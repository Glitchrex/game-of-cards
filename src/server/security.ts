/**
 * Security helpers for the route handlers: rate limiting, client IP + hashing,
 * text sanitising, honeypot detection and the admin session.
 *
 * Environment (read at call time, so tests and env changes apply immediately):
 *   APP_SECRET         — salts IP hashes and keys session signatures.
 *                        Falls back to a value derived from ADMIN_PASSWORD, then
 *                        to a built-in constant (fine locally, set it in production).
 *   ADMIN_PASSWORD     — enables /admin when it is not blank. The session-signing
 *                        key is derived from it, so changing it logs every admin out.
 *   TRUSTED_PROXY_HOPS — how many reverse proxies in front of the app append to
 *                        X-Forwarded-For (default 1). See `getClientIp`.
 *
 * In production the example values from `.env.example` are refused (a copied
 * example file must not open /admin with a published password).
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import sanitizeHtml from 'sanitize-html';

/* -------------------------------------------------------------- rate limit */

export interface RateLimitOptions {
  /** Max accepted hits inside the window. */
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** Hits still allowed in the current window. */
  remaining: number;
  /** Seconds until the next hit would be accepted (0 when ok). */
  retryAfterSeconds: number;
}

interface Bucket {
  windowMs: number;
  hits: number[];
}

/**
 * Hard cap on tracked keys, so a flood of distinct (spoofed or real) client
 * addresses cannot grow memory without bound. Map order is kept as "least
 * recently used first", and the oldest keys are evicted once the cap is hit.
 */
export const MAX_RATE_LIMIT_KEYS = 10_000;

// Process-wide (see the note on the DB handle cache in db/client.ts): every
// route must share one budget even if the bundler instantiates this module
// more than once.
const globalForLimits = globalThis as typeof globalThis & {
  __gocRateLimitBuckets?: Map<string, Bucket>;
};
const buckets = (globalForLimits.__gocRateLimitBuckets ??= new Map<string, Bucket>());
const SWEEP_EVERY = 500;
let callsSinceSweep = 0;

function sweep(now: number): void {
  for (const [key, bucket] of buckets) {
    const newest = bucket.hits[bucket.hits.length - 1];
    if (newest === undefined || newest <= now - bucket.windowMs) buckets.delete(key);
  }
}

function makeRoom(now: number): void {
  if (buckets.size < MAX_RATE_LIMIT_KEYS) return;
  sweep(now);
  for (const key of buckets.keys()) {
    if (buckets.size < MAX_RATE_LIMIT_KEYS) break;
    buckets.delete(key);
  }
}

function liveHits(bucket: Bucket | undefined, windowMs: number, now: number): number[] {
  if (!bucket) return [];
  const cutoff = now - windowMs;
  let firstLive = 0;
  while (firstLive < bucket.hits.length && (bucket.hits[firstLive] ?? 0) <= cutoff) firstLive++;
  if (firstLive > 0) bucket.hits.splice(0, firstLive);
  return bucket.hits;
}

function blocked(hits: number[], windowMs: number, now: number): RateLimitResult {
  const oldest = hits[0] ?? now;
  return {
    ok: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
  };
}

/**
 * In-memory sliding-window log, per key (per server instance). Rejected hits
 * are not recorded, so a client that waits is let back in as soon as its
 * oldest accepted hit leaves the window.
 */
export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  if (++callsSinceSweep >= SWEEP_EVERY) {
    callsSinceSweep = 0;
    sweep(now);
  }
  let bucket = buckets.get(key);
  if (bucket) {
    buckets.delete(key); // re-inserted below: keeps Map order least-recently-used first
  } else {
    makeRoom(now);
    bucket = { windowMs, hits: [] };
  }
  bucket.windowMs = windowMs;
  const hits = liveHits(bucket, windowMs, now);
  buckets.set(key, bucket);
  if (hits.length >= limit) return blocked(hits, windowMs, now);
  hits.push(now);
  return { ok: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

/**
 * Same answer `rateLimit` would give, without recording a hit. Used where only
 * some outcomes should count (e.g. failed admin logins): peek first, then call
 * `rateLimit` for the outcomes that should use up the budget.
 */
export function peekRateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
  now: number = Date.now(),
): RateLimitResult {
  const hits = liveHits(buckets.get(key), windowMs, now);
  if (hits.length >= limit) return blocked(hits, windowMs, now);
  return { ok: true, remaining: limit - hits.length, retryAfterSeconds: 0 };
}

