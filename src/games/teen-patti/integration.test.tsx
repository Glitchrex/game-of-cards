// @vitest-environment jsdom
/**
 * Teen Patti end to end at the component level: the generated registry → GameShell
 * (/games/teen-patti/play) and PracticeHand (/games/teen-patti/try) → the real engine and
 * Board, on the curated seeds the Playwright tests use.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/teen-patti';
import { roasts, titles } from '@content/titles';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { GameShell, RESULT_REVEAL_MS } from '@/components/play/GameShell';
import { PracticeHand } from '@/components/play/PracticeHand';
import { stripTipPrefix } from '@/components/play/personas';
import { clearGameModuleCache } from '@/components/play/useGameModule';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { cardName } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { gameModuleLoaders, TIER1_SLUGS } from '@/games/registry.generated';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { type TeenPattiMoveType } from './engine';
import teenPattiModule from './index';
import { TEENPATTI_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

/** Teen Patti bots always have a choice, so every bot move takes the full thinking delay. */
const BOT_MS = BOT_DELAY_MS.normal;
const TIPS = content.tips.map(stripTipPrefix);

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
      <GameShell slug="teen-patti" gameName="Teen Patti" tips={content.tips} seed={String(seed)} />
    </Wrap>,
  );
  await flush();
  return view;
}

/** Every wallet movement since the test started, oldest first. */
const ledger = () => [...useWallet.getState().ledger].reverse().map((e) => [e.reason, e.amount]);

async function dealFor(stake = 5) {
  fireEvent.click(screen.getByTestId(`stake-${stake}`));
  fireEvent.click(screen.getByTestId('deal-button'));
  await flush();
}

const yourTurn = () => screen.queryByTestId('turn-indicator')?.dataset.turn === 'you';

/**
 * Play the hand out: on the learner's turn press the next of `moves` (by button, or by its
 * shortcut key with `keys`), otherwise let the bot think. Then open the result overlay.
 */
async function playHand(moves: TeenPattiMoveType[], { keys = false } = {}) {
  const queue = [...moves];
  for (let guard = 0; guard < 60 && !teenPattiOver(); guard++) {
    if (yourTurn()) {
      const type = queue.shift();
      if (!type) throw new Error('The learner has no more moves planned');
      if (keys) {
        const key = { see: 's', chaal: 'c', raise: 'r', show: 'w', pack: 'p' }[type];
        fireEvent.keyDown(document.activeElement ?? document.body, { key });
      } else {
        fireEvent.click(screen.getByTestId(`tp-${type}`));
      }
      await flush();
    } else {
      await flush(BOT_MS);
    }
  }
  expect(queue).toEqual([]);
  await flush(RESULT_REVEAL_MS);
}

const teenPattiOver = () => screen.queryByTestId('tp-board')?.dataset.over === 'true';

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

describe('Teen Patti is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('teen-patti');
    await expect(gameModuleLoaders['teen-patti']?.()).resolves.toBe(teenPattiModule);
  });
});

