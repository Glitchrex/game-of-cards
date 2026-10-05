/**
 * `npm run db:seed` — insert a handful of sample Community Board posts (with
 * comments, votes and statuses) into an EMPTY posts table. Safe to re-run.
 */
import { existsSync } from 'node:fs';
import { closeDb, getDb } from '../src/server/db/client';
import { seedSampleData } from '../src/server/seed';

if (existsSync('.env') && typeof process.loadEnvFile === 'function') process.loadEnvFile('.env');

try {
  const result = await seedSampleData(await getDb());
  if (result.seeded) {
    console.info(
      `[db] Seeded ${result.posts} posts, ${result.comments} comments and ${result.votes} votes.`,
    );
  } else {
    console.info('[db] Posts already exist — nothing to seed.');
  }
} catch (err) {
  console.error('[db] Seeding failed:', err);
  process.exitCode = 1;
} finally {
  await closeDb();
}
