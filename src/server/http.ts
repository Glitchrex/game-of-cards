/**
 * Shared plumbing for the route handlers in src/app/api/**: JSON responses,
 * safe body parsing, :id params, error handling and the public write pipeline
 * (the order documented in docs/API.md):
 *
 *   parse JSON (415 / 413 / 400) → Zod validate (400) → honeypot (fake 201)
 *     → rate limit (429) → sanitize → re-validate (400) → persist
 *
 * Validating first means a bot that fills the honeypot gets exactly the
 * answers a person would (400 for bad input, 201 otherwise), and people fixing
 * form mistakes don't use up their write budget.
 */
import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { z } from 'zod';
import type { Comment, Post } from '@/lib/api-client';
import {
  getClientIp,
  hashIp,
  isHoneypotFilled,
  rateLimit,
  RATE_LIMIT_MESSAGE,
  sanitizeText,
  type RateLimitOptions,
} from './security';
import { validate, type CreateCommentPayload, type CreatePostPayload } from './validation';

const NO_STORE = { 'cache-control': 'no-store' } as const;

export function json(data: unknown, status = 200, headers?: Record<string, string>): NextResponse {
  return NextResponse.json(data, { status, headers: { ...NO_STORE, ...headers } });
}

export function errorJson(
  status: number,
  error: string,
  fieldErrors?: Record<string, string>,
  headers?: Record<string, string>,
): NextResponse {
  const body = fieldErrors && Object.keys(fieldErrors).length ? { error, fieldErrors } : { error };
  return json(body, status, headers);
}

export function notFound(what: string): NextResponse {
  return errorJson(404, `${what} not found.`);
}

export function tooManyRequests(retryAfterSeconds: number): NextResponse {
  return errorJson(429, RATE_LIMIT_MESSAGE, undefined, {
    'retry-after': String(Math.max(1, retryAfterSeconds)),
  });
}

const MAX_DB_ID = 2_147_483_647;

/** Positive 32-bit integer id from a route param, else null. */
export function parseId(raw: string | undefined): number | null {
  if (!raw || !/^[1-9]\d{0,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id <= MAX_DB_ID ? id : null;
}

export interface IdRouteContext {
  params: Promise<{ id: string }>;
}

export async function idFromContext(ctx: IdRouteContext): Promise<number | null> {
  const { id } = await ctx.params;
  return parseId(id);
}

/** Largest accepted request body in bytes (a maxed-out 3,000-char message is ~10 KB). */
export const MAX_BODY_BYTES = 32 * 1024;

export type JsonBodyResult =
  { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse };

const tooLarge = () => errorJson(413, 'That request is too large.');

/** `application/json`, optionally with parameters (`; charset=utf-8`), or any `+json` type. */
export function isJsonContentType(header: string | null): boolean {
  const type = header?.split(';')[0]?.trim().toLowerCase() ?? '';
  return type === 'application/json' || /^application\/[\w.+-]+\+json$/.test(type);
}

/** Reads the body as UTF-8, giving up (null) as soon as it exceeds `maxBytes`. */
async function readTextLimited(req: Request, maxBytes: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * Reads a JSON object body without throwing: 415 unless sent as JSON, 413 if
 * huge, 400 if not a JSON object. Requiring a JSON content type also means a
 * cross-site page can't submit it with a plain HTML form or a "simple" fetch:
 * the browser must ask first (CORS preflight), and we never say yes.
 */
export async function readJsonBody(req: Request): Promise<JsonBodyResult> {
  if (!isJsonContentType(req.headers.get('content-type'))) {
    return {
      ok: false,
      response: errorJson(
        415,
        'Please send the request body as JSON (Content-Type: application/json).',
      ),
    };
  }
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { ok: false, response: tooLarge() };
  }
  let text: string | null;
  try {
    text = await readTextLimited(req, MAX_BODY_BYTES);
  } catch {
    return { ok: false, response: errorJson(400, 'Could not read the request body.') };
  }
  if (text === null) return { ok: false, response: tooLarge() };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, response: errorJson(400, 'The request body must be valid JSON.') };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, response: errorJson(400, 'The request body must be a JSON object.') };
  }
  return { ok: true, body: parsed as Record<string, unknown> };
}

/** Runs a handler, turning unexpected errors into a logged, generic 500. */
export async function handle(
  label: string,
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[api] ${label} failed:`, err);
    return errorJson(500, 'Something went wrong on our side. Please try again in a moment.');
  }
}

/* ------------------------------------------------------- public write flow */

export interface WriteContext {
  ipHash: string;
}

export interface PublicWriteSpec<S extends z.ZodType> {
  /** Rate-limit bucket name, e.g. "write" (shared) or "vote". */
  bucket: string;
  limit: RateLimitOptions;
  /**
   * Response body for a honeypot hit (sent with 201, nothing stored). Gets the
   * validated input. Omit for endpoints without a honeypot.
   */
  honeypot?: (data: z.output<S>) => unknown;
  schema: S;
  /** Strip HTML etc. The result is validated again with `schema`. */
  sanitize?: (data: z.output<S>) => z.input<S>;
  persist: (data: z.output<S>, ctx: WriteContext) => Promise<NextResponse>;
}

export async function publicWrite<S extends z.ZodType>(
  req: Request,
  spec: PublicWriteSpec<S>,
): Promise<NextResponse> {
  const parsed = await readJsonBody(req);
  if (!parsed.ok) return parsed.response;
  const { body } = parsed;

  const first = validate(spec.schema, body);
  if (!first.ok) return errorJson(400, first.error, first.fieldErrors);

  if (spec.honeypot && isHoneypotFilled(body)) {
    return json(spec.honeypot(first.data), 201);
  }

  const ipHash = hashIp(getClientIp(req));
  const limited = rateLimit(`${spec.bucket}:${ipHash}`, spec.limit);
  if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

  let data = first.data;
  if (spec.sanitize) {
    const second = validate(spec.schema, spec.sanitize(first.data));
    if (!second.ok) return errorJson(400, second.error, second.fieldErrors);
    data = second.data;
  }
  return spec.persist(data, { ipHash });
}

/* ---------------------------------------------------- sanitising shortcuts */

/** Single-line plain text (titles, names). */
export const cleanLine = (s: string) => sanitizeText(s, { multiline: false });
/** Multi-line plain text (bodies, messages). */
export const cleanBlock = (s: string) => sanitizeText(s, { multiline: true });
/** Optional single-line field; empty → null. */
export const cleanOptionalLine = (s: string | null | undefined) =>
  s == null ? null : cleanLine(s) || null;
/** Optional multi-line field; empty → null. */
export const cleanOptionalBlock = (s: string | null | undefined) =>
  s == null ? null : cleanBlock(s) || null;

/* ------------------------------------------------- honeypot fake responses */

function fakeId(): number {
  return randomInt(1_000, 1_000_000);
}

/** A believable post for a bot that filled the honeypot. Nothing is stored. */
export function fakePost(data: CreatePostPayload): Post {
  return {
    id: fakeId(),
    type: data.type,
    title: cleanLine(data.title),
    body: cleanBlock(data.body),
    authorName: cleanOptionalLine(data.name),
    status: 'open',
    upvotes: 0,
    commentCount: 0,
    createdAt: new Date().toISOString(),
  };
}

/** A believable comment for a bot that filled the honeypot. Nothing is stored. */
export function fakeComment(postId: number, data: CreateCommentPayload): Comment {
  return {
    id: fakeId(),
    postId,
    body: cleanBlock(data.body),
    authorName: cleanOptionalLine(data.name),
    createdAt: new Date().toISOString(),
  };
}
