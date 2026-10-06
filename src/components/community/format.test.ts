import { absoluteDate, excerpt, plural, prettySlug, relativeTime } from './format';
import {
  validateCommentDraft,
  validatePostDraft,
  emptyPostDraft,
  pickFieldErrors,
} from './validation';

const NOW = Date.parse('2026-10-05T12:00:00.000Z');
const ago = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe('relativeTime', () => {
  it.each([
    [10, 'just now'],
    [-30, 'just now'], // a server clock slightly ahead never reads "in 30 seconds"
    [90, '2 minutes ago'],
    [60 * 60, '1 hour ago'],
    [5 * 3600, '5 hours ago'],
    [26 * 3600, 'yesterday'],
    [3 * 86400, '3 days ago'],
    [8 * 86400, 'last week'],
    [21 * 86400, '3 weeks ago'],
    [65 * 86400, '2 months ago'],
    [400 * 86400, 'last year'],
  ])('%i seconds ago → %s', (seconds, expected) => {
    expect(relativeTime(ago(seconds), NOW)).toBe(expected);
  });

  it('returns the input unchanged for an unparseable date', () => {
    expect(relativeTime('not a date', NOW)).toBe('not a date');
  });
});

describe('absoluteDate', () => {
  it('formats in UTC so server and browser agree', () => {
    expect(absoluteDate('2026-10-05T23:59:00.000Z')).toBe('5 Oct 2026');
    expect(absoluteDate('2026-01-01T00:00:00.000Z')).toBe('1 Jan 2026');
  });
});

describe('excerpt', () => {
  it('keeps short text and flattens whitespace', () => {
    expect(excerpt('Hello\n\n  board', 50)).toBe('Hello board');
  });

  it('cuts long text at a word boundary with an ellipsis', () => {
    const text = 'The quick brown fox jumps over the lazy dog, then naps.';
    const out = excerpt(text, 30);
    expect(out).toBe('The quick brown fox jumps over…');
    expect(out.length).toBeLessThanOrEqual(31);
  });

  it('does not leave dangling punctuation before the ellipsis', () => {
    expect(excerpt('Alpha beta, gamma delta epsilon', 12)).toBe('Alpha beta…');
  });
});

describe('plural / prettySlug', () => {
  it('picks singular or plural entries', () => {
    expect(plural(1, 'community.list.countOne', 'community.list.countMany')).toBe('1 post');
    expect(plural(0, 'community.list.countOne', 'community.list.countMany')).toBe('0 posts');
    expect(plural(1200, 'community.list.countOne', 'community.list.countMany')).toBe('1,200 posts');
  });

  it('turns slugs into readable names', () => {
    expect(prettySlug('teen-patti')).toBe('Teen Patti');
    expect(prettySlug('go-fish')).toBe('Go Fish');
  });
});

describe('validation', () => {
  it('mirrors the API limits for posts', () => {
    const ok = {
      ...emptyPostDraft('bug'),
      title: 'Cards overlap',
      body: 'On a 375px phone screen.',
    };
    expect(validatePostDraft(ok)).toEqual({});
    expect(validatePostDraft({ ...ok, title: 'x'.repeat(121) }).title).toBe(
      'Title must be 120 characters or fewer.',
    );
    expect(validatePostDraft({ ...ok, body: 'x'.repeat(2001) }).body).toBe(
      'Description must be 2000 characters or fewer.',
    );
    expect(validatePostDraft({ ...ok, name: 'n'.repeat(61) }).name).toBe(
      'Your name must be 60 characters or fewer.',
    );
    expect(validatePostDraft({ ...ok, email: '   ' }).email).toBeUndefined();
    expect(validatePostDraft({ ...ok, email: 'a@b' }).email).toBe(
      'Please enter a valid email address.',
    );
  });

  it('mirrors the API limits for comments', () => {
    expect(validateCommentDraft({ body: 'ok', name: '', website: '' })).toEqual({});
    expect(validateCommentDraft({ body: ' a ', name: '', website: '' }).body).toBe(
      'Your comment needs at least 2 characters.',
    );
    expect(validateCommentDraft({ body: 'x'.repeat(1001), name: '', website: '' }).body).toBe(
      'Your comment must be 1000 characters or fewer.',
    );
  });

  it('keeps only server field errors the form can show', () => {
    expect(
      pickFieldErrors(['title', 'body'] as const, { title: 'Too short', website: 'bot?' }),
    ).toEqual({ title: 'Too short' });
    expect(pickFieldErrors(['title'] as const, undefined)).toEqual({});
  });
});
