import { describe, expect, it, vi } from 'vitest';
import type { Comment, Post } from '@/lib/api-client';
import { countPosts, getPost } from '@/server/repo';
import { getDb } from '@/server/db/client';
import { RATE_LIMIT_MESSAGE, VOTES_PER_MINUTE } from '@/server/security';
import * as postsRoute from '../posts/route';
import * as postRoute from '../posts/[id]/route';
import * as voteRoute from '../posts/[id]/vote/route';
import * as commentsRoute from '../posts/[id]/comments/route';
import * as contactRoute from '../contact/route';
import * as ratingsRoute from '../ratings/route';
import { body, idParams, nextIp, request, setupTestDatabase } from './helpers';

setupTestDatabase();

const validPost = {
  type: 'feature',
  title: 'Add a hint button',
  body: 'A button that shows the best move would help beginners a lot.',
  name: 'Kiran',
  email: 'kiran@example.com',
};

async function create(overrides: Record<string, unknown> = {}, ip?: string): Promise<Post> {
  const res = await postsRoute.POST(
    request('/api/posts', { body: { ...validPost, ...overrides }, ip }),
  );
  expect(res.status).toBe(201);
  return (await body<{ post: Post }>(res)).post;
}

async function list(qs = ''): Promise<Post[]> {
  const res = await postsRoute.GET(request(`/api/posts${qs}`));
  expect(res.status).toBe(200);
  return (await body<{ posts: Post[] }>(res)).posts;
}

async function vote(id: number | string, voterToken: unknown, ip?: string) {
  return voteRoute.POST(
    request(`/api/posts/${id}/vote`, { body: { voterToken }, ip }),
    idParams(id),
  );
}

async function comment(id: number | string, payload: Record<string, unknown>, ip?: string) {
  return commentsRoute.POST(
    request(`/api/posts/${id}/comments`, { body: payload, ip }),
    idParams(id),
  );
}

describe('route config', () => {
  it('every public route runs on Node and is never statically cached', () => {
    for (const mod of [
      postsRoute,
      postRoute,
      voteRoute,
      commentsRoute,
      contactRoute,
      ratingsRoute,
    ]) {
      expect(mod.runtime).toBe('nodejs');
      expect(mod.dynamic).toBe('force-dynamic');
    }
  });
});

describe('error handling', () => {
  it('turns unexpected failures into a generic 500 without internals', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      vi.stubEnv('DATABASE_URL', 'mysql://root:hunter2@db.internal/cards');
      const responses = [
        await postsRoute.GET(request('/api/posts')),
        await postsRoute.POST(request('/api/posts', { body: validPost })),
        await postRoute.GET(request('/api/posts/1'), idParams(1)),
        await vote(1, 'valid-token-1'),
      ];
      for (const res of responses) {
        expect(res.status).toBe(500);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const text = await res.text();
        expect(JSON.parse(text)).toEqual({
          error: 'Something went wrong on our side. Please try again in a moment.',
        });
        for (const secret of ['hunter2', 'mysql', 'db.internal', 'DATABASE_URL', ' at ']) {
          expect(text).not.toContain(secret);
        }
      }
      expect(logged).toHaveBeenCalled(); // the details go to the server log only
    } finally {
      logged.mockRestore();
    }
  });
});

