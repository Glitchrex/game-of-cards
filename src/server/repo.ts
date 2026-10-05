/**
 * Data access for the Community Board, contact messages, lesson ratings and
 * the admin view. Written ONCE for both dialects: `createRepository(handle)`
 * only uses the query-builder subset shared by Drizzle's SQLite and Postgres
 * builders (see `createDbHandle` in ./db/client.ts for the single cast).
 *
 * Public functions never return `author_email` or `ip_hash`; only the admin
 * functions (`overview`, `setPostStatus`) expose the author email.
 *
 * Counter consistency: vote/comment mutations run in a transaction that first
 * "touches" the parent post row (a no-op UPDATE). That proves the post exists
 * and, on Postgres, takes the row lock, so concurrent toggles/comments/deletes
 * on the same post serialise; the counter is then recomputed from the child
 * table inside the same transaction, so it can never drift.
 */
import { and, asc, count, desc, eq, inArray, sql, type SQL } from 'drizzle-orm';
import type {
  AdminComment,
  AdminOverview,
  AdminPost,
  Comment,
  ContactMessage,
  Post,
  PostSort,
  PostStatus,
  PostType,
  Rating,
  RatingSummary,
  VoteResult,
} from '@/lib/api-client';
import { getDb, type AppDatabase, type AppSchema, type DbHandle } from './db/client';

/** Max posts returned by `listPosts`. */
export const MAX_LIST_POSTS = 100;
/** Max rows per list in the admin overview (newest first). */
export const MAX_ADMIN_ROWS = 1000;

export interface ListPostsOptions {
  sort?: PostSort;
  type?: PostType;
  voterToken?: string | null;
  /** 1–100, default 100. */
  limit?: number;
}

export interface NewPost {
  type: PostType;
  title: string;
  body: string;
  authorName?: string | null;
  authorEmail?: string | null;
  ipHash: string;
}

export interface NewComment {
  body: string;
  authorName?: string | null;
  ipHash: string;
}

export interface NewContactMessage {
  name: string;
  email: string;
  message: string;
  ipHash: string;
}

export interface NewRating {
  gameSlug: string;
  stars: number;
  comment?: string | null;
  ipHash: string;
}

export interface PostWithComments {
  post: Post;
  comments: Comment[];
}

export interface Repository {
  listPosts(options?: ListPostsOptions): Promise<Post[]>;
  createPost(input: NewPost): Promise<Post>;
  getPost(id: number, voterToken?: string | null): Promise<PostWithComments | null>;
  /** Adds the voter's upvote, or removes it if present. `null` when the post doesn't exist. */
  toggleVote(postId: number, voterToken: string, ipHash: string): Promise<VoteResult | null>;
  /** `null` when the post doesn't exist. */
  addComment(postId: number, input: NewComment): Promise<Comment | null>;
  createContactMessage(input: NewContactMessage): Promise<{ id: number }>;
  createRating(input: NewRating): Promise<{ id: number }>;
  countPosts(): Promise<number>;
  overview(): Promise<AdminOverview>;
  setPostStatus(id: number, status: PostStatus): Promise<AdminPost | null>;
  /** Deletes the post plus its comments and votes (FK cascade). False if missing. */
  deletePost(id: number): Promise<boolean>;
  deleteComment(id: number): Promise<boolean>;
  setMessageRead(id: number, read: boolean): Promise<boolean>;
  deleteMessage(id: number): Promise<boolean>;
}

export interface RepositoryOptions {
  /** Clock for `created_at` (tests and the seed script stagger timestamps with it). */
  now?: () => Date;
}

/** Transaction handle type; identical query API to the database itself. */
type Tx = Parameters<Parameters<AppDatabase['transaction']>[0]>[0];
type Queryable = AppDatabase | Tx;

