/**
 * `npm run db:migrate` — apply pending migrations for the database selected by
 * DATABASE_URL (SQLite by default, Postgres for postgres:// URLs), then exit.
 * Runs automatically before `npm run dev`. The server also migrates lazily on
 * its first database call, so this is a convenience, not a requirement.
 */
import { existsSync } from 'node:fs';
import { closeDb, getDb, resolveDatabaseConfig, sqliteFilePath } from '../src/server/db/client';

if (existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');

try {
  const config = resolveDatabaseConfig();
  const target =
    config.dialect === 'sqlite' ? (sqliteFilePath(config.url) ?? 'in-memory SQLite') : 'Postgres';
  await getDb();
  console.info(`[db] Migrations are up to date (${target}).`);
} catch (err) {
  console.error('[db] Migration failed:', err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
