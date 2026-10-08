// @vitest-environment jsdom
/**
 * Go Fish end to end at the component level: the generated registry → GameShell
 * (/games/go-fish/play) and PracticeHand (/games/go-fish/try) → the real engine and Board,
 * on the curated seeds the Playwright tests use. Bot turns are paced by the controller's
 * delay (`BOT_DELAY_MS.normal`, 60% of it when the bot has a single legal ask), so the
 * tests run on fake timers.
 *
 * In play mode there is no coach on screen, so the tests keep a "mirror" of the game — the
 * same engine on the same seed — to know which ask the coach would make, and make exactly
 * that ask in the real UI (pick the player, pick the rank, press Ask). Normal bots are
 * deterministic, so the mirror and the table stay in step; the tests check that they do.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/go-fish';
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
import { goFishEngine as E, type GoFishMove, type GoFishState } from './engine';
import goFishModule from './index';
import { GOFISH_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

const TIPS = content.tips.map(stripTipPrefix);

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** The controller's delay for a bot's turn in `state`. */
function botDelay(state: GoFishState): number {
  const seat = E.currentPlayer(state) ?? 0;
  return E.legalMoves(state, seat).length <= 1
    ? Math.round(BOT_DELAY_MS.normal * 0.6)
    : BOT_DELAY_MS.normal;
}

/** The learner's ask, made through the UI: the player, the rank, then Ask. */
function askInUi(move: GoFishMove) {
  fireEvent.click(screen.getByTestId(`gofish-target-${move.target}`));
  fireEvent.click(screen.getByTestId(`gofish-rank-${move.rank}`));
  fireEvent.click(screen.getByTestId('gofish-ask'));
}

/** The learner's hand as the Board shows it (rank → count). */
function handInUi(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const el of screen
    .getByTestId('gofish-hand')
    .querySelectorAll<HTMLElement>('[data-count]')) {
    const id = el.dataset.testid ?? '';
    if (id.startsWith('gofish-rank-'))
      out[id.slice('gofish-rank-'.length)] = Number(el.dataset.count);
  }
  return out;
}

function handOf(state: GoFishState): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of state.hands[0] ?? []) out[c[0]!] = (out[c[0]!] ?? 0) + 1;
  return out;
}

/**
 * Every card the learner must not see: the bots' hands and the pond — less the cards a bot
 * showed everyone by fishing its wish, and the cards the learner drew themself (a bot may
 * have caught those from them since, but the learner knows exactly which they were).
 */
function secretsIn(state: GoFishState): string[] {
  const known = new Set(
    state.log.flatMap((e) =>
      (e.type === 'fish' && (e.wish || e.seat === 0)) || (e.type === 'refill' && e.seat === 0)
        ? [e.card]
        : [],
    ),
  );
  return [...(state.hands[1] ?? []), ...(state.hands[2] ?? []), ...state.stock]
    .filter((c: CardCode) => !known.has(c))
    .map(cardName);
}

/**
 * Play the whole game in the real UI, making the coach's ask (taken from the mirror) on
 * every learner turn, and letting the bots play with the controller's timing.
 */
async function playOutFollowingCoach(seed: number, { checkHidden = false } = {}) {
  let mirror = E.setup(goFishModule.defaultConfig, createRng(String(seed)));
  const botRng = createRng(`bot-${seed}`);
  let learnerMoves = 0;
  while (!E.isOver(mirror)) {
    const seat = E.currentPlayer(mirror) ?? 0;
    if (seat === 0) {
      expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
      expect(handInUi()).toEqual(handOf(mirror));
      const move = E.coach(mirror, 0).suggestion as GoFishMove;
      askInUi(move);
      await flush();
      mirror = E.applyMove(mirror, move);
      learnerMoves += 1;
    } else {
      expect(screen.getByTestId(`gofish-seat-${seat}`)).toHaveAttribute('data-thinking', 'true');
      await flush(botDelay(mirror));
      mirror = E.applyMove(mirror, E.botMove(mirror, seat, 'normal', botRng));
    }
    expect(screen.getByTestId('gofish-pond')).toHaveAttribute(
      'data-count',
      String(mirror.stock.length),
    );
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
  // Unmount, then let Motion finish the frames it scheduled on the fake clock.
  cleanup();
  await flush(1000);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Go Fish is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('go-fish');
    await expect(gameModuleLoaders['go-fish']?.()).resolves.toBe(goFishModule);
  });

  it('labels moves with persona names', () => {
    expect(goFishModule.moveLabel?.({ type: 'ask', target: 2, rank: '7' }, {} as GoFishState)).toBe(
      'Ask Kanta Kaka for Sevens',
    );
  });
});

