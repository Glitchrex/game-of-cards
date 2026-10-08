/** DELETE /api/admin/comments/:id (keeps the post's comment count in sync). */
import { deleteComment } from '@/server/repo';
import { requireAdmin } from '@/server/security';
import { handle, idFromContext, json, notFound, type IdRouteContext } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(req: Request, ctx: IdRouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return handle('DELETE /api/admin/comments/:id', async () => {
    const id = await idFromContext(ctx);
    if (id === null || !(await deleteComment(id))) return notFound('Comment');
    return json({ ok: true });
  });
}
