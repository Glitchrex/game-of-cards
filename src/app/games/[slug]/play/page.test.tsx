// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { parseDifficulty, parsePlayParams, parseSeed } from './params';

vi.mock('@/games/registry.generated', () => ({
  TIER1_SLUGS: ['blackjack'],
  ENGINE_SLUGS: ['blackjack'],
  // Never resolves: the page test only checks the server-rendered frame.
  gameModuleLoaders: { blackjack: () => new Promise(() => {}) },
}));

// The generated content index may be empty in a fresh checkout; use a fixed catalog entry.
vi.mock('@/lib/content/catalog', () => {
  const games: Record<string, { slug: string; name: string; tips: string[]; tier: 1 | 2 }> = {
    blackjack: { slug: 'blackjack', name: 'Blackjack', tips: ['Tip: split Aces.'], tier: 1 },
    bridge: { slug: 'bridge', name: 'Bridge', tips: [], tier: 2 },
  };
  return { getGame: (slug: string) => games[slug] };
});

const {
  default: PlayPage,
  generateMetadata,
  generateStaticParams,
  dynamicParams,
} = await import('./page');

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

const params = (slug: string) => Promise.resolve({ slug });

describe('/games/[slug]/play', () => {
  it('is generated for Tier 1 games only', () => {
    expect(dynamicParams).toBe(false);
    expect(generateStaticParams()).toEqual([{ slug: 'blackjack' }]);
  });

  it('has a "Play <Name> vs a bot" title and canonical URL', async () => {
    const meta = await generateMetadata({ params: params('blackjack') });
    expect(meta.title).toBe('Play Blackjack vs a bot');
    expect(meta.alternates?.canonical).toBe('/games/blackjack/play');
    expect(await generateMetadata({ params: params('bridge') })).toEqual({});
  });

  it('404s for games without an engine', async () => {
    await expect(
      PlayPage({ params: params('bridge'), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow();
    await expect(
      PlayPage({ params: params('nope'), searchParams: Promise.resolve({}) }),
    ).rejects.toThrow();
  });

  it('renders the heading and the game shell', async () => {
    const page = await PlayPage({
      params: params('blackjack'),
      searchParams: Promise.resolve({ seed: '42', difficulty: 'easy' }),
    });
    render(page);
    expect(screen.getByRole('heading', { level: 1, name: 'Play Blackjack' })).toBeInTheDocument();
    expect(screen.getByTestId('play-page')).toBeInTheDocument();
    expect(screen.getByTestId('game-shell')).toHaveAttribute('data-phase', 'loading');
  });
});

describe('play query params', () => {
  it('accepts safe seeds and known difficulties only', () => {
    expect(parseSeed('42')).toBe('42');
    expect(parseSeed(['win-1', 'x'])).toBe('win-1');
    expect(parseSeed('<script>')).toBeUndefined();
    expect(parseSeed('')).toBeUndefined();
    expect(parseSeed('a'.repeat(65))).toBeUndefined();
    expect(parseDifficulty('EASY')).toBe('easy');
    expect(parseDifficulty('hard')).toBeUndefined();
    expect(parsePlayParams({ seed: '7', difficulty: 'normal' })).toEqual({
      seed: '7',
      difficulty: 'normal',
    });
    expect(parsePlayParams({})).toEqual({ seed: undefined, difficulty: undefined });
  });
});
