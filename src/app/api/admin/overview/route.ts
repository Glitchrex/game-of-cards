/** GET /api/admin/overview — everything the moderation view needs. */
import { overview } from '@/server/repo';
import { requireAdmin } from '@/server/security';
import { handle, json } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return handle('GET /api/admin/overview', async () => json(await overview()));
}
