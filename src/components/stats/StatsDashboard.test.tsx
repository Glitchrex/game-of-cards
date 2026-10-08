// @vitest-environment jsdom
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionGlobalConfig } from 'motion/react';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { type GameSummary } from '@/components/journey/journey-data';
import { StoreHydrator } from '@/store/hydrate';
import { emptyProgress, useProgress } from '@/store/progress';
import { useStats, type Award } from '@/store/stats';
import { STARTING_BALANCE, useWallet } from '@/store/wallet';
import { StatsDashboard } from './StatsDashboard';

const GAMES: GameSummary[] = [
  { slug: 'war', name: 'War', tier: 1 },
  { slug: 'blackjack', name: 'Blackjack', tier: 1 },
  { slug: 'bridge', name: 'Bridge', tier: 2 },
];

const AWARDS: Award[] = [
  {
    id: 'a2',
    titleId: 't-2',
    text: 'Baazigar of the Table',
    film: 'Baazigar (1993)',
    gameSlug: 'blackjack',
    jeet: 1250,
    at: Date.UTC(2026, 9, 4, 12),
  },
  {
    id: 'a1',
    titleId: 't-1',
    text: 'The Dark Knight of Diamonds',
    gameSlug: 'war',
    jeet: 40,
    at: Date.UTC(2026, 9, 1, 12),
  },
];

const statsReset = () =>
  useStats.setState({
    played: 0,
    wins: 0,
    losses: 0,
    pushes: 0,
    biggestWin: 0,
    currentStreak: 0,
    bestStreak: 0,
    perGame: {},
    awards: [],
    lastTitleId: null,
    lastRoastId: null,
  });

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  localStorage.clear();
  dismissAllToasts();
  useWallet.setState({ balance: STARTING_BALANCE, lastUdhaarAt: null, ledger: [] });
  statsReset();
  useProgress.setState({ games: {} });
});

function renderStats() {
  return render(
    <>
      <StoreHydrator />
      <StatsDashboard games={GAMES} />
      <Toaster />
    </>,
  );
}

