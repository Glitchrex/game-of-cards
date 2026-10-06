// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { StoreHydrator } from '@/store/hydrate';
import { emptyProgress, useProgress } from '@/store/progress';
import { DifficultyPips } from './DifficultyPips';
import { GameCard, playersText } from './GameCard';
import { type GameCardData } from './catalog-data';

const base: GameCardData = {
  slug: 'teen-patti',
  name: 'Teen Patti',
  aka: ['3 Patti'],
  country: 'India',
  countryCode: 'IN',
  region: 'south-asia',
  regionLabel: 'South Asia',
  type: 'comparing',
  typeLabel: 'Comparing',
  players: { min: 2, max: 5 },
  difficulty: 2,
  length: 'About 5 minutes',
  hook: 'Three cards, one pot and a lot of nerve',
  tier: 1,
};

beforeEach(() => {
  localStorage.clear();
  useProgress.setState({ games: {} });
});

describe('GameCard', () => {
  it('reads difficulty as "Difficulty 2 of 5" and shows the poster facts', () => {
    render(<GameCard game={base} />);
    expect(screen.getByRole('img', { name: 'Difficulty 2 of 5' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Teen Patti' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Teen Patti' })).toHaveAttribute(
      'href',
      '/games/teen-patti',
    );
    expect(screen.getByText('India')).toBeInTheDocument();
    expect(screen.getByText('🇮🇳')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Comparing')).toBeInTheDocument();
    expect(screen.getByText('2–5 players')).toBeInTheDocument();
    expect(screen.getByText('About 5 minutes')).toBeInTheDocument();
    expect(screen.getByText('Three cards, one pot and a lot of nerve')).toBeInTheDocument();
    expect(screen.getByText('Play vs bot')).toBeInTheDocument();
  });

  it('stretches the title link over the whole card (no positioned element in between)', () => {
    render(<GameCard game={base} />);
    const card = screen.getByTestId('game-card-teen-patti');
    const link = screen.getByRole('link', { name: 'Teen Patti' });
    expect(link.className).toMatch(/after:absolute/);
    expect(link.className).toMatch(/after:inset-0/);
    expect(card.className).toMatch(/\brelative\b/);
    // Any positioned or transformed ancestor below the card would become the
    // ::after's containing block and shrink the click area to the title.
    const establishesContainingBlock =
      /(^|\s)(relative|absolute|fixed|sticky|transform|translate-|rotate-|scale-|filter|blur-|contain-)/;
    for (let el = link.parentElement; el && el !== card; el = el.parentElement) {
      expect(el.className).not.toMatch(establishesContainingBlock);
    }
    expect(card.querySelectorAll('a')).toHaveLength(1);
  });

  it('omits the bot badge for Tier 2 games and uses a globe for worldwide games', () => {
    render(<GameCard game={{ ...base, tier: 2, countryCode: 'UN', country: 'Worldwide' }} />);
    expect(screen.queryByText('Play vs bot')).not.toBeInTheDocument();
    expect(screen.getByText('🌐')).toBeInTheDocument();
  });

  it('shows the progress ribbon only after the stores hydrate', async () => {
    localStorage.setItem(
      'goc:progress',
      JSON.stringify({
        state: { games: { 'teen-patti': { ...emptyProgress(), started: true, lessonDone: true } } },
        version: 1,
      }),
    );
    // Server / first paint: a blank placeholder, never a guessed status.
    const html = renderToString(<GameCard game={base} />);
    expect(html).not.toContain('Learning');
    expect(html).not.toContain('Not started');

    render(
      <>
        <StoreHydrator />
        <GameCard game={base} />
      </>,
    );
    await waitFor(() =>
      expect(screen.getByTestId('ribbon-teen-patti')).toHaveAttribute('data-status', 'learning'),
    );
    expect(screen.getByText('Your progress: Learning')).toBeInTheDocument();

    act(() => {
      useProgress.getState().markExampleDone('teen-patti');
      useProgress.getState().recordQuiz('teen-patti', 5);
    });
    expect(screen.getByTestId('ribbon-teen-patti')).toHaveAttribute('data-status', 'learned');
    act(() => useProgress.getState().recordWin('teen-patti'));
    expect(screen.getByTestId('ribbon-teen-patti')).toHaveAttribute('data-status', 'mastered');
    expect(screen.getByText('Your progress: Mastered')).toBeInTheDocument();
  });
});

describe('helpers', () => {
  it('formats player counts', () => {
    expect(playersText({ min: 1, max: 1 })).toBe('1 player');
    expect(playersText({ min: 4, max: 4 })).toBe('4 players');
    expect(playersText({ min: 2, max: 6 })).toBe('2–6 players');
  });

  it('clamps difficulty pips', () => {
    render(<DifficultyPips value={9} />);
    expect(screen.getByRole('img', { name: 'Difficulty 5 of 5' })).toBeInTheDocument();
  });
});
