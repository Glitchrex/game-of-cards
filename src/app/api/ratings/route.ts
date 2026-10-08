/** POST /api/ratings — "How was this lesson?" stars. See docs/API.md. */
import { createRating } from '@/server/repo';
import { writeRateLimit } from '@/server/security';
import { cleanOptionalBlock, handle, json, publicWrite } from '@/server/http';
import { ratingSchema } from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle('POST /api/ratings', () =>
    publicWrite(req, {
      bucket: 'write',
      limit: writeRateLimit(),
      honeypot: () => ({ ok: true }),
      schema: ratingSchema,
      sanitize: (data) => ({ ...data, comment: cleanOptionalBlock(data.comment) }),
      persist: async (data, { ipHash }) => {
        await createRating({
          gameSlug: data.gameSlug,
          stars: data.stars,
          comment: data.comment || null,
          ipHash,
        });
        return json({ ok: true }, 201);
      },
    }),
  );
}
