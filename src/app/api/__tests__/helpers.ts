/**
 * Helpers for route-handler tests: a private SQLite file per test file, and
 * Request builders. (`__tests__` is a private folder, so Next never routes it.)
 */
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { closeDb } from '@/server/db/client';
import { resetRateLimits } from '@/server/security';

/** Fresh migrated database for this test file; rate limits reset before each test. */
export function setupTestDatabase(): void {
  let dir = '';
  let previousUrl: string | undefined;
  beforeAll(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'goc-api-'));
    previousUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = `file:${path.join(dir, 'test.db')}`;
  });
  afterAll(async () => {
    await closeDb();
    if (previousUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousUrl;
    await rm(dir, { recursive: true, force: true });
  });
  beforeEach(() => resetRateLimits());
  afterEach(() => vi.unstubAllEnvs());
}

let ipCounter = 0;
/** A different client IP on every call, so tests don't trip each other's rate limits. */
export function nextIp(): string {
  ipCounter++;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  /** Serialised with JSON.stringify unless `raw` is given. */
  body?: unknown;
  raw?: string;
  ip?: string;
  cookie?: string;
  /** Extra headers (applied last, so they can override content-type or x-forwarded-for). */
  headers?: Record<string, string>;
}

export function request(urlPath: string, options: RequestOptions = {}): Request {
  const { method = options.body !== undefined || options.raw !== undefined ? 'POST' : 'GET' } =
    options;
  const headers: Record<string, string> = { 'x-forwarded-for': options.ip ?? nextIp() };
  if (options.cookie) headers.cookie = options.cookie;
  let body: string | undefined;
  if (options.raw !== undefined) body = options.raw;
  else if (options.body !== undefined) body = JSON.stringify(options.body);
  if (body !== undefined) headers['content-type'] = 'application/json';
  Object.assign(headers, options.headers);
  return new Request(`http://localhost${urlPath}`, { method, headers, body });
}

/** Second argument of a dynamic route handler. */
export function idParams(id: string | number): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id: String(id) }) };
}

export async function body<T = Record<string, unknown>>(res: Response): Promise<T> {
  return (await res.json()) as T;
}
