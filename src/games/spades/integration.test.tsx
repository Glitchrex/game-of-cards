// @vitest-environment jsdom
/**
 * Spades end to end at the component level: the generated registry → GameShell
 * (/games/spades/play) and PracticeHand (/games/spades/try) → the real engine and Board,
 * on the curated seeds the Playwright tests use. Bot turns are paced by the controller's
 * delay (`BOT_DELAY_MS.normal`, 60% of it when the bot has a single legal card), so the
 * tests run on fake timers.
 *
 * In play mode there is no coach on screen, so the tests keep a "mirror" of the hand —
 * the same engine on the same seed — to know which bid or card the coach would pick, and
 * press exactly that in the real UI. Normal bots are deterministic, so the mirror and the
 * table stay in step; the tests check that they do.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/spades';
import { roasts, titles } from '@content/titles';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { GameShell, RESULT_REVEAL_MS } from '@/components/play/GameShell';
import { PracticeHand } from '@/components/play/PracticeHand';
import { stripTipPrefix } from '@/components/play/personas';
import { clearGameModuleCache } from '@/components/play/useGameModule';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { cardName, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { gameModuleLoaders, TIER1_SLUGS } from '@/games/registry.generated';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { spadesEngine as E, type SpadesMove, type SpadesState } from './engine';
import spadesModule from './index';
import { SPADES_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

const TIPS = content.tips.map(stripTipPrefix);
/** A few animation frames — shorter than any bot delay. */
const FRAMES_MS = 50;

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** The controller's delay for a bot's turn in `state`. */
function botDelay(state: SpadesState): number {
  const seat = E.currentPlayer(state) ?? 0;
  return E.legalMoves(state, seat).length <= 1
    ? Math.round(BOT_DELAY_MS.normal * 0.6)
    : BOT_DELAY_MS.normal;
}

const handCard = (code: CardCode) =>
  within(screen.getByTestId('spades-hand')).getByRole('button', { name: cardName(code) });

const handCodes = () =>
  [...screen.getByTestId('spades-hand').querySelectorAll('[data-card]')]
    .map((el) => el.getAttribute('data-card'))
    .sort();

/** Make the learner's move through the UI: pick a bid and press Bid, or press one card. */
function moveInUi(move: SpadesMove) {
  if (move.type === 'bid') {
    fireEvent.click(screen.getByTestId(`spades-bid-${move.tricks}`));
    fireEvent.click(screen.getByTestId('spades-bid-submit'));
  } else {
    fireEvent.click(handCard(move.card));
  }
}

/** Every card the learner must not see right now: the bots' hands. */
function secretsIn(state: SpadesState): string[] {
  return [1, 2, 3].flatMap((seat) => state.hands[seat] ?? []).map((code) => cardName(code));
}

/**
 * Play the whole hand in GameShell, following the coach's suggestion (taken from the
 * mirror) for every learner move, and let the bots play with the controller's timing.
 */
async function playOutFollowingCoach(seed: number, { checkHidden = false, keyboard = false } = {}) {
  let mirror = E.setup(
    { ...spadesModule.defaultConfig, affordableUnits: 99 },
    createRng(String(seed)),
  );
  const botRng = createRng(`bot-${seed}`);
  let learnerMoves = 0;
  while (!E.isOver(mirror)) {
    const seat = E.currentPlayer(mirror) ?? 0;
    if (seat === 0) {
      expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
      expect(handCodes()).toEqual([...(mirror.hands[0] ?? [])].sort());
      const move = E.coach(mirror, 0).suggestion as SpadesMove;
      if (keyboard && move.type === 'bid' && move.tricks <= 9) {
        fireEvent.keyDown(document.body, { key: String(move.tricks) });
        fireEvent.keyDown(document.body, { key: 'b' });
      } else {
        moveInUi(move);
      }
      // A few animation frames, so the played card's exit animation finishes.
      await flush(FRAMES_MS);
      mirror = E.applyMove(mirror, move);
      learnerMoves += 1;
    } else {
      expect(screen.getByTestId(`spades-seat-${seat}`)).toHaveAttribute('data-thinking', 'true');
      await flush(botDelay(mirror));
      mirror = E.applyMove(mirror, E.botMove(mirror, seat, 'normal', botRng));
    }
    // The table shows every bid made so far (and none that hasn't been).
    for (const s of [0, 1, 2, 3]) {
      expect(screen.getByTestId(`spades-bid-badge-${s}`).getAttribute('data-bid')).toBe(
        mirror.bids[s] === null ? null : String(mirror.bids[s]),
      );
    }
    if (checkHidden) {
      const page = document.body.innerHTML;
      for (const secret of secretsIn(mirror)) expect(page).not.toContain(secret);
    }
  }
  return { mirror, learnerMoves };
}

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      // Motion runs its frames (and finishes exit animations) on animation frames.
      'requestAnimationFrame',
      'cancelAnimationFrame',
    ],
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 201 }))),
  );
  clearGameModuleCache();
  dismissAllToasts();
  localStorage.clear();
  sessionStorage.clear();
  useWallet.setState({ balance: 1000, lastUdhaarAt: null, ledger: [] });
  useStats.getState().reset();
  useProgress.getState().reset();
  useSettings.setState({ botSpeed: 'normal', motion: 'full', muted: true });
});

