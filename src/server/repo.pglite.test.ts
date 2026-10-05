import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { createDbHandle, migrationsFolder } from './db/client';
import { describeRepository } from './test-utils/repository-suite';

// Proves the Postgres path: the generated drizzle/pg migrations + the exact same
// repository code, running on PGlite (in-process Postgres).
describeRepository('Postgres (PGlite, drizzle/pg migrations)', async () => {
  const client = new PGlite();
  const db = drizzle({ client });
  await migrate(db, { migrationsFolder: migrationsFolder('postgres') });
  const handle = createDbHandle({
    dialect: 'postgres',
    db,
    serialize: true,
    close: () => client.close(),
  });
  return { handle, cleanup: () => handle.close() };
});
