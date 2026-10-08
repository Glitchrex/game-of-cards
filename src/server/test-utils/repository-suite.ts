/**
 * Shared repository contract tests, run against every dialect
 * (repo.sqlite.test.ts → SQLite file, repo.pglite.test.ts → in-process Postgres).
 */
import { count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { DbHandle } from '../db/client';
import { createRepository, MAX_LIST_POSTS, type NewPost, type Repository } from '../repo';

export interface OpenedDatabase {
  handle: DbHandle;
  cleanup: () => Promise<void>;
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

export function describeRepository(label: string, open: () => Promise<OpenedDatabase>): void {
  describe(`repository on ${label}`, () => {
    let opened: OpenedDatabase;
    let repo: Repository;
    let clock = Date.parse('2026-01-01T00:00:00.000Z');

    const newPost = (overrides: Partial<NewPost> = {}): NewPost => ({
      type: 'feature',
      title: 'Add a dark mode',
      body: 'The felt is lovely but my eyes would love a darker theme at night.',
      authorName: 'Asha',
      authorEmail: 'asha@example.com',
      ipHash: 'hash-1',
      ...overrides,
    });

    async function tableCount(table: 'posts' | 'comments' | 'votes'): Promise<number> {
      const { db, schema } = opened.handle;
      const [row] = await db.select({ n: count() }).from(schema[table]);
      return row?.n ?? 0;
    }

    async function clearAll(): Promise<void> {
      const { db, schema } = opened.handle;
      await db.delete(schema.votes);
      await db.delete(schema.comments);
      await db.delete(schema.posts);
      await db.delete(schema.contactMessages);
      await db.delete(schema.lessonRatings);
    }

    beforeAll(async () => {
      opened = await open();
      repo = createRepository(opened.handle, {
        now: () => new Date((clock += 1_000)),
      });
    });

    afterAll(async () => {
      await opened?.cleanup();
    });

    beforeEach(clearAll);

    it('creates a post and never exposes the email or IP hash publicly', async () => {
      const post = await repo.createPost(newPost());
      expect(post).toEqual({
        id: expect.any(Number),
        type: 'feature',
        title: 'Add a dark mode',
        body: 'The felt is lovely but my eyes would love a darker theme at night.',
        authorName: 'Asha',
        status: 'open',
        upvotes: 0,
        commentCount: 0,
        createdAt: expect.stringMatching(ISO),
      });
      const [listed] = await repo.listPosts();
      const found = await repo.getPost(post.id);
      for (const value of [post, listed, found?.post]) {
        expect(value).not.toHaveProperty('authorEmail');
        expect(value).not.toHaveProperty('ipHash');
      }
    });

    it('stores missing optional author fields as null', async () => {
      const post = await repo.createPost(
        newPost({ authorName: undefined, authorEmail: null, type: 'general' }),
      );
      expect(post.authorName).toBeNull();
      const { posts } = await repo.overview();
      expect(posts[0]?.authorEmail).toBeNull();
    });

    it('sorts by newest and by most upvoted, and filters by type', async () => {
      const a = await repo.createPost(newPost({ title: 'Oldest bug', type: 'bug' }));
      const b = await repo.createPost(newPost({ title: 'Middle game', type: 'game' }));
      const c = await repo.createPost(newPost({ title: 'Newest bug', type: 'bug' }));
      await repo.toggleVote(b.id, 'voter-aaaa-1', 'h');
      await repo.toggleVote(b.id, 'voter-aaaa-2', 'h');
      await repo.toggleVote(a.id, 'voter-aaaa-1', 'h');

      expect((await repo.listPosts()).map((p) => p.id)).toEqual([c.id, b.id, a.id]);
      expect((await repo.listPosts({ sort: 'new' })).map((p) => p.id)).toEqual([c.id, b.id, a.id]);
      expect((await repo.listPosts({ sort: 'top' })).map((p) => p.id)).toEqual([b.id, a.id, c.id]);
      expect((await repo.listPosts({ type: 'bug' })).map((p) => p.id)).toEqual([c.id, a.id]);
      expect((await repo.listPosts({ type: 'bug', sort: 'top' })).map((p) => p.id)).toEqual([
        a.id,
        c.id,
      ]);
      expect(await repo.listPosts({ type: 'feature' })).toEqual([]);
    });

    it('breaks upvote ties by newest first', async () => {
      const older = await repo.createPost(newPost({ title: 'Older' }));
      const newer = await repo.createPost(newPost({ title: 'Newer' }));
      expect((await repo.listPosts({ sort: 'top' })).map((p) => p.id)).toEqual([
        newer.id,
        older.id,
      ]);
    });

    it('caps the list at 100 posts', async () => {
      for (let i = 0; i < MAX_LIST_POSTS + 3; i++) {
        await repo.createPost(newPost({ title: `Post number ${i}` }));
      }
      expect(await repo.listPosts()).toHaveLength(MAX_LIST_POSTS);
      expect(await repo.listPosts({ limit: 5 })).toHaveLength(5);
      expect(await repo.countPosts()).toBe(MAX_LIST_POSTS + 3);
    });

    it('adds hasVoted only when a voter token is supplied', async () => {
      const voted = await repo.createPost(newPost({ title: 'Voted' }));
      await repo.createPost(newPost({ title: 'Not voted' }));
      await repo.toggleVote(voted.id, 'my-token-123', 'h');

      const anonymous = await repo.listPosts();
      expect(anonymous.every((p) => !('hasVoted' in p))).toBe(true);

      const mine = await repo.listPosts({ voterToken: 'my-token-123' });
      expect(Object.fromEntries(mine.map((p) => [p.title, p.hasVoted]))).toEqual({
        Voted: true,
        'Not voted': false,
      });

      expect((await repo.getPost(voted.id, 'my-token-123'))?.post.hasVoted).toBe(true);
      expect((await repo.getPost(voted.id, 'other-token-1'))?.post.hasVoted).toBe(false);
      expect((await repo.getPost(voted.id))?.post).not.toHaveProperty('hasVoted');
    });

    it('toggles votes, one per voter token', async () => {
      const post = await repo.createPost(newPost());
      expect(await repo.toggleVote(post.id, 'token-aaaa', 'h1')).toEqual({
        upvotes: 1,
        hasVoted: true,
      });
      expect(await repo.toggleVote(post.id, 'token-bbbb', 'h1')).toEqual({
        upvotes: 2,
        hasVoted: true,
      });
      expect(await repo.toggleVote(post.id, 'token-aaaa', 'h1')).toEqual({
        upvotes: 1,
        hasVoted: false,
      });
      expect(await repo.toggleVote(post.id, 'token-aaaa', 'h1')).toEqual({
        upvotes: 2,
        hasVoted: true,
      });
      expect((await repo.getPost(post.id))?.post.upvotes).toBe(2);
      expect(await tableCount('votes')).toBe(2);
      expect(await repo.toggleVote(999_999, 'token-aaaa', 'h1')).toBeNull();
    });

    it('enforces UNIQUE(post_id, voter_token) in the database', async () => {
      const post = await repo.createPost(newPost());
      const { db, schema } = opened.handle;
      const row = { postId: post.id, voterToken: 'dup-token', ipHash: 'h', createdAt: 'x' };
      await db.insert(schema.votes).values(row);
      await expect(db.insert(schema.votes).values(row)).rejects.toThrow();
    });

    it('keeps counts consistent under concurrent requests', async () => {
      const post = await repo.createPost(newPost());
      await Promise.all(
        Array.from({ length: 20 }, (_, i) => repo.toggleVote(post.id, `concurrent-${i}`, 'h')),
      );
      // The same token toggled 5 times at once ends up voted (odd number of toggles).
      const same = await Promise.all(
        Array.from({ length: 5 }, () => repo.toggleVote(post.id, 'same-token', 'h')),
      );
      expect(same.filter((r) => r?.hasVoted).length).toBe(3);
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          repo.addComment(post.id, { body: `Comment ${i}`, ipHash: 'h' }),
        ),
      );
      const found = await repo.getPost(post.id);
      expect(found?.post.upvotes).toBe(21);
      expect(await tableCount('votes')).toBe(21);
      expect(found?.post.commentCount).toBe(10);
      expect(found?.comments).toHaveLength(10);
    });

    it('adds comments in order and keeps comment_count in sync', async () => {
      const post = await repo.createPost(newPost());
      const first = await repo.addComment(post.id, {
        body: 'Yes please!',
        authorName: 'Ravi',
        ipHash: 'h',
      });
      const second = await repo.addComment(post.id, { body: 'Me too', ipHash: 'h' });
      expect(first).toEqual({
        id: expect.any(Number),
        postId: post.id,
        body: 'Yes please!',
        authorName: 'Ravi',
        createdAt: expect.stringMatching(ISO),
      });
      expect(second?.authorName).toBeNull();
      expect(first).not.toHaveProperty('ipHash');

      let found = await repo.getPost(post.id);
      expect(found?.post.commentCount).toBe(2);
      expect(found?.comments.map((c) => c.body)).toEqual(['Yes please!', 'Me too']);

      expect(await repo.deleteComment(first!.id)).toBe(true);
      expect(await repo.deleteComment(first!.id)).toBe(false);
      found = await repo.getPost(post.id);
      expect(found?.post.commentCount).toBe(1);
      expect(found?.comments.map((c) => c.body)).toEqual(['Me too']);

      expect(await repo.addComment(999_999, { body: 'Nope', ipHash: 'h' })).toBeNull();
      expect(await repo.getPost(999_999)).toBeNull();
    });

    it('enforces the posts foreign key', async () => {
      const { db, schema } = opened.handle;
      await expect(
        db
          .insert(schema.comments)
          .values({ postId: 424_242, body: 'orphan', ipHash: 'h', createdAt: 'x' }),
      ).rejects.toThrow();
    });

    it('cascades comments and votes when a post is deleted', async () => {
      const keep = await repo.createPost(newPost({ title: 'Keep me' }));
      const doomed = await repo.createPost(newPost({ title: 'Delete me' }));
      await repo.addComment(doomed.id, { body: 'Bye', ipHash: 'h' });
      await repo.addComment(keep.id, { body: 'Stay', ipHash: 'h' });
      await repo.toggleVote(doomed.id, 'voter-cascade', 'h');
      await repo.toggleVote(keep.id, 'voter-cascade', 'h');

      expect(await repo.deletePost(doomed.id)).toBe(true);
      expect(await repo.deletePost(doomed.id)).toBe(false);
      expect(await repo.getPost(doomed.id)).toBeNull();

      const { db, schema } = opened.handle;
      expect(
        await db.select().from(schema.comments).where(eq(schema.comments.postId, doomed.id)),
      ).toEqual([]);
      expect(
        await db.select().from(schema.votes).where(eq(schema.votes.postId, doomed.id)),
      ).toEqual([]);
      expect(await tableCount('comments')).toBe(1);
      expect(await tableCount('votes')).toBe(1);
    });

    it('changes a post status and returns the admin view', async () => {
      const post = await repo.createPost(newPost());
      const updated = await repo.setPostStatus(post.id, 'in-progress');
      expect(updated).toMatchObject({
        id: post.id,
        status: 'in-progress',
        authorEmail: 'asha@example.com',
      });
      expect(updated).not.toHaveProperty('ipHash');
      expect((await repo.getPost(post.id))?.post.status).toBe('in-progress');
      expect(await repo.setPostStatus(999_999, 'done')).toBeNull();
    });

    it('stores contact messages and lets admin mark them read and delete them', async () => {
      const { id } = await repo.createContactMessage({
        name: 'Meera',
        email: 'meera@example.com',
        message: 'Loved the Teen Patti lesson!',
        ipHash: 'h',
      });
      let { messages } = await repo.overview();
      expect(messages).toEqual([
        {
          id,
          name: 'Meera',
          email: 'meera@example.com',
          message: 'Loved the Teen Patti lesson!',
          read: false,
          createdAt: expect.stringMatching(ISO),
        },
      ]);
      expect(await repo.setMessageRead(id, true)).toBe(true);
      ({ messages } = await repo.overview());
      expect(messages[0]?.read).toBe(true);
      expect(await repo.setMessageRead(id, false)).toBe(true);
      ({ messages } = await repo.overview());
      expect(messages[0]?.read).toBe(false);
      expect(await repo.setMessageRead(999_999, true)).toBe(false);
      expect(await repo.deleteMessage(id)).toBe(true);
      expect(await repo.deleteMessage(id)).toBe(false);
      expect((await repo.overview()).messages).toEqual([]);
    });

    it('stores ratings and summarises them per game', async () => {
      await repo.createRating({ gameSlug: 'blackjack', stars: 5, comment: 'Great', ipHash: 'h' });
      await repo.createRating({ gameSlug: 'blackjack', stars: 4, ipHash: 'h' });
      await repo.createRating({ gameSlug: 'blackjack', stars: 4, ipHash: 'h' });
      await repo.createRating({ gameSlug: 'hearts', stars: 3, comment: null, ipHash: 'h' });
      const { ratings, ratingSummary } = await repo.overview();
      expect(ratings).toHaveLength(4);
      expect(ratings[0]).toEqual({
        id: expect.any(Number),
        gameSlug: 'hearts',
        stars: 3,
        comment: null,
        createdAt: expect.stringMatching(ISO),
      });
      expect(ratings.find((r) => r.comment === 'Great')?.stars).toBe(5);
      expect(ratingSummary).toEqual([
        { gameSlug: 'blackjack', count: 3, average: 4.33 },
        { gameSlug: 'hearts', count: 1, average: 3 },
      ]);
    });

    it('rejects out-of-range stars at the database level too', async () => {
      await expect(repo.createRating({ gameSlug: 'war', stars: 9, ipHash: 'h' })).rejects.toThrow();
    });

    it('builds the admin overview with emails and post titles', async () => {
      const post = await repo.createPost(newPost({ title: 'Add Bluff' }));
      await repo.addComment(post.id, { body: 'Seconded', ipHash: 'h' });
      const data = await repo.overview();
      expect(data.posts).toEqual([
        expect.objectContaining({ id: post.id, authorEmail: 'asha@example.com', commentCount: 1 }),
      ]);
      expect(data.comments).toEqual([
        expect.objectContaining({ postId: post.id, body: 'Seconded', postTitle: 'Add Bluff' }),
      ]);
      for (const row of [...data.posts, ...data.comments, ...data.messages, ...data.ratings]) {
        expect(row).not.toHaveProperty('ipHash');
      }
    });
  });
}
