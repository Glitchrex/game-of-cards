/** PATCH /api/admin/posts/:id (status) · DELETE /api/admin/posts/:id (cascades). */
import { deletePost, setPostStatus } from '@/server/repo';
import { requireAdmin } from '@/server/security';
import {
  errorJson,
  handle,
  idFromContext,
  json,
  notFound,
  readJsonBody,
  type IdRouteContext,
} from '@/server/http';
import { adminPostPatchSchema, validate } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: IdRouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return handle('PATCH /api/admin/posts/:id', async () => {
    const id = await idFromContext(ctx);
    if (id === null) return notFound('Post');
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return parsed.response;
    const input = validate(adminPostPatchSchema, parsed.body);
    if (!input.ok) return errorJson(400, input.error, input.fieldErrors);
    const post = await setPostStatus(id, input.data.status);
    if (!post) return notFound('Post');
    return json({ post });
  });
}

export async function DELETE(req: Request, ctx: IdRouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return handle('DELETE /api/admin/posts/:id', async () => {
    const id = await idFromContext(ctx);
    if (id === null || !(await deletePost(id))) return notFound('Post');
    return json({ ok: true });
  });
}
