import { defineConfig } from 'drizzle-kit';

/** Postgres migrations. Generate with `npm run db:generate`. */
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/server/db/schema.pg.ts',
  out: './drizzle/pg',
  strict: true,
});