/** Number of keys currently tracked (diagnostics and tests). */
export function rateLimitKeyCount(): number {
  return buckets.size;
}

/** Test helper: forget every rate-limit bucket. */
export function resetRateLimits(): void {
  buckets.clear();
  callsSinceSweep = 0;
}

export const DEFAULT_WRITES_PER_MINUTE = 8;
export const VOTES_PER_MINUTE = 60;
export const ADMIN_LOGINS_PER_MINUTE = 10;
const MINUTE = 60_000;

/** Shared limit for posts, comments, contact and ratings (RATE_LIMIT_PER_MINUTE, default 8). */
export function writeRateLimit(): RateLimitOptions {
  const parsed = Number.parseInt(process.env.RATE_LIMIT_PER_MINUTE ?? '', 10);
  const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_WRITES_PER_MINUTE;
  return { limit, windowMs: MINUTE };
}

export const VOTE_RATE_LIMIT: RateLimitOptions = { limit: VOTES_PER_MINUTE, windowMs: MINUTE };
/** Failed admin logins per IP per minute (successful logins are not counted). */
export const LOGIN_RATE_LIMIT: RateLimitOptions = {
  limit: ADMIN_LOGINS_PER_MINUTE,
  windowMs: MINUTE,
};

export const RATE_LIMIT_MESSAGE = 'Too many requests — take a breather and try again in a minute.';

/* ---------------------------------------------------------------- IP + hash */

export const DEFAULT_TRUSTED_PROXY_HOPS = 1;
const MAX_TRUSTED_PROXY_HOPS = 10;

/** TRUSTED_PROXY_HOPS (1–10, default 1): reverse proxies that append to X-Forwarded-For. */
export function trustedProxyHops(): number {
  const parsed = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10);
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_TRUSTED_PROXY_HOPS;
  return Math.min(parsed, MAX_TRUSTED_PROXY_HOPS);
}

/**
 * Client address used for rate limiting and IP hashes.
 *
 * Every proxy APPENDS the address it received the request from to
 * X-Forwarded-For, so only the entries written by our own proxies can be
 * trusted; anything further left was written by the client and is ignored.
 * We therefore read the entry `TRUSTED_PROXY_HOPS` places from the right
 * (default 1: one proxy such as Vercel, nginx or a PaaS router). Next.js fills
 * the header with the socket address when it is missing, so it is always set
 * when the app is reached directly; in that setup a client can still forge it
 * (always run the app behind a proxy in production).
 *
 * The result is normalised (`normalizeIp`): ports and IPv6 zones are dropped,
 * IPv4-mapped IPv6 becomes IPv4 and IPv6 is reduced to its /64 network, since
 * one subscriber usually controls a whole /64.
 */
export function getClientIp(req: Request): string {
  const chain = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const picked =
    chain.length > 0
      ? chain[Math.max(0, chain.length - trustedProxyHops())]
      : req.headers.get('x-real-ip')?.trim();
  return picked ? normalizeIp(picked) : 'local';
}

