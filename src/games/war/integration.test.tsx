// @vitest-environment jsdom
/**
 * War end to end at the component level: the generated registry → GameShell
 * (/games/war/play) and PracticeHand (/games/war/try) → the real engine and Board, on the
 * curated seeds the Playwright tests use.
 *
 * War's engine keeps the learner on move the whole game (one Flip fights a whole battle),
 * so there are no bot delays to wait for: each Flip applies at once, and only the result
 * overlay waits for RESULT_REVEAL_MS.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/war';
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
import { useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { warEngine as E, type WarState } from './engine';
import warModule from './index';
import { WAR_SEEDS } from './seeds';
import { playOut } from './test-helpers';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

const TIPS = content.tips.map(stripTipPrefix);
/** Battles each curated full-rules game lasts when the learner keeps flipping. */
const LENGTH = { quickWin: 18, quickLoss: 11, push: 60 } as const;

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function renderShell(seed: number, { strict = false }: { strict?: boolean } = {}) {
  const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
  const view = render(
    <Wrap>
      <StoreHydrator />
      <GameShell slug="war" gameName="War" tips={content.tips} seed={String(seed)} />
    </Wrap>,
  );
  await flush();
  return view;
}

/** Every wallet movement since the test started, oldest first. */
const ledger = () => [...useWallet.getState().ledger].reverse().map((e) => [e.reason, e.amount]);

async function dealFor(stake = 10) {
  fireEvent.click(screen.getByTestId(`stake-${stake}`));
  fireEvent.click(screen.getByTestId('deal-button'));
  await flush();
}

/** Press Flip `n` times, letting each battle land. */
async function flipTimes(n: number) {
  for (let i = 0; i < n; i++) {
    fireEvent.click(screen.getByTestId('war-flip'));
    await flush();
  }
}

/** The deal the shell makes for `?seed=<seed>`. */
function dealt(seed: number): WarState {
  return E.setup({ ...warModule.defaultConfig, affordableUnits: 99 }, createRng(String(seed)));
}

const secretsOf = (codes: readonly CardCode[]) => codes.map((c) => cardName(c));

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

describe('War is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('war');
    await expect(gameModuleLoaders.war?.()).resolves.toBe(warModule);
  });

  it('the curated games last as long as these tests expect', () => {
    for (const name of ['quickWin', 'quickLoss', 'push'] as const) {
      expect(playOut(dealt(WAR_SEEDS[name])).at(-1)!.battles).toBe(LENGTH[name]);
    }
  });
});

