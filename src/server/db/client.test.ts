import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeDb,
  connect,
  DEFAULT_SQLITE_URL,
  getDb,
  MIGRATION_ATTEMPTS,
  migrateWithRetry,
  migrationsFolder,
  resolveDatabaseConfig,
  sqliteFilePath,
} from './client';
import { createRepository } from '../repo';

describe('resolveDatabaseConfig', () => {
  it('defaults to the local SQLite file', () => {
    expect(resolveDatabaseConfig(undefined)).toEqual({
      dialect: 'sqlite',
      url: DEFAULT_SQLITE_URL,
    });
    expect(resolveDatabaseConfig('  ')).toEqual({ dialect: 'sqlite', url: DEFAULT_SQLITE_URL });
    expect(DEFAULT_SQLITE_URL).toBe('file:./data/dev.db');
  });

  it('maps file: to SQLite and postgres(ql):// to Postgres', () => {
    expect(resolveDatabaseConfig('file:/tmp/x.db')).toEqual({
      dialect: 'sqlite',
      url: 'file:/tmp/x.db',
    });
    expect(resolveDatabaseConfig('postgres://u:p@h:5432/db').dialect).toBe('postgres');
    expect(resolveDatabaseConfig('postgresql://u:p@h/db').dialect).toBe('postgres');
  });

  it('throws a helpful error for anything else', () => {
    expect(() => resolveDatabaseConfig('mysql://h/db')).toThrow(/Unsupported DATABASE_URL/);
  });
});

describe('sqliteFilePath', () => {
  const cwd = '/srv/app';
  it('resolves relative and absolute file URLs', () => {
    expect(sqliteFilePath('file:./data/dev.db', cwd)).toBe('/srv/app/data/dev.db');
    expect(sqliteFilePath('file:data/dev.db', cwd)).toBe('/srv/app/data/dev.db');
    expect(sqliteFilePath('file:/var/db/app.db', cwd)).toBe('/var/db/app.db');
    expect(sqliteFilePath('file:///var/db/app.db', cwd)).toBe('/var/db/app.db');
    expect(sqliteFilePath('file://localhost/var/db/app.db', cwd)).toBe('/var/db/app.db');
    expect(sqliteFilePath('file:./my%20db.db?mode=rw', cwd)).toBe('/srv/app/my db.db');
  });

  it('returns null for in-memory databases', () => {
    expect(sqliteFilePath('file::memory:', cwd)).toBeNull();
    expect(sqliteFilePath('file::memory:?cache=shared', cwd)).toBeNull();
  });
});

describe('migrationsFolder', () => {
  it('points at drizzle/<dialect> under the working directory', () => {
    expect(migrationsFolder('sqlite', '/app')).toBe('/app/drizzle/sqlite');
    expect(migrationsFolder('postgres', '/app')).toBe('/app/drizzle/pg');
    expect(existsSync(path.join(migrationsFolder('sqlite'), 'meta/_journal.json'))).toBe(true);
    expect(existsSync(path.join(migrationsFolder('postgres'), 'meta/_journal.json'))).toBe(true);
  });
});

