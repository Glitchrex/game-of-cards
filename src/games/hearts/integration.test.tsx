// @vitest-environment jsdom
/**
 * Hearts end to end at the component level: the generated registry → GameShell
 * (/games/hearts/play) and PracticeHand (/games/hearts/try) → the real engine and Board,
 * on the curated seeds the Playwright tests use. Bot turns are paced by the controller's
 * delay (`BOT_DELAY_MS.normal`, 60% of it when the bot has a single legal card), so the
 * tests run on fake timers.
 *
 * In play mode there is no coach on screen, so the tests keep a "mirror" of the hand —
 * the same engine on the same seed — to know which card the coach would pick, and click
 * exactly that card in the real UI. Normal bots are deterministic, so the mirror and the
 * table stay in step; the tests check that they do.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/hearts';
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
import { heartsEngine as E, type HeartsMove, type HeartsState } from './engine';
import heartsModule from './index';
import { HEARTS_SEEDS } from './seeds';

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
function botDelay(state: HeartsState): number {
  const seat = E.currentPlayer(state) ?? 0;
  return E.legalMoves(state, seat).length <= 1
    ? Math.round(BOT_DELAY_MS.normal * 0.6)
    : BOT_DELAY_MS.normal;
}

const handCard = (code: CardCode) =>
  within(screen.getByTestId('hearts-hand')).getByRole('button', { name: cardName(code) });

const handCodes = () =>
  [...screen.getByTestId('hearts-hand').querySelectorAll('[data-card]')]
    .map((el) => el.getAttribute('data-card'))
    .sort();

/** Make the learner's move through the UI: pick 3 cards and pass, or press one card. */
function moveInUi(move: HeartsMove) {
  if (move.type === 'pass') {
    for (const code of move.cards) fireEvent.click(handCard(code));
    fireEvent.click(screen.getByTestId('hearts-pass'));
  } else {
    fireEvent.click(handCard(move.card));
  }
}

/**
 * Every card the learner must not see right now: the bots' hands and their passes — less
 * the cards the learner passed (they know where those went) and, before the first lead,
 * the 2♣ (everyone knows its holder must lead it).
 */
function secretsIn(state: HeartsState): string[] {
  const firstLead = state.phase === 'play' && state.tricks.length === 0 && state.trick.length === 0;
  const mine = state.passed[0] ?? [];
  return [1, 2, 3]
    .flatMap((seat) => [
      ...(state.hands[seat] ?? []),
      ...(state.phase === 'pass' ? (state.passed[seat] ?? []) : []),
    ])
    .filter((code) => !mine.includes(code) && !(firstLead && code === '2C'))
    .map((code) => cardName(code));
}

/**
 * Play the whole hand in GameShell, following the coach's suggestion (taken from the
 * mirror) for every learner move, and let the bots play with the controller's timing.
 */
async function playOutFollowingCoach(seed: number, { checkHidden = false } = {}) {
  let mirror = E.setup(
    { ...heartsModule.defaultConfig, affordableUnits: 99 },
    createRng(String(seed)),
  );
  const botRng = createRng(`bot-${seed}`);
  let learnerMoves = 0;
  while (!E.isOver(mirror)) {
    const seat = E.currentPlayer(mirror) ?? 0;
    if (seat === 0) {
      expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
      expect(handCodes()).toEqual([...(mirror.hands[0] ?? [])].sort());
      const move = E.coach(mirror, 0).suggestion as HeartsMove;
      moveInUi(move);
      // A few animation frames, so the played card's exit animation finishes.
      await flush(FRAMES_MS);
      mirror = E.applyMove(mirror, move);
      learnerMoves += 1;
    } else {
      expect(screen.getByTestId(`hearts-seat-${seat}`)).toHaveAttribute('data-thinking', 'true');
      await flush(botDelay(mirror));
      mirror = E.applyMove(mirror, E.botMove(mirror, seat, 'normal', botRng));
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

describe('Hearts is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('hearts');
    await expect(gameModuleLoaders.hearts?.()).resolves.toBe(heartsModule);
  });
});

/* ------------------------------------------------------------------ play mode */