describe('POST /api/posts', () => {
  it('creates a post (201) without leaking the email', async () => {
    const res = await postsRoute.POST(request('/api/posts', { body: validPost }));
    expect(res.status).toBe(201);
    const { post } = await body<{ post: Post }>(res);
    expect(post).toMatchObject({
      id: expect.any(Number),
      type: 'feature',
      title: 'Add a hint button',
      authorName: 'Kiran',
      status: 'open',
      upvotes: 0,
      commentCount: 0,
    });
    expect(JSON.stringify(post)).not.toContain('kiran@example.com');
    expect(post).not.toHaveProperty('ipHash');
    expect((await list()).some((p) => p.id === post.id)).toBe(true);
  });

  it('treats empty optional name/email as absent', async () => {
    const post = await create({ name: '   ', email: '' });
    expect(post.authorName).toBeNull();
  });

  it('rejects invalid payloads with field errors (400)', async () => {
    const res = await postsRoute.POST(
      request('/api/posts', { body: { type: 'rant', title: 'Hi', body: 'short', email: 'nope' } }),
    );
    expect(res.status).toBe(400);
    const data = await body<{ error: string; fieldErrors: Record<string, string> }>(res);
    expect(data.error).toEqual(expect.any(String));
    expect(Object.keys(data.fieldErrors).sort()).toEqual(['body', 'email', 'title', 'type']);
  });

  it('rejects malformed JSON and non-object bodies (400) and huge bodies (413)', async () => {
    const before = await countPosts();
    const bad = await postsRoute.POST(request('/api/posts', { raw: '{"type": "bug",' }));
    expect(bad.status).toBe(400);
    expect(await body(bad)).toEqual({ error: 'The request body must be valid JSON.' });
    expect((await postsRoute.POST(request('/api/posts', { raw: '[1,2]' }))).status).toBe(400);
    expect((await postsRoute.POST(request('/api/posts', { raw: 'null' }))).status).toBe(400);
    expect((await postsRoute.POST(request('/api/posts', { raw: '' }))).status).toBe(400);
    const huge = await postsRoute.POST(
      request('/api/posts', { body: { ...validPost, body: 'x'.repeat(40_000) } }),
    );
    expect(huge.status).toBe(413);
    expect(await countPosts()).toBe(before);
  });

  it('strips HTML from every text field', async () => {
    const post = await create({
      title: '<script>alert(1)</script>Hi there',
      body: '<p>Please add <b>Bluff</b>!</p><img src=x onerror=alert(1)> Tom & Jerry <3',
      name: '<i>Sneaky</i>',
    });
    expect(post.title).toBe('Hi there');
    expect(post.body).toBe('Please add Bluff! Tom & Jerry <3');
    expect(post.authorName).toBe('Sneaky');
    const stored = await getPost(post.id);
    expect(stored?.post.title).toBe('Hi there');
    expect(stored?.post.body).not.toMatch(/<[a-z/]/i);
  });

  it('stores no markup even for entity-encoded or nested-encoded payloads', async () => {
    let nested = '<img src=x onerror=alert(1)>';
    // Five encodings: the old 5-pass sanitiser decoded these into a live <img> tag.
    for (let i = 0; i < 5; i++) nested = nested.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const post = await create({
      title: 'Totally &lt;script&gt;alert(1)&lt;/script&gt; normal',
      body: `Hello ${nested} there, \u202Eevil\u202C friends`,
      name: '&lt;b&gt;Neo&lt;/b&gt;',
    });
    const stored = await getPost(post.id);
    for (const text of [stored?.post.title, stored?.post.body, stored?.post.authorName]) {
      expect(text).not.toMatch(/<\s*[a-z/!?]/i);
      expect(text).not.toMatch(/[\u202A-\u202E\u2066-\u2069]/);
    }
    expect(stored?.post.title).toBe('Totally normal');
    expect(stored?.post.authorName).toBe('Neo');
  });

  it('rejects text that is too short once the HTML is removed', async () => {
    const before = await countPosts();
    const res = await postsRoute.POST(
      request('/api/posts', { body: { ...validPost, title: '<b><i>a</i></b>' } }),
    );
    expect(res.status).toBe(400);
    expect((await body<{ fieldErrors: Record<string, string> }>(res)).fieldErrors).toHaveProperty(
      'title',
    );
    expect(await countPosts()).toBe(before);
  });

  it('honeypot: returns a normal-looking 201 and stores nothing', async () => {
    const before = await countPosts();
    const res = await postsRoute.POST(
      request('/api/posts', {
        body: { ...validPost, title: '<b>Buy</b> cheap pills', website: 'http://spam.example' },
      }),
    );
    expect(res.status).toBe(201);
    const { post } = await body<{ post: Post }>(res);
    // Shaped exactly like a real post (sanitised, no email, no private columns).
    expect(post).toEqual({
      id: expect.any(Number),
      type: 'feature',
      title: 'Buy cheap pills',
      body: validPost.body,
      authorName: 'Kiran',
      status: 'open',
      upvotes: 0,
      commentCount: 0,
      createdAt: expect.any(String),
    });
    expect(await countPosts()).toBe(before);
    expect(await getPost(post.id)).toBeNull();
  });

  it('honeypot: validates first (docs/API.md order), so bots see what a person would', async () => {
    const before = await countPosts();
    // Invalid input gets the same 400 a person would get: a fake 201 for a
    // one-letter title would tell the bot it had been spotted.
    const invalid = await postsRoute.POST(
      request('/api/posts', { body: { title: 'x', website: 'http://spam.example' } }),
    );
    expect(invalid.status).toBe(400);
    expect(Object.keys((await body<{ fieldErrors: object }>(invalid)).fieldErrors)).toEqual(
      expect.arrayContaining(['type', 'title', 'body']),
    );
    // Honeypot hits are never rate limited (nothing is stored) and never use up the budget.
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '1');
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      const trap = await postsRoute.POST(
        request('/api/posts', { ip, body: { ...validPost, website: 'spam' } }),
      );
      expect(trap.status).toBe(201);
    }
    expect(await countPosts()).toBe(before);
    expect((await postsRoute.POST(request('/api/posts', { ip, body: validPost }))).status).toBe(
      201,
    );
  });

  it('requires a JSON content type (415), so plain cross-site forms cannot post', async () => {
    const before = await countPosts();
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data']) {
      const res = await postsRoute.POST(
        request('/api/posts', { body: validPost, headers: { 'content-type': type } }),
      );
      expect(res.status).toBe(415);
      expect(await body(res)).toEqual({ error: expect.stringContaining('JSON') });
    }
    const missing = new Request('http://localhost/api/posts', {
      method: 'POST',
      body: new Blob([JSON.stringify(validPost)]),
      headers: { 'x-forwarded-for': nextIp() },
    });
    expect((await postsRoute.POST(missing)).status).toBe(415);
    expect(await countPosts()).toBe(before);
    const charset = await postsRoute.POST(
      request('/api/posts', {
        body: validPost,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );
    expect(charset.status).toBe(201);
  });

  it('does not charge invalid submissions to the write budget', async () => {
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '2');
    const ip = nextIp();
    for (let i = 0; i < 5; i++) {
      const res = await postsRoute.POST(request('/api/posts', { ip, body: { title: 'x' } }));
      expect(res.status).toBe(400);
    }
    await create({}, ip);
    await create({}, ip);
    expect((await postsRoute.POST(request('/api/posts', { ip, body: validPost }))).status).toBe(
      429,
    );
  });

  it('cannot dodge the rate limit by forging X-Forwarded-For or rotating IPv6 addresses', async () => {
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '2');
    // nginx-style proxy appends the real peer to whatever the client sent.
    const forged = (fake: string) =>
      postsRoute.POST(request('/api/posts', { ip: `${fake}, 203.0.113.50`, body: validPost }));
    expect((await forged('1.1.1.1')).status).toBe(201);
    expect((await forged('2.2.2.2')).status).toBe(201);
    expect((await forged('3.3.3.3')).status).toBe(429);

    const v6 = (suffix: string) =>
      postsRoute.POST(request('/api/posts', { ip: `2001:db8:77:1::${suffix}`, body: validPost }));
    expect((await v6('1')).status).toBe(201);
    expect((await v6('2')).status).toBe(201);
    expect((await v6('abcd')).status).toBe(429);
  });

  it('rate-limits writes per IP (429), shared across posts, comments, contact and ratings', async () => {
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '4');
    const ip = nextIp();
    const post = await create({}, ip);
    expect((await comment(post.id, { body: 'Nice idea' }, ip)).status).toBe(201);
    const contact = await contactRoute.POST(
      request('/api/contact', {
        ip,
        body: { name: 'A', email: 'a@example.com', message: 'Hello from the tests' },
      }),
    );
    expect(contact.status).toBe(201);
    const rating = await ratingsRoute.POST(
      request('/api/ratings', { ip, body: { gameSlug: 'blackjack', stars: 4 } }),
    );
    expect(rating.status).toBe(201);

    const blocked = await postsRoute.POST(request('/api/posts', { body: validPost, ip }));
    expect(blocked.status).toBe(429);
    expect(await body(blocked)).toEqual({ error: RATE_LIMIT_MESSAGE });
    expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await comment(post.id, { body: 'Again' }, ip)).status).toBe(429);

    // A different IP is unaffected.
    expect((await postsRoute.POST(request('/api/posts', { body: validPost }))).status).toBe(201);
  });

  it('defaults to 8 writes per minute', async () => {
    const ip = nextIp();
    for (let i = 0; i < 8; i++) await create({ title: `Idea number ${i}` }, ip);
    expect((await postsRoute.POST(request('/api/posts', { body: validPost, ip }))).status).toBe(
      429,
    );
  });
});

