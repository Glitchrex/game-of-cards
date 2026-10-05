import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { connect, type DbHandle } from './db/client';
import { createRepository } from './repo';
import { startPgliteServer, type PgliteServer } from './test-utils/pglite-server';
import { describeRepository } from './test-utils/repository-suite';

// The PRODUCTION Postgres path, end to end: connect() with a postgres:// URL →
// postgres-js pool (10 connections, no app-side mutex) → drizzle-orm/postgres-js
// → drizzle/pg migrations → the shared repository. PGlite speaks the wire
// protocol through test-utils/pglite-server.ts.
describeRepository('Postgres (postgres-js pool via connect(), PGlite over TCP)', async () => {
  const server = await startPgliteServer();
  const handle = await connect({ dialect: 'postgres', url: server.url });
  return {
    handle,
    cleanup: async () => {
      await handle.close();
      await server.close();
    },
  };
});

describe('connect() on Postgres', () => {
  let server: PgliteServer;
  const handles: DbHandle[] = [];

  beforeAll(async () => {
    server = await startPgliteServer();
  });
  afterAll(async () => {
    await Promise.all(handles.map((h) => h.close()));
    await server.close();
  });

  it('survives several processes migrating a fresh database at once', async () => {
    const config = { dialect: 'postgres' as const, url: server.url };
    const results = await Promise.allSettled([connect(config), connect(config), connect(config)]);
    for (const result of results) if (result.status === 'fulfilled') handles.push(result.value);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);

    const applied = await server.db.query<{ n: number }>(
      'select count(*)::int as n from drizzle.__drizzle_migrations',
    );
    expect(applied.rows[0]?.n).toBe(1);

    // Every handle works against the one migrated schema.
    const [first, second] = handles;
    const post = await createRepository(first!).createPost({
      type: 'general',
      title: 'Hello from handle one',
      body: 'Written through the first pool, read through the second.',
      ipHash: 'h',
    });
    const found = await createRepository(second!).getPost(post.id);
    expect(found?.post.title).toBe('Hello from handle one');
  });

  it('decodes counts and averages from the postgres-js driver as numbers', async () => {
    const handle = handles[0]!;
    const repo = createRepository(handle);
    await repo.createRating({ gameSlug: 'go-fish', stars: 5, ipHash: 'h' });
    await repo.createRating({ gameSlug: 'go-fish', stars: 4, ipHash: 'h' });
    const { ratingSummary, messages } = await repo.overview();
    expect(ratingSummary).toEqual([{ gameSlug: 'go-fish', count: 2, average: 4.5 }]);
    expect(messages).toEqual([]);
    expect(typeof (await repo.countPosts())).toBe('number');
    const fks = await server.db.query<{ n: number }>(
      "select count(*)::int as n from pg_constraint where contype = 'f'",
    );
    expect(fks.rows[0]?.n).toBe(2); // comments.post_id and votes.post_id
  });
});
