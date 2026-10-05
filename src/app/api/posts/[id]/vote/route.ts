/** POST /api/posts/:id/vote — toggle this browser's upvote. See docs/API.md. */
import { toggleVote } from '@/server/repo';
import { VOTE_RATE_LIMIT } from '@/server/security';
import {
  handle,
  idFromContext,
  json,
  notFound,
  publicWrite,
  type IdRouteContext,
} from '@/server/http';
import { voteSchema } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request, ctx: IdRouteContext) {
  return handle('POST /api/posts/:id/vote', async () => {
    const id = await idFromContext(ctx);
    if (id === null) return notFound('Post');
    return publicWrite(req, {
      bucket: 'vote',
      limit: VOTE_RATE_LIMIT,
      schema: voteSchema,
      persist: async (data, { ipHash }) => {
        const result = await toggleVote(id, data.voterToken, ipHash);
        if (!result) return notFound('Post');
        return json(result);
      },
    });
  });
}
