// @vitest-environment jsdom
/**
 * The landing page and "Pick a game for me" against every real content file (see
 * test-real-catalog.ts: this runs and means something whatever state the generated
 * registries are in).
 */
import { render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { type CatalogGame } from '@/lib/content/catalog';
import { REGION_LABELS } from '@/lib/content/schema';
import { fitsPlayers, recommendGames } from '@/lib/recommend';
import { isCardCode } from '@/games/core/cards';
import { MAX_FEATURED, featuredGames } from './LandingPage';
import { MOOD_ANSWERS, PLAYERS_ANSWERS, TIME_ANSWERS, toPickableGame } from './pick-data';
import { posterCards } from './PosterKeyArt';
import { loadRealCatalog, restoreCatalog } from './test-real-catalog';

let games: CatalogGame[] = [];

beforeAll(async () => {
  MotionGlobalConfig.skipAnimations = true;
  games = await loadRealCatalog();
});

afterAll(() => restoreCatalog());

describe('/ with the real catalog', () => {
  it('has content to show', () => {
    expect(games.length).toBeGreaterThanOrEqual(MAX_FEATURED);
  });

  it('renders the page with six featured posters, every region and a canonical URL', async () => {
    const { default: HomePage, metadata } = await import('@/app/page');
    expect(metadata.alternates?.canonical).toBe('/');
    render(<HomePage />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Learn every card game. The fun way.',
    );
    expect(screen.getByText(`Now showing · ${games.length} card games`)).toBeInTheDocument();

    const nowShowing = screen.getByRole('region', { name: 'Now showing' });
    const featured = featuredGames(games);
    expect(featured).toHaveLength(MAX_FEATURED);
    expect(within(nowShowing).getAllByRole('article')).toHaveLength(MAX_FEATURED);
    for (const game of featured) {
      const poster = within(nowShowing).getByTestId(`featured-${game.slug}`);
      expect(within(poster).getByRole('link', { name: game.name })).toHaveAttribute(
        'href',
        `/games/${game.slug}`,
      );
    }

    const world = screen.getByRole('region', { name: 'Games from around the world' });
    const regions = new Set(games.map((g) => g.origin.region));
    for (const region of regions)
      expect(within(world).getByTestId(`region-${region}`)).toHaveTextContent(
        REGION_LABELS[region],
      );
  });

  it('draws three distinct, real cards on every poster', () => {
    for (const game of games) {
      const cards = posterCards(game.lesson);
      expect(cards, game.slug).toHaveLength(3);
      expect(new Set(cards).size, game.slug).toBe(3);
      for (const code of cards) expect(isCardCode(code), `${game.slug}: ${code}`).toBe(true);
    }
  });
});

describe('Pick a game for me, with the real catalog', () => {
  it('always has a pick that seats the chosen number of players', () => {
    const slim = games.map(toPickableGame);
    for (const players of PLAYERS_ANSWERS)
      for (const mood of MOOD_ANSWERS)
        for (const time of TIME_ANSWERS) {
          const label = `${players}/${mood}/${time}`;
          const picks = recommendGames(slim, { players, mood, time });
          const [top, ...rest] = picks;
          expect(top, label).toBeDefined();
          expect(fitsPlayers(top!.game, players), label).toBe(true);
          expect(top!.reason.length, label).toBeGreaterThan(20);
          // The result card always has runner-ups to offer.
          expect(rest.length, label).toBeGreaterThanOrEqual(2);
        }
  });

  it('keeps the client payload small (slim records, not whole content files)', () => {
    const slimBytes = JSON.stringify(games.map(toPickableGame)).length;
    const fullBytes = JSON.stringify(games).length;
    expect(slimBytes).toBeLessThan(fullBytes / 10);
    // ~350 bytes a game: the whole list stays a few KB inside the page's RSC payload.
    expect(slimBytes / games.length).toBeLessThan(500);
  });
});
