/** GET /api/posts (list, sort, filter) · POST /api/posts (create). See docs/API.md. */
import { createPost, listPosts } from '@/server/repo';
import { writeRateLimit } from '@/server/security';
import {
  cleanBlock,
  cleanLine,
  cleanOptionalLine,
  errorJson,
  fakePost,
  handle,
  json,
  publicWrite,
} from '@/server/http';
import {
  createPostSchema,
  listPostsQuerySchema,
  searchParamsToObject,
  validate,
} from '@/server/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle('GET /api/posts', async () => {
    const query = validate(
      listPostsQuerySchema,
      searchParamsToObject(new URL(req.url).searchParams),
    );
    if (!query.ok) return errorJson(400, query.error, query.fieldErrors);
    const posts = await listPosts({
      sort: query.data.sort,
      type: query.data.type,
      voterToken: query.data.voter,
    });
    return json({ posts });
  });
}

export async function POST(req: Request) {
  return handle('POST /api/posts', () =>
    publicWrite(req, {
      bucket: 'write',
      limit: writeRateLimit(),
      honeypot: (data) => ({ post: fakePost(data) }),
      schema: createPostSchema,
      sanitize: (data) => ({
        ...data,
        title: cleanLine(data.title),
        body: cleanBlock(data.body),
        name: cleanOptionalLine(data.name),
      }),
      persist: async (data, { ipHash }) => {
        const post = await createPost({
          type: data.type,
          title: data.title,
          body: data.body,
          authorName: data.name || null,
          authorEmail: data.email || null,
          ipHash,
        });
        return json({ post }, 201);
      },
    }),
  );
}
