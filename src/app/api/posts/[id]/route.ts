/** GET /api/posts/:id — one post with its comments. See docs/API.md. */
import { getPost } from '@/server/repo';
import {
  errorJson,
  handle,
  idFromContext,
  json,
  notFound,
  type IdRouteContext,
} from '@/server/http';
import { getPostQuerySchema, searchParamsToObject, validate } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, ctx: IdRouteContext) {
  return handle('GET /api/posts/:id', async () => {
    const id = await idFromContext(ctx);
    if (id === null) return notFound('Post');
    const query = validate(getPostQuerySchema, searchParamsToObject(new URL(req.url).searchParams));
    if (!query.ok) return errorJson(400, query.error, query.fieldErrors);
    const found = await getPost(id, query.data.voter);
    if (!found) return notFound('Post');
    return json(found);
  });
}
