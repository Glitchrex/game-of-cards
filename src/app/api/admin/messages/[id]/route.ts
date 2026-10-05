/** PATCH /api/admin/messages/:id (read flag) · DELETE /api/admin/messages/:id. */
import { deleteMessage, setMessageRead } from '@/server/repo';
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
import { adminMessagePatchSchema, validate } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PATCH(req: Request, ctx: IdRouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return handle('PATCH /api/admin/messages/:id', async () => {
    const id = await idFromContext(ctx);
    if (id === null) return notFound('Message');
    const parsed = await readJsonBody(req);
    if (!parsed.ok) return parsed.response;
    const input = validate(adminMessagePatchSchema, parsed.body);
    if (!input.ok) return errorJson(400, input.error, input.fieldErrors);
    if (!(await setMessageRead(id, input.data.read))) return notFound('Message');
    return json({ ok: true });
  });
}

export async function DELETE(req: Request, ctx: IdRouteContext) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return handle('DELETE /api/admin/messages/:id', async () => {
    const id = await idFromContext(ctx);
    if (id === null || !(await deleteMessage(id))) return notFound('Message');
    return json({ ok: true });
  });
}