export function createRepository(handle: DbHandle, options: RepositoryOptions = {}): Repository {
  const { db, schema } = handle;
  const { posts, comments, votes, contactMessages, lessonRatings }: AppSchema = schema;
  const timestamp = () => (options.now?.() ?? new Date()).toISOString();

  const postColumns = {
    id: posts.id,
    type: posts.type,
    title: posts.title,
    body: posts.body,
    authorName: posts.authorName,
    status: posts.status,
    upvotes: posts.upvotes,
    commentCount: posts.commentCount,
    createdAt: posts.createdAt,
  };
  const adminPostColumns = { ...postColumns, authorEmail: posts.authorEmail };
  const commentColumns = {
    id: comments.id,
    postId: comments.postId,
    body: comments.body,
    authorName: comments.authorName,
    createdAt: comments.createdAt,
  };
  const messageColumns = {
    id: contactMessages.id,
    name: contactMessages.name,
    email: contactMessages.email,
    message: contactMessages.message,
    read: contactMessages.read,
    createdAt: contactMessages.createdAt,
  };
  const ratingColumns = {
    id: lessonRatings.id,
    gameSlug: lessonRatings.gameSlug,
    stars: lessonRatings.stars,
    comment: lessonRatings.comment,
    createdAt: lessonRatings.createdAt,
  };

  /** No-op UPDATE: existence check + Postgres row lock for the rest of the transaction. */
  async function touchPost(tx: Queryable, postId: number): Promise<boolean> {
    const rows = await tx
      .update(posts)
      .set({ upvotes: sql`${posts.upvotes}` })
      .where(eq(posts.id, postId))
      .returning({ id: posts.id });
    return rows.length > 0;
  }

  async function recountVotes(tx: Queryable, postId: number): Promise<number> {
    const [row] = await tx
      .update(posts)
      .set({
        upvotes: sql`(select count(*) from ${votes} where ${votes.postId} = ${posts.id})`,
      })
      .where(eq(posts.id, postId))
      .returning({ upvotes: posts.upvotes });
    return row?.upvotes ?? 0;
  }

  async function recountComments(tx: Queryable, postId: number): Promise<void> {
    await tx
      .update(posts)
      .set({
        commentCount: sql`(select count(*) from ${comments} where ${comments.postId} = ${posts.id})`,
      })
      .where(eq(posts.id, postId));
  }

  async function votedPostIds(postIds: number[], voterToken: string): Promise<Set<number>> {
    if (postIds.length === 0) return new Set();
    const rows = await db
      .select({ postId: votes.postId })
      .from(votes)
      .where(and(eq(votes.voterToken, voterToken), inArray(votes.postId, postIds)));
    return new Set(rows.map((r) => r.postId));
  }

  async function withVoteFlags(rows: Post[], voterToken?: string | null): Promise<Post[]> {
    if (!voterToken) return rows;
    const voted = await votedPostIds(
      rows.map((r) => r.id),
      voterToken,
    );
    return rows.map((r) => ({ ...r, hasVoted: voted.has(r.id) }));
  }

  const repo: Repository = {
    async listPosts({ sort = 'new', type, voterToken, limit = MAX_LIST_POSTS } = {}) {
      const order: SQL[] =
        sort === 'top'
          ? [desc(posts.upvotes), desc(posts.createdAt), desc(posts.id)]
          : [desc(posts.createdAt), desc(posts.id)];
      const rows = await db
        .select(postColumns)
        .from(posts)
        .where(type ? eq(posts.type, type) : undefined)
        .orderBy(...order)
        .limit(
          Number.isFinite(limit)
            ? Math.max(1, Math.min(MAX_LIST_POSTS, Math.floor(limit)))
            : MAX_LIST_POSTS,
        );
      return withVoteFlags(rows, voterToken);
    },

    async createPost(input) {
      const [row] = await db
        .insert(posts)
        .values({
          type: input.type,
          title: input.title,
          body: input.body,
          authorName: input.authorName ?? null,
          authorEmail: input.authorEmail ?? null,
          ipHash: input.ipHash,
          createdAt: timestamp(),
        })
        .returning(postColumns);
      if (!row) throw new Error('Insert into posts returned no row');
      return row;
    },

    async getPost(id, voterToken) {
      const [row] = await db.select(postColumns).from(posts).where(eq(posts.id, id));
      if (!row) return null;
      const [post] = await withVoteFlags([row], voterToken);
      const list = await db
        .select(commentColumns)
        .from(comments)
        .where(eq(comments.postId, id))
        .orderBy(asc(comments.createdAt), asc(comments.id));
      return { post: post ?? row, comments: list };
    },

    toggleVote(postId, voterToken, ipHash) {
      return db.transaction(async (tx) => {
        if (!(await touchPost(tx, postId))) return null;
        const removed = await tx
          .delete(votes)
          .where(and(eq(votes.postId, postId), eq(votes.voterToken, voterToken)))
          .returning({ id: votes.id });
        const hasVoted = removed.length === 0;
        if (hasVoted) {
          await tx
            .insert(votes)
            .values({ postId, voterToken, ipHash, createdAt: timestamp() })
            .onConflictDoNothing({ target: [votes.postId, votes.voterToken] });
        }
        const upvotes = await recountVotes(tx, postId);
        return { upvotes, hasVoted };
      });
    },

    addComment(postId, input) {
      return db.transaction(async (tx) => {
        if (!(await touchPost(tx, postId))) return null;
        const [row] = await tx
          .insert(comments)
          .values({
            postId,
            body: input.body,
            authorName: input.authorName ?? null,
            ipHash: input.ipHash,
            createdAt: timestamp(),
          })
          .returning(commentColumns);
        if (!row) throw new Error('Insert into comments returned no row');
        await recountComments(tx, postId);
        return row;
      });
    },

    async createContactMessage(input) {
      const [row] = await db
        .insert(contactMessages)
        .values({
          name: input.name,
          email: input.email,
          message: input.message,
          ipHash: input.ipHash,
          read: false,
          createdAt: timestamp(),
        })
        .returning({ id: contactMessages.id });
      if (!row) throw new Error('Insert into contact_messages returned no row');
      return row;
    },

    async createRating(input) {
      const [row] = await db
        .insert(lessonRatings)
        .values({
          gameSlug: input.gameSlug,
          stars: input.stars,
          comment: input.comment ?? null,
          ipHash: input.ipHash,
          createdAt: timestamp(),
        })
        .returning({ id: lessonRatings.id });
      if (!row) throw new Error('Insert into lesson_ratings returned no row');
      return row;
    },

    async countPosts() {
      const [row] = await db.select({ n: count() }).from(posts);
      return row?.n ?? 0;
    },

    async overview() {
      const postRows: AdminPost[] = await db
        .select(adminPostColumns)
        .from(posts)
        .orderBy(desc(posts.createdAt), desc(posts.id))
        .limit(MAX_ADMIN_ROWS);
      const commentRows: AdminComment[] = await db
        .select({ ...commentColumns, postTitle: posts.title })
        .from(comments)
        .innerJoin(posts, eq(comments.postId, posts.id))
        .orderBy(desc(comments.createdAt), desc(comments.id))
        .limit(MAX_ADMIN_ROWS);
      const messages: ContactMessage[] = await db
        .select(messageColumns)
        .from(contactMessages)
        .orderBy(desc(contactMessages.createdAt), desc(contactMessages.id))
        .limit(MAX_ADMIN_ROWS);
      const ratings: Rating[] = await db
        .select(ratingColumns)
        .from(lessonRatings)
        .orderBy(desc(lessonRatings.createdAt), desc(lessonRatings.id))
        .limit(MAX_ADMIN_ROWS);
      const summaryRows = await db
        .select({
          gameSlug: lessonRatings.gameSlug,
          count: count(),
          // avg() is REAL in SQLite and NUMERIC (a string) in Postgres.
          average: sql<number>`avg(${lessonRatings.stars})`.mapWith(Number),
        })
        .from(lessonRatings)
        .groupBy(lessonRatings.gameSlug)
        .orderBy(asc(lessonRatings.gameSlug));
      const ratingSummary: RatingSummary[] = summaryRows.map((r) => ({
        gameSlug: r.gameSlug,
        count: r.count,
        average: Math.round(r.average * 100) / 100,
      }));
      return { posts: postRows, comments: commentRows, messages, ratings, ratingSummary };
    },

    async setPostStatus(id, status) {
      const [row] = await db
        .update(posts)
        .set({ status })
        .where(eq(posts.id, id))
        .returning(adminPostColumns);
      return row ?? null;
    },

    async deletePost(id) {
      const rows = await db.delete(posts).where(eq(posts.id, id)).returning({ id: posts.id });
      return rows.length > 0;
    },

    async deleteComment(id) {
      const [target] = await db
        .select({ postId: comments.postId })
        .from(comments)
        .where(eq(comments.id, id));
      if (!target) return false;
      return db.transaction(async (tx) => {
        // Lock order post → comment, the same as addComment and deletePost's cascade.
        await touchPost(tx, target.postId);
        const removed = await tx
          .delete(comments)
          .where(eq(comments.id, id))
          .returning({ id: comments.id });
        await recountComments(tx, target.postId);
        return removed.length > 0;
      });
    },

    async setMessageRead(id, read) {
      const rows = await db
        .update(contactMessages)
        .set({ read })
        .where(eq(contactMessages.id, id))
        .returning({ id: contactMessages.id });
      return rows.length > 0;
    },

    async deleteMessage(id) {
      const rows = await db
        .delete(contactMessages)
        .where(eq(contactMessages.id, id))
        .returning({ id: contactMessages.id });
      return rows.length > 0;
    },
  };

  // Every public operation runs through the handle's `exclusive` gate (a mutex
  // for single-connection SQLite/PGlite, a pass-through for pooled Postgres).
  // Methods above never call each other, so the gate can't deadlock.
  const gated = {} as Repository;
  for (const key of Object.keys(repo) as (keyof Repository)[]) {
    const fn = repo[key] as (...args: unknown[]) => Promise<unknown>;
    (gated as unknown as Record<string, unknown>)[key] = (...args: unknown[]) =>
      handle.exclusive(() => fn(...args));
  }
  return gated;
}

