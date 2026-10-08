/**
 * SQLite schema (libsql). MUST stay identical in table names, column names,
 * nullability and defaults to `schema.pg.ts` — `schema.test.ts` enforces it.
 *
 * Conventions shared by both dialects:
 * - Primary keys are auto-incrementing integers.
 * - Timestamps are ISO 8601 UTC strings (`Date#toISOString()`, fixed width),
 *   stored as TEXT. They sort chronologically as plain strings in both dialects.
 * - IPs are never stored raw: `ip_hash` holds a salted SHA-256 (see security.ts).
 * - Child rows cascade on post deletion (SQLite needs `PRAGMA foreign_keys = ON`,
 *   which `client.ts` sets on the connection).
 *
 * After editing, run `npm run db:generate` to create migrations for BOTH dialects.
 */
import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { POST_STATUSES, POST_TYPES } from '../../lib/api-client';

const createdAt = () =>
  text('created_at')
    .notNull()
    .$defaultFn(() => new Date().toISOString());

export const posts = sqliteTable(
  'posts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
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

export const comments = sqliteTable(
  'comments',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
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

export const votes = sqliteTable(
  'votes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    voterToken: text('voter_token').notNull(),
    ipHash: text('ip_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique('votes_post_id_voter_token_unique').on(t.postId, t.voterToken)],
);

export const contactMessages = sqliteTable('contact_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  message: text('message').notNull(),
  ipHash: text('ip_hash').notNull(),
  read: integer('read', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAt(),
});

export const lessonRatings = sqliteTable(
  'lesson_ratings',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
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
