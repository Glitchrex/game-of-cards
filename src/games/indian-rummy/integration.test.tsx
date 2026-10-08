// @vitest-environment jsdom
/**
 * Indian Rummy end to end at the component level: the generated registry → GameShell
 * (/games/indian-rummy/play) and PracticeHand (/games/indian-rummy/try) → the real engine,
 * bots and Board, on the curated seeds, with fake timers for the bots' thinking time.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/indian-rummy';
import { roasts, titles } from '@content/titles';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { GameShell, RESULT_REVEAL_MS } from '@/components/play/GameShell';
import { PracticeHand } from '@/components/play/PracticeHand';
import { clearGameModuleCache } from '@/components/play/useGameModule';
import { dismissAllToasts } from '@/components/ui/Toast';
import { cardName, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { type GameConfig } from '@/games/core/types';
import { gameModuleLoaders, TIER1_SLUGS } from '@/games/registry.generated';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { indianRummyEngine as E, type IndianRummyMove } from './engine';
import indianRummyModule from './index';
import { INDIAN_RUMMY_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

const BOT_MS = BOT_DELAY_MS.normal;
/** Long enough for any card in flight (the opening deal included) to land. */
const SETTLE_MS = 1500;

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const ledger = () => [...useWallet.getState().ledger].reverse().map((e) => [e.reason, e.amount]);
const turn = () => screen.getByTestId('turn-indicator').getAttribute('data-turn');

/** Let the bot take its turn(s) until the learner may move again or the game ends. */
async function waitForLearner() {
  for (let i = 0; i < 12 && turn() === 'bot'; i++) await flush(BOT_MS);
  await flush(SETTLE_MS);
}

function handCard(code: CardCode): HTMLElement {
  const el = within(screen.getByTestId('rummy-hand'))
    .getAllByTestId('rummy-card')
    .find((c) => c.getAttribute('data-card') === code);
  if (!el) throw new Error(`${code} is not face up in the learner's hand`);
  return el;
}

/** Make one learner move the way a player would, through the Board. */
async function playThroughUi(move: IndianRummyMove) {
  switch (move.type) {
    case 'draw':
      fireEvent.click(
        screen.getByTestId(move.from === 'stock' ? 'rummy-stock' : 'rummy-discard-pile'),
      );
      break;
    case 'discard':
      fireEvent.click(handCard(move.card));
      fireEvent.click(screen.getByTestId('rummy-discard'));
      break;
    case 'declare':
      fireEvent.click(handCard(move.discard));
      fireEvent.click(screen.getByTestId('rummy-declare'));
      break;
    case 'drop':
      fireEvent.click(screen.getByTestId('rummy-drop'));
      fireEvent.click(screen.getByTestId('rummy-drop-confirm'));
      break;
  }
  await flush(SETTLE_MS);
}

/** The learner moves the coach recommends for `seed`, with the bot seeded like the shell's. */
function coachLine(seed: number | string, config: GameConfig): IndianRummyMove[] {
  let s = E.setup(config, createRng(seed));
  const botRng = createRng(`bot-${String(seed)}`);
  const moves: IndianRummyMove[] = [];
  while (!E.isOver(s)) {
    const p = E.currentPlayer(s)!;
    const m =
      p === 0 ? (E.coach(s, 0).suggestion as IndianRummyMove) : E.botMove(s, p, 'normal', botRng);
    if (p === 0) moves.push(m);
    s = E.applyMove(s, m);
  }
  return moves;
}

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

describe('Indian Rummy is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('indian-rummy');
    await expect(gameModuleLoaders['indian-rummy']?.()).resolves.toBe(indianRummyModule);
  });
});

