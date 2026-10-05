import { DEFAULT_NEXT, safeNextPath } from './safeNext';

describe('safeNextPath', () => {
  it('accepts internal paths', () => {
    expect(safeNextPath('/games/blackjack/try')).toBe('/games/blackjack/try');
    expect(safeNextPath('/games?type=rummy#top')).toBe('/games?type=rummy#top');
    expect(safeNextPath('/')).toBe('/');
  });

  it.each([
    null,
    undefined,
    '',
    'games',
    '//evil.example',
    '///evil.example',
    '/\\evil.example',
    'https://evil.example/games',
    'javascript:alert(1)',
    '/games\nSet-Cookie: x',
    ' //evil.example',
  ])('falls back to /games for %j', (raw) => {
    expect(safeNextPath(raw)).toBe(DEFAULT_NEXT);
  });
});
