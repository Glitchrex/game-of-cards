/** POST /api/admin/logout — clear the admin session cookie. */
import { ADMIN_COOKIE, adminCookieOptions, requireSameOrigin } from '@/server/security';
import { json } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  // A cross-site page must not be able to sign the admin out either.
  const crossSite = requireSameOrigin(req);
  if (crossSite) return crossSite;
  const res = json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', adminCookieOptions(0));
  return res;
}