afterEach(async () => {
  // Unmount, then let Motion finish the frames it scheduled on the fake clock: a frame left
  // pending would stall its frame loop (and every exit animation) in the next test.
  cleanup();
  await flush(1000);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Spades is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('spades');
    await expect(gameModuleLoaders.spades?.()).resolves.toBe(spadesModule);
  });
});

/* ------------------------------------------------------------------ play mode */

async function renderShell(seed: number, { strict = false }: { strict?: boolean } = {}) {
  const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
  const view = render(
    <Wrap>
      <StoreHydrator />
      <GameShell slug="spades" gameName="Spades" tips={content.tips} seed={String(seed)} />
    </Wrap>,
  );
  await flush();
  return view;
}

const ledger = () => [...useWallet.getState().ledger].reverse().map((e) => [e.reason, e.amount]);

async function dealFor(stake = 10) {
  fireEvent.click(screen.getByTestId(`stake-${stake}`));
  fireEvent.click(screen.getByTestId('deal-button'));
  await flush();
}

describe('/games/spades/play (GameShell + the real module)', () => {
  it('offers the Spades bet: chips, the payout line, bot difficulty and the three players', async () => {
    await renderShell(SPADES_SEEDS.win);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(spadesModule.betting.describe);
    expect(within(panel).getByText('Bot difficulty')).toBeInTheDocument();
    expect(
      screen.getByText('You vs Stuntman Rafi, Mausi Marigold and Lady Limelight'),
    ).toBeInTheDocument();
  });

  it('win: bet, bid, play all 13 tricks and win one stake — with a title', async () => {
    render(<LiveAnnouncer />);
    await renderShell(SPADES_SEEDS.win);
    await dealFor(10);
    expect(useWallet.getState().balance).toBe(990);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    expect(screen.getByTestId('spades-board')).toHaveAttribute('data-phase', 'bid');

    const { learnerMoves, mirror } = await playOutFollowingCoach(SPADES_SEEDS.win, {
      checkHidden: true,
    });
    expect(learnerMoves).toBe(14);
    expect(screen.getByTestId('spades-scores')).toBeInTheDocument();
    expect(screen.getByTestId('spades-score-us')).toHaveAttribute('data-winner', 'true');
    expect(screen.getByTestId('spades-score-us')).toHaveAttribute(
      'data-total',
      String(E.result(mirror).scores?.[0]),
    );

    await flush(RESULT_REVEAL_MS);
    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+10 Jeet')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent('Your team won 72 to 40');
    expect(useWallet.getState().balance).toBe(1010);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 20],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(
      within(screen.getByTestId('move-log')).getByText(/That was the last trick\./),
    ).toBeInTheDocument();
  });

  it('loss: the opponents score more — the stake is lost, with a roast and a Spades tip', async () => {
    await renderShell(SPADES_SEEDS.loss);
    await dealFor(50);
    await playOutFollowingCoach(SPADES_SEEDS.loss);
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(TIPS.some((x) => tip.includes(x))).toBe(true);
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('−50 Jeet');
    expect(useWallet.getState().balance).toBe(950);
    expect(ledger()).toEqual([['bet', -50]]);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });

  it('the opponents bid first; the learner’s bid waits its turn, then a set loses', async () => {
    await renderShell(SPADES_SEEDS.set);
    await dealFor(25);
    expect(screen.getByTestId('turn-indicator')).not.toHaveTextContent('Your turn');
    await playOutFollowingCoach(SPADES_SEEDS.set);
    expect(screen.getByTestId('spades-score-us')).toHaveAttribute('data-made', 'false');
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(975);
  });

  it('bids with the keyboard shortcuts (a digit, then B) and wins with a Nil that holds', async () => {
    await renderShell(SPADES_SEEDS.nilWin);
    await dealFor(10);
    await playOutFollowingCoach(SPADES_SEEDS.nilWin, { keyboard: true });
    expect(screen.getByTestId('spades-bid-badge-0')).toHaveAttribute('data-bid', '0');
    expect(screen.getByTestId('spades-tricks-0')).toHaveAttribute('data-tricks', '0');
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1010);
  });

  it('explains an illegal card instead of playing it', async () => {
    await renderShell(SPADES_SEEDS.practice);
    await dealFor(10);
    // Trying to play a card before bidding.
    fireEvent.click(handCard('AS'));
    expect(screen.getByTestId('move-error')).toHaveTextContent(
      'Not yet! Everyone bids before any card is played',
    );
    fireEvent.keyDown(document.body, { key: '3' });
    fireEvent.keyDown(document.body, { key: 'b' });
    await flush();
    expect(screen.getByTestId('spades-bid-badge-0')).toHaveAttribute('data-bid', '3');
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Stuntman Rafi is thinking…');
    for (let i = 0; i < 3; i++) await flush(BOT_DELAY_MS.normal);
    expect(screen.getByTestId('spades-board')).toHaveAttribute('data-phase', 'play');
    // Leading a Spade before Spades are broken.
    fireEvent.click(handCard('AS'));
    expect(screen.getByTestId('move-error')).toHaveTextContent("Spades aren't broken yet");
    expect(handCodes()).toContain('AS');
  });

  it('leaving mid-hand forfeits the stake and says so', async () => {
    const view = await renderShell(SPADES_SEEDS.practice);
    await dealFor(50);
    expect(useWallet.getState().balance).toBe(950);
    view.unmount();
    expect(useWallet.getState().balance).toBe(950);
    expect(ledger()).toEqual([['bet', -50]]);
    expect(useStats.getState().played).toBe(0);
    render(<Toaster />);
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'You left in the middle of a hand, so your 50 Jeet bet was forfeited.',
    );
  });

  it('settles and records exactly once under React StrictMode', async () => {
    await renderShell(SPADES_SEEDS.win, { strict: true });
    await dealFor(10);
    await playOutFollowingCoach(SPADES_SEEDS.win);
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1010);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 20],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
  });
});

