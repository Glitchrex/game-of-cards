// @vitest-environment jsdom
/**
 * Texas Hold'em end to end at the component level: the generated registry → GameShell
 * (/games/texas-holdem/play) and PracticeHand (/games/texas-holdem/try) → the real engine,
 * bots and Board, on the curated seeds (src/games/texas-holdem/seeds.ts).
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/texas-holdem';
import { roasts, titles } from '@content/titles';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { GameShell, RESULT_REVEAL_MS } from '@/components/play/GameShell';
import { PracticeHand } from '@/components/play/PracticeHand';
import { clearGameModuleCache } from '@/components/play/useGameModule';
import { dismissAllToasts } from '@/components/ui/Toast';
import { cardName } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { gameModuleLoaders, TIER1_SLUGS } from '@/games/registry.generated';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { texasHoldemEngine } from './engine';
import holdemModule from './index';
import { TEXASHOLDEM_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

const NAME = 'Texas Hold’em Poker';
const BOT_MS = BOT_DELAY_MS.normal;

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const turn = () => screen.queryByTestId('turn-indicator')?.getAttribute('data-turn') ?? null;

/** Let the bots play (one thinking delay per move) until it is the learner's turn or the end. */
async function untilLearnerOrOver(maxBotMoves = 12) {
  for (let i = 0; i < maxBotMoves; i++) {
    const now = turn();
    if (now === 'you' || now === 'over') return now;
    await flush(BOT_MS);
  }
  throw new Error(`the learner never got a turn (turn: ${String(turn())})`);
}

async function renderShell(seed: number, { strict = false }: { strict?: boolean } = {}) {
  const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
  const view = render(
    <Wrap>
      <StoreHydrator />
      <GameShell slug="texas-holdem" gameName={NAME} tips={content.tips} seed={String(seed)} />
    </Wrap>,
  );
  await flush();
  return view;
}

async function dealFor(stake: number) {
  fireEvent.click(screen.getByTestId(`stake-${stake}`));
  fireEvent.click(screen.getByTestId('deal-button'));
  await flush();
}

/** Pick the quick size worth `amount` chips and confirm the bet / raise. */
function raiseTo(amount: number) {
  const quick = screen
    .getAllByRole('button', { pressed: false })
    .concat(screen.getAllByRole('button', { pressed: true }))
    .find((b) => b.getAttribute('data-amount') === String(amount));
  if (quick) fireEvent.click(quick);
  else fireEvent.change(screen.getByTestId('holdem-amount'), { target: { value: String(amount) } });
  fireEvent.click(screen.getByTestId('holdem-raise'));
}

/** Every wallet movement since the test started, oldest first. */
const ledger = () => [...useWallet.getState().ledger].reverse().map((e) => [e.reason, e.amount]);

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Texas Hold’em is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('texas-holdem');
    await expect(gameModuleLoaders['texas-holdem']?.()).resolves.toBe(holdemModule);
  });

  it('speaks persona names in the result summary (the rules are the engine’s own)', () => {
    const { legalMoves, applyMove, setup } = holdemModule.engine;
    expect(legalMoves).toBe(texasHoldemEngine.legalMoves);
    expect(applyMove).toBe(texasHoldemEngine.applyMove);
    expect(setup).toBe(texasHoldemEngine.setup);
    let s = setup({ players: 4 }, createRng(TEXASHOLDEM_SEEDS.showdownLoss));
    const bots = createRng(`bot-${TEXASHOLDEM_SEEDS.showdownLoss}`);
    while (!holdemModule.engine.isOver(s)) {
      const p = holdemModule.engine.currentPlayer(s) ?? 0;
      const move =
        p === 0
          ? (holdemModule.engine.coach(s, 0).suggestion as Parameters<typeof applyMove>[1])
          : holdemModule.engine.botMove(s, p, 'normal', bots);
      s = applyMove(s, move);
    }
    expect(holdemModule.engine.result(s).summary).toBe(
      "At the showdown Lakshmi Ledger's Pair of Kings beat your Pair of Queens, so Lakshmi Ledger won the 207-chip pot.",
    );
    expect(texasHoldemEngine.result(s).summary).toContain("Player 2's Pair of Kings");
  });
});

