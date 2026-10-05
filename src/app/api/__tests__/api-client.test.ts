/**
 * End-to-end test of src/lib/api-client.ts: `fetch` is routed straight into
 * the real route handlers (with a tiny cookie jar), proving that every helper
 * hits an existing endpoint with the right method and payload, and that
 * errors come back as values instead of exceptions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as api from '@/lib/api-client';
import * as postsRoute from '../posts/route';
import * as postRoute from '../posts/[id]/route';
import * as voteRoute from '../posts/[id]/vote/route';
import * as commentsRoute from '../posts/[id]/comments/route';
import * as contactRoute from '../contact/route';
import * as ratingsRoute from '../ratings/route';
import * as loginRoute from '../admin/login/route';
import * as logoutRoute from '../admin/logout/route';
import * as sessionRoute from '../admin/session/route';
import * as overviewRoute from '../admin/overview/route';
import * as adminPostRoute from '../admin/posts/[id]/route';
import * as adminCommentRoute from '../admin/comments/[id]/route';
import * as adminMessageRoute from '../admin/messages/[id]/route';
import { nextIp, setupTestDatabase } from './helpers';

setupTestDatabase();

type Handler = (req: Request, ctx: { params: Promise<{ id: string }> }) => Promise<Response>;
type RouteModule = Partial<Record<'GET' | 'POST' | 'PATCH' | 'DELETE', unknown>>;

const ROUTES: [RegExp, RouteModule][] = [
  [/^\/api\/posts$/, postsRoute],
  [/^\/api\/posts\/([^/]+)$/, postRoute],
  [/^\/api\/posts\/([^/]+)\/vote$/, voteRoute],
  [/^\/api\/posts\/([^/]+)\/comments$/, commentsRoute],
  [/^\/api\/contact$/, contactRoute],
  [/^\/api\/ratings$/, ratingsRoute],
  [/^\/api\/admin\/login$/, loginRoute],
  [/^\/api\/admin\/logout$/, logoutRoute],
  [/^\/api\/admin\/session$/, sessionRoute],
  [/^\/api\/admin\/overview$/, overviewRoute],
  [/^\/api\/admin\/posts\/([^/]+)$/, adminPostRoute],
  [/^\/api\/admin\/comments\/([^/]+)$/, adminCommentRoute],
  [/^\/api\/admin\/messages\/([^/]+)$/, adminMessageRoute],
];

let cookieJar: string | null = null;
const calls: { method: string; path: string }[] = [];

async function routedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = new URL(String(input), 'http://localhost');
  const method = (init.method ?? 'GET').toUpperCase() as keyof RouteModule;
  calls.push({ method, path: url.pathname + url.search });
  for (const [pattern, mod] of ROUTES) {
    const match = pattern.exec(url.pathname);
    if (!match) continue;
    const handler = mod[method] as Handler | undefined;
    if (!handler) return new Response(null, { status: 405 });
    const headers = new Headers(init.headers);
    headers.set('x-forwarded-for', nextIp());
    if (cookieJar) headers.set('cookie', cookieJar);
    const req = new Request(url, { method, headers, body: init.body ?? undefined });
    const res = await handler(req, { params: Promise.resolve({ id: match[1] ?? '' }) });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const [pair] = setCookie.split(';');
      cookieJar = /Max-Age=0/i.test(setCookie) ? null : (pair ?? null);
    }
    return res;
  }
  return new Response('<html>Not found</html>', { status: 404 });
}

beforeEach(() => {
  cookieJar = null;
  calls.length = 0;
  vi.stubGlobal('fetch', vi.fn(routedFetch));
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('labels', () => {
  it('match the documented UI copy', () => {
    expect(api.POST_TYPE_LABELS).toEqual({
      feature: 'Feature request',
      bug: 'Bug',
      game: 'Game request',
      general: 'General feedback',
    });
    expect(api.POST_STATUS_LABELS).toEqual({
      open: 'Open',
      planned: 'Planned',
      'in-progress': 'In progress',
      done: 'Done',
    });
  });
});

describe('public helpers', () => {
  it('create → list → vote → comment → get, all as typed results', async () => {
    const created = await api.createPost({
      type: 'game',
      title: 'Add Bluff please',
      body: 'Our whole family plays Bluff at Diwali.',
      name: 'Farhan',
      website: '',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const { post } = created.data;
    expect(post.title).toBe('Add Bluff please');

    const voter = 'client-test-voter';
    const voted = await api.toggleVote(post.id, voter);
    expect(voted).toEqual({ ok: true, data: { upvotes: 1, hasVoted: true } });

    const listed = await api.listPosts({ sort: 'top', type: 'game', voter });
    expect(listed.ok && listed.data.posts.find((p) => p.id === post.id)?.hasVoted).toBe(true);
    const all = await api.listPosts({ type: 'all' });
    expect(all.ok && all.data.posts.length).toBeGreaterThan(0);

    const commented = await api.addComment(post.id, { body: 'Count me in!' });
    expect(commented.ok && commented.data.comment.postId).toBe(post.id);

    const fetched = await api.getPost(post.id, voter);
    expect(fetched.ok).toBe(true);
    if (fetched.ok) {
      expect(fetched.data.post).toMatchObject({ upvotes: 1, commentCount: 1, hasVoted: true });
      expect(fetched.data.comments.map((c) => c.body)).toEqual(['Count me in!']);
    }

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'POST /api/posts',
      `POST /api/posts/${post.id}/vote`,
      `GET /api/posts?sort=top&type=game&voter=${voter}`,
      'GET /api/posts',
      `POST /api/posts/${post.id}/comments`,
      `GET /api/posts/${post.id}?voter=${voter}`,
    ]);
  });

  it('returns validation errors with fieldErrors instead of throwing', async () => {
    const res = await api.createPost({ type: 'bug', title: 'x', body: 'y' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(400);
    expect(res.error).toEqual(expect.any(String));
    expect(Object.keys(res.fieldErrors ?? {}).sort()).toEqual(['body', 'title']);

    const missing = await api.getPost(999_999);
    expect(missing).toEqual({ ok: false, status: 404, error: 'Post not found.' });
  });

  it('sends contact messages and ratings', async () => {
    expect(
      await api.sendContact({
        name: 'Meera',
        email: 'meera@example.com',
        message: 'Hello from the client!',
      }),
    ).toEqual({ ok: true, data: { ok: true } });
    expect(await api.sendRating({ gameSlug: 'blackjack', stars: 5, comment: 'Loved it' })).toEqual({
      ok: true,
      data: { ok: true },
    });
    const bad = await api.sendRating({ gameSlug: 'blackjack', stars: 9 });
    expect(bad.ok).toBe(false);
    expect(!bad.ok && bad.fieldErrors).toHaveProperty('stars');
  });

  it('turns network failures and non-JSON errors into values', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const offline = await api.listPosts();
    expect(offline).toEqual({ ok: false, status: 0, error: expect.stringMatching(/network/i) });

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')));
    expect(await api.listPosts()).toEqual({ ok: false, status: 0, error: 'Request cancelled.' });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
    );
    const gateway = await api.toggleVote(1, 'some-voter-token');
    expect(gateway).toEqual({ ok: false, status: 502, error: expect.any(String) });
  });
});

describe('unexpected success bodies', () => {
  it('reports a 200 that is not a JSON object as a failure instead of handing back null', async () => {
    for (const reply of [
      new Response('<html>Captive portal</html>', { status: 200 }),
      new Response(null, { status: 200 }),
      new Response('[1,2,3]', { status: 200 }),
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(reply));
      expect(await api.listPosts()).toEqual({ ok: false, status: 200, error: expect.any(String) });
    }
  });
});

describe('admin helpers', () => {
  it('reports a disabled admin', async () => {
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(await api.adminSession()).toEqual({
      ok: true,
      data: { authenticated: false, enabled: false },
    });
    const login = await api.adminLogin('anything');
    expect(login.ok === false && login.status).toBe(503);
  });

  it('logs in, moderates everything, and logs out', async () => {
    vi.stubEnv('ADMIN_PASSWORD', 'client-test-password');
    expect(await api.adminSession()).toEqual({
      ok: true,
      data: { authenticated: false, enabled: true },
    });
    const denied = await api.adminOverview();
    expect(denied.ok === false && denied.status).toBe(401);

    const wrong = await api.adminLogin('nope');
    expect(wrong).toEqual({ ok: false, status: 401, error: expect.any(String) });
    expect(await api.adminLogin('client-test-password')).toEqual({ ok: true, data: { ok: true } });
    expect(await api.adminSession()).toEqual({
      ok: true,
      data: { authenticated: true, enabled: true },
    });

    const created = await api.createPost({
      type: 'bug',
      title: 'Moderation target',
      body: 'Something to moderate in this test.',
      email: 'reporter@example.com',
    });
    if (!created.ok) throw new Error(created.error);
    const postId = created.data.post.id;
    const commented = await api.addComment(postId, { body: 'Delete me' });
    if (!commented.ok) throw new Error(commented.error);
    await api.sendContact({
      name: 'Zed',
      email: 'zed@example.com',
      message: 'Please read me soon',
    });

    const overview = await api.adminOverview();
    if (!overview.ok) throw new Error(overview.error);
    expect(overview.data.posts.find((p) => p.id === postId)?.authorEmail).toBe(
      'reporter@example.com',
    );
    const message = overview.data.messages.find((m) => m.name === 'Zed');
    expect(message?.read).toBe(false);

    const status = await api.adminSetPostStatus(postId, 'done');
    expect(status.ok && status.data.post.status).toBe('done');
    expect(await api.adminDeleteComment(commented.data.comment.id)).toEqual({
      ok: true,
      data: { ok: true },
    });
    expect(await api.adminSetMessageRead(message!.id, true)).toEqual({
      ok: true,
      data: { ok: true },
    });
    expect(await api.adminDeleteMessage(message!.id)).toEqual({ ok: true, data: { ok: true } });
    expect(await api.adminDeletePost(postId)).toEqual({ ok: true, data: { ok: true } });
    const gone = await api.adminDeletePost(postId);
    expect(gone.ok === false && gone.status).toBe(404);

    expect(await api.adminLogout()).toEqual({ ok: true, data: { ok: true } });
    expect(await api.adminSession()).toEqual({
      ok: true,
      data: { authenticated: false, enabled: true },
    });

    const methods = new Set(calls.map((c) => `${c.method} ${c.path.replace(/\d+/g, ':id')}`));
    for (const expected of [
      'POST /api/admin/login',
      'POST /api/admin/logout',
      'GET /api/admin/session',
      'GET /api/admin/overview',
      'PATCH /api/admin/posts/:id',
      'DELETE /api/admin/posts/:id',
      'DELETE /api/admin/comments/:id',
      'PATCH /api/admin/messages/:id',
      'DELETE /api/admin/messages/:id',
    ]) {
      expect(methods).toContain(expected);
    }
  });
});
