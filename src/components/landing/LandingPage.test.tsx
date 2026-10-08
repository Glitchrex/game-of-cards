// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { siteConfig } from '@/config/site';
import { STARTING_BALANCE } from '@/store/wallet';
import { summarizeRegions } from './AroundTheWorld';
import { LandingPage, MAX_FEATURED, featuredGames } from './LandingPage';
import { START_HREF, START_JEET, flagEmoji } from './pick-data';
import { posterCards } from './PosterKeyArt';
import { FIXTURE_GAMES } from './test-fixtures';

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

describe('Landing page', () => {
  it('leads with the poster headline and both calls to action', () => {
    render(<LandingPage games={FIXTURE_GAMES} />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(h1).toHaveTextContent('Learn every card game. The fun way.');
    expect(h1).toHaveClass('font-display');

    const start = screen.getByTestId('cta-start');
    expect(start).toHaveAccessibleName('Start learning in 2 minutes');
    expect(start).toHaveAttribute('href', '/basics?next=/games/blackjack/try');
    expect(START_HREF).toBe('/basics?next=/games/blackjack/try');

    const pick = screen.getByTestId('cta-pick');
    expect(pick.tagName).toBe('BUTTON');
    expect(pick).toHaveAccessibleName('Pick a game for me');
    // The dialog itself is not rendered (or even loaded) until someone asks for it.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    expect(
      screen.getByText('You start with 1,000 Jeet — pretend coins, no real money, ever.'),
    ).toBeInTheDocument();
    expect(START_JEET).toBe(STARTING_BALANCE);
    expect(
      screen.getByText(`Now showing · ${FIXTURE_GAMES.length} card games`),
    ).toBeInTheDocument();
  });

  it('reserves the deck showcase stage so nothing shifts while it animates', () => {
    const { container } = render(<LandingPage games={FIXTURE_GAMES} />);
    const hero = screen.getByRole('region', { name: 'Learn every card game. The fun way.' });
    const stage = hero.querySelector<HTMLElement>('[style*="aspect-ratio"]');
    expect(stage).not.toBeNull();
    expect(stage).toHaveAttribute('aria-hidden', 'true');
    expect(within(hero).getByText(/deals a royal flush of Hearts/)).toHaveClass('sr-only');
    // The marquee wordmark hangs over the table, decorative (the header link names the site).
    const sign = Array.from(hero.querySelectorAll('svg')).find((svg) =>
      svg.textContent?.includes('CARDS'),
    );
    expect(sign).toHaveAttribute('aria-hidden', 'true');
    expect(within(hero).queryByRole('img', { name: 'Game of Cards' })).not.toBeInTheDocument();
    // No images to download: everything on the page is inline SVG or CSS.
    expect(container.querySelectorAll('img')).toHaveLength(0);
  });

  it('shows the featured games as posters that link to their game pages', () => {
    render(<LandingPage games={FIXTURE_GAMES} />);
    const section = screen.getByRole('region', { name: 'Now showing' });
    const featured = FIXTURE_GAMES.filter((g) => g.featured);
    const posters = within(section).getAllByRole('article');
    expect(posters).toHaveLength(featured.length);
    for (const game of featured) {
      const poster = within(section).getByTestId(`featured-${game.slug}`);
      expect(within(poster).getByRole('link', { name: game.name })).toHaveAttribute(
        'href',
        `/games/${game.slug}`,
      );
      expect(poster).toHaveTextContent(game.hook);
      expect(poster).toHaveTextContent(game.origin.country);
      expect(poster).toHaveTextContent(`Difficulty ${game.difficulty} of 5`);
      if (game.tier === 1) expect(poster).toHaveTextContent('Play vs bots');
    }
    expect(within(section).queryByTestId('featured-bridge')).not.toBeInTheDocument();
    expect(
      within(section).getByRole('link', { name: `See all ${FIXTURE_GAMES.length} games` }),
    ).toHaveAttribute('href', '/games');
  });

  it('explains how it works in four steps', () => {
    render(<LandingPage games={FIXTURE_GAMES} />);
    const section = screen.getByRole('region', { name: 'How it works' });
    const steps = within(section).getAllByRole('listitem');
    expect(steps).toHaveLength(4);
    expect(steps.map((s) => within(s).getByRole('heading', { level: 3 }).textContent)).toEqual([
      'Discover',
      'Learn',
      'Try',
      'Play',
    ]);
    expect(steps[0]).toHaveTextContent('Step 1');
    // The step icons are decorative.
    for (const svg of section.querySelectorAll('svg'))
      expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('links every region with its game count to the filtered catalog', () => {
    render(<LandingPage games={FIXTURE_GAMES} />);
    const section = screen.getByRole('region', { name: 'Games from around the world' });
    const links = within(section).getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/games?region=europe',
      '/games?region=north-america',
      '/games?region=global',
      '/games?region=south-asia',
    ]);
    expect(within(section).getByRole('link', { name: /Europe.*2 games/ })).toBeInTheDocument();
    expect(within(section).getByRole('link', { name: /South Asia.*1 game$/ })).toBeInTheDocument();
  });

  it('closes with another chance to start, and describes the site for search engines', () => {
    const { container } = render(<LandingPage games={FIXTURE_GAMES} />);
    const closing = screen.getByRole('region', { name: 'The show starts in 60 seconds.' });
    expect(
      within(closing).getByRole('link', { name: 'Start learning in 2 minutes' }),
    ).toHaveAttribute('href', START_HREF);
    expect(within(closing).getByRole('link', { name: 'Browse all games' })).toHaveAttribute(
      'href',
      '/games',
    );
    const ld = container.querySelector('script[type="application/ld+json"]');
    const data = JSON.parse(ld?.textContent ?? '{}') as Record<string, string>;
    expect(data['@type']).toBe('WebSite');
    expect(data.name).toBe(siteConfig.name);
    expect(data.url).toBe(`${siteConfig.url.replace(/\/+$/, '')}/`);
    // The tagline is not an alternative *name* for the site.
    expect(data).not.toHaveProperty('alternateName');
  });

  it('still renders cleanly with an empty catalog', () => {
    render(<LandingPage games={[]} />);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByTestId('cta-start')).toBeInTheDocument();
    expect(screen.getByTestId('cta-pick')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Now showing' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('region', { name: 'Games from around the world' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Now showing · card games from around the world')).toBeInTheDocument();
  });
});

