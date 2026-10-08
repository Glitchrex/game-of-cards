import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminOverview, AdminPost } from '@/lib/api-client';
import { getDb } from '@/server/db/client';
import {
  addComment,
  createContactMessage,
  createPost,
  createRating,
  getPost,
  toggleVote,
} from '@/server/repo';
import { ADMIN_LOGINS_PER_MINUTE } from '@/server/security';
import * as loginRoute from '../admin/login/route';
import * as logoutRoute from '../admin/logout/route';
import * as sessionRoute from '../admin/session/route';
import * as overviewRoute from '../admin/overview/route';
import * as postRoute from '../admin/posts/[id]/route';
import * as commentRoute from '../admin/comments/[id]/route';
import * as messageRoute from '../admin/messages/[id]/route';
import { body, idParams, nextIp, request, setupTestDatabase } from './helpers';

setupTestDatabase();

const PASSWORD = 'open sesame 42';

async function login(password: string, ip?: string) {
  return loginRoute.POST(request('/api/admin/login', { body: { password }, ip }));
}

/** Logs in and returns the Cookie header value for later requests. */
async function adminCookie(): Promise<string> {
  const res = await login(PASSWORD);
  expect(res.status).toBe(200);
  const token = /goc_admin=([^;]+)/.exec(res.headers.get('set-cookie') ?? '')?.[1];
  expect(token).toBeTruthy();
  return `goc_admin=${token}`;
}

async function seedPost(title = 'Moderate me') {
  const post = await createPost({
    type: 'bug',
    title,
    body: 'Cards overlap on small phones.',
    authorName: 'Neha',
    authorEmail: 'neha@example.com',
    ipHash: 'seed',
  });
  const comment = await addComment(post.id, { body: 'Same here', ipHash: 'seed' });
  await toggleVote(post.id, 'admin-test-voter', 'seed');
  return { post, comment: comment! };
}

describe('route config', () => {
  it('every admin route runs on Node and is never statically cached', () => {
    for (const mod of [
      loginRoute,
      logoutRoute,
      sessionRoute,
      overviewRoute,
      postRoute,
      commentRoute,
      messageRoute,
    ]) {
      expect(mod.runtime).toBe('nodejs');
      expect(mod.dynamic).toBe('force-dynamic');
    }
  });
});

describe('admin disabled (no ADMIN_PASSWORD)', () => {
  beforeEach(() => vi.stubEnv('ADMIN_PASSWORD', ''));

  it('reports disabled and answers 503 everywhere else', async () => {
    const session = await sessionRoute.GET(request('/api/admin/session'));
    expect(await body(session)).toEqual({ authenticated: false, enabled: false });
    expect((await login('anything')).status).toBe(503);
    expect((await overviewRoute.GET(request('/api/admin/overview'))).status).toBe(503);
    expect(
      (
        await postRoute.PATCH(
          request('/api/admin/posts/1', { method: 'PATCH', body: { status: 'done' } }),
          idParams(1),
        )
      ).status,
    ).toBe(503);
    expect(
      (await postRoute.DELETE(request('/api/admin/posts/1', { method: 'DELETE' }), idParams(1)))
        .status,
    ).toBe(503);
    expect(
      (
        await commentRoute.DELETE(
          request('/api/admin/comments/1', { method: 'DELETE' }),
          idParams(1),
        )
      ).status,
    ).toBe(503);
    expect(
      (
        await messageRoute.DELETE(
          request('/api/admin/messages/1', { method: 'DELETE' }),
          idParams(1),
        )
      ).status,
    ).toBe(503);
  });
});