async function renderShell(seed: number, { strict = false }: { strict?: boolean } = {}) {
  const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
  const view = render(
    <Wrap>
      <StoreHydrator />
      <GameShell slug="hearts" gameName="Hearts" tips={content.tips} seed={String(seed)} />
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

describe('/games/hearts/play (GameShell + the real module)', () => {
  it('offers the Hearts bet: chips, the payout line, bot difficulty and the three bots', async () => {
    await renderShell(HEARTS_SEEDS.soleWin);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(heartsModule.betting.describe);
    expect(within(panel).getByText('Bot difficulty')).toBeInTheDocument();
    expect(
      screen.getByText('You vs Auntie Bubbles, Colonel Kofta and Usherette Tilly'),
    ).toBeInTheDocument();
  });

  it('soleWin: bet, pass, play all 13 tricks and win the whole pot (+3 stakes)', async () => {
    render(<LiveAnnouncer />);
    await renderShell(HEARTS_SEEDS.soleWin);
    await dealFor(10);
    expect(useWallet.getState().balance).toBe(990);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    expect(screen.getByTestId('hearts-board')).toHaveAttribute('data-phase', 'pass');

    const { learnerMoves } = await playOutFollowingCoach(HEARTS_SEEDS.soleWin, {
      checkHidden: true,
    });
    expect(learnerMoves).toBe(14);
    expect(screen.getByTestId('hearts-scores')).toBeInTheDocument();
    expect(screen.getByTestId('hearts-score-0')).toHaveAttribute('data-winner', 'true');

    await flush(RESULT_REVEAL_MS);
    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+30 Jeet')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1030);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 40],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(
      within(screen.getByTestId('move-log')).getByText(/That was the last trick\./),
    ).toBeInTheDocument();
  });

  it('sharedWin: a tie for the lowest score splits the pot (+1 stake)', async () => {
    await renderShell(HEARTS_SEEDS.sharedWin);
    await dealFor(25);
    await playOutFollowingCoach(HEARTS_SEEDS.sharedWin);
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    // The engine's "Player 3" reaches the screen as the persona's name.
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      'You tied for the lowest score (0 points) with Usherette Tilly, so you share the win.',
    );
    expect(screen.getByTestId('hearts-score-3')).toHaveAttribute('data-winner', 'true');
    expect(useWallet.getState().balance).toBe(1025);
    expect(ledger()).toEqual([
      ['bet', -25],
      ['payout', 50],
    ]);
  });

  it('loss: losing by a point costs the stake, with a roast and a Hearts tip', async () => {
    await renderShell(HEARTS_SEEDS.loss);
    await dealFor(50);
    await playOutFollowingCoach(HEARTS_SEEDS.loss);
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

  it('opponentMoon: a bot shoots the moon — banner, 26 for the learner, a loss', async () => {
    await renderShell(HEARTS_SEEDS.opponentMoon);
    await dealFor(10);
    await playOutFollowingCoach(HEARTS_SEEDS.opponentMoon);
    expect(screen.getByTestId('hearts-moon')).toHaveTextContent('Auntie Bubbles shot the moon!');
    expect(screen.getByTestId('hearts-score-0')).toHaveAttribute('data-score', '26');
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(990);
  });

  it('explains an illegal card instead of playing it', async () => {
    await renderShell(HEARTS_SEEDS.practice);
    await dealFor(10);
    fireEvent.click(handCard('QS'));
    fireEvent.click(screen.getByTestId('hearts-pass'));
    expect(screen.getByTestId('move-error')).toHaveTextContent(
      'Pick exactly 3 cards to pass — you picked 1.',
    );
    expect(screen.getByTestId('hearts-board')).toHaveAttribute('data-phase', 'pass');
    // P passes from the keyboard once three cards are picked.
    fireEvent.click(handCard('AS'));
    fireEvent.click(handCard('AH'));
    fireEvent.keyDown(document.body, { key: 'p' });
    await flush();
    expect(screen.getByTestId('hearts-passed')).toBeInTheDocument();
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Auntie Bubbles is thinking…');
  });

  it('leaving mid-hand forfeits the stake and says so', async () => {
    const view = await renderShell(HEARTS_SEEDS.practice);
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
    await renderShell(HEARTS_SEEDS.soleWin, { strict: true });
    await dealFor(10);
    await playOutFollowingCoach(HEARTS_SEEDS.soleWin);
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1030);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 40],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
  });
});

/* -------------------------------------------------------------- practice mode */

describe('/games/hearts/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="hearts" gameName="Hearts" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro and the passing situation', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(heartsModule.practice.intro);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'Before the first trick, choose 3 cards to pass to Auntie Bubbles (on your left).',
    );
    expect(screen.getByTestId('hearts-board')).toHaveAttribute('data-phase', 'pass');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"What would a pro do?" lights up the three cards to pass and explains why', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    for (const code of ['QS', 'AS', 'AH'] as const) {
      expect(handCard(code)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/Queen of Spades/);
    fireEvent.click(screen.getByTestId('hearts-pass-pick'));
    expect(screen.getByTestId('hearts-pass')).toHaveAttribute('data-suggested', 'true');
  });

  it('follows the coach through the whole hand: highlights, a mistake explained, a summary', async () => {
    await renderPractice();
    let turns = 0;
    let explained = false;
    for (let guard = 0; guard < 200 && !screen.queryByTestId('practice-summary'); guard++) {
      if (screen.getByTestId('turn-indicator').textContent?.includes('Your turn')) {
        const board = screen.getByTestId('hearts-board');
        if (board.dataset.phase === 'play') {
          // Coach mode: every legal card glows; the rest are dimmed.
          const hand = screen.getByTestId('hearts-hand');
          expect(hand.querySelectorAll('[data-highlighted]').length).toBeGreaterThan(0);
          if (!explained) {
            // Trick 1: Clubs were led and the Q♣ is the only Club — try a Heart first.
            fireEvent.click(handCard('KH'));
            expect(screen.getByTestId('coach-error')).toHaveTextContent(
              'You must follow suit: Clubs were led and you still have a Club',
            );
            explained = true;
          }
        }
        fireEvent.click(screen.getByTestId('coach-hint'));
        if (board.dataset.phase === 'pass') {
          fireEvent.click(screen.getByTestId('hearts-pass-pick'));
          fireEvent.click(screen.getByTestId('hearts-pass'));
        } else {
          const pick = screen
            .getByTestId('hearts-hand')
            .querySelector<HTMLElement>('[data-suggested]');
          expect(pick).not.toBeNull();
          fireEvent.click(pick!);
        }
        turns += 1;
        await flush();
      } else {
        await flush(BOT_DELAY_MS.normal);
      }
    }
    expect(explained).toBe(true);
    expect(turns).toBe(14);
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      'You won with 0 points — the lowest score at the table!',
    );
    expect(screen.getByTestId('hearts-score-0')).toHaveAttribute('data-score', '0');
    expect(useProgress.getState().games.hearts?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});
