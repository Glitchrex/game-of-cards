/**
 * Database connection + dialect switch + lazy migrations.
 *
 *   DATABASE_URL unset / "file:…"            → SQLite through @libsql/client
 *   DATABASE_URL "postgres://…" / "postgresql://…" → Postgres through postgres-js
 *
 * The first `getDb()` call opens the connection and applies the matching
 * migrations from `drizzle/<dialect>`; that work is memoised as ONE promise, so
 * concurrent first requests share it. A fresh clone therefore works with just
 * `npm run dev`. The cache lives on `globalThis`, so neither Next's HMR nor a
 * second copy of this module opens another connection. Other processes migrating the
 * same database at the same moment are handled by `migrateWithRetry`.
 *
 * The repository (`../repo.ts`) is written once against a single query-builder
 * type, `AppDatabase`; `createDbHandle` is the one place where the dialect-
 * specific Drizzle instances are cast to it (see the comment there).
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import * as pgSchema from './schema.pg';
import * as sqliteSchema from './schema.sqlite';

export type Dialect = 'sqlite' | 'postgres';

/** The query-builder type the repository is written against (see `createDbHandle`). */
export type AppDatabase = PgDatabase<PgQueryResultHKT>;
/** The table objects the repository is written against. */
export type AppSchema = typeof pgSchema;

export interface DbHandle {
  readonly dialect: Dialect;
  readonly db: AppDatabase;
  readonly schema: AppSchema;
  /**
   * Runs `fn` with exclusive use of the connection. Single-connection drivers
   * (SQLite, PGlite) need this so that an open transaction never overlaps with
   * another request's queries; pooled Postgres runs `fn` immediately.
   */
  exclusive<T>(fn: () => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export type SupportedDatabase<H extends PgQueryResultHKT = PgQueryResultHKT> =
  LibSQLDatabase<Record<string, unknown>> | PgDatabase<H, Record<string, unknown>>;

export interface CreateDbHandleOptions<H extends PgQueryResultHKT = PgQueryResultHKT> {
  dialect: Dialect;
  db: SupportedDatabase<H>;
  close?: () => unknown;
  /** Serialise all repository work on this handle. Defaults to `true` for SQLite. */
  serialize?: boolean;
}

function createMutex(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<unknown> = Promise.resolve();
  return <T>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn);
    tail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };
}

/**
 * Wraps a dialect-specific Drizzle instance for the shared repository.
 *
 * THE ONE DIALECT CAST: Drizzle's SQLite and Postgres builders are separate
 * class hierarchies with the same runtime API for everything the repository
 * uses (select/insert/update/delete, where/orderBy/limit/groupBy/innerJoin,
 * returning, onConflictDoNothing, transaction). The repository is typed
 * against the Postgres builder and only uses that common subset, and the two
 * schema files declare identical tables/columns (enforced by schema.test.ts),
 * so the SQLite instance and table objects are presented under the Postgres
 * types here. Values are still encoded by the real (SQLite) column objects at
 * runtime, e.g. booleans become 0/1. Both dialects are exercised by the test
 * suite (SQLite file + PGlite), which is what keeps this cast honest.
 */
export function createDbHandle<H extends PgQueryResultHKT>(
  options: CreateDbHandleOptions<H>,
): DbHandle {
  const db = options.db as unknown as AppDatabase;
  const schema = (options.dialect === 'sqlite' ? sqliteSchema : pgSchema) as unknown as AppSchema;
  const serialize = options.serialize ?? options.dialect === 'sqlite';
  const exclusive = serialize ? createMutex() : <T>(fn: () => Promise<T>) => fn();
  let closed: Promise<void> | null = null;
  return {
    dialect: options.dialect,
    db,
    schema,
    exclusive,
    close() {
      closed ??= Promise.resolve(options.close?.()).then(() => undefined);
      return closed;
    },
  };
}

/* ------------------------------------------------------------ configuration */

export const DEFAULT_SQLITE_URL = 'file:./data/dev.db';

export interface DatabaseConfig {
  dialect: Dialect;
  url: string;
}