describe('StatsDashboard', () => {
  it('shows a loading skeleton until the stores hydrate', async () => {
    renderStats();
    // Hydration is asynchronous, so the first paint is the skeleton (first test in the file).
    expect(screen.getByTestId('stats-skeleton')).toHaveAttribute('aria-busy', 'true');
    expect(await screen.findByTestId('stats-balance')).toHaveTextContent('1,000');
    expect(screen.queryByTestId('stats-skeleton')).not.toBeInTheDocument();
  });

  it('stat tiles reflect the stats store', async () => {
    useStats.setState({
      played: 7,
      wins: 4,
      losses: 2,
      pushes: 1,
      biggestWin: 1250,
      currentStreak: 3,
      bestStreak: 4,
      awards: AWARDS,
    });
    renderStats();
    expect(await screen.findByTestId('stat-played')).toHaveTextContent(/^7$/);
    expect(screen.getByTestId('stat-wins')).toHaveTextContent(/^4$/);
    expect(screen.getByTestId('stat-losses')).toHaveTextContent(/^2$/);
    expect(screen.getByTestId('stat-pushes')).toHaveTextContent(/^1$/);
    expect(screen.getByTestId('stat-win-rate')).toHaveTextContent(/^57%$/);
    expect(screen.getByTestId('stat-biggest-win')).toHaveTextContent('+1,250');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('3 wins in a row');
    expect(screen.getByTestId('stat-best-streak')).toHaveTextContent('4 wins');
    expect(screen.getByTestId('stat-titles')).toHaveTextContent(/^2$/);

    act(() => useStats.setState({ currentStreak: -2, losses: 4, played: 9 }));
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('2 losses in a row');
    expect(screen.getByTestId('stat-losses')).toHaveTextContent(/^4$/);
    expect(screen.getByTestId('stat-win-rate')).toHaveTextContent(/^44%$/);
  });

  it('shows dashes instead of numbers that do not exist yet', async () => {
    renderStats();
    expect(await screen.findByTestId('stat-played')).toHaveTextContent(/^0$/);
    expect(screen.getByTestId('stat-win-rate')).toHaveTextContent('None yet');
    expect(screen.getByTestId('stat-biggest-win')).toHaveTextContent('None yet');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('No streak yet');
  });

  it('wallet card shows the balance, latest ledger entries and the pretend-money notice', async () => {
    useWallet.setState({
      balance: 1180,
      ledger: [
        { at: Date.now() - 1000, amount: 300, reason: 'payout', gameSlug: 'blackjack' },
        { at: Date.now() - 5000, amount: -120, reason: 'bet', gameSlug: 'blackjack' },
      ],
    });
    renderStats();
    expect(await screen.findByTestId('stats-balance')).toHaveTextContent('1,180');
    const wallet = screen.getByTestId('stats-wallet');
    expect(within(wallet).getByText('Winnings')).toBeInTheDocument();
    expect(within(wallet).getAllByText(/Blackjack/)).toHaveLength(2);
    expect(within(wallet).getByText('+300')).toBeInTheDocument();
    expect(screen.getByTestId('stats-wallet-notice')).toHaveTextContent(
      'Jeet is pretend money for learning. No real money, ever.',
    );
    // Not broke → no udhaar offer; and never anything to buy.
    expect(screen.queryByTestId('udhaar-offer')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /buy|purchase|pay/i })).not.toBeInTheDocument();
  });

  it('offers the Daily Udhaar (compact) when the learner is nearly broke', async () => {
    const user = userEvent.setup();
    useWallet.setState({ balance: 40 });
    renderStats();
    const offer = await screen.findByTestId('udhaar-offer');
    expect(offer).toHaveAttribute('data-state', 'ok');
    await user.click(within(offer).getByRole('button', { name: 'Claim 500 Jeet' }));
    expect(screen.getByTestId('stats-balance')).toHaveTextContent('540');
    expect(screen.queryByTestId('udhaar-offer')).not.toBeInTheDocument();
    // Focus moves to the balance rather than dropping to <body>.
    expect(document.activeElement).toContainElement(screen.getByTestId('stats-balance'));
  });

  it('lists each played or opened game with its record and learning status', async () => {
    useStats.setState({
      perGame: { blackjack: { played: 5, wins: 3, losses: 2, pushes: 0, biggestWin: 300 } },
    });
    useProgress.setState({
      games: {
        blackjack: { ...emptyProgress(), started: true, lessonDone: true },
        bridge: {
          ...emptyProgress(),
          started: true,
          lessonDone: true,
          exampleDone: true,
          quizBest: 5,
        },
      },
    });
    renderStats();
    const row = await screen.findByTestId('stats-game-blackjack');
    const cells = within(row).getAllByRole('cell');
    expect(within(row).getByRole('link', { name: 'Blackjack' })).toHaveAttribute(
      'href',
      '/games/blackjack',
    );
    expect(cells.map((c) => c.textContent)).toEqual(['5', '3', '2', '+300 Jeet', 'Learning']);
    expect(
      within(screen.getByTestId('stats-game-bridge')).getByText('Mastered'),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('stats-game-war')).not.toBeInTheDocument();

    // Phones get the same rows as compact cards (the table is hidden below `sm`).
    const card = screen.getByTestId('stats-game-card-blackjack');
    expect(within(card).getByRole('link', { name: 'Blackjack' })).toHaveAttribute(
      'href',
      '/games/blackjack',
    );
    expect(
      within(card)
        .getAllByRole('definition')
        .map((d) => d.textContent),
    ).toEqual(['5', '3', '2', '+300 Jeet']);
    expect(within(card).getByText('Learning')).toBeInTheDocument();
  });

  it('scrolls a /stats#awards deep link to the shelf once it has rendered', async () => {
    const scrolled: Element[] = [];
    const original = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolled.push(this);
    };
    window.history.replaceState(null, '', '/stats#awards');
    try {
      renderStats();
      const shelf = await screen.findByTestId('awards-shelf');
      expect(shelf).toHaveAttribute('id', 'awards');
      expect(scrolled).toEqual([shelf]);
    } finally {
      window.history.replaceState(null, '', '/');
      Element.prototype.scrollIntoView = original;
    }
  });

  it('reset asks for confirmation, then resets wallet, stats and progress', async () => {
    const user = userEvent.setup();
    useWallet.setState({
      balance: 420,
      ledger: [{ at: Date.now(), amount: -100, reason: 'bet', gameSlug: 'war' }],
    });
    useStats.setState({ played: 3, wins: 2, losses: 1, awards: AWARDS, currentStreak: 2 });
    useProgress.setState({ games: { war: { ...emptyProgress(), started: true } } });
    renderStats();
    const opener = await screen.findByTestId('reset-progress');

    // Cancelling keeps everything.
    await user.click(opener);
    let dialog = await screen.findByRole('alertdialog', { name: 'Reset all progress?' });
    expect(dialog).toHaveAccessibleDescription(/can’t be undone/);
    expect(within(dialog).getByRole('button', { name: 'Keep my progress' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Keep my progress' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(opener).toHaveFocus();
    expect(useStats.getState().played).toBe(3);
    expect(useWallet.getState().balance).toBe(420);

    // Confirming resets the three learner stores.
    await user.click(opener);
    dialog = await screen.findByRole('alertdialog', { name: 'Reset all progress?' });
    await user.click(within(dialog).getByTestId('reset-confirm'));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(useWallet.getState()).toMatchObject({ balance: 1000, ledger: [], lastUdhaarAt: null });
    expect(useStats.getState()).toMatchObject({ played: 0, wins: 0, awards: [], currentStreak: 0 });
    expect(useProgress.getState().games).toEqual({});
    expect(screen.getByTestId('stats-balance')).toHaveTextContent('1,000');
    expect(screen.getByTestId('stat-played')).toHaveTextContent(/^0$/);
    expect(screen.getByTestId('awards-empty')).toBeInTheDocument();
    expect(await screen.findByText(/Fresh start!/)).toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});
