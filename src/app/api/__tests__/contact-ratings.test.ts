import { describe, expect, it } from 'vitest';
import { overview } from '@/server/repo';
import * as contactRoute from '../contact/route';
import * as ratingsRoute from '../ratings/route';
import { body, request, setupTestDatabase } from './helpers';

setupTestDatabase();

const contact = (payload: unknown) => contactRoute.POST(request('/api/contact', { body: payload }));
const rate = (payload: unknown) => ratingsRoute.POST(request('/api/ratings', { body: payload }));

describe('POST /api/contact', () => {
  const valid = {
    name: 'Meera',
    email: 'meera@example.com',
    message: 'I loved learning Hearts here!',
  };

  it('stores the message (201 { ok: true })', async () => {
    const res = await contact(valid);
    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ ok: true });
    const { messages } = await overview();
    expect(messages[0]).toMatchObject({ ...valid, read: false });
    expect(messages[0]).not.toHaveProperty('ipHash');
  });

  it('requires name, a valid email and a 10+ char message (400)', async () => {
    const res = await contact({ name: '', email: 'nope', message: 'short' });
    expect(res.status).toBe(400);
    const data = await body<{ fieldErrors: Record<string, string> }>(res);
    expect(Object.keys(data.fieldErrors).sort()).toEqual(['email', 'message', 'name']);
    expect((await contact({ name: 'A', message: 'long enough message' })).status).toBe(400);
    expect((await contactRoute.POST(request('/api/contact', { raw: 'name=A' }))).status).toBe(400);
  });

  it('accepts a maximum-length message in any script', async () => {
    const message = 'न'.repeat(3000);
    const res = await contact({ name: 'राज', email: 'raj@example.com', message });
    expect(res.status).toBe(201);
    expect((await overview()).messages[0]?.message).toBe(message);
  });

  it('strips HTML from the name and message', async () => {
    await contact({
      name: '<b>Raj</b>',
      email: 'raj@example.com',
      message: '<script>alert(1)</script>Hello <a href="x">friend</a>, nice site',
    });
    const { messages } = await overview();
    expect(messages[0]).toMatchObject({ name: 'Raj', message: 'Hello friend, nice site' });
  });

  it('honeypot: fake success, nothing stored', async () => {
    const before = (await overview()).messages.length;
    const res = await contact({ ...valid, website: 'https://spam.example' });
    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ ok: true });
    expect((await overview()).messages).toHaveLength(before);
  });
});

describe('POST /api/ratings', () => {
  it('stores a rating (201 { ok: true }) and feeds the summary', async () => {
    expect((await rate({ gameSlug: 'go-fish', stars: 5, comment: 'So fun' })).status).toBe(201);
    const res = await rate({ gameSlug: 'go-fish', stars: 2 });
    expect(await body(res)).toEqual({ ok: true });
    const { ratings, ratingSummary } = await overview();
    expect(
      ratings.filter((r) => r.gameSlug === 'go-fish').map((r) => [r.stars, r.comment]),
    ).toEqual([
      [2, null],
      [5, 'So fun'],
    ]);
    expect(ratingSummary.find((s) => s.gameSlug === 'go-fish')).toEqual({
      gameSlug: 'go-fish',
      count: 2,
      average: 3.5,
    });
  });

  it('validates stars, slug and comment length (400)', async () => {
    for (const payload of [
      { gameSlug: 'go-fish', stars: 0 },
      { gameSlug: 'go-fish', stars: 6 },
      { gameSlug: 'go-fish', stars: 3.5 },
      { gameSlug: 'go-fish', stars: '4' },
      { gameSlug: 'Go Fish', stars: 4 },
      { gameSlug: 'go-fish', stars: 4, comment: 'x'.repeat(501) },
      {},
    ]) {
      expect((await rate(payload)).status).toBe(400);
    }
  });

  it('strips HTML from the comment and drops comments that end up empty', async () => {
    await rate({ gameSlug: 'war', stars: 4, comment: '<em>Nice</em> lesson' });
    await rate({ gameSlug: 'war', stars: 3, comment: '<img src=x onerror=alert(1)>' });
    const { ratings } = await overview();
    expect(ratings.filter((r) => r.gameSlug === 'war').map((r) => r.comment)).toEqual([
      null,
      'Nice lesson',
    ]);
  });

  it('honeypot: fake success, nothing stored', async () => {
    const before = (await overview()).ratings.length;
    const res = await rate({ gameSlug: 'war', stars: 5, website: 'x' });
    expect(res.status).toBe(201);
    expect(await body(res)).toEqual({ ok: true });
    expect((await overview()).ratings).toHaveLength(before);
  });
});