describe('GET /api/posts', () => {
  it('sorts by newest (default) and by top, and filters by type', async () => {
    const tag = `sort-${Date.now()}`;
    const a = await create({ type: 'bug', title: `${tag} a` });
    const b = await create({ type: 'game', title: `${tag} b` });
    const c = await create({ type: 'bug', title: `${tag} c` });
    for (const token of ['token-one-1', 'token-two-2']) await vote(b.id, token);
    await vote(a.id, 'token-one-1');

    const mine = (posts: Post[]) => posts.filter((p) => p.title.startsWith(tag)).map((p) => p.id);
    expect(mine(await list())).toEqual([c.id, b.id, a.id]);
    expect(mine(await list('?sort=new'))).toEqual([c.id, b.id, a.id]);
    expect(mine(await list('?sort=top'))).toEqual([b.id, a.id, c.id]);
    expect(mine(await list('?type=bug'))).toEqual([c.id, a.id]);
    expect(mine(await list('?type=bug&sort=top'))).toEqual([a.id, c.id]);
    expect(mine(await list('?type=all'))).toEqual([c.id, b.id, a.id]);
    expect((await list('?type=bug')).every((p) => p.type === 'bug')).toBe(true);
    const top = await list('?sort=top');
    for (let i = 1; i < top.length; i++) {
      expect(top[i - 1]!.upvotes).toBeGreaterThanOrEqual(top[i]!.upvotes);
    }
  });

  it('marks hasVoted when ?voter= is supplied', async () => {
    const post = await create();
    await vote(post.id, 'voter-flag-1');
    const withVoter = await list('?voter=voter-flag-1');
    expect(withVoter.find((p) => p.id === post.id)?.hasVoted).toBe(true);
    expect(withVoter.every((p) => typeof p.hasVoted === 'boolean')).toBe(true);
    const anonymous = await list();
    expect(anonymous.find((p) => p.id === post.id)).not.toHaveProperty('hasVoted');
  });

  it('never returns more than 100 posts and never leaks private columns', async () => {
    const posts = await list();
    expect(posts.length).toBeLessThanOrEqual(100);
    for (const p of posts) {
      expect(p).not.toHaveProperty('authorEmail');
      expect(p).not.toHaveProperty('ipHash');
    }
  });

  it('rejects unknown query values (400)', async () => {
    expect((await postsRoute.GET(request('/api/posts?sort=oldest'))).status).toBe(400);
    expect((await postsRoute.GET(request('/api/posts?type=rant'))).status).toBe(400);
    expect((await postsRoute.GET(request('/api/posts?voter=bad'))).status).toBe(400);
  });
});