describe('getDb (SQLite)', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  afterAll(async () => {
    await Promise.all(dirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  it('creates the data directory, migrates lazily and memoises one handle', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'goc-client-'));
    dirs.push(dir);
    const dbFile = path.join(dir, 'nested', 'data', 'app.db');
    vi.stubEnv('DATABASE_URL', `file:${dbFile}`);

    const [a, b, c] = await Promise.all([getDb(), getDb(), getDb()]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(await getDb()).toBe(a);
    expect(a.dialect).toBe('sqlite');
    expect(existsSync(dbFile)).toBe(true);

    // The handle is typed for the shared repository; reach the raw SQLite API for PRAGMAs.
    const sqlite = a.db as unknown as LibSQLDatabase;
    const tables = await sqlite.all<{ name: string }>(
      sql`select name from sqlite_master where type = 'table' order by name`,
    );
    const names = tables.map((r) => r.name);
    expect(names).toEqual(
      expect.arrayContaining(['posts', 'comments', 'votes', 'contact_messages', 'lesson_ratings']),
    );

    const fk = await sqlite.all<{ foreign_keys: number }>(sql`pragma foreign_keys`);
    expect(fk[0]?.foreign_keys).toBe(1);
  });

  it('re-running migrations on an existing database is a no-op', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'goc-client-'));
    dirs.push(dir);
    vi.stubEnv('DATABASE_URL', `file:${path.join(dir, 'app.db')}`);
    const first = await getDb();
    await first.db.insert(first.schema.contactMessages).values({
      name: 'A',
      email: 'a@b.co',
      message: 'persisted message',
      ipHash: 'h',
    });
    await closeDb();
    const second = await getDb();
    expect(second).not.toBe(first);
    const rows = await second.db.select().from(second.schema.contactMessages);
    expect(rows.map((r) => r.message)).toEqual(['persisted message']);
  });

  it('evicts a failed connection so the next call can retry', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'goc-client-'));
    dirs.push(dir);
    // A regular file where the data directory should be: mkdir fails (ENOTDIR).
    const blocker = path.join(dir, 'blocker');
    await writeFile(blocker, '');
    vi.stubEnv('DATABASE_URL', `file:${path.join(blocker, 'app.db')}`);
    await expect(getDb()).rejects.toThrow();
    await rm(blocker);
    await expect(getDb()).resolves.toMatchObject({ dialect: 'sqlite' });
    expect(existsSync(path.join(blocker, 'app.db'))).toBe(true);
  });
});

describe('migrateWithRetry', () => {
  it('retries a failed migration and stops as soon as one succeeds', async () => {
    const run = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('table `posts` already exists'))
      .mockResolvedValue(undefined);
    await migrateWithRetry(run, { baseDelayMs: 1 });
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('rethrows a persistent failure after the last attempt', async () => {
    const run = vi.fn<() => Promise<void>>().mockRejectedValue(new Error('syntax error'));
    await expect(migrateWithRetry(run, { baseDelayMs: 1 })).rejects.toThrow('syntax error');
    expect(run).toHaveBeenCalledTimes(MIGRATION_ATTEMPTS);
  });
});

describe('connect (SQLite) from several processes at once', () => {
  it('lets every connection migrate a fresh file without "table already exists"', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'goc-race-'));
    const config = { dialect: 'sqlite' as const, url: `file:${path.join(dir, 'race.db')}` };
    // Separate clients = separate connections, exactly like the dev server and
    // `npm run db:seed` opening the same fresh database together.
    const results = await Promise.allSettled([connect(config), connect(config), connect(config)]);
    try {
      expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
      const handles = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
      const sqlite = handles[0]!.db as unknown as LibSQLDatabase;
      const applied = await sqlite.all<{ n: number }>(
        sql`select count(*) as n from __drizzle_migrations`,
      );
      expect(applied[0]?.n).toBe(1);

      // Foreign keys stay enforced on every connection, before and after a transaction.
      for (const handle of handles) {
        const repo = createRepository(handle);
        const post = await repo.createPost({
          type: 'general',
          title: 'Race survivor',
          body: 'Created after three connections migrated at once.',
          ipHash: 'h',
        });
        await repo.toggleVote(post.id, 'race-voter-1', 'h');
        const fk = await (handle.db as unknown as LibSQLDatabase).all<{ foreign_keys: number }>(
          sql`pragma foreign_keys`,
        );
        expect(fk[0]?.foreign_keys).toBe(1);
        expect(await repo.deletePost(post.id)).toBe(true);
      }
      const orphans = await sqlite.all<{ n: number }>(sql`select count(*) as n from votes`);
      expect(orphans[0]?.n).toBe(0);
    } finally {
      await Promise.all(results.map((r) => (r.status === 'fulfilled' ? r.value.close() : null)));
      await rm(dir, { recursive: true, force: true });
    }
  });
});