describe('/games/indian-rummy/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="indian-rummy" gameName="Indian Rummy" tips={content.tips} />
      </>,
    );
    await flush(SETTLE_MS);
  }

  it('opens with the coach intro, the situation and glowing draw piles', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(
      indianRummyModule.practice.intro,
    );
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'Your turn: draw one card from the closed stock or the open pile',
    );
    expect(screen.getByTestId('rummy-step')).toHaveAttribute('data-step', 'draw');
    const glows = (id: string) => screen.getByTestId(id).querySelector('[data-highlighted]');
    expect(glows('rummy-stock')).not.toBeNull();
    expect(glows('rummy-discard-pile')).not.toBeNull();
    expect(screen.getByTestId('rummy-hand')).toHaveAttribute('data-count', '13');
    expect(screen.getByTestId('rummy-opponent-hand-1')).toHaveAttribute('data-count', '13');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"What would a pro do?" makes the open pile (a printed joker) pulse and says why', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    expect(
      screen.getByTestId('rummy-discard-pile').querySelector('[data-suggested]'),
    ).not.toBeNull();
    expect(screen.getByTestId('rummy-stock').querySelector('[data-suggested]')).toBeNull();
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/joker/i);
  });

  it('explains a mistake: you must draw before you discard, and cannot take the wild joker', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('rummy-discard'));
    expect(screen.getByTestId('coach-error')).toHaveTextContent('Draw first!');
    fireEvent.click(screen.getByTestId('rummy-wild'));
    expect(screen.getByTestId('coach-error')).toHaveTextContent('nobody can take it');
    expect(screen.getByTestId('rummy-hand')).toHaveAttribute('data-count', '13');
  });

  it('follow the coach through the Board until the declare → the summary', async () => {
    await renderPractice();
    let learnerMoves = 0;
    for (let guard = 0; guard < 40 && screen.queryByTestId('practice-summary') === null; guard++) {
      if (turn() !== 'you') {
        await waitForLearner();
        continue;
      }
      fireEvent.click(screen.getByTestId('coach-hint'));
      const pulsing = screen.getByTestId('rummy-board').querySelectorAll('[data-suggested]');
      const target = pulsing[0] as HTMLElement | undefined;
      if (!target) throw new Error('The coach suggested nothing');
      const pile = target.closest<HTMLElement>(
        '[data-testid="rummy-stock"], [data-testid="rummy-discard-pile"]',
      );
      if (pile) {
        fireEvent.click(pile);
      } else if (target.dataset.testid === 'rummy-drop') {
        fireEvent.click(target);
        fireEvent.click(screen.getByTestId('rummy-drop-confirm'));
      } else {
        // A card: select it, then press whichever action the coach now picks.
        expect(target).toHaveAttribute('data-testid', 'rummy-card');
        fireEvent.click(target);
        const action = ['rummy-declare', 'rummy-discard']
          .map((id) => screen.getByTestId(id))
          .find((el) => el.hasAttribute('data-suggested'));
        if (!action) throw new Error('No action pulses for the selected card');
        fireEvent.click(action);
      }
      learnerMoves += 1;
      await flush(SETTLE_MS);
    }
    expect(learnerMoves).toBe(10);
    expect(screen.queryByTestId('practice-intro')).not.toBeInTheDocument();
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      'You declared a valid hand after 5 turns, so Dadi Diamond paid you 71 points for their loose cards.',
    );
    expect(screen.getByTestId('rummy-outcome')).toHaveAttribute('data-outcome', 'win');
    expect(screen.getByTestId('rummy-opponent-hand-1')).toHaveAttribute('data-revealed', 'true');
    expect(useProgress.getState().games['indian-rummy']?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('plays a turn from the keyboard: O takes the open card and hands you the new card', async () => {
    await renderPractice();
    fireEvent.keyDown(document.body, { key: 'o' });
    await flush(SETTLE_MS);
    const focused = document.activeElement as HTMLElement;
    expect(focused).toHaveAttribute('data-testid', 'rummy-card');
    expect(focused).toHaveAttribute('data-card', 'X2');
    expect(screen.getByTestId('rummy-step')).toHaveAttribute('data-step', 'discard');

    // ← / → to the A♥ (the coach's throw), Enter selects it, D discards.
    fireEvent.keyDown(focused, { key: 'Home' });
    for (let i = 0; i < 14 && document.activeElement?.getAttribute('data-card') !== 'AH'; i++) {
      fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    }
    const ace = document.activeElement as HTMLElement;
    expect(ace).toHaveAttribute('data-card', 'AH');
    fireEvent.click(ace); // Enter / Space on a native button
    expect(ace).toHaveAttribute('aria-pressed', 'true');
    fireEvent.keyDown(ace, { key: 'd' });
    await flush(SETTLE_MS);
    expect(screen.getByTestId('rummy-hand')).toHaveAttribute('data-count', '13');
    expect(
      within(screen.getByTestId('move-log')).getByText('You discard the Ace of Hearts.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Dadi Diamond is thinking');
  });
});

describe('/games/indian-rummy/play (GameShell + the real module)', () => {
  async function renderShell(seed: number, { strict = false }: { strict?: boolean } = {}) {
    const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
    const view = render(
      <Wrap>
        <StoreHydrator />
        <GameShell
          slug="indian-rummy"
          gameName="Indian Rummy"
          tips={content.tips}
          seed={String(seed)}
        />
      </Wrap>,
    );
    await flush();
    return view;
  }

  async function dealFor(stake: number) {
    fireEvent.click(screen.getByTestId(`stake-${stake}`));
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush(SETTLE_MS);
  }

  it('offers the points bet: 1 / 2 / 5 Jeet per point, the payout line and both bot levels', async () => {
    await renderShell(INDIAN_RUMMY_SEEDS.quickWin);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [1, 2, 5]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(indianRummyModule.betting.describe);
    expect(within(panel).getByText('Bot difficulty')).toBeInTheDocument();
    expect(screen.getByText('You vs Dadi Diamond')).toBeInTheDocument();
  });

  it('quickWin: deal → play → declare → a celebration, and the wallet gains 14 × the stake', async () => {
    const line = coachLine(String(INDIAN_RUMMY_SEEDS.quickWin), indianRummyModule.defaultConfig);
    render(<LiveAnnouncer />);
    await renderShell(INDIAN_RUMMY_SEEDS.quickWin);
    await dealFor(2);
    // 80 points × 2 Jeet are set aside before the deal.
    expect(useWallet.getState().balance).toBe(840);

    // Nothing hidden reaches the page: Dadi's cards and the stock stay face down.
    const dealt = E.setup(
      { ...indianRummyModule.defaultConfig, affordableUnits: 0 },
      createRng(String(INDIAN_RUMMY_SEEDS.quickWin)),
    );
    const visible = new Set(
      [...dealt.hands[0]!, ...dealt.discard, dealt.wildCard].map((c) => cardName(c)),
    );
    const secrets = [...dealt.hands[1]!, ...dealt.stock.slice(-3)]
      .map((c) => cardName(c))
      .filter((name) => !visible.has(name));
    expect(secrets.length).toBeGreaterThan(5);
    for (const name of secrets) expect(document.body.innerHTML).not.toContain(name);

    for (const move of line) {
      await waitForLearner();
      await playThroughUi(move);
    }
    await flush(RESULT_REVEAL_MS);
    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+28 Jeet')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1028);
    expect(ledger()).toEqual([
      ['bet', -160],
      ['payout', 188],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
  });

  it('quickLoss: the bot declares → a roast and a tip, and the wallet pays 16 points', async () => {
    const line = coachLine(String(INDIAN_RUMMY_SEEDS.quickLoss), indianRummyModule.defaultConfig);
    await renderShell(INDIAN_RUMMY_SEEDS.quickLoss);
    await dealFor(1);
    expect(useWallet.getState().balance).toBe(920);
    for (const move of line) {
      await waitForLearner();
      await playThroughUi(move);
    }
    await waitForLearner();
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('−16 Jeet');
    expect(screen.getByTestId('rummy-opponent-hand-1')).toHaveAttribute('data-revealed', 'true');
    expect(screen.getByTestId('rummy-verdict-1')).toHaveAttribute('data-verdict', 'declared');
    expect(useWallet.getState().balance).toBe(984);
    expect(ledger()).toEqual([
      ['bet', -80],
      ['refund', 64],
    ]);
  });

  it('a first drop costs exactly 20 points, after a confirmation', async () => {
    await renderShell(INDIAN_RUMMY_SEEDS.quickWin);
    await dealFor(5);
    expect(useWallet.getState().balance).toBe(600);
    fireEvent.click(screen.getByTestId('rummy-drop'));
    expect(screen.getByRole('alertdialog')).toHaveTextContent('you pay 20 points');
    fireEvent.click(screen.getByTestId('rummy-drop-confirm'));
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(900);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });

  it('explains an illegal move in the error callout instead of applying it', async () => {
    await renderShell(INDIAN_RUMMY_SEEDS.quickWin);
    await dealFor(1);
    fireEvent.click(screen.getByTestId('rummy-declare'));
    expect(screen.getByTestId('move-error')).toHaveTextContent('Draw a card first.');
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
  });

  it('settles and records exactly once under React StrictMode', async () => {
    const line = coachLine(String(INDIAN_RUMMY_SEEDS.quickLoss), indianRummyModule.defaultConfig);
    await renderShell(INDIAN_RUMMY_SEEDS.quickLoss, { strict: true });
    await dealFor(1);
    for (const move of line) {
      await waitForLearner();
      await playThroughUi(move);
    }
    await waitForLearner();
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(984);
    expect(ledger()).toHaveLength(2);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });
});
