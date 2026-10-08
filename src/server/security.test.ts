import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_SECONDS,
  adminCookieOptions,
  checkAdminPassword,
  createAdminToken,
  getClientIp,
  hashIp,
  isAdminEnabled,
  isAdminRequest,
  isHoneypotFilled,
  isSameOriginRequest,
  MAX_RATE_LIMIT_KEYS,
  normalizeIp,
  peekRateLimit,
  rateLimit,
  rateLimitKeyCount,
  readCookie,
  requireAdmin,
  requireSameOrigin,
  resetRateLimits,
  sanitizeText,
  trustedProxyHops,
  verifyAdminToken,
  writeRateLimit,
} from './security';

const req = (headers: Record<string, string> = {}) =>
  new Request('http://localhost/api/test', { headers });

beforeEach(() => resetRateLimits());
afterEach(() => vi.unstubAllEnvs());

describe('rateLimit (sliding window)', () => {
  const opts = { limit: 3, windowMs: 60_000 };

  it('allows up to the limit, then blocks with a retry hint', () => {
    const t = 1_000_000;
    expect(rateLimit('k', opts, t)).toEqual({ ok: true, remaining: 2, retryAfterSeconds: 0 });
    expect(rateLimit('k', opts, t + 1).ok).toBe(true);
    expect(rateLimit('k', opts, t + 2)).toEqual({ ok: true, remaining: 0, retryAfterSeconds: 0 });
    const blocked = rateLimit('k', opts, t + 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(50);
  });

  it('slides: old hits expire individually', () => {
    const t = 5_000_000;
    rateLimit('k', opts, t);
    rateLimit('k', opts, t + 30_000);
    rateLimit('k', opts, t + 40_000);
    expect(rateLimit('k', opts, t + 59_999).ok).toBe(false);
    expect(rateLimit('k', opts, t + 60_000).ok).toBe(true); // first hit left the window
    expect(rateLimit('k', opts, t + 60_001).ok).toBe(false);
    expect(rateLimit('k', opts, t + 90_000).ok).toBe(true);
  });

  it('does not count rejected attempts and keeps keys independent', () => {
    const t = 9_000_000;
    for (let i = 0; i < 3; i++) rateLimit('a', opts, t);
    for (let i = 0; i < 10; i++) expect(rateLimit('a', opts, t + 1_000).ok).toBe(false);
    expect(rateLimit('b', opts, t + 1_000).ok).toBe(true);
    expect(rateLimit('a', opts, t + 60_001).ok).toBe(true);
  });

  it('resetRateLimits clears every bucket', () => {
    for (let i = 0; i < 3; i++) rateLimit('k', opts);
    expect(rateLimit('k', opts).ok).toBe(false);
    resetRateLimits();
    expect(rateLimit('k', opts).ok).toBe(true);
  });

  it('keeps memory bounded under a flood of distinct keys, evicting the least recently used', () => {
    const t = 20_000_000;
    rateLimit('regular', opts, t);
    rateLimit('regular', opts, t + 1);
    for (let i = 0; i < MAX_RATE_LIMIT_KEYS + 500; i++) {
      rateLimit(`flood-${i}`, opts, t + 2);
      if (i % 1000 === 0) rateLimit('regular', opts, t + 2); // stays recently used
    }
    expect(rateLimitKeyCount()).toBeLessThanOrEqual(MAX_RATE_LIMIT_KEYS);
    // The active key kept its history (it was used recently, so it was not evicted)…
    expect(peekRateLimit('regular', opts, t + 3).ok).toBe(false);
    // …while the oldest flood keys were dropped.
    expect(peekRateLimit('flood-0', opts, t + 3).remaining).toBe(3);
  });

  it('peekRateLimit reports without recording', () => {
    const t = 30_000_000;
    for (let i = 0; i < 10; i++) {
      expect(peekRateLimit('p', opts, t)).toEqual({ ok: true, remaining: 3, retryAfterSeconds: 0 });
    }
    for (let i = 0; i < 3; i++) rateLimit('p', opts, t);
    expect(peekRateLimit('p', opts, t + 1_000)).toEqual({
      ok: false,
      remaining: 0,
      retryAfterSeconds: 59,
    });
    expect(peekRateLimit('p', opts, t + 60_000).ok).toBe(true);
  });

  it('reads RATE_LIMIT_PER_MINUTE with a default of 8', () => {
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '');
    expect(writeRateLimit()).toEqual({ limit: 8, windowMs: 60_000 });
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '3');
    expect(writeRateLimit().limit).toBe(3);
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', 'lots');
    expect(writeRateLimit().limit).toBe(8);
  });
});

