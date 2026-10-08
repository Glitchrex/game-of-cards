import { getTableConfig as pgConfig, type PgTable } from 'drizzle-orm/pg-core';
import { getTableConfig as sqliteConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import * as pg from './schema.pg';
import * as sqlite from './schema.sqlite';

type Shape = ReturnType<typeof describeShape>;

function describeShape(config: ReturnType<typeof pgConfig> | ReturnType<typeof sqliteConfig>) {
  return {
    name: config.name,
    columns: config.columns
      .map((c) => ({
        name: c.name,
        notNull: c.notNull,
        primary: c.primary,
        hasDefault: c.hasDefault,
        default: c.default as unknown,
        enumValues: c.enumValues ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    foreignKeys: config.foreignKeys
      .map((fk) => {
        const ref = fk.reference();
        return {
          columns: ref.columns.map((c) => c.name),
          foreignColumns: ref.foreignColumns.map((c) => c.name),
          onDelete: fk.onDelete ?? null,
        };
      })
      .sort((a, b) => a.columns.join().localeCompare(b.columns.join())),
    uniques: config.uniqueConstraints.map((u) => ({
      name: u.name ?? null,
      columns: u.columns.map((c) => c.name),
    })),
    indexes: config.indexes
      .map((i) => ({
        name: i.config.name,
        columns: i.config.columns.map((c) => ('name' in c ? c.name : String(c))),
      }))
      .sort((a, b) => String(a.name).localeCompare(String(b.name))),
    checks: config.checks.map((c) => c.name).sort(),
  };
}

const TABLES = ['posts', 'comments', 'votes', 'contactMessages', 'lessonRatings'] as const;

describe('database schemas', () => {
  it('export the same tables for both dialects', () => {
    expect(Object.keys(sqlite).sort()).toEqual(Object.keys(pg).sort());
    expect(Object.keys(pg).sort()).toEqual([...TABLES].sort());
  });

  it.each(TABLES)('%s has an identical shape in SQLite and Postgres', (table) => {
    const a: Shape = describeShape(sqliteConfig(sqlite[table] as SQLiteTable));
    const b: Shape = describeShape(pgConfig(pg[table] as PgTable));
    expect(a).toEqual(b);
  });

  it('uses the documented table names, cascades and vote uniqueness', () => {
    expect(TABLES.map((t) => pgConfig(pg[t]).name)).toEqual([
      'posts',
      'comments',
      'votes',
      'contact_messages',
      'lesson_ratings',
    ]);
    const votes = describeShape(pgConfig(pg.votes));
    expect(votes.uniques).toEqual([
      { name: 'votes_post_id_voter_token_unique', columns: ['post_id', 'voter_token'] },
    ]);
    expect(votes.foreignKeys).toEqual([
      { columns: ['post_id'], foreignColumns: ['id'], onDelete: 'cascade' },
    ]);
    expect(describeShape(pgConfig(pg.comments)).foreignKeys[0]?.onDelete).toBe('cascade');
  });
});