/* ------------------------------------------------------------------ play mode */

async function renderShell(seed: number, { strict = false }: { strict?: boolean } = {}) {
  const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
  const view = render(
    <Wrap>
      <StoreHydrator />
      <GameShell slug="go-fish" gameName="Go Fish" tips={content.tips} seed={String(seed)} />
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

describe('/games/go-fish/play (GameShell + the real module)', () => {
  it('offers the Go Fish bet: chips, the payout line, bot difficulty and the two bots', async () => {
    await renderShell(GOFISH_SEEDS.soleWin);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(
      'Most books wins the pot: a sole win pays 2× your stake, a shared win splits it, otherwise you lose your stake.',
    );
    expect(within(panel).getByText('Bot difficulty')).toBeInTheDocument();
    expect(screen.getByText('You vs Machli Mira and Kanta Kaka')).toBeInTheDocument();
  });

  it('soleWin: bet, ask through the whole game and win the pot (+2 stakes) with a title', async () => {
    render(<LiveAnnouncer />);
    await renderShell(GOFISH_SEEDS.soleWin);
    await dealFor(10);
    expect(useWallet.getState().balance).toBe(990);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    expect(screen.getByTestId('gofish-board')).toHaveAttribute('data-phase', 'play');

    const { learnerMoves } = await playOutFollowingCoach(GOFISH_SEEDS.soleWin, {
      checkHidden: true,
    });
    expect(learnerMoves).toBeGreaterThan(5);
    expect(screen.getByTestId('gofish-books-0')).toHaveAttribute('data-count', '7');
    expect(screen.getByTestId('gofish-you')).toHaveAttribute('data-winner', 'true');

    await flush(RESULT_REVEAL_MS);
    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+20 Jeet')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1020);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 30],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(
      within(screen.getByTestId('move-log')).getByText(
        /That was the last book — the game is over!/,
      ),
    ).toBeInTheDocument();
  });

  it('sharedWin: a tie for the most books splits the pot (+½ stake)', async () => {
    await renderShell(GOFISH_SEEDS.sharedWin);
    await dealFor(10);
    await playOutFollowingCoach(GOFISH_SEEDS.sharedWin);
    expect(screen.getByTestId('gofish-seat-2')).toHaveAttribute('data-winner', 'true');
    expect(screen.getByTestId('gofish-you')).toHaveAttribute('data-winner', 'true');
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      /You tied with .+ for the most books \(5 each\), so you share the pot\./,
    );
    expect(useWallet.getState().balance).toBe(1005);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 15],
    ]);
  });

  it('loss: no books costs the stake, with a roast and a Go Fish tip', async () => {
    await renderShell(GOFISH_SEEDS.loss);
    await dealFor(50);
    await playOutFollowingCoach(GOFISH_SEEDS.loss);
    expect(screen.getByTestId('gofish-books-0')).toHaveAttribute('data-count', '0');
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

  it('explains an illegal ask instead of making it, then plays from the keyboard', async () => {
    await renderShell(GOFISH_SEEDS.practice);
    await dealFor(10);
    const mirror = E.setup(goFishModule.defaultConfig, createRng(String(GOFISH_SEEDS.practice)));
    const held = new Set((mirror.hands[0] ?? []).map((c) => c[0]));
    const missing = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'].find(
      (r) => !held.has(r),
    )!;
    // Ask without picking anything, then for a rank you don't hold.
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(screen.getByTestId('move-error')).toHaveTextContent('Pick one of the other players');
    fireEvent.click(screen.getByTestId('gofish-target-1'));
    fireEvent.keyDown(document.body, { key: missing });
    fireEvent.click(screen.getByTestId('gofish-ask'));
    expect(screen.getByTestId('move-error')).toHaveTextContent(
      'You can only ask for a rank you already hold',
    );
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');

    // The coach's first ask, keyboard only: the seat toolbar, a rank key, then Enter on Ask.
    const move = E.coach(mirror, 0).suggestion as GoFishMove;
    const first = screen.getByTestId('gofish-target-1');
    act(() => first.focus());
    if (move.target === 2) fireEvent.keyDown(first, { key: 'ArrowRight' });
    const seatBtn = screen.getByTestId(`gofish-target-${move.target}`);
    expect(seatBtn).toHaveFocus();
    fireEvent.click(seatBtn); // Enter/Space on a focused <button> is a click
    fireEvent.keyDown(seatBtn, { key: move.rank });
    const askBtn = screen.getByTestId('gofish-ask');
    act(() => askBtn.focus());
    fireEvent.click(askBtn);
    await flush();
    const after = E.applyMove(mirror, move);
    expect(screen.getByTestId('gofish-hand')).toHaveAttribute(
      'data-count',
      String(after.hands[0]?.length),
    );
    expect(within(screen.getByTestId('move-log')).getByText(/You asked/)).toBeInTheDocument();
  });

  it('leaving mid-game forfeits the stake and says so', async () => {
    const view = await renderShell(GOFISH_SEEDS.practice);
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
    await renderShell(GOFISH_SEEDS.soleWin, { strict: true });
    await dealFor(10);
    await playOutFollowingCoach(GOFISH_SEEDS.soleWin);
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1020);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 30],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
  });
});

