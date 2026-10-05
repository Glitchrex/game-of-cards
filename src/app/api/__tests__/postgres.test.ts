/**
 * The route handlers on the PRODUCTION Postgres path: DATABASE_URL=postgres://…
 * → getDb() → postgres-js pool → lazy migrations → repository, with PGlite
 * serving the wire protocol (src/server/test-utils/pglite-server.ts).
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminOverview, Comment, Post } from '@/lib/api-client';
import { closeDb, getDb } from '@/server/db/client';
import { resetRateLimits } from '@/server/security';
import { startPgliteServer, type PgliteServer } from '@/server/test-utils/pglite-server';
import * as postsRoute from '../posts/route';
import * as postRoute from '../posts/[id]/route';
import * as voteRoute from '../posts/[id]/vote/route';
import * as commentsRoute from '../posts/[id]/comments/route';
import * as contactRoute from '../contact/route';
import * as ratingsRoute from '../ratings/route';
import * as loginRoute from '../admin/login/route';
import * as overviewRoute from '../admin/overview/route';
import * as adminPostRoute from '../admin/posts/[id]/route';
import * as adminCommentRoute from '../admin/comments/[id]/route';
import * as adminMessageRoute from '../admin/messages/[id]/route';
import { body, idParams, request } from './helpers';

let server: PgliteServer;

beforeAll(async () => {
  server = await startPgliteServer();
  vi.stubEnv('DATABASE_URL', server.url);
  vi.stubEnv('ADMIN_PASSWORD', 'postgres-admin-password');
  vi.stubEnv('APP_SECRET', 'postgres-test-secret');
});
afterAll(async () => {
  await closeDb();
  vi.unstubAllEnvs();
  await server.close();
});
beforeEach(() => resetRateLimits());

describe('API on Postgres (postgres-js)', () => {
  it('migrates lazily on the first request and serves the whole public flow', async () => {
    expect((await getDb()).dialect).toBe('postgres');

    const created = await postsRoute.POST(
      request('/api/posts', {
        body: {
          type: 'game',
          title: '<b>Add</b> Bluff',
          body: 'Our family plays it every Diwali — please add it!',
          name: 'Farhan',
          email: 'farhan@example.com',
        },
      }),
    );
    expect(created.status).toBe(201);
    const { post } = await body<{ post: Post }>(created);
    expect(post).toMatchObject({ title: 'Add Bluff', authorName: 'Farhan', upvotes: 0 });
    expect(JSON.stringify(post)).not.toContain('farhan@example.com');

    const votes = await Promise.all(
      ['pg-voter-aaaa', 'pg-voter-bbbb', 'pg-voter-aaaa'].map((voterToken) =>
        voteRoute.POST(
          request(`/api/posts/${post.id}/vote`, { body: { voterToken } }),
          idParams(post.id),
        ),
      ),
    );
    expect(votes.map((r) => r.status)).toEqual([200, 200, 200]);

    const commented = await commentsRoute.POST(
      request(`/api/posts/${post.id}/comments`, { body: { body: 'Count me in!' } }),
      idParams(post.id),
    );
    expect(commented.status).toBe(201);

    const res = await postRoute.GET(
      request(`/api/posts/${post.id}?voter=pg-voter-bbbb`),
      idParams(post.id),
    );
    const data = await body<{ post: Post; comments: Comment[] }>(res);
    expect(data.post).toMatchObject({ upvotes: 1, commentCount: 1, hasVoted: true });
    expect(data.comments.map((c) => c.body)).toEqual(['Count me in!']);

    const listed = await body<{ posts: Post[] }>(
      await postsRoute.GET(request('/api/posts?sort=top&type=game')),
    );
    expect(listed.posts.map((p) => p.id)).toEqual([post.id]);

    expect(
      (
        await contactRoute.POST(
          request('/api/contact', {
            body: { name: 'Meera', email: 'meera@example.com', message: 'Hello from Postgres!' },
          }),
        )
      ).status,
    ).toBe(201);
    expect(
      (await ratingsRoute.POST(request('/api/ratings', { body: { gameSlug: 'war', stars: 4 } })))
        .status,
    ).toBe(201);
  });

  it('serves the admin view and moderation', async () => {
    const login = await loginRoute.POST(
      request('/api/admin/login', { body: { password: 'postgres-admin-password' } }),
    );
    const token = /goc_admin=([^;]+)/.exec(login.headers.get('set-cookie') ?? '')?.[1];
    const cookie = `goc_admin=${token}`;

    const overview = await body<AdminOverview>(
      await overviewRoute.GET(request('/api/admin/overview', { cookie })),
    );
    const [post] = overview.posts;
    expect(post).toMatchObject({ authorEmail: 'farhan@example.com', upvotes: 1, commentCount: 1 });
    expect(overview.messages[0]).toMatchObject({ name: 'Meera', read: false });
    expect(overview.ratingSummary).toEqual([{ gameSlug: 'war', count: 1, average: 4 }]);
    expect(JSON.stringify(overview)).not.toContain('ipHash');

    const patched = await adminPostRoute.PATCH(
      request(`/api/admin/posts/${post!.id}`, {
        method: 'PATCH',
        body: { status: 'done' },
        cookie,
      }),
      idParams(post!.id),
    );
    expect(await body(patched)).toMatchObject({ post: { status: 'done' } });
    const read = await adminMessageRoute.PATCH(
      request(`/api/admin/messages/${overview.messages[0]!.id}`, {
        method: 'PATCH',
        body: { read: true },
        cookie,
      }),
      idParams(overview.messages[0]!.id),
    );
    expect(read.status).toBe(200);
    const comment = overview.comments[0]!;
    expect(
      (
        await adminCommentRoute.DELETE(
          request(`/api/admin/comments/${comment.id}`, { method: 'DELETE', cookie }),
          idParams(comment.id),
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await adminPostRoute.DELETE(
          request(`/api/admin/posts/${post!.id}`, { method: 'DELETE', cookie }),
          idParams(post!.id),
        )
      ).status,
    ).toBe(200);

    const after = await body<AdminOverview>(
      await overviewRoute.GET(request('/api/admin/overview', { cookie })),
    );
    expect(after.posts).toEqual([]);
    expect(after.comments).toEqual([]);
    expect(after.messages[0]?.read).toBe(true);
    const leftovers = await server.db.query<{ n: number }>(
      'select (select count(*) from votes)::int + (select count(*) from comments)::int as n',
    );
    expect(leftovers.rows[0]?.n).toBe(0); // FK cascade removed the votes too
  });
});
