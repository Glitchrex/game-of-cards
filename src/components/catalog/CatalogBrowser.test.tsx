// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { useSettings } from '@/store/settings';

vi.mock('@content/games', () => ({ rawGameContent: {} }));
vi.mock('@/games/slugs.generated', () => ({
  TIER1_SLUGS: [],
  ENGINE_SLUGS: [],
}));

let search = new URLSearchParams();
vi.mock('next/navigation', () => ({
  useSearchParams: () => search,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/games',
}));

import { CatalogBrowser } from './CatalogBrowser';
import { buildCatalogIndex } from './catalog-index';
import { FIXTURE_GAMES } from './test-fixtures';

const index = buildCatalogIndex(FIXTURE_GAMES);

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  search = new URLSearchParams();
  window.history.replaceState(null, '', '/games');
  useSettings.setState({ motion: 'reduce' });
});

const cards = () =>
  screen
    .queryAllByTestId(/^game-card-/)
    .map((el) => el.getAttribute('data-testid')?.replace('game-card-', ''));

describe('CatalogBrowser', () => {
  it('shows every game as a poster linking to its hub', () => {
    render(<CatalogBrowser index={index} />);
    expect(cards()).toEqual(FIXTURE_GAMES.map((g) => g.slug));
    expect(screen.getByTestId('catalog-count')).toHaveTextContent('All 7 games');
    expect(screen.getByRole('link', { name: 'Teen Patti' })).toHaveAttribute(
      'href',
      '/games/teen-patti',
    );
  });

  it('filters by search text and writes it to the URL', async () => {
    const user = userEvent.setup();
    render(<CatalogBrowser index={index} />);
    await user.type(screen.getByTestId('catalog-search'), 'thirteen');
    expect(cards()).toEqual(['tien-len']);
    expect(screen.getByTestId('catalog-count')).toHaveTextContent('Showing 1 of 7 games');
    expect(window.location.search).toBe('?q=thirteen');
  });

  it('combines chips and the playable switch, with counts and URL state', async () => {
    const user = userEvent.setup();
    render(<CatalogBrowser index={index} />);
    const region = screen.getByRole('group', { name: 'Region' });
    const europe = within(region).getByRole('button', { name: /Europe/ });
    expect(europe).toHaveAttribute('aria-pressed', 'false');
    expect(europe).toHaveTextContent('2');
    await user.click(europe);
    expect(europe).toHaveAttribute('aria-pressed', 'true');
    expect(cards()).toEqual(['scopa', 'skat']);
    expect(window.location.search).toBe('?region=europe');

    const players = screen.getByRole('group', { name: 'Players' });
    await user.click(within(players).getByRole('button', { name: /^3/ }));
    expect(cards()).toEqual(['scopa', 'skat']);
    await user.click(within(players).getByRole('button', { name: /^4/ }));
    expect(cards()).toEqual(['scopa']);
    expect(window.location.search).toBe('?region=europe&players=4');

    // Clicking the selected chip clears that filter.
    await user.click(europe);
    expect(cards()).toEqual(['teen-patti', 'hearts', 'scopa', 'tien-len', 'canasta']);

    await user.click(screen.getByRole('switch', { name: 'Playable vs bot' }));
    expect(cards()).toEqual(['teen-patti', 'hearts']);
    expect(window.location.search).toBe('?players=4&playable=1');

    const difficulty = screen.getByRole('group', { name: 'Difficulty' });
    await user.click(within(difficulty).getByRole('button', { name: 'Difficulty 3 of 5' }));
    expect(cards()).toEqual(['hearts']);
  });

  it('shows an empty state with a reset button', async () => {
    const user = userEvent.setup();
    render(<CatalogBrowser index={index} />);
    await user.type(screen.getByTestId('catalog-search'), 'no such game');
    expect(cards()).toEqual([]);
    const empty = screen.getByTestId('catalog-empty');
    expect(empty).toHaveTextContent('No games match those filters');
    await user.click(within(empty).getByRole('button', { name: 'Reset filters' }));
    expect(cards()).toHaveLength(7);
    expect(screen.getByTestId('catalog-search')).toHaveValue('');
    expect(window.location.search).toBe('');
  });

  it('has one always-visible reset control (outside the collapsible panel)', async () => {
    const user = userEvent.setup();
    render(<CatalogBrowser index={index} />);
    expect(screen.queryByTestId('catalog-reset')).not.toBeInTheDocument();
    await user.click(screen.getByRole('switch', { name: 'Playable vs bot' }));
    expect(screen.getAllByTestId('catalog-reset')).toHaveLength(1);
    const reset = screen.getByTestId('catalog-reset');
    const panelId = screen.getByTestId('catalog-filters-toggle').getAttribute('aria-controls');
    expect(reset.closest(`[id="${panelId}"]`)).toBeNull();
    await user.click(reset);
    expect(cards()).toHaveLength(7);
    expect(screen.queryByTestId('catalog-reset')).not.toBeInTheDocument();
    // The button is gone, so focus lands on the result count instead of the page body.
    expect(screen.getByTestId('catalog-count')).toHaveFocus();
    expect(screen.getByRole('switch', { name: 'Playable vs bot' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('reads its initial filters from the URL (shareable links)', () => {
    search = new URLSearchParams('mood=brainy&type=trick-taking&bogus=1');
    render(<CatalogBrowser index={index} />);
    expect(cards()).toEqual(['hearts', 'skat']);
    const mood = screen.getByRole('group', { name: 'Mood' });
    expect(within(mood).getByRole('button', { name: /Brainy/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByTestId('catalog-count')).toHaveTextContent('Showing 2 of 7 games');
    expect(screen.getByTestId('catalog-filters-toggle')).toHaveTextContent('Filters (2)');
  });

  it('announces the result count after a change', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      const { LiveAnnouncer } = await import('@/components/layout/LiveAnnouncer');
      render(
        <>
          <LiveAnnouncer />
          <CatalogBrowser index={index} />
        </>,
      );
      await user.click(screen.getByRole('switch', { name: 'Playable vs bot' }));
      act(() => {
        vi.advanceTimersByTime(600);
      });
      await waitFor(() =>
        expect(screen.getByTestId('sr-announcer')).toHaveTextContent('Showing 3 of 7 games'),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('toggles the filter panel on small screens', async () => {
    const user = userEvent.setup();
    render(<CatalogBrowser index={index} />);
    const toggle = screen.getByTestId('catalog-filters-toggle');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    const panel = document.getElementById(toggle.getAttribute('aria-controls') ?? '');
    expect(panel).toHaveClass('hidden');
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(panel).not.toHaveClass('hidden');
  });
});