/* ------------------------------------------------- default (env) repository */

const repositories = new WeakMap<DbHandle, Repository>();

/** Repository bound to the connection selected by DATABASE_URL (lazily migrated). */
export async function getRepository(): Promise<Repository> {
  const handle = await getDb();
  let repo = repositories.get(handle);
  if (!repo) {
    repo = createRepository(handle);
    repositories.set(handle, repo);
  }
  return repo;
}

export async function listPosts(options?: ListPostsOptions): Promise<Post[]> {
  return (await getRepository()).listPosts(options);
}
export async function createPost(input: NewPost): Promise<Post> {
  return (await getRepository()).createPost(input);
}
export async function getPost(
  id: number,
  voterToken?: string | null,
): Promise<PostWithComments | null> {
  return (await getRepository()).getPost(id, voterToken);
}
export async function toggleVote(
  postId: number,
  voterToken: string,
  ipHash: string,
): Promise<VoteResult | null> {
  return (await getRepository()).toggleVote(postId, voterToken, ipHash);
}
export async function addComment(postId: number, input: NewComment): Promise<Comment | null> {
  return (await getRepository()).addComment(postId, input);
}
export async function createContactMessage(input: NewContactMessage): Promise<{ id: number }> {
  return (await getRepository()).createContactMessage(input);
}
export async function createRating(input: NewRating): Promise<{ id: number }> {
  return (await getRepository()).createRating(input);
}
export async function countPosts(): Promise<number> {
  return (await getRepository()).countPosts();
}
export async function overview(): Promise<AdminOverview> {
  return (await getRepository()).overview();
}
export async function setPostStatus(id: number, status: PostStatus): Promise<AdminPost | null> {
  return (await getRepository()).setPostStatus(id, status);
}
export async function deletePost(id: number): Promise<boolean> {
  return (await getRepository()).deletePost(id);
}
export async function deleteComment(id: number): Promise<boolean> {
  return (await getRepository()).deleteComment(id);
}
export async function setMessageRead(id: number, read: boolean): Promise<boolean> {
  return (await getRepository()).setMessageRead(id, read);
}
export async function deleteMessage(id: number): Promise<boolean> {
  return (await getRepository()).deleteMessage(id);
}