describe('/games/war/play (GameShell + the real module)', () => {
  it('offers the War bet: its chips, payout line and no difficulty picker', async () => {
    await renderShell(WAR_SEEDS.quickWin);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(warModule.betting.describe);
    expect(within(panel).queryByText('Bot difficulty')).not.toBeInTheDocument();
    expect(screen.getByText('You vs Bugle Bhaskar')).toBeInTheDocument();
  });

  it('quickWin: flip through to all 52 cards, a celebration with a title and +1 stake', async () => {
    await renderShell(WAR_SEEDS.quickWin);
    await dealFor(10);
    expect(useWallet.getState().balance).toBe(990);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
    expect(screen.getByTestId('war-counter')).toHaveTextContent('No battles yet: 60 to play');

    await flipTimes(2);
    // Battle 2 is a war, logged with the persona's name.
    expect(
      within(screen.getByTestId('move-log')).getByText(/a tie, so it's War!.*Bugle Bhaskar's/),
    ).toBeInTheDocument();
    await flush(3000);
    expect(screen.getByTestId('war-banner')).toHaveTextContent('War!');
    expect(screen.getByTestId('war-outcome')).toHaveTextContent('You win the war!');

    await flipTimes(LENGTH.quickWin - 2);
    expect(screen.getByTestId('war-board')).toHaveAttribute('data-phase', 'over');
    expect(screen.getByTestId('war-flip')).toHaveAttribute('aria-disabled', 'true');
    await flush(RESULT_REVEAL_MS);

    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+10 Jeet')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      'You won all 52 cards in 18 battles — total victory!',
    );
    expect(useWallet.getState().balance).toBe(1010);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 20],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards[0]).toMatchObject({ gameSlug: 'war', jeet: 10 });
  });

  it('quickLoss: plays the whole game from the keyboard and ends with a roast and a tip', async () => {
    await renderShell(WAR_SEEDS.quickLoss);
    await dealFor(25);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    // Space from the table, then F from anywhere.
    fireEvent.keyDown(document.activeElement ?? document.body, { key: ' ' });
    await flush();
    expect(screen.getByTestId('war-counter')).toHaveTextContent('Battle 1 of 60');
    for (let i = 1; i < LENGTH.quickLoss; i++) {
      fireEvent.keyDown(document.body, { key: 'f' });
      await flush();
    }
    await flush(RESULT_REVEAL_MS);

    const roast = screen.getByTestId('roast');
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(TIPS.some((x) => tip.includes(x))).toBe(true);
    expect(within(roast).getByTestId('rematch-button')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(975);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });

  it('push: 60 battles to a 26–26 tie gives the stake back, with no title or roast', async () => {
    await renderShell(WAR_SEEDS.push);
    await dealFor(50);
    await flipTimes(LENGTH.push);
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('push-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('push-summary')).toHaveTextContent(
      "After 60 battles you each held 26 cards — a perfect tie, so it's a push.",
    );
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('roast')).not.toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1000);
    expect(useStats.getState()).toMatchObject({ played: 1, pushes: 1, awards: [] });
  });

  it('Auto-flip plays 10 battles through the controller, one Flip at a time', async () => {
    await renderShell(WAR_SEEDS.push);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('war-auto'));
    for (let i = 0; i < 40 && screen.getByTestId('war-auto').dataset.running; i++) {
      await flush(500);
    }
    expect(screen.getByTestId('war-counter')).toHaveTextContent('Battle 10 of 60');
    expect(
      within(screen.getByTestId('move-log')).getByRole('button', { name: 'Show full log (10)' }),
    ).toBeInTheDocument();
  });

  it('never puts a face-down card in the page: not the piles, not the cards laid in a war', async () => {
    const states = playOut(dealt(WAR_SEEDS.quickWin));
    render(<LiveAnnouncer />);
    await renderShell(WAR_SEEDS.quickWin);
    await dealFor(10);
    const page = () => document.body.innerHTML;
    // Before battle 1: no card is known yet.
    for (const name of secretsOf(states[0]!.piles.flat())) expect(page()).not.toContain(name);

    await flipTimes(2);
    await flush(3000);
    const war = states[2]!.lastBattle!;
    expect(war.wars).toBe(1);
    const down = war.rounds.flatMap((r) => [...r.down[0], ...r.down[1]]);
    expect(down).toHaveLength(6);
    for (const name of secretsOf(down)) expect(page()).not.toContain(name);
    // Nor the next card of either pile.
    for (const name of secretsOf([states[2]!.piles[0][0]!, states[2]!.piles[1][0]!])) {
      expect(page()).not.toContain(name);
    }
    expect(screen.getByTestId('sr-announcer')).toHaveTextContent(/your Jack of Diamonds/);
  });

  it('leaving mid-game forfeits the stake (nothing else was set aside) and says so', async () => {
    const view = await renderShell(WAR_SEEDS.push);
    await dealFor(50);
    await flipTimes(3);
    expect(useWallet.getState().balance).toBe(950);
    view.unmount();
    expect(useWallet.getState().balance).toBe(950);
    expect(ledger()).toEqual([['bet', -50]]);
    expect(useStats.getState().played).toBe(0);
    render(<Toaster />);
    expect(screen.getByTestId('toast')).toHaveTextContent(/your 50 Jeet bet was forfeited/);
  });

  it('settles, records and logs exactly once under React StrictMode', async () => {
    await renderShell(WAR_SEEDS.quickLoss, { strict: true });
    await dealFor(10);
    await flipTimes(LENGTH.quickLoss);
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(990);
    expect(ledger()).toEqual([['bet', -10]]);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
    expect(
      within(screen.getByTestId('move-log')).getByRole('button', {
        name: `Show full log (${LENGTH.quickLoss})`,
      }),
    ).toBeInTheDocument();
  });
});

describe('/games/war/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="war" gameName="War" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro, the situation and a glowing Flip', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(warModule.practice.intro);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'The cards are dealt: you and Bugle Bhaskar have 26 cards each, face down. Flip to start battle 1 of 20',
    );
    expect(screen.getByTestId('war-flip')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('war-counter')).toHaveTextContent('No battles yet: 20 to play');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"What would a pro do?" makes Flip pulse and explains that War is pure luck', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    expect(screen.getByTestId('war-flip')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/War is pure luck/);
  });

  it('follows the coach’s pick through the UI until the game ends, then sums it up', async () => {
    await renderPractice();
    let moves = 0;
    while (!screen.queryByTestId('practice-summary') && moves < 100) {
      fireEvent.click(screen.getByTestId('coach-hint'));
      const pick = screen.getByTestId('war-flip');
      expect(pick).toHaveAttribute('data-suggested', 'true');
      fireEvent.click(pick);
      moves++;
      await flush();
      if (moves === 3) {
        // Battle 3 is a war of Aces: the coach explains it on the next turn.
        await flush(3000);
        expect(screen.getByTestId('war-banner')).toHaveTextContent('War!');
        expect(screen.getByTestId('coach-situation')).toHaveTextContent(
          "Last battle: a war! In the end your Ace beat Bugle Bhaskar's Jack",
        );
      }
    }
    expect(moves).toBe(20);
    expect(screen.queryByTestId('practice-intro')).not.toBeInTheDocument();
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      "After 20 battles you held 36 cards to Bugle Bhaskar's 16, so you win!",
    );
    expect(useProgress.getState().games.war?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});