describe('/games/teen-patti/play (GameShell + the real module)', () => {
  it('offers the Teen Patti bet: boots of 5/10/20, the 64-boot escrow and both difficulties', async () => {
    await renderShell(TEENPATTI_SEEDS.blindWin);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [5, 10]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeEnabled();
    }
    // 20 Jeet a boot needs 1,280 Jeet set aside — more than a fresh wallet holds.
    expect(within(panel).getByTestId('stake-20')).toBeDisabled();
    expect(panel).toHaveTextContent(teenPattiModule.betting.describe);
    expect(within(panel).getByText('Bot difficulty')).toBeInTheDocument();
    expect(screen.getByText('You vs Chacha Chaalbaaz and Bindiya Bioscope')).toBeInTheDocument();
  });

  it('blindWin: one blind chaal wins the show — celebrated, titled and paid', async () => {
    render(<LiveAnnouncer />);
    await renderShell(TEENPATTI_SEEDS.blindWin);
    await dealFor(5);
    expect(useWallet.getState().balance).toBe(1000 - 5 * 64);
    expect(screen.getByTestId('tp-pot')).toHaveAttribute('data-pot', '3');

    await playHand(['chaal']);
    expect(screen.getByTestId('tp-outcome')).toHaveAttribute('data-kind', 'show');
    expect(screen.getByTestId('tp-winner-0')).toHaveAttribute('data-boots', '8');
    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+30 Jeet')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      'Bindiya Bioscope asked for a show',
    );
    expect(useWallet.getState().balance).toBe(1030);
    expect(ledger()).toEqual([
      ['bet', -320],
      ['payout', 350],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(
      within(screen.getByTestId('move-log')).getByText(/Bindiya Bioscope asks for a show/),
    ).toBeInTheDocument();
  });

  it('quickLoss: a lost show is roasted with a Teen Patti tip and costs only the boots put in', async () => {
    await renderShell(TEENPATTI_SEEDS.quickLoss);
    await dealFor(10);
    await playHand(['chaal']);
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(TIPS.some((t) => tip.includes(t))).toBe(true);
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('−20 Jeet');
    expect(useWallet.getState().balance).toBe(980);
    expect(ledger()).toEqual([
      ['bet', -640],
      ['refund', 620],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });

  it('potLimit: plays a whole hand from the keyboard into the 64-boot pot limit', async () => {
    await renderShell(TEENPATTI_SEEDS.potLimit);
    await dealFor(5);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    await playHand(['chaal', 'see', 'raise', 'raise', 'chaal'], { keys: true });
    expect(screen.getByTestId('tp-pot')).toHaveAttribute('data-pot', '64');
    expect(screen.getByTestId('tp-outcome')).toHaveAttribute('data-kind', 'pot-limit');
    expect(screen.getByTestId('tp-hand-name-1')).toHaveTextContent('Sequence');
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    // −36 boots at 5 Jeet a boot: the escrow covered it, and the rest is refunded.
    expect(useWallet.getState().balance).toBe(1000 - 180);
    expect(ledger()).toEqual([
      ['bet', -320],
      ['refund', 140],
    ]);
  });

  it('everyonePacks: last player standing wins without anyone showing', async () => {
    await renderShell(TEENPATTI_SEEDS.everyonePacks);
    await dealFor(10);
    await playHand(['chaal']);
    expect(screen.getByTestId('tp-outcome')).toHaveAttribute('data-kind', 'last-standing');
    expect(screen.getByTestId('tp-status-1')).toHaveAttribute('data-status', 'packed');
    expect(screen.getByTestId('tp-status-2')).toHaveAttribute('data-status', 'packed');
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1040);
  });

  it('never puts a hidden card in the page: bots’ cards only at the show, packed ones never', async () => {
    const dealt = teenPattiModule.engine.setup(
      teenPattiModule.defaultConfig,
      createRng(String(TEENPATTI_SEEDS.blindWin)),
    );
    const names = (seat: number) => dealt.hands[seat]!.map(cardName);
    const page = () => document.body.innerHTML;
    await renderShell(TEENPATTI_SEEDS.blindWin);
    await dealFor(5);
    for (const seat of [0, 1, 2]) for (const n of names(seat)) expect(page()).not.toContain(n);

    await playHand(['chaal']);
    // Seat 1 packed (never shown); the learner and seat 2 went to the show.
    for (const n of names(1)) expect(page()).not.toContain(n);
    for (const n of [...names(0), ...names(2)]) expect(page()).toContain(n);
  });

  it('explains an unavailable action instead of applying it', async () => {
    await renderShell(TEENPATTI_SEEDS.potLimit);
    await dealFor(5);
    expect(yourTurn()).toBe(true);
    fireEvent.click(screen.getByTestId('tp-show'));
    expect(screen.getByTestId('move-error')).toHaveTextContent(
      'You can only ask for a show when just two players are left',
    );
    expect(screen.getByTestId('tp-pot')).toHaveAttribute('data-pot', '3');
    expect(yourTurn()).toBe(true);
  });

  it('leaving mid-hand forfeits the whole escrow (docs/DECISIONS.md D-20: a pot game)', async () => {
    const view = await renderShell(TEENPATTI_SEEDS.potLimit);
    await dealFor(10);
    expect(useWallet.getState().balance).toBe(360);
    view.unmount();
    // Walking away counts as packing everything set aside: nothing comes back.
    expect(useWallet.getState().balance).toBe(360);
    expect(ledger()).toEqual([['bet', -640]]);
    expect(useStats.getState().played).toBe(0);
    render(<Toaster />);
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'You left in the middle of a hand, so everything you set aside (640 Jeet) was forfeited',
    );
  });

  it('settles, records and logs exactly once under React StrictMode', async () => {
    await renderShell(TEENPATTI_SEEDS.blindWin, { strict: true });
    await dealFor(5);
    await playHand(['chaal']);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1030);
    expect(ledger()).toEqual([
      ['bet', -320],
      ['payout', 350],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
    // chaal, chaal, chaal, see, pack, see, show — each logged once.
    expect(
      within(screen.getByTestId('move-log')).getByRole('button', { name: 'Show full log (7)' }),
    ).toBeInTheDocument();
  });
});

describe('/games/teen-patti/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="teen-patti" gameName="Teen Patti" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro while Bindiya plays, then glows the learner’s options', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(teenPattiModule.practice.intro);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Bindiya Bioscope is thinking');
    expect(screen.getByTestId('tp-persona-2')).toHaveAttribute('data-thinking', 'true');
    await flush(BOT_MS);
    expect(yourTurn()).toBe(true);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      "You're playing blind — you haven't looked at your cards yet.",
    );
    for (const id of ['tp-see', 'tp-chaal', 'tp-raise', 'tp-pack']) {
      expect(screen.getByTestId(id)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.getByTestId('tp-show')).not.toHaveAttribute('data-highlighted');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('explains a mistake, then follows the coach’s picks to the end of the hand', async () => {
    await renderPractice();
    await flush(BOT_MS);
    fireEvent.click(screen.getByTestId('tp-show'));
    expect(screen.getByTestId('coach-error')).toHaveTextContent(
      'You can only ask for a show when just two players are left',
    );

    const picks: string[] = [];
    for (let guard = 0; guard < 40 && !screen.queryByTestId('practice-summary'); guard++) {
      if (yourTurn()) {
        fireEvent.click(screen.getByTestId('coach-hint'));
        const suggested = document.querySelectorAll<HTMLElement>('[data-suggested="true"]');
        expect(suggested).toHaveLength(1);
        expect(screen.getByTestId('coach-hint-text')).not.toBeEmptyDOMElement();
        const pick = suggested[0]!;
        picks.push(pick.dataset.tpAction ?? '');
        fireEvent.click(pick);
        await flush();
      } else {
        await flush(BOT_MS);
      }
    }
    expect(picks).toEqual(['chaal', 'see', 'raise']);
    expect(screen.queryByTestId('practice-intro')).not.toBeInTheDocument();
    expect(screen.getByTestId('tp-hand-name-0')).toHaveTextContent('Pair of Kings');
    expect(screen.getByTestId('tp-hand-name-2')).toHaveTextContent('Pair of Fours');
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      "Bindiya Bioscope asked for a show: your Pair of Kings beat Bindiya Bioscope's Pair of Fours, so you won the 27-boot pot.",
    );
    expect(useProgress.getState().games['teen-patti']?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"Try another practice hand" deals a fresh hand', async () => {
    await renderPractice();
    for (let guard = 0; guard < 40 && !screen.queryByTestId('practice-summary'); guard++) {
      if (yourTurn()) {
        fireEvent.click(screen.getByTestId('coach-hint'));
        fireEvent.click(document.querySelector<HTMLElement>('[data-suggested="true"]')!);
        await flush();
      } else {
        await flush(BOT_MS);
      }
    }
    fireEvent.click(screen.getByTestId('practice-again'));
    await flush();
    expect(screen.queryByTestId('practice-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('tp-pot')).toHaveAttribute('data-pot', '3');
    expect(screen.getByTestId('tp-board')).not.toHaveAttribute('data-over');
  });
});