describe('GET /api/posts/:id', () => {
  it('returns the post and its comments', async () => {
    const post = await create();
    await comment(post.id, { body: 'First!' });
    await comment(post.id, { body: 'Second', name: 'Dev' });
    const res = await postRoute.GET(request(`/api/posts/${post.id}`), idParams(post.id));
    expect(res.status).toBe(200);
    const data = await body<{ post: Post; comments: Comment[] }>(res);
    expect(data.post).toMatchObject({ id: post.id, commentCount: 2 });
    expect(data.comments.map((c) => [c.body, c.authorName])).toEqual([
      ['First!', null],
      ['Second', 'Dev'],
    ]);
  });

  it('includes hasVoted with ?voter=', async () => {
    const post = await create();
    await vote(post.id, 'single-voter');
    const res = await postRoute.GET(
      request(`/api/posts/${post.id}?voter=single-voter`),
      idParams(post.id),
    );
    expect((await body<{ post: Post }>(res)).post.hasVoted).toBe(true);
  });

  it('404s for missing posts and malformed ids', async () => {
    for (const id of ['999999', 'abc', '0', '-1', '1.5', '01', '99999999999']) {
      const res = await postRoute.GET(request(`/api/posts/${id}`), idParams(id));
      expect(res.status).toBe(404);
      expect(await body(res)).toEqual({ error: 'Post not found.' });
    }
  });
});