/** Maps DATABASE_URL to a dialect. Throws for unsupported schemes. */
export function resolveDatabaseConfig(
  raw: string | undefined = process.env.DATABASE_URL,
): DatabaseConfig {
  const url = raw?.trim();
  if (!url) return { dialect: 'sqlite', url: DEFAULT_SQLITE_URL };
  if (url.startsWith('file:')) return { dialect: 'sqlite', url };
  if (/^postgres(ql)?:\/\//i.test(url)) return { dialect: 'postgres', url };
  throw new Error(
    'Unsupported DATABASE_URL: use "file:./data/dev.db" (SQLite) or "postgres://user:pass@host:5432/db" (Postgres).',
  );
}

/**
 * Filesystem path of a `file:` SQLite URL (absolute), or null for in-memory
 * databases. Handles `file:./rel.db`, `file:rel.db`, `file:/abs.db`,
 * `file:///abs.db` and `file://localhost/abs.db`.
 */
export function sqliteFilePath(url: string, cwd: string = process.cwd()): string | null {
  let rest = url.slice('file:'.length);
  const queryAt = rest.indexOf('?');
  if (queryAt >= 0) rest = rest.slice(0, queryAt);
  if (rest.startsWith('//')) {
    rest = rest.slice(2);
    if (rest.toLowerCase().startsWith('localhost/')) rest = rest.slice('localhost'.length);
  }
  rest = decodeURIComponent(rest);
  if (!rest || rest === ':memory:' || rest.startsWith(':memory:')) return null;
  return path.resolve(cwd, rest);
}

export function migrationsFolder(dialect: Dialect, cwd: string = process.cwd()): string {
  return path.join(cwd, 'drizzle', dialect === 'sqlite' ? 'sqlite' : 'pg');
}

/* --------------------------------------------------------------- connecting */

export const MIGRATION_ATTEMPTS = 4;

/**
 * Runs a Drizzle `migrate()` call, retrying a few times with a short backoff.
 * Two processes that open a fresh database together (the dev server and
 * `npm run db:seed`, or two app instances on their first deploy) both read
 * "nothing applied yet"; the slower one's migration transaction then fails
 * ("table already exists") and rolls back. Running it again re-reads the
 * migrations table, finds the work done and succeeds. A persistent failure
 * (bad SQL, unreachable server) is rethrown after the last attempt.
 */
export async function migrateWithRetry(
  run: () => Promise<unknown>,
  {
    attempts = MIGRATION_ATTEMPTS,
    baseDelayMs = 50,
  }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await run();
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1) + Math.random() * baseDelayMs;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

async function connectSqlite(url: string): Promise<DbHandle> {
  const filePath = sqliteFilePath(url);
  if (filePath) mkdirSync(path.dirname(filePath), { recursive: true });

  const [{ createClient }, { drizzle }, { migrate }] = await Promise.all([
    import('@libsql/client'),
    import('drizzle-orm/libsql'),
    import('drizzle-orm/libsql/migrator'),
  ]);
  // One connection: SQLite has a single writer anyway, connection-level PRAGMAs
  // (foreign_keys) then apply to every query, and `exclusive` (the mutex in
  // createDbHandle) keeps transactions from overlapping. `timeout` is the busy
  // timeout for other processes (e.g. `npm run db:seed` next to the dev server).
  const client = createClient({ url, concurrency: 1, timeout: 5_000 });
  try {
    await client.execute('PRAGMA foreign_keys = ON');
    if (filePath) await client.execute('PRAGMA journal_mode = WAL');
    const db = drizzle({ client });
    await migrateWithRetry(() => migrate(db, { migrationsFolder: migrationsFolder('sqlite') }));
    // libsql's migrate() toggles foreign_keys off and back on; make sure it's on.
    await client.execute('PRAGMA foreign_keys = ON');
    return createDbHandle({ dialect: 'sqlite', db, close: () => client.close() });
  } catch (err) {
    client.close();
    throw err;
  }
}

async function connectPostgres(url: string): Promise<DbHandle> {
  const [{ default: postgres }, { drizzle }, { migrate }] = await Promise.all([
    import('postgres'),
    import('drizzle-orm/postgres-js'),
    import('drizzle-orm/postgres-js/migrator'),
  ]);
  const client = postgres(url, { max: 10, onnotice: () => {} });
  try {
    const db = drizzle({ client });
    await migrateWithRetry(() => migrate(db, { migrationsFolder: migrationsFolder('postgres') }));
    return createDbHandle({
      dialect: 'postgres',
      db,
      close: () => client.end({ timeout: 5 }),
    });
  } catch (err) {
    await client.end({ timeout: 5 });
    throw err;
  }
}

export function connect(config: DatabaseConfig): Promise<DbHandle> {
  return config.dialect === 'sqlite' ? connectSqlite(config.url) : connectPostgres(config.url);
}

/* -------------------------------------------------------------------- cache */

type HandleCache = Map<string, Promise<DbHandle>>;
// Process-wide, not module-wide: Next's HMR re-evaluates modules in development,
// and a bundler may instantiate this module more than once (separate route
// bundles or server layers). One process must still hold ONE connection per
// database, or SQLite's single-connection + mutex model would not hold.
const globalForDb = globalThis as typeof globalThis & { __gocDbHandles?: HandleCache };
const handles: HandleCache = (globalForDb.__gocDbHandles ??= new Map());

/**
 * Connected, migrated database for the current DATABASE_URL. Memoised per URL;
 * a failed connection/migration is evicted so the next call retries.
 */
export function getDb(): Promise<DbHandle> {
  const config = resolveDatabaseConfig();
  const key = `${config.dialect}|${config.url}`;
  const cached = handles.get(key);
  if (cached) return cached;
  const pending = connect(config);
  handles.set(key, pending);
  pending.catch(() => {
    if (handles.get(key) === pending) handles.delete(key);
  });
  return pending;
}

/** Closes every cached connection (scripts, tests, graceful shutdown). */
export async function closeDb(): Promise<void> {
  const pending = [...handles.values()];
  handles.clear();
  await Promise.all(
    pending.map(async (p) => {
      try {
        await (await p).close();
      } catch {
        // A connection that never opened has nothing to close.
      }
    }),
  );
}
