import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  adminLoginSchema,
  adminMessagePatchSchema,
  adminPostPatchSchema,
  contactSchema,
  createCommentSchema,
  createPostSchema,
  formatZodError,
  listPostsQuerySchema,
  ratingSchema,
  searchParamsToObject,
  validate,
  VALIDATION_ERROR,
  voteSchema,
} from './validation';

const s = (n: number, ch = 'a') => ch.repeat(n);

describe('createPostSchema', () => {
  const ok = { type: 'feature', title: 'Dark mode', body: 'Please add a darker theme.' };

  it('accepts a valid post, trims strings and strips unknown keys', () => {
    const r = validate(createPostSchema, { ...ok, title: '  Dark mode  ', extra: 1, website: '' });
    expect(r).toEqual({ ok: true, data: { ...ok } });
  });

  it('enforces title 3–120 and body 10–2000', () => {
    expect(validate(createPostSchema, { ...ok, title: s(3) }).ok).toBe(true);
    expect(validate(createPostSchema, { ...ok, title: s(120) }).ok).toBe(true);
    expect(validate(createPostSchema, { ...ok, body: s(2000) }).ok).toBe(true);
    for (const bad of [
      { title: 'ab' },
      { title: '  ab   ' },
      { title: s(121) },
      { body: s(9) },
      { body: s(2001) },
    ]) {
      const r = validate(createPostSchema, { ...ok, ...bad });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(Object.keys(r.fieldErrors)).toEqual(Object.keys(bad));
    }
  });

  it('validates type, optional name (≤ 60) and optional email (≤ 120)', () => {
    expect(validate(createPostSchema, { ...ok, type: 'rant' }).ok).toBe(false);
    expect(validate(createPostSchema, { ...ok, name: s(60), email: 'a@b.co' }).ok).toBe(true);
    expect(validate(createPostSchema, { ...ok, name: '', email: '' }).ok).toBe(true);
    expect(validate(createPostSchema, { ...ok, name: null, email: null }).ok).toBe(true);
    expect(validate(createPostSchema, { ...ok, name: s(61) }).ok).toBe(false);
    expect(validate(createPostSchema, { ...ok, email: 'not-an-email' }).ok).toBe(false);
    expect(validate(createPostSchema, { ...ok, email: `${s(115)}@b.com` }).ok).toBe(false);
  });

  it('reports every bad field with a friendly message', () => {
    const r = validate(createPostSchema, { type: 'x', title: 1, body: '' });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toBe(VALIDATION_ERROR);
    expect(r.fieldErrors).toEqual({
      type: 'Pick a post type.',
      title: 'Title must be between 3 and 120 characters.',
      body: 'Description must be between 10 and 2,000 characters.',
    });
  });
});

describe('other payloads', () => {
  it('comment body 2–1000', () => {
    expect(validate(createCommentSchema, { body: 'ok' }).ok).toBe(true);
    expect(validate(createCommentSchema, { body: 'o' }).ok).toBe(false);
    expect(validate(createCommentSchema, { body: s(1001) }).ok).toBe(false);
    expect(validate(createCommentSchema, { body: s(1000), name: s(61) }).ok).toBe(false);
  });

  it('contact requires name, valid email and a 10–3000 char message', () => {
    const ok = { name: 'Meera', email: 'meera@example.com', message: 'Hello there!' };
    expect(validate(contactSchema, ok).ok).toBe(true);
    expect(validate(contactSchema, { ...ok, name: '' }).ok).toBe(false);
    expect(validate(contactSchema, { ...ok, email: '' }).ok).toBe(false);
    expect(validate(contactSchema, { ...ok, email: undefined }).ok).toBe(false);
    expect(validate(contactSchema, { ...ok, message: s(9) }).ok).toBe(false);
    expect(validate(contactSchema, { ...ok, message: s(3000) }).ok).toBe(true);
    expect(validate(contactSchema, { ...ok, message: s(3001) }).ok).toBe(false);
  });

  it('rating: integer stars 1–5, slug format, comment ≤ 500', () => {
    const ok = { gameSlug: 'teen-patti', stars: 5 };
    expect(validate(ratingSchema, ok).ok).toBe(true);
    expect(validate(ratingSchema, { ...ok, comment: s(500) }).ok).toBe(true);
    expect(validate(ratingSchema, { ...ok, comment: s(501) }).ok).toBe(false);
    for (const stars of [0, 6, 2.5, '5', null]) {
      expect(validate(ratingSchema, { ...ok, stars }).ok).toBe(false);
    }
    for (const gameSlug of ['x', 'Teen-Patti', 'teen_patti', s(41), '../etc']) {
      expect(validate(ratingSchema, { ...ok, gameSlug }).ok).toBe(false);
    }
  });

  it('voter token: 8–100 chars of [A-Za-z0-9-_]', () => {
    expect(validate(voteSchema, { voterToken: crypto.randomUUID() }).ok).toBe(true);
    expect(validate(voteSchema, { voterToken: 'abc_DEF-12' }).ok).toBe(true);
    expect(validate(voteSchema, { voterToken: 'short' }).ok).toBe(false);
    expect(validate(voteSchema, { voterToken: s(101) }).ok).toBe(false);
    expect(validate(voteSchema, { voterToken: 'has space!' }).ok).toBe(false);
    expect(validate(voteSchema, {}).ok).toBe(false);
  });

  it('admin payloads', () => {
    expect(validate(adminPostPatchSchema, { status: 'in-progress' }).ok).toBe(true);
    expect(validate(adminPostPatchSchema, { status: 'closed' }).ok).toBe(false);
    expect(validate(adminMessagePatchSchema, { read: true }).ok).toBe(true);
    expect(validate(adminMessagePatchSchema, { read: 'yes' }).ok).toBe(false);
    expect(validate(adminLoginSchema, { password: 'pw' }).ok).toBe(true);
    expect(validate(adminLoginSchema, { password: '' }).ok).toBe(false);
  });
});

describe('listPostsQuerySchema', () => {
  const parse = (qs: string) =>
    validate(listPostsQuerySchema, searchParamsToObject(new URLSearchParams(qs)));

  it('defaults to newest, treats "all" and empty values as no filter', () => {
    expect(parse('')).toEqual({ ok: true, data: { sort: 'new' } });
    expect(parse('sort=&type=all')).toEqual({ ok: true, data: { sort: 'new', type: undefined } });
    expect(parse('sort=top&type=bug&voter=abcdefgh')).toEqual({
      ok: true,
      data: { sort: 'top', type: 'bug', voter: 'abcdefgh' },
    });
  });

  it('rejects unknown values', () => {
    expect(parse('sort=old').ok).toBe(false);
    expect(parse('type=rant').ok).toBe(false);
    expect(parse('voter=x').ok).toBe(false);
  });
});

describe('formatZodError', () => {
  it('uses root-level messages as the main error', () => {
    const r = z.string({ error: 'Expected text' }).safeParse(1);
    expect(r.success).toBe(false);
    if (!r.success)
      expect(formatZodError(r.error)).toEqual({ error: 'Expected text', fieldErrors: {} });
  });

  it('keeps the first message per field', () => {
    const schema = z.object({ a: z.string().min(5, 'too short').regex(/^\d+$/, 'digits only') });
    const r = schema.safeParse({ a: 'x' });
    if (!r.success) {
      expect(formatZodError(r.error)).toEqual({
        error: VALIDATION_ERROR,
        fieldErrors: { a: 'too short' },
      });
    }
  });
});
