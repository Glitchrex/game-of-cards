import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, type DbHandle } from './db/client';
import { createRepository } from './repo';
import { SAMPLE_POSTS, seedSampleData } from './seed';

describe('seedSampleData', () => {
  let dir = '';
  let handle: DbHandle;

  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'goc-seed-'));
    handle = await connect({ dialect: 'sqlite', url: `file:${path.join(dir, 'seed.db')}` });
  });
  afterAll(async () => {
    await handle.close();
    await rm(dir, { recursive: true, force: true });
  });

  it('inserts varied sample posts with consistent counts', async () => {
    const result = await seedSampleData(handle, new Date('2026-10-01T12:00:00.000Z'));
    expect(result).toEqual({
      seeded: true,
      posts: SAMPLE_POSTS.length,
      comments: SAMPLE_POSTS.reduce((n, p) => n + p.comments.length, 0),
      votes: SAMPLE_POSTS.reduce((n, p) => n + p.votes, 0),
    });
    const repo = createRepository(handle);
    const posts = await repo.listPosts();
    expect(posts).toHaveLength(SAMPLE_POSTS.length);
    expect(new Set(posts.map((p) => p.type)).size).toBe(4);
    expect(new Set(posts.map((p) => p.status)).size).toBe(4);
    for (const sample of SAMPLE_POSTS) {
      const post = posts.find((p) => p.title === sample.title);
      expect(post).toMatchObject({
        status: sample.status,
        upvotes: sample.votes,
        commentCount: sample.comments.length,
      });
    }
    // Newest first matches the staggered timestamps.
    expect(posts[0]?.title).toBe(SAMPLE_POSTS[SAMPLE_POSTS.length - 1]?.title);
    expect((await repo.listPosts({ sort: 'top' }))[0]?.title).toBe(SAMPLE_POSTS[0]?.title);
  });

  it('is idempotent: does nothing when posts already exist', async () => {
    expect(await seedSampleData(handle)).toEqual({
      seeded: false,
      posts: 0,
      comments: 0,
      votes: 0,
    });
    expect(await createRepository(handle).countPosts()).toBe(SAMPLE_POSTS.length);
  });
});
