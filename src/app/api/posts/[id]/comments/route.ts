/** POST /api/posts/:id/comments — add a comment. See docs/API.md. */
import { addComment } from '@/server/repo';
import { writeRateLimit } from '@/server/security';
import {
  cleanBlock,
  cleanOptionalLine,
  fakeComment,
  handle,
  idFromContext,
  json,
  notFound,
  publicWrite,
  type IdRouteContext,
} from '@/server/http';
import { createCommentSchema } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: IdRouteContext) {
  return handle('POST /api/posts/:id/comments', async () => {
    const id = await idFromContext(ctx);
    if (id === null) return notFound('Post');
    return publicWrite(req, {
      bucket: 'write',
      limit: writeRateLimit(),
      honeypot: (data) => ({ comment: fakeComment(id, data) }),
      schema: createCommentSchema,
      sanitize: (data) => ({
        ...data,
        body: cleanBlock(data.body),
        name: cleanOptionalLine(data.name),
      }),
      persist: async (data, { ipHash }) => {
        const comment = await addComment(id, {
          body: data.body,
          authorName: data.name || null,
          ipHash,
        });
        if (!comment) return notFound('Post');
        return json({ comment }, 201);
      },
    });
  });
}
