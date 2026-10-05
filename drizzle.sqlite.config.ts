import { defineConfig } from 'drizzle-kit';

/** SQLite (libsql) migrations. Generate with `npm run db:generate`. */
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.sqlite.ts',
  out: './drizzle/sqlite',
  strict: true,
});