function expandIpv6(ip: string): number[] | null {
  let text = ip.toLowerCase();
  const lastColon = text.lastIndexOf(':');
  const tail = text.slice(lastColon + 1);
  if (tail.includes('.')) {
    const octets = tail.split('.').map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) {
      return null;
    }
    const [a = 0, b = 0, c = 0, d = 0] = octets;
    text = `${text.slice(0, lastColon + 1)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':').map((h) => parseInt(h, 16)));
  const head = parse(halves[0] ?? '');
  const rest = halves.length === 2 ? parse(halves[1] ?? '') : [];
  const fill = halves.length === 2 ? 8 - head.length - rest.length : 0;
  if (fill < 0) return null;
  const groups = [...head, ...new Array<number>(fill).fill(0), ...rest];
  if (groups.length !== 8 || groups.some((g) => !Number.isInteger(g) || g < 0 || g > 0xffff)) {
    return null;
  }
  return groups;
}

/**
 * Canonical form of one X-Forwarded-For / X-Real-IP entry:
 * `203.0.113.7:4711` → `203.0.113.7`, `[2001:db8::1]:443` → `2001:db8:0:0::/64`,
 * `::ffff:203.0.113.7` → `203.0.113.7`. Non-IP tokens (e.g. `unknown`) are
 * kept, lower-cased and truncated.
 */
export function normalizeIp(raw: string): string {
  let ip = raw.trim().replace(/^"(.*)"$/, '$1');
  const bracketed = /^\[([^\]]+)\](?::\d{1,5})?$/.exec(ip);
  if (bracketed?.[1]) ip = bracketed[1];
  else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d{1,5}$/.test(ip)) ip = ip.slice(0, ip.lastIndexOf(':'));
  const zone = ip.indexOf('%');
  if (zone >= 0) ip = ip.slice(0, zone);

  const version = isIP(ip);
  if (version === 4) return ip;
  if (version === 6) {
    const groups = expandIpv6(ip);
    if (groups) {
      const [, , , , , g5, g6 = 0, g7 = 0] = groups;
      if (groups.slice(0, 5).every((g) => g === 0) && g5 === 0xffff) {
        return [g6 >> 8, g6 & 255, g7 >> 8, g7 & 255].join('.');
      }
      return `${groups
        .slice(0, 4)
        .map((g) => g.toString(16))
        .join(':')}::/64`;
    }
  }
  return ip.slice(0, 100).toLowerCase();
}

const FALLBACK_SECRET = 'game-of-cards/local-development-secret';
/** Published example values from `.env.example`, refused in production. */
const EXAMPLE_ADMIN_PASSWORDS: ReadonlySet<string> = new Set(['change-me-locally']);
const EXAMPLE_APP_SECRETS: ReadonlySet<string> = new Set(['replace-with-a-long-random-string']);

const isProduction = () => process.env.NODE_ENV === 'production';

const warned = new Set<string>();
function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  console.warn(`[security] ${message}`);
}

/** ADMIN_PASSWORD when admin is enabled, else null (blank, or the example value in production). */
function adminPassword(): string | null {
  const value = process.env.ADMIN_PASSWORD ?? '';
  if (value.trim() === '') return null;
  if (isProduction() && EXAMPLE_ADMIN_PASSWORDS.has(value.trim())) {
    warnOnce(
      'example-admin-password',
      'ADMIN_PASSWORD is still the example value from .env.example, so /admin stays disabled. Choose a private password.',
    );
    return null;
  }
  return value;
}

function appSecret(): string {
  const explicit = process.env.APP_SECRET?.trim();
  if (explicit) {
    if (!(isProduction() && EXAMPLE_APP_SECRETS.has(explicit))) return explicit;
    warnOnce(
      'example-app-secret',
      'APP_SECRET is still the example value from .env.example and is ignored. Set a long random string.',
    );
  }
  const password = adminPassword();
  if (password) {
    return createHash('sha256').update(`game-of-cards/app-secret\0${password}`).digest('hex');
  }
  if (isProduction()) {
    warnOnce(
      'missing-app-secret',
      'APP_SECRET is not set, so IP hashes use a built-in salt. Set APP_SECRET to a long random string.',
    );
  }
  return FALLBACK_SECRET;
}

/** Salted SHA-256 (HMAC keyed with APP_SECRET) of an IP, hex. Raw IPs are never stored. */
export function hashIp(ip: string): string {
  return createHmac('sha256', appSecret()).update(`ip\0${ip}`).digest('hex');
}

/* ----------------------------------------------------------------- sanitize */

const STRIP_ALL: sanitizeHtml.IOptions = {
  allowedTags: [],
  allowedAttributes: {},
  disallowedTagsMode: 'discard',
};

// sanitize-html returns HTML-escaped text; we store plain text (React escapes on render).
function decodeEscapes(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

// C0 controls except \t \n \r, DEL, C1 controls, and the bidi embedding /
// override / isolate controls (used to visually reverse text, "Trojan Source").
// Zero-width (non-)joiners stay: Devanagari and emoji sequences need them.
const CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g;

/** Strip-and-decode rounds before giving up on pathologically nested entity encodings. */
const MAX_SANITIZE_PASSES = 8;

export interface SanitizeOptions {
  /** Keep line breaks (bodies, messages). Single-line fields collapse all whitespace. */
  multiline?: boolean;
}

/**
 * Plain text with every HTML tag removed (script/style contents included).
 * Repeats until stable so entity-encoded markup (`&lt;b&gt;`, even nested as
 * `&amp;lt;b&amp;gt;`) can't survive as a tag either; if the input is still
 * changing after MAX_SANITIZE_PASSES rounds, every `<`, `>` and `&` is dropped
 * so no tag can remain (and the result is stable). Ordinary characters such as
 * `&`, `<` and `>` in prose are kept. Then strips control characters,
 * normalises whitespace and trims.
 */
export function sanitizeText(input: string, { multiline = true }: SanitizeOptions = {}): string {
  let text = input.normalize('NFC');
  let stable = false;
  for (let pass = 0; pass < MAX_SANITIZE_PASSES && !stable; pass++) {
    const next = decodeEscapes(sanitizeHtml(text, STRIP_ALL));
    stable = next === text;
    text = next;
  }
  // Still decoding after every pass: adversarial input. Drop the characters
  // markup and entities are made of, so nothing can decode into a tag later.
  if (!stable) text = text.replace(/[<>&]/g, '');
  text = text
    .replace(/\r\n?/g, '\n')
    .replace(/[\u2028\u2029]/g, '\n')
    .replace(CONTROL_CHARS, '');
  if (!multiline) return text.replace(/\s+/g, ' ').trim();
  return text
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trimEnd())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ----------------------------------------------------------------- honeypot */

export const HONEYPOT_FIELD = 'website';

/** True when a bot filled the hidden `website` field (any non-empty value). */
export function isHoneypotFilled(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const value = (body as Record<string, unknown>)[HONEYPOT_FIELD];
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

/* ------------------------------------------------------------ admin session */

export const ADMIN_COOKIE = 'goc_admin';
export const ADMIN_SESSION_SECONDS = 8 * 60 * 60;
const TOKEN_VERSION = 'v1';

/**
 * True when ADMIN_PASSWORD is set to something other than blanks (and, in
 * production, other than the published example value).
 */
export function isAdminEnabled(): boolean {
  return adminPassword() !== null;
}

function sessionKey(): Buffer {
  return createHmac('sha256', appSecret())
    .update(`admin-session\0${adminPassword() ?? ''}`)
    .digest();
}

function sign(payload: string): string {
  return createHmac('sha256', sessionKey()).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Timing-safe comparison against ADMIN_PASSWORD (false when admin is disabled). */
export function checkAdminPassword(input: string): boolean {
  const password = adminPassword();
  if (password === null) return false;
  // Hashing both sides first gives equal-length buffers, so the comparison
  // time reveals neither the password's length nor how much of it matched.
  const expected = createHash('sha256').update(password).digest();
  const actual = createHash('sha256').update(input).digest();
  return timingSafeEqual(expected, actual);
}

/** Signed session token `v1.<expiresAtMs>.<nonce>.<hmac>`, valid for 8 hours. */
export function createAdminToken(now: number = Date.now()): string {
  const expires = now + ADMIN_SESSION_SECONDS * 1000;
  const payload = `${TOKEN_VERSION}.${expires}.${randomBytes(12).toString('base64url')}`;
  return `${payload}.${sign(payload)}`;
}

export function verifyAdminToken(
  token: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!token || !isAdminEnabled() || token.length > 200) return false;
  const parts = token.split('.');
  if (parts.length !== 4) return false;
  const [version, expires, nonce, signature] = parts as [string, string, string, string];
  if (version !== TOKEN_VERSION || !/^\d{1,16}$/.test(expires) || !nonce) return false;
  if (!safeEqual(signature, sign(`${version}.${expires}.${nonce}`))) return false;
  const expiresAt = Number(expires);
  return expiresAt > now && expiresAt <= now + ADMIN_SESSION_SECONDS * 1000;
}

/** Reads one cookie from the request's Cookie header. */
export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get('cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function isAdminRequest(req: Request): boolean {
  return verifyAdminToken(readCookie(req, ADMIN_COOKIE));
}

/** Cookie attributes for the admin session (pass `maxAge: 0` to clear). */
export function adminCookieOptions(maxAge: number = ADMIN_SESSION_SECONDS) {
  return {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

const SAFE_METHODS: ReadonlySet<string> = new Set(['GET', 'HEAD', 'OPTIONS']);

function requestHosts(req: Request): string[] {
  const hosts = [req.headers.get('x-forwarded-host'), req.headers.get('host')]
    .flatMap((value) => (value ?? '').split(','))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  if (hosts.length === 0) {
    try {
      hosts.push(new URL(req.url).host.toLowerCase());
    } catch {
      // Relative or malformed URL: nothing to compare against.
    }
  }
  return hosts;
}

/**
 * CSRF check for cookie-authenticated (admin) requests. The SameSite=Strict
 * cookie already stops cross-SITE requests, but not same-site ones (e.g. a
 * page on a sibling subdomain), so state-changing admin requests must also
 * come from our own origin:
 * - `Sec-Fetch-Site` (sent by every current browser) must be `same-origin`
 *   (or `none`, a request the user typed themselves);
 * - without it, an `Origin` header must name the host the request was sent to
 *   (`X-Forwarded-Host` or `Host`); `Origin: null` is refused;
 * - with neither header the request is not from a browser page (curl, server
 *   code), so it carries no ambient browser credentials and is allowed.
 */
export function isSameOriginRequest(req: Request): boolean {
  const site = req.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if (site) return site === 'same-origin' || site === 'none';
  const origin = req.headers.get('origin')?.trim();
  if (!origin) return true;
  if (origin === 'null') return false;
  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  return requestHosts(req).includes(originHost);
}

const NO_STORE = { 'cache-control': 'no-store' } as const;
export const CROSS_SITE_MESSAGE = 'Cross-site requests are not allowed.';
export const ADMIN_DISABLED_MESSAGE =
  'Admin is disabled on this server. Set ADMIN_PASSWORD to enable it.';

/** `null` for same-origin requests, otherwise a 403 response (see `isSameOriginRequest`). */
export function requireSameOrigin(req: Request): NextResponse | null {
  if (isSameOriginRequest(req)) return null;
  return NextResponse.json({ error: CROSS_SITE_MESSAGE }, { status: 403, headers: NO_STORE });
}

/**
 * Guard for admin route handlers: `null` when the request carries a valid
 * session, otherwise the response to return: 503 disabled · 403 cross-site
 * state-changing request (anything but GET/HEAD/OPTIONS) · 401 not logged in.
 */
export function requireAdmin(req: Request): NextResponse | null {
  if (!isAdminEnabled()) {
    return NextResponse.json({ error: ADMIN_DISABLED_MESSAGE }, { status: 503, headers: NO_STORE });
  }
  if (!SAFE_METHODS.has(req.method.toUpperCase())) {
    const denied = requireSameOrigin(req);
    if (denied) return denied;
  }
  if (!isAdminRequest(req)) {
    return NextResponse.json(
      { error: 'Please log in as admin to continue.' },
      { status: 401, headers: NO_STORE },
    );
  }
  return null;
}