describe('client IP + hashing', () => {
  it('uses the X-Forwarded-For entry written by our proxy, then X-Real-IP, then "local"', () => {
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.9' }))).toBe('203.0.113.9');
    expect(getClientIp(req({ 'x-real-ip': '198.51.100.2' }))).toBe('198.51.100.2');
    expect(
      getClientIp(req({ 'x-forwarded-for': '203.0.113.9', 'x-real-ip': '198.51.100.2' })),
    ).toBe('203.0.113.9');
    expect(getClientIp(req({ 'x-forwarded-for': ' , ' }))).toBe('local');
    expect(getClientIp(req())).toBe('local');
  });

  it('ignores entries a client prepended to X-Forwarded-For (no rate-limit bypass)', () => {
    // nginx-style proxies append the real peer address to whatever the client sent.
    const spoofed = (fake: string) =>
      getClientIp(req({ 'x-forwarded-for': `${fake}, 203.0.113.7` }));
    expect(spoofed('1.1.1.1')).toBe('203.0.113.7');
    expect(spoofed('9.9.9.9, 8.8.8.8')).toBe('203.0.113.7');
  });

  it('honours TRUSTED_PROXY_HOPS for chains of proxies', () => {
    expect(trustedProxyHops()).toBe(1);
    vi.stubEnv('TRUSTED_PROXY_HOPS', '2');
    expect(trustedProxyHops()).toBe(2);
    // client-supplied, real client (added by the CDN), CDN edge (added by nginx)
    const chain = { 'x-forwarded-for': '6.6.6.6, 203.0.113.7, 198.51.100.1' };
    expect(getClientIp(req(chain))).toBe('203.0.113.7');
    // Fewer entries than hops: the leftmost one is the best we have.
    expect(getClientIp(req({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7');
    for (const bad of ['0', '-3', 'many', '']) {
      vi.stubEnv('TRUSTED_PROXY_HOPS', bad);
      expect(trustedProxyHops()).toBe(1);
    }
    vi.stubEnv('TRUSTED_PROXY_HOPS', '500');
    expect(trustedProxyHops()).toBe(10);
  });

  it('normalises addresses: ports, IPv4-mapped IPv6, zones and IPv6 /64 networks', () => {
    expect(normalizeIp('203.0.113.7:4711')).toBe('203.0.113.7');
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(normalizeIp('::FFFF:cb00:7107')).toBe('203.0.113.7');
    expect(normalizeIp('[2001:db8:1:2::1]:443')).toBe('2001:db8:1:2::/64');
    expect(normalizeIp('2001:DB8:1:2:aaaa:bbbb:cccc:dddd')).toBe('2001:db8:1:2::/64');
    expect(normalizeIp('fe80::1%eth0')).toBe('fe80:0:0:0::/64');
    expect(normalizeIp('::1')).toBe('0:0:0:0::/64');
    expect(normalizeIp('"203.0.113.7"')).toBe('203.0.113.7');
    expect(normalizeIp('Unknown')).toBe('unknown');
    expect(normalizeIp('x'.repeat(500))).toHaveLength(100);
  });

  it('puts every address of one IPv6 /64 in the same rate-limit bucket', () => {
    const a = getClientIp(req({ 'x-forwarded-for': '2001:db8:aa:bb::1' }));
    const b = getClientIp(req({ 'x-forwarded-for': '2001:db8:aa:bb:ffff:1234:5678:9abc' }));
    const other = getClientIp(req({ 'x-forwarded-for': '2001:db8:aa:bc::1' }));
    expect(a).toBe(b);
    expect(hashIp(a)).toBe(hashIp(b));
    expect(other).not.toBe(a);
  });

  it('hashes IPs with a salt: stable, hex, never the raw IP', () => {
    vi.stubEnv('APP_SECRET', 'secret-one');
    const h = hashIp('203.0.113.7');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).not.toContain('203');
    expect(hashIp('203.0.113.7')).toBe(h);
    expect(hashIp('203.0.113.8')).not.toBe(h);
    vi.stubEnv('APP_SECRET', 'secret-two');
    expect(hashIp('203.0.113.7')).not.toBe(h);
  });

  it('falls back to ADMIN_PASSWORD, then a constant, for the salt', () => {
    vi.stubEnv('APP_SECRET', '');
    vi.stubEnv('ADMIN_PASSWORD', '');
    const constant = hashIp('1.1.1.1');
    vi.stubEnv('ADMIN_PASSWORD', 'pw');
    expect(hashIp('1.1.1.1')).not.toBe(constant);
  });
});

describe('sanitizeText', () => {
  it('removes tags and script/style contents', () => {
    expect(sanitizeText('<script>alert(1)</script>Hi')).toBe('Hi');
    expect(sanitizeText('<b>bold</b> <i>move</i>')).toBe('bold move');
    expect(sanitizeText('<style>body{}</style><img src=x onerror=alert(1)>Ok')).toBe('Ok');
    expect(sanitizeText('<a href="javascript:alert(1)">click</a>')).toBe('click');
  });

  it('keeps ordinary punctuation as plain text (React escapes on render)', () => {
    expect(sanitizeText('Tom & Jerry say 5 > 3 and 2 < 4 "quoted" it\'s')).toBe(
      'Tom & Jerry say 5 > 3 and 2 < 4 "quoted" it\'s',
    );
    expect(sanitizeText('Hindi: नमस्ते 🃏')).toBe('Hindi: नमस्ते 🃏');
  });

  it('does not let entity-encoded markup survive as a tag', () => {
    const out = sanitizeText('&lt;script&gt;alert(1)&lt;/script&gt;safe');
    expect(out).not.toMatch(/<[a-z/!]/i);
    expect(out).toContain('safe');
  });

  it('never lets deeply nested entity encodings decode into a tag', () => {
    let payload = '<script>alert(1)</script><img src=x onerror=alert(1)>ok';
    for (let depth = 0; depth <= 12; depth++) {
      const out = sanitizeText(payload);
      expect(out, `depth ${depth}`).not.toMatch(/<\s*[a-z/!?]/i);
      expect(sanitizeText(out), `depth ${depth} is stable`).toBe(out);
      payload = payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
  });

  it('removes bidi override characters but keeps joiners used by Indic scripts and emoji', () => {
    expect(sanitizeText('Admin\u202Egnp.exe\u202C \u2066x\u2069')).toBe('Admingnp.exe x');
    expect(sanitizeText('क्\u200Dष 👩\u200D💻')).toBe('क्\u200Dष 👩\u200D💻');
  });

  it('strips control characters and normalises whitespace', () => {
    expect(sanitizeText('  a\u0000b\u0007c  ')).toBe('abc');
    expect(sanitizeText('line 1\r\n\r\n\r\n\r\nline   2\t\tend  ', { multiline: true })).toBe(
      'line 1\n\nline 2 end',
    );
    expect(sanitizeText('a\n b\t c', { multiline: false })).toBe('a b c');
  });
});

describe('isHoneypotFilled', () => {
  it('detects any non-empty website value', () => {
    expect(isHoneypotFilled({ website: 'http://spam.example' })).toBe(true);
    expect(isHoneypotFilled({ website: 1 })).toBe(true);
    expect(isHoneypotFilled({ website: ['x'] })).toBe(true);
  });

  it('ignores absent or empty values', () => {
    expect(isHoneypotFilled({})).toBe(false);
    expect(isHoneypotFilled({ website: '' })).toBe(false);
    expect(isHoneypotFilled({ website: '   ' })).toBe(false);
    expect(isHoneypotFilled({ website: null })).toBe(false);
    expect(isHoneypotFilled(null)).toBe(false);
    expect(isHoneypotFilled('website')).toBe(false);
  });
});

describe('admin session', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', 'correct horse');
    vi.stubEnv('APP_SECRET', 'test-secret');
  });

  it('is enabled only when ADMIN_PASSWORD is non-empty', () => {
    expect(isAdminEnabled()).toBe(true);
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(isAdminEnabled()).toBe(false);
    expect(checkAdminPassword('')).toBe(false);
  });

  it('treats a blank (whitespace-only) ADMIN_PASSWORD as disabled', () => {
    vi.stubEnv('ADMIN_PASSWORD', '   ');
    expect(isAdminEnabled()).toBe(false);
    expect(checkAdminPassword('   ')).toBe(false);
    expect(verifyAdminToken(createAdminToken())).toBe(false);
  });

  it('refuses the published example password and secret in production', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      vi.stubEnv('ADMIN_PASSWORD', 'change-me-locally');
      expect(isAdminEnabled()).toBe(true); // fine on a laptop
      vi.stubEnv('NODE_ENV', 'production');
      expect(isAdminEnabled()).toBe(false);
      expect(checkAdminPassword('change-me-locally')).toBe(false);
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('ADMIN_PASSWORD'));

      vi.stubEnv('ADMIN_PASSWORD', 'a real private password');
      vi.stubEnv('APP_SECRET', 'replace-with-a-long-random-string');
      const withExample = hashIp('203.0.113.7');
      vi.stubEnv('APP_SECRET', '');
      expect(hashIp('203.0.113.7')).toBe(withExample); // the example secret is ignored
    } finally {
      warn.mockRestore();
    }
  });

  it('checks the password exactly', () => {
    expect(checkAdminPassword('correct horse')).toBe(true);
    expect(checkAdminPassword('correct horse ')).toBe(false);
    expect(checkAdminPassword('Correct horse')).toBe(false);
    expect(checkAdminPassword('')).toBe(false);
  });

  it('creates tokens that verify for 8 hours', () => {
    const now = 1_700_000_000_000;
    const token = createAdminToken(now);
    expect(verifyAdminToken(token, now)).toBe(true);
    expect(verifyAdminToken(token, now + ADMIN_SESSION_SECONDS * 1000 - 1)).toBe(true);
    expect(verifyAdminToken(token, now + ADMIN_SESSION_SECONDS * 1000)).toBe(false);
  });

  it('rejects tampered, malformed and foreign tokens', () => {
    const now = Date.now();
    const token = createAdminToken(now);
    const [v, exp, nonce, sig] = token.split('.') as [string, string, string, string];
    expect(verifyAdminToken(`${v}.${Number(exp) + 1000}.${nonce}.${sig}`, now)).toBe(false);
    expect(verifyAdminToken(`${v}.${exp}.${nonce}x.${sig}`, now)).toBe(false);
    expect(verifyAdminToken(`${v}.${exp}.${nonce}.${sig.slice(1)}`, now)).toBe(false);
    expect(verifyAdminToken('garbage', now)).toBe(false);
    expect(verifyAdminToken('', now)).toBe(false);
    expect(verifyAdminToken(null, now)).toBe(false);
    vi.stubEnv('ADMIN_PASSWORD', 'a new password');
    expect(verifyAdminToken(token, now)).toBe(false); // changing the password logs out
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(verifyAdminToken(token, now)).toBe(false);
  });

  it('reads the cookie and guards admin routes', async () => {
    const token = createAdminToken();
    const authed = req({ cookie: `theme=dark; ${ADMIN_COOKIE}=${encodeURIComponent(token)}` });
    expect(readCookie(authed, ADMIN_COOKIE)).toBe(token);
    expect(isAdminRequest(authed)).toBe(true);
    expect(requireAdmin(authed)).toBeNull();

    const anonymous = requireAdmin(req());
    expect(anonymous?.status).toBe(401);
    expect(await anonymous?.json()).toEqual({ error: expect.any(String) });

    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(requireAdmin(authed)?.status).toBe(503);
  });

  it('blocks cross-site state-changing admin requests even with a valid cookie', () => {
    const cookie = `${ADMIN_COOKIE}=${createAdminToken()}`;
    const admin = (method: string, headers: Record<string, string>) =>
      requireAdmin(
        new Request('http://localhost/api/admin/posts/1', {
          method,
          headers: { cookie, host: 'localhost', ...headers },
        }),
      );
    expect(admin('DELETE', { 'sec-fetch-site': 'cross-site' })?.status).toBe(403);
    expect(admin('PATCH', { 'sec-fetch-site': 'same-site' })?.status).toBe(403);
    expect(admin('DELETE', { origin: 'https://evil.example' })?.status).toBe(403);
    expect(admin('DELETE', { 'sec-fetch-site': 'same-origin' })).toBeNull();
    expect(admin('DELETE', { origin: 'http://localhost' })).toBeNull();
    expect(admin('DELETE', {})).toBeNull(); // not a browser page: no ambient credentials
    // Reads are not state-changing (and the response is unreadable cross-origin).
    expect(admin('GET', { 'sec-fetch-site': 'cross-site' })).toBeNull();
  });

  it('isSameOriginRequest checks Sec-Fetch-Site, then Origin against Host / X-Forwarded-Host', () => {
    const check = (headers: Record<string, string>) =>
      isSameOriginRequest(new Request('http://internal:3000/api/x', { method: 'POST', headers }));
    expect(check({ 'sec-fetch-site': 'same-origin', origin: 'https://evil.example' })).toBe(true);
    expect(check({ 'sec-fetch-site': 'none' })).toBe(true);
    expect(check({ 'sec-fetch-site': 'cross-site' })).toBe(false);
    expect(check({ 'sec-fetch-site': 'same-site' })).toBe(false);
    expect(check({ origin: 'https://cards.example', host: 'cards.example' })).toBe(true);
    expect(
      check({
        origin: 'https://cards.example',
        host: 'internal:3000',
        'x-forwarded-host': 'cards.example',
      }),
    ).toBe(true);
    expect(check({ origin: 'https://cards.example.evil.io', host: 'cards.example' })).toBe(false);
    expect(check({ origin: 'https://cards.example:8443', host: 'cards.example' })).toBe(false);
    expect(check({ origin: 'null', host: 'cards.example' })).toBe(false);
    expect(check({ origin: 'not a url', host: 'cards.example' })).toBe(false);
    expect(check({ origin: 'http://internal:3000' })).toBe(true); // falls back to the URL host
    expect(check({})).toBe(true);
    expect(
      requireSameOrigin(new Request('http://a/x', { headers: { 'sec-fetch-site': 'cross-site' } }))
        ?.status,
    ).toBe(403);
  });

  it('uses strict, httpOnly cookie settings (secure in production)', () => {
    expect(adminCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 8 * 60 * 60,
    });
    vi.stubEnv('NODE_ENV', 'production');
    expect(adminCookieOptions(0)).toMatchObject({ secure: true, maxAge: 0 });
  });
});