describe('admin enabled', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_PASSWORD', PASSWORD);
    vi.stubEnv('APP_SECRET', 'admin-test-secret');
  });

  it('401s without a session cookie (or with a forged one)', async () => {
    const { post } = await seedPost();
    expect((await overviewRoute.GET(request('/api/admin/overview'))).status).toBe(401);
    const forged = 'goc_admin=v1.99999999999999.abc.def';
    expect(
      (await overviewRoute.GET(request('/api/admin/overview', { cookie: forged }))).status,
    ).toBe(401);
    const patch = await postRoute.PATCH(
      request(`/api/admin/posts/${post.id}`, { method: 'PATCH', body: { status: 'done' } }),
      idParams(post.id),
    );
    expect(patch.status).toBe(401);
    expect((await getPost(post.id))?.post.status).toBe('open');
    const session = await sessionRoute.GET(request('/api/admin/session'));
    expect(await body(session)).toEqual({ authenticated: false, enabled: true });
  });

  it('rejects a wrong password (401) and accepts the right one with a strict cookie', async () => {
    const wrong = await login('open sesame 43');
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get('set-cookie')).toBeNull();
    expect((await loginRoute.POST(request('/api/admin/login', { body: {} }))).status).toBe(400);
    expect((await loginRoute.POST(request('/api/admin/login', { raw: '{' }))).status).toBe(400);

    const right = await login(PASSWORD);
    expect(right.status).toBe(200);
    expect(await body(right)).toEqual({ ok: true });
    const cookie = right.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^goc_admin=v1\./);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=28800/);
    expect(cookie).not.toMatch(/Secure/i); // only in production

    const header = await adminCookie();
    const session = await sessionRoute.GET(request('/api/admin/session', { cookie: header }));
    expect(await body(session)).toEqual({ authenticated: true, enabled: true });
  });

  it('sets a Secure cookie in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const res = await login(PASSWORD);
    expect(res.headers.get('set-cookie')).toMatch(/Secure/i);
  });

  it('rate-limits failed login attempts per IP', async () => {
    const ip = nextIp();
    for (let i = 0; i < ADMIN_LOGINS_PER_MINUTE; i++) {
      expect((await login('guess', ip)).status).toBe(401);
    }
    expect((await login(PASSWORD, ip)).status).toBe(429);
    expect((await login(PASSWORD)).status).toBe(200);
  });

  it('does not count successful logins, so an admin (or an E2E suite) is never locked out', async () => {
    const ip = nextIp();
    for (let i = 0; i < ADMIN_LOGINS_PER_MINUTE * 2; i++) {
      expect((await login(PASSWORD, ip)).status).toBe(200);
    }
    for (let i = 0; i < ADMIN_LOGINS_PER_MINUTE; i++) {
      expect((await login('guess', ip)).status).toBe(401);
    }
    expect((await login('guess', ip)).status).toBe(429);
  });

  it('cannot spread password guesses over forged X-Forwarded-For entries', async () => {
    for (let i = 0; i < ADMIN_LOGINS_PER_MINUTE; i++) {
      expect((await login('guess', `10.66.${i}.1, 198.51.100.66`)).status).toBe(401);
    }
    expect((await login(PASSWORD, '10.66.99.1, 198.51.100.66')).status).toBe(429);
  });

  it('refuses cross-site login, logout and moderation (CSRF), even with a valid cookie', async () => {
    const cookie = await adminCookie();
    const { post } = await seedPost('CSRF target');
    const crossSite = { 'sec-fetch-site': 'cross-site' };
    const sameSite = { 'sec-fetch-site': 'same-site' };
    const foreignOrigin = { origin: 'https://evil.example' };

    for (const headers of [crossSite, sameSite, foreignOrigin]) {
      const patch = await postRoute.PATCH(
        request(`/api/admin/posts/${post.id}`, {
          method: 'PATCH',
          body: { status: 'done' },
          cookie,
          headers,
        }),
        idParams(post.id),
      );
      expect(patch.status).toBe(403);
      expect(await body(patch)).toEqual({ error: 'Cross-site requests are not allowed.' });
      const del = await postRoute.DELETE(
        request(`/api/admin/posts/${post.id}`, { method: 'DELETE', cookie, headers }),
        idParams(post.id),
      );
      expect(del.status).toBe(403);
      expect(
        (
          await commentRoute.DELETE(
            request('/api/admin/comments/1', { method: 'DELETE', cookie, headers }),
            idParams(1),
          )
        ).status,
      ).toBe(403);
      expect(
        (
          await messageRoute.PATCH(
            request('/api/admin/messages/1', {
              method: 'PATCH',
              body: { read: true },
              cookie,
              headers,
            }),
            idParams(1),
          )
        ).status,
      ).toBe(403);
      const crossLogin = await loginRoute.POST(
        request('/api/admin/login', { body: { password: PASSWORD }, headers }),
      );
      expect(crossLogin.status).toBe(403);
      expect(crossLogin.headers.get('set-cookie')).toBeNull();
      const crossLogout = await logoutRoute.POST(
        request('/api/admin/logout', { method: 'POST', cookie, headers }),
      );
      expect(crossLogout.status).toBe(403);
      expect(crossLogout.headers.get('set-cookie')).toBeNull();
    }
    const found = await getPost(post.id);
    expect(found?.post.status).toBe('open');

    // The real admin UI (same origin) still works, with or without Sec-Fetch-Site.
    const sameOrigin: Record<string, string>[] = [
      { 'sec-fetch-site': 'same-origin' },
      { origin: 'http://localhost', host: 'localhost' },
    ];
    for (const headers of sameOrigin) {
      const ok = await postRoute.PATCH(
        request(`/api/admin/posts/${post.id}`, {
          method: 'PATCH',
          body: { status: 'planned' },
          cookie,
          headers,
        }),
        idParams(post.id),
      );
      expect(ok.status).toBe(200);
    }
  });

  it('only accepts JSON bodies for login and updates (415)', async () => {
    const cookie = await adminCookie();
    const { post } = await seedPost();
    const form = { 'content-type': 'application/x-www-form-urlencoded' };
    expect(
      (
        await loginRoute.POST(
          request('/api/admin/login', { body: { password: PASSWORD }, headers: form }),
        )
      ).status,
    ).toBe(415);
    const patch = await postRoute.PATCH(
      request(`/api/admin/posts/${post.id}`, {
        method: 'PATCH',
        body: { status: 'done' },
        cookie,
        headers: { 'content-type': 'text/plain' },
      }),
      idParams(post.id),
    );
    expect(patch.status).toBe(415);
    expect((await getPost(post.id))?.post.status).toBe('open');
  });

  it('treats a blank ADMIN_PASSWORD as disabled', async () => {
    vi.stubEnv('ADMIN_PASSWORD', '   ');
    expect(await body(await sessionRoute.GET(request('/api/admin/session')))).toEqual({
      authenticated: false,
      enabled: false,
    });
    expect((await login('   ')).status).toBe(503);
    expect((await overviewRoute.GET(request('/api/admin/overview'))).status).toBe(503);
  });

  it('logout clears the cookie', async () => {
    const res = await logoutRoute.POST(request('/api/admin/logout', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true });
    const cookie = res.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^goc_admin=;/);
    expect(cookie).toMatch(/Max-Age=0/);
  });

  it('overview includes posts (with email), comments (with title), messages, ratings and averages', async () => {
    const cookie = await adminCookie();
    const { post, comment } = await seedPost('Overview post');
    const message = await createContactMessage({
      name: 'Arjun',
      email: 'arjun@example.com',
      message: 'Can you add Bluff?',
      ipHash: 'seed',
    });
    await createRating({ gameSlug: 'hearts', stars: 5, ipHash: 'seed' });
    await createRating({ gameSlug: 'hearts', stars: 4, comment: 'Clear', ipHash: 'seed' });

    const res = await overviewRoute.GET(request('/api/admin/overview', { cookie }));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    const data = await body<AdminOverview>(res);
    expect(data.posts.find((p) => p.id === post.id)).toMatchObject({
      authorEmail: 'neha@example.com',
      upvotes: 1,
      commentCount: 1,
    });
    expect(data.comments.find((c) => c.id === comment.id)).toMatchObject({
      postTitle: 'Overview post',
      body: 'Same here',
    });
    expect(data.messages.find((m) => m.id === message.id)).toMatchObject({
      name: 'Arjun',
      email: 'arjun@example.com',
      read: false,
    });
    expect(data.ratings.filter((r) => r.gameSlug === 'hearts')).toHaveLength(2);
    expect(data.ratingSummary).toContainEqual({ gameSlug: 'hearts', count: 2, average: 4.5 });
    expect(JSON.stringify(data)).not.toContain('ipHash');
  });

  it('changes a post status', async () => {
    const cookie = await adminCookie();
    const { post } = await seedPost();
    const patch = (id: string | number, payload: unknown) =>
      postRoute.PATCH(
        request(`/api/admin/posts/${id}`, { method: 'PATCH', body: payload, cookie }),
        idParams(id),
      );

    const res = await patch(post.id, { status: 'planned' });
    expect(res.status).toBe(200);
    const { post: updated } = await body<{ post: AdminPost }>(res);
    expect(updated).toMatchObject({
      id: post.id,
      status: 'planned',
      authorEmail: 'neha@example.com',
    });
    expect((await getPost(post.id))?.post.status).toBe('planned');

    expect((await patch(post.id, { status: 'archived' })).status).toBe(400);
    expect((await patch(post.id, {})).status).toBe(400);
    expect((await patch(999_999, { status: 'done' })).status).toBe(404);
    expect((await patch('abc', { status: 'done' })).status).toBe(404);
    const badJson = await postRoute.PATCH(
      request(`/api/admin/posts/${post.id}`, { method: 'PATCH', raw: 'status=done', cookie }),
      idParams(post.id),
    );
    expect(badJson.status).toBe(400);
  });

  it('deletes a post and cascades its comments and votes', async () => {
    const cookie = await adminCookie();
    const { post, comment } = await seedPost('Doomed post');
    const del = (id: string | number) =>
      postRoute.DELETE(
        request(`/api/admin/posts/${id}`, { method: 'DELETE', cookie }),
        idParams(id),
      );

    const res = await del(post.id);
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true });
    expect(await getPost(post.id)).toBeNull();

    const { db, schema } = await getDb();
    expect((await db.select().from(schema.comments)).some((c) => c.id === comment.id)).toBe(false);
    expect((await db.select().from(schema.votes)).some((v) => v.postId === post.id)).toBe(false);

    expect((await del(post.id)).status).toBe(404);
    expect((await del('0')).status).toBe(404);
  });

  it('deletes a comment and decrements the count', async () => {
    const cookie = await adminCookie();
    const { post, comment } = await seedPost();
    await addComment(post.id, { body: 'Another', ipHash: 'seed' });
    expect((await getPost(post.id))?.post.commentCount).toBe(2);
    const del = (id: string | number) =>
      commentRoute.DELETE(
        request(`/api/admin/comments/${id}`, { method: 'DELETE', cookie }),
        idParams(id),
      );

    const res = await del(comment.id);
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true });
    const found = await getPost(post.id);
    expect(found?.post.commentCount).toBe(1);
    expect(found?.comments.map((c) => c.body)).toEqual(['Another']);
    expect((await del(comment.id)).status).toBe(404);
    expect((await del('x')).status).toBe(404);
  });

  it('marks messages read/unread and deletes them', async () => {
    const cookie = await adminCookie();
    const { id } = await createContactMessage({
      name: 'Zoya',
      email: 'zoya@example.com',
      message: 'Thanks for the Rummy lesson',
      ipHash: 'seed',
    });
    const patch = (msgId: number | string, payload: unknown) =>
      messageRoute.PATCH(
        request(`/api/admin/messages/${msgId}`, { method: 'PATCH', body: payload, cookie }),
        idParams(msgId),
      );
    const read = async () => {
      const res = await overviewRoute.GET(request('/api/admin/overview', { cookie }));
      return (await body<AdminOverview>(res)).messages.find((m) => m.id === id);
    };

    const res = await patch(id, { read: true });
    expect(res.status).toBe(200);
    expect(await body(res)).toEqual({ ok: true });
    expect((await read())?.read).toBe(true);
    expect((await patch(id, { read: false })).status).toBe(200);
    expect((await read())?.read).toBe(false);
    expect((await patch(id, { read: 'yes' })).status).toBe(400);
    expect((await patch(999_999, { read: true })).status).toBe(404);

    const del = await messageRoute.DELETE(
      request(`/api/admin/messages/${id}`, { method: 'DELETE', cookie }),
      idParams(id),
    );
    expect(del.status).toBe(200);
    expect(await read()).toBeUndefined();
    const again = await messageRoute.DELETE(
      request(`/api/admin/messages/${id}`, { method: 'DELETE', cookie }),
      idParams(id),
    );
    expect(again.status).toBe(404);
  });

  it('a session dies when the admin password changes', async () => {
    const cookie = await adminCookie();
    expect((await overviewRoute.GET(request('/api/admin/overview', { cookie }))).status).toBe(200);
    vi.stubEnv('ADMIN_PASSWORD', 'rotated password');
    expect((await overviewRoute.GET(request('/api/admin/overview', { cookie }))).status).toBe(401);
  });
});
