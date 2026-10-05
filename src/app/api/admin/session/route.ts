/** GET /api/admin/session — is admin enabled, and is this browser logged in? */
import { isAdminEnabled, isAdminRequest } from '@/server/security';
import { json } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const enabled = isAdminEnabled();
  return json({ authenticated: enabled && isAdminRequest(req), enabled });
}