describe('/games/texas-holdem/play (GameShell + the real module)', () => {
  it('offers the Hold’em bet: 1 / 2 / 5 Jeet per chip, the buy-in line and a bot level', async () => {
    await renderShell(TEXASHOLDEM_SEEDS.practice);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [1, 2, 5]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(holdemModule.betting.describe);
    expect(within(panel).getByText('Bot difficulty')).toBeInTheDocument();
    expect(
      screen.getByText('You vs Maestro Moti, Lakshmi Ledger and Bunty Popcorn'),
    ).toBeInTheDocument();
  });

  it('quickWin: raise, everyone folds — a celebration and +2 chips × 5 Jeet', async () => {
    render(<LiveAnnouncer />);
    await renderShell(TEXASHOLDEM_SEEDS.quickWin);
    await dealFor(5);
    // 100 chips × 5 Jeet are set aside for the buy-in.
    expect(useWallet.getState().balance).toBe(500);
    expect(screen.getByTestId('holdem-table')).toBeInTheDocument();
    expect(await untilLearnerOrOver()).toBe('you');
    // Lakshmi and Bunty folded; it is the learner's turn in the small blind.
    expect(screen.getByTestId('holdem-seat-2')).toHaveAttribute('data-folded', 'true');
    expect(screen.getByTestId('holdem-seat-3')).toHaveAttribute('data-folded', 'true');
    expect(within(screen.getByTestId('move-log')).getByText('Lakshmi Ledger folds.')).toBeTruthy();

    raiseTo(6);
    await flush();
    expect(screen.getByTestId('holdem-bet-0')).toHaveAttribute('data-bet', '6');
    expect(await untilLearnerOrOver()).toBe('over');
    await flush(RESULT_REVEAL_MS);

    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+10 Jeet')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      'Everyone else folded, so you won the 4-chip pot without showing your cards.',
    );
    expect(useWallet.getState().balance).toBe(1010);
    expect(ledger()).toEqual([
      ['bet', -500],
      ['payout', 510],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    // Nobody had to show: Maestro Moti's cards never reached the page.
    const dealt = holdemModule.engine.setup(
      { ...holdemModule.defaultConfig, affordableUnits: 100 },
      createRng(String(TEXASHOLDEM_SEEDS.quickWin)),
    );
    for (const code of dealt.hands.slice(1).flat()) {
      expect(document.body.innerHTML).not.toContain(cardName(code));
    }
  });

  it('showdownLoss: Queens call an all-in and lose to Kings — a roast and the full buy-in lost', async () => {
    await renderShell(TEXASHOLDEM_SEEDS.showdownLoss);
    await dealFor(1);
    expect(useWallet.getState().balance).toBe(900);
    const dealt = holdemModule.engine.setup(
      { ...holdemModule.defaultConfig, affordableUnits: 900 },
      createRng(String(TEXASHOLDEM_SEEDS.showdownLoss)),
    );
    const kings = dealt.hands[2] ?? [];
    expect(kings).toEqual(['KS', 'KH']);

    expect(await untilLearnerOrOver()).toBe('you');
    // Lakshmi's Kings stay hidden while the hand is live.
    for (const code of kings) expect(document.body.innerHTML).not.toContain(cardName(code));
    raiseTo(17);
    await flush();
    expect(await untilLearnerOrOver()).toBe('you');
    expect(screen.getByTestId('holdem-seat-2')).toHaveAttribute('data-all-in', 'true');
    expect(screen.getByTestId('holdem-call')).toHaveTextContent('Call 83');
    fireEvent.click(screen.getByTestId('holdem-call'));
    await flush();
    // The rest of the board is dealt at once and the hands are turned over.
    expect(screen.getByTestId('holdem-community')).toHaveAttribute('data-count', '5');
    await flush(1500);
    expect(screen.getByTestId('holdem-hole-2')).toHaveAttribute('data-revealed', 'true');
    expect(screen.getByTestId('holdem-hand-name-2')).toHaveTextContent('Pair of Kings');
    expect(screen.getByTestId('holdem-winner-2')).toBeInTheDocument();
    await flush(RESULT_REVEAL_MS);

    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('−100 Jeet');
    expect(screen.getByTestId('roast-summary')).toHaveTextContent(
      "Lakshmi Ledger's Pair of Kings beat your Pair of Queens",
    );
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(tip.length).toBeGreaterThan(10);
    expect(useWallet.getState().balance).toBe(900);
    expect(ledger()).toEqual([['bet', -100]]);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });

  it('splitPot: Aces against Aces — a push, and every chip of the buy-in comes back', async () => {
    await renderShell(TEXASHOLDEM_SEEDS.splitPot);
    await dealFor(2);
    expect(useWallet.getState().balance).toBe(800);
    expect(await untilLearnerOrOver()).toBe('you');
    raiseTo(18);
    await flush();
    expect(await untilLearnerOrOver()).toBe('you');
    fireEvent.click(screen.getByTestId('holdem-call'));
    await flush(RESULT_REVEAL_MS + 1500);
    expect(screen.getByTestId('push-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('push-summary')).toHaveTextContent('you split the 200-chip pot');
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1000);
    expect(useStats.getState()).toMatchObject({ played: 1, pushes: 1 });
  });

  it('explains an illegal move instead of applying it', async () => {
    await renderShell(TEXASHOLDEM_SEEDS.showdownLoss);
    await dealFor(1);
    await untilLearnerOrOver();
    // Bunty Popcorn raised to 6, so checking is not allowed.
    fireEvent.click(screen.getByTestId('holdem-check'));
    expect(screen.getByTestId('move-error')).toHaveTextContent(
      "You can't check — Bunty Popcorn raised, so the bet to match is 6 chips.",
    );
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
    // The slider cannot go below the smallest legal raise (to 10: 6 + the 4-chip raise).
    fireEvent.change(screen.getByTestId('holdem-amount'), { target: { value: '7' } });
    expect(screen.getByTestId('holdem-raise')).toHaveTextContent('Raise to 10');
    // Folding is always allowed; afterwards the learner's presses are ignored while the bots
    // play the hand out.
    fireEvent.click(screen.getByTestId('holdem-fold'));
    await flush();
    expect(screen.getByTestId('holdem-seat-0')).toHaveAttribute('data-folded', 'true');
    fireEvent.keyDown(document.body, { key: 'c' });
    expect(screen.getByTestId('holdem-call')).toHaveAccessibleDescription(
      /You’ve folded — watch how the hand ends\./,
    );
  });

  it('plays a whole hand from the keyboard and settles once under StrictMode', async () => {
    await renderShell(TEXASHOLDEM_SEEDS.showdownWin, { strict: true });
    await dealFor(1);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    expect(await untilLearnerOrOver()).toBe('you');
    // Size the raise with the slider (keyboard users arrow it), then R confirms.
    const slider = screen.getByTestId('holdem-amount');
    slider.focus();
    fireEvent.change(slider, { target: { value: '16' } });
    fireEvent.keyDown(slider, { key: 'r' });
    await flush();
    expect(await untilLearnerOrOver()).toBe('you');
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'c' });
    await flush(RESULT_REVEAL_MS + 1500);

    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      'Full House, Queens full of Sixes',
    );
    expect(useWallet.getState().balance).toBe(1108);
    expect(ledger()).toEqual([
      ['bet', -100],
      ['payout', 208],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
  });
});

describe('/games/texas-holdem/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="texas-holdem" gameName={NAME} tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the intro, then lights up the learner’s options when it is their turn', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(holdemModule.practice.intro);
    expect(await untilLearnerOrOver()).toBe('you');
    expect(screen.getByTestId('coach-situation')).toHaveTextContent('You hold A♠ K♠');
    for (const id of ['holdem-fold', 'holdem-call', 'holdem-raise', 'holdem-allin']) {
      expect(screen.getByTestId(id)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.getByTestId('holdem-check')).not.toHaveAttribute('data-highlighted');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('follows the coach through the UI — hint, then the pulsing move — to the summary', async () => {
    await renderPractice();
    const taken: string[] = [];
    for (let decision = 0; decision < 8; decision++) {
      if ((await untilLearnerOrOver()) === 'over') break;
      fireEvent.click(screen.getByTestId('coach-hint'));
      expect(screen.getByTestId('coach-hint-text').textContent?.length).toBeGreaterThan(10);
      const action = ['fold', 'check', 'call', 'raise', 'allin']
        .map((id) => screen.getByTestId(`holdem-${id}`))
        .find((el) => el.hasAttribute('data-suggested'));
      if (!action) throw new Error('the coach’s pick did not pulse');
      taken.push(action.textContent ?? '');
      // The shortcut key on the pulsing button plays it.
      fireEvent.keyDown(document.body, { key: action.getAttribute('aria-keyshortcuts') ?? '' });
      await flush();
    }
    expect(taken.map((s) => s.replace(/[A-Z]$/, ''))).toEqual([
      expect.stringContaining('Raise to 6'),
      expect.stringContaining('Bet 9'),
      expect.stringContaining('Bet 23'),
      expect.stringContaining('All-in 62'),
    ]);
    await flush(1500);
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      "At the showdown your Flush, Ace high beat Maestro Moti's Two Pair, Kings and Eights, and you won the 200-chip pot.",
    );
    expect(screen.getByTestId('holdem-hand-name-1')).toHaveTextContent(
      'Two Pair, Kings and Eights',
    );
    expect(screen.getByTestId('holdem-winner-0')).toBeInTheDocument();
    expect(useProgress.getState().games['texas-holdem']?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('explains a mistake in the coach panel', async () => {
    await renderPractice();
    await untilLearnerOrOver();
    fireEvent.click(screen.getByTestId('holdem-check'));
    expect(screen.getByTestId('coach-error')).toHaveTextContent(
      "You can't check — the big blind is 2 chips, so staying in costs 1 chip more.",
    );
  });
});