/* -------------------------------------------------------------- practice mode */

describe('/games/go-fish/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="go-fish" gameName="Go Fish" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro, the situation and glowing seats and ranks', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(goFishModule.practice.intro);
    const situation = screen.getByTestId('coach-situation').textContent ?? '';
    expect(situation.length).toBeGreaterThan(20);
    expect(situation).not.toMatch(/Player \d/);
    expect(screen.getByTestId('gofish-target-1')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('gofish-target-2')).toHaveAttribute('data-highlighted', 'true');
    const ranks = screen
      .getByTestId('gofish-hand')
      .querySelectorAll('[data-testid^="gofish-rank-"]');
    expect(ranks.length).toBeGreaterThan(0);
    for (const r of ranks) expect(r).toHaveAttribute('data-highlighted', 'true');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"What would a pro do?" makes the coach’s seat and rank pulse and explains why', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    expect(
      document.querySelectorAll('[data-testid^="gofish-target-"][data-suggested]'),
    ).toHaveLength(1);
    expect(document.querySelectorAll('[data-testid^="gofish-rank-"][data-suggested]')).toHaveLength(
      1,
    );
    expect((screen.getByTestId('coach-hint-text').textContent ?? '').length).toBeGreaterThan(20);
    fireEvent.click(screen.getByTestId('gofish-use-pick'));
    expect(screen.getByTestId('gofish-ask')).toHaveAttribute('data-suggested', 'true');
  });

  it('follows the coach through the whole game: a mistake explained, catches, Go Fish, a summary', async () => {
    await renderPractice();
    let turns = 0;
    let explained = false;
    let splashes = 0;
    for (let guard = 0; guard < 300 && !screen.queryByTestId('practice-summary'); guard++) {
      if (screen.getByTestId('turn-indicator').textContent?.includes('Your turn')) {
        // Coach mode: the asks you can make glow.
        expect(document.querySelectorAll('[data-highlighted]').length).toBeGreaterThan(0);
        if (!explained) {
          fireEvent.click(screen.getByTestId('gofish-ask'));
          expect(screen.getByTestId('coach-error')).toHaveTextContent(
            'Pick one of the other players at the table to ask.',
          );
          explained = true;
        }
        fireEvent.click(screen.getByTestId('coach-hint'));
        const seat = document.querySelector<HTMLElement>(
          '[data-testid^="gofish-target-"][data-suggested]',
        );
        const rank = document.querySelector<HTMLElement>(
          '[data-testid^="gofish-rank-"][data-suggested]',
        );
        expect(seat).not.toBeNull();
        expect(rank).not.toBeNull();
        fireEvent.click(seat!);
        fireEvent.click(rank!);
        expect(screen.getByTestId('gofish-ask')).toHaveAttribute('data-suggested', 'true');
        fireEvent.click(screen.getByTestId('gofish-ask'));
        turns += 1;
        await flush();
        if (screen.queryByTestId('gofish-splash')) splashes += 1;
      } else {
        await flush(BOT_DELAY_MS.normal);
      }
    }
    expect(explained).toBe(true);
    expect(turns).toBe(16);
    expect(splashes).toBe(16);
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      /You collected 5 books — the most at the table/,
    );
    expect(screen.getByTestId('gofish-books-0')).toHaveAttribute('data-count', '5');
    expect(useProgress.getState().games['go-fish']?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});
