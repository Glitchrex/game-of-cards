/**
 * Postgres schema. MUST stay identical in table names, column names,
 * nullability and defaults to `schema.sqlite.ts` — `schema.test.ts` enforces it.
 * See that file for the shared conventions (ISO-string timestamps, hashed IPs,
 * cascading deletes).
 *
 * After editing, run `npm run db:generate` to create migrations for BOTH dialects.
 */
import { sql } from 'drizzle-orm';
import { boolean, check, index, integer, pgTable, text, unique } from 'drizzle-orm/pg-core';
import { POST_STATUSES, POST_TYPES } from '../../lib/api-client';

const createdAt = () =>
  text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString());

export const posts = pgTable(
  'posts',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    type: text('type', { enum: POST_TYPES }).notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    authorName: text('author_name'),
    authorEmail: text('author_email'),
    status: text('status', { enum: POST_STATUSES }).notNull().default('open'),
    upvotes: integer('upvotes').notNull().default(0),
    commentCount: integer('comment_count').notNull().default(0),
    ipHash: text('ip_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('posts_created_at_idx').on(t.createdAt),
    index('posts_upvotes_idx').on(t.upvotes),
    index('posts_type_idx').on(t.type),
  ],
);

export const comments = pgTable(
  'comments',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    body: text('body').notNull(),
    authorName: text('author_name'),
    ipHash: text('ip_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('comments_post_id_idx').on(t.postId)],
);

export const votes = pgTable(
  'votes',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    voterToken: text('voter_token').notNull(),
    ipHash: text('ip_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('votes_post_id_voter_token_unique').on(t.postId, t.voterToken)],
);

export const contactMessages = pgTable('contact_messages', {
  id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  ipHash: text('ip_hash').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: createdAt(),
});

export const lessonRatings = pgTable(
  'lesson_ratings',
  {
    id: integer('id').primaryKey().generatedByDefaultAsIdentity(),
    gameSlug: text('game_slug').notNull(),
    stars: integer('stars').notNull(),
    comment: text('comment'),
    ipHash: text('ip_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('lesson_ratings_game_slug_idx').on(t.gameSlug),
    check('lesson_ratings_stars_check', sql`${t.stars} >= 1 AND ${t.stars} <= 5`),
  ],
);