/* -------------------------------------------------------------- practice mode */

describe('/games/spades/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="spades" gameName="Spades" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro and the bidding situation', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(spadesModule.practice.intro);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent("It's your turn to bid.");
    expect(screen.getByTestId('coach-situation')).toHaveTextContent('Mausi Marigold');
    expect(screen.getByTestId('spades-board')).toHaveAttribute('data-phase', 'bid');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"What would a pro do?" lights up the coach’s bid and explains why', async () => {
    await renderPractice();
    // Coach mode: every bid is a legal move, so each one glows.
    expect(
      screen.getByTestId('spades-bid-options').querySelectorAll('[data-highlighted]'),
    ).toHaveLength(14);
    fireEvent.click(screen.getByTestId('coach-hint'));
    expect(screen.getByTestId('spades-bid-3')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('spades-bid-suggestion')).toHaveTextContent('Suggested: 3 tricks');
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/Ace of Spades|A♠/);
    fireEvent.click(screen.getByTestId('spades-bid-suggestion'));
    expect(screen.getByTestId('spades-bid-submit')).toHaveAttribute('data-suggested', 'true');
  });

  it('follows the coach through the whole hand: highlights, a mistake explained, a summary', async () => {
    await renderPractice();
    let turns = 0;
    let explained = false;
    for (let guard = 0; guard < 200 && !screen.queryByTestId('practice-summary'); guard++) {
      if (screen.getByTestId('turn-indicator').textContent?.includes('Your turn')) {
        const board = screen.getByTestId('spades-board');
        if (board.dataset.phase === 'play') {
          // Coach mode: every legal card glows; the rest are dimmed.
          const hand = screen.getByTestId('spades-hand');
          expect(hand.querySelectorAll('[data-highlighted]').length).toBeGreaterThan(0);
          if (!explained) {
            // Trick 1: the learner leads, and Spades aren't broken — try the A♠ first.
            fireEvent.click(handCard('AS'));
            expect(screen.getByTestId('coach-error')).toHaveTextContent("Spades aren't broken yet");
            explained = true;
          }
        }
        fireEvent.click(screen.getByTestId('coach-hint'));
        if (board.dataset.phase === 'bid') {
          fireEvent.click(screen.getByTestId('spades-bid-suggestion'));
          fireEvent.click(screen.getByTestId('spades-bid-submit'));
        } else {
          const pick = screen
            .getByTestId('spades-hand')
            .querySelector<HTMLElement>('[data-suggested]');
          expect(pick).not.toBeNull();
          fireEvent.click(pick!);
        }
        turns += 1;
        await flush(FRAMES_MS);
      } else {
        await flush(BOT_DELAY_MS.normal);
      }
    }
    expect(explained).toBe(true);
    expect(turns).toBe(14);
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      'Your team won 60 to 43: your team bid 6 and made it exactly, while the opponents bid 4 and took 7.',
    );
    expect(screen.getByTestId('spades-score-us')).toHaveAttribute('data-total', '60');
    expect(useProgress.getState().games.spades?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});