describe('POST /api/posts/:id/vote', () => {
  it('toggles, allowing one vote per voter token', async () => {
    const post = await create();
    const first = await vote(post.id, 'browser-a-token');
    expect(first.status).toBe(200);
    expect(await body(first)).toEqual({ upvotes: 1, hasVoted: true });
    expect(await body(await vote(post.id, 'browser-b-token'))).toEqual({
      upvotes: 2,
      hasVoted: true,
    });
    expect(await body(await vote(post.id, 'browser-a-token'))).toEqual({
      upvotes: 1,
      hasVoted: false,
    });
    expect(await body(await vote(post.id, 'browser-a-token'))).toEqual({
      upvotes: 2,
      hasVoted: true,
    });

    const { db, schema } = await getDb();
    const rows = await db.select().from(schema.votes);
    const forPost = rows.filter((r) => r.postId === post.id);
    expect(forPost.map((r) => r.voterToken).sort()).toEqual(['browser-a-token', 'browser-b-token']);
    expect(forPost.every((r) => /^[0-9a-f]{64}$/.test(r.ipHash))).toBe(true);
    expect((await getPost(post.id))?.post.upvotes).toBe(2);
  });

  it('stays consistent when the same browser double-clicks', async () => {
    const post = await create();
    const results = await Promise.all([1, 2, 3, 4].map(() => vote(post.id, 'double-clicker')));
    expect(results.every((r) => r.status === 200)).toBe(true);
    const found = await getPost(post.id, 'double-clicker');
    expect(found?.post.upvotes).toBe(0);
    expect(found?.post.hasVoted).toBe(false);
  });

  it('validates the token (400) and the post (404)', async () => {
    const post = await create();
    expect((await vote(post.id, 'short')).status).toBe(400);
    expect((await vote(post.id, 'has spaces in it')).status).toBe(400);
    expect((await vote(post.id, undefined)).status).toBe(400);
    expect((await vote(999_999, 'valid-token-1')).status).toBe(404);
    expect((await vote('nope', 'valid-token-1')).status).toBe(404);
  });

  it(`rate-limits votes separately at ${VOTES_PER_MINUTE}/min`, async () => {
    vi.stubEnv('RATE_LIMIT_PER_MINUTE', '1');
    const post = await create();
    const ip = nextIp();
    for (let i = 0; i < VOTES_PER_MINUTE; i++) {
      expect((await vote(post.id, `bulk-voter-${i}`, ip)).status).toBe(200);
    }
    const blocked = await vote(post.id, 'one-too-many', ip);
    expect(blocked.status).toBe(429);
    expect(await body(blocked)).toEqual({ error: RATE_LIMIT_MESSAGE });
    // Votes don't use up the write budget.
    expect((await comment(post.id, { body: 'still allowed' }, ip)).status).toBe(201);
  });
});

describe('POST /api/posts/:id/comments', () => {
  it('adds a comment (201) and keeps commentCount consistent', async () => {
    const post = await create();
    const res = await comment(post.id, { body: 'Great idea', name: 'Lata' });
    expect(res.status).toBe(201);
    const { comment: created } = await body<{ comment: Comment }>(res);
    expect(created).toEqual({
      id: expect.any(Number),
      postId: post.id,
      body: 'Great idea',
      authorName: 'Lata',
      createdAt: expect.any(String),
    });
    await Promise.all([
      comment(post.id, { body: 'one more' }),
      comment(post.id, { body: 'and another' }),
    ]);
    const found = await getPost(post.id);
    expect(found?.post.commentCount).toBe(3);
    expect(found?.comments).toHaveLength(3);
  });

  it('strips HTML from comments', async () => {
    const post = await create();
    const res = await comment(post.id, { body: '<script>alert(1)</script>Hi', name: '<b>Bo</b>' });
    const { comment: created } = await body<{ comment: Comment }>(res);
    expect(created.body).toBe('Hi');
    expect(created.authorName).toBe('Bo');
  });

  it('validates (400), 404s for missing posts, and honours the honeypot', async () => {
    const post = await create();
    const short = await comment(post.id, { body: 'x' });
    expect(short.status).toBe(400);
    expect((await body<{ fieldErrors: Record<string, string> }>(short)).fieldErrors).toHaveProperty(
      'body',
    );
    expect((await comment(999_999, { body: 'Hello there' })).status).toBe(404);
    expect((await comment('x', { body: 'Hello there' })).status).toBe(404);

    const trap = await comment(post.id, { body: 'Visit my site', website: 'spam.example' });
    expect(trap.status).toBe(201);
    expect((await body<{ comment: Comment }>(trap)).comment.postId).toBe(post.id);
    const found = await getPost(post.id);
    expect(found?.comments).toEqual([]);
    expect(found?.post.commentCount).toBe(0);
  });
});
