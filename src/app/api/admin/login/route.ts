/** POST /api/admin/login — exchange ADMIN_PASSWORD for a session cookie. */
import {
  ADMIN_COOKIE,
  ADMIN_DISABLED_MESSAGE,
  adminCookieOptions,
  checkAdminPassword,
  createAdminToken,
  getClientIp,
  hashIp,
  isAdminEnabled,
  LOGIN_RATE_LIMIT,
  peekRateLimit,
  rateLimit,
  requireSameOrigin,
} from '@/server/security';
import { errorJson, handle, json, readJsonBody, tooManyRequests } from '@/server/http';
import { adminLoginSchema, validate } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle('POST /api/admin/login', async () => {
    if (!isAdminEnabled()) return errorJson(503, ADMIN_DISABLED_MESSAGE);
    // Blocks login CSRF (a page on a sibling subdomain signing the browser in).
    const crossSite = requireSameOrigin(req);
    if (crossSite) return crossSite;

    const parsed = await readJsonBody(req);
    if (!parsed.ok) return parsed.response;

    // Only failed attempts use up the budget, so a busy admin (or an E2E
    // suite) is never locked out by successful logins. Everything from the
    // peek to the recorded failure runs synchronously, so parallel guesses
    // can't slip past the limit between the two calls.
    const key = `login:${hashIp(getClientIp(req))}`;
    const limited = peekRateLimit(key, LOGIN_RATE_LIMIT);
    if (!limited.ok) return tooManyRequests(limited.retryAfterSeconds);

    const input = validate(adminLoginSchema, parsed.body);
    if (!input.ok) return errorJson(400, input.error, input.fieldErrors);
    if (!checkAdminPassword(input.data.password)) {
      rateLimit(key, LOGIN_RATE_LIMIT);
      return errorJson(401, 'That password is not right.');
    }

    const res = json({ ok: true });
    res.cookies.set(ADMIN_COOKIE, createAdminToken(), adminCookieOptions());
    return res;
  });
}