describe('landing helpers', () => {
  it('picks the featured games, falling back to the first few', () => {
    expect(featuredGames(FIXTURE_GAMES).map((g) => g.slug)).toEqual([
      'blackjack',
      'teen-patti',
      'hearts',
    ]);
    const none = FIXTURE_GAMES.map((g) => ({ ...g, featured: false }));
    expect(featuredGames(none)).toHaveLength(Math.min(MAX_FEATURED, none.length));
  });

  it('summarises regions, most games first', () => {
    const regions = summarizeRegions(FIXTURE_GAMES);
    expect(regions.map((r) => [r.region, r.count])).toEqual([
      ['europe', 2],
      ['north-america', 2],
      ['global', 2],
      ['south-asia', 1],
    ]);
    expect(regions.find((r) => r.region === 'europe')?.countryCodes).toEqual(['IT', 'GB']);
    expect(regions.find((r) => r.region === 'north-america')?.countryCodes).toEqual(['US']);
    expect(regions[0]?.label).toBe('Europe');
  });

  it('draws poster cards from the lesson, skipping jokers and repeats', () => {
    expect(posterCards(FIXTURE_GAMES[0]!.lesson)).toEqual(['AS', 'KH', '7D']);
    expect(posterCards([])).toEqual(['AS', 'KH', 'QD']);
    expect(posterCards([{ scene: { zones: [{ cards: ['KH'] }] } }])).toEqual(['KH', 'AS', 'QD']);
  });

  it('turns country codes into flags (globe for worldwide)', () => {
    expect(flagEmoji('IN')).toBe('🇮🇳');
    expect(flagEmoji('gb')).toBe('🇬🇧');
    expect(flagEmoji('UN')).toBe('🌍');
    expect(flagEmoji('???')).toBe('🌍');
  });
});
