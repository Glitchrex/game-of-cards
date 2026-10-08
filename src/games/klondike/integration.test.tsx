// @vitest-environment jsdom
/**
 * Klondike end to end at the component level: the generated registry → GameShell
 * (/games/klondike/play) and PracticeHand (/games/klondike/try) → the real engine and Board,
 * on the curated seeds. The learner follows the coach through the UI — pointer taps in one
 * game, the keyboard only in another — until the game ends.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/klondike';
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
import { useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import klondikeModule from './index';
import { KLONDIKE_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

/** Longer than the Board's double-tap window, so two taps on one card stay two taps. */
const BETWEEN_TAPS_MS = 400;

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

const ledger = () => [...useWallet.getState().ledger].reverse().map((e) => [e.reason, e.amount]);

async function renderShell(seed: number, { strict = false }: { strict?: boolean } = {}) {
  const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
  const view = render(
    <Wrap>
      <StoreHydrator />
      <LiveAnnouncer />
      <GameShell
        slug="klondike"
        gameName="Klondike Solitaire"
        tips={content.tips}
        seed={String(seed)}
      />
    </Wrap>,
  );
  await flush();
  return view;
}

async function renderPractice() {
  render(
    <>
      <StoreHydrator />
      <PracticeHand slug="klondike" gameName="Klondike Solitaire" tips={content.tips} />
    </>,
  );
  await flush();
}

async function dealFor(stake = 10) {
  fireEvent.click(screen.getByTestId(`stake-${stake}`));
  fireEvent.click(screen.getByTestId('deal-button'));
  await flush();
}

/* ---------------------------------------------------------------- driver */

type Kind = 'draw' | 'resign' | 'move';

interface Pick {
  kind: Kind;
  /** The pile the suggested card (or run) is in. */
  from?: HTMLElement;
  /** The card at the base of the suggested run. */
  card?: HTMLElement;
  /** How many cards above the base are picked up with it. */
  above?: number;
  to?: HTMLElement;
}

/** Reads the coach's pick off the table: the pulsing button, card and destination pile. */
function readPick(): Pick {
  if (screen.getByTestId('klondike-draw').hasAttribute('data-suggested')) return { kind: 'draw' };
  if (screen.getByTestId('klondike-resign').hasAttribute('data-suggested')) {
    return { kind: 'resign' };
  }
  const board = screen.getByTestId('klondike-board');
  const cards = [...board.querySelectorAll<HTMLElement>('[data-testid^="klondike-card-"]')];
  const base = cards.find((el) => el.querySelector(':scope > span > [data-suggested]'));
  const to = board.querySelector<HTMLElement>('[data-pile][data-suggested]');
  if (!base || !to) throw new Error('No coach pick is showing on the table');
  const from = base.closest<HTMLElement>('[data-pile]')!;
  const inPile = [...from.querySelectorAll('[data-testid^="klondike-card-"]')];
  return { kind: 'move', from, card: base, to, above: inPile.length - 1 - inPile.indexOf(base) };
}

/** Ask the coach, then make its move by tapping (pointer) — the suggestion must be shown. */
async function followByTapping() {
  fireEvent.click(screen.getByTestId('coach-hint'));
  const pick = readPick();
  if (pick.kind === 'draw') fireEvent.click(screen.getByTestId('klondike-stock'));
  else if (pick.kind === 'resign') {
    fireEvent.click(screen.getByTestId('klondike-resign'));
    fireEvent.click(screen.getByTestId('klondike-resign-confirm'));
  } else {
    fireEvent.click(pick.card!);
    await flush(BETWEEN_TAPS_MS);
    fireEvent.click(pick.to!);
  }
  await flush(BETWEEN_TAPS_MS);
  return pick.kind;
}

/** A key press on whatever has focus. */
function press(key: string) {
  const el = document.activeElement ?? document.body;
  fireEvent.keyDown(el, { key });
  fireEvent.keyUp(el, { key });
}

/**
 * Enter on the focused button. A browser turns Enter on a focused <button> into a click;
 * jsdom does not, so the click is dispatched here, on the focused element only.
 */
function pressEnter() {
  const el = document.activeElement;
  if (!(el instanceof HTMLButtonElement)) throw new Error('Enter needs a focused button');
  press('Enter');
  fireEvent.click(el);
}

/** Ask the coach, then make its move with the keyboard only (Tab-reachable buttons). */
async function followByKeyboard() {
  screen.getByTestId('coach-hint').focus();
  pressEnter();
  const pick = readPick();
  if (pick.kind === 'draw') {
    press('d');
  } else if (pick.kind === 'resign') {
    screen.getByTestId('klondike-resign').focus();
    pressEnter();
    screen.getByTestId('klondike-resign-confirm').focus();
    pressEnter();
  } else {
    pick.from!.focus();
    pressEnter();
    for (let i = 0; i < pick.above!; i++) press('ArrowUp');
    pick.to!.focus();
    pressEnter();
  }
  await flush();
  return pick.kind;
}

/* ----------------------------------------------------------------- setup */

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true;
});

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
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

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('Klondike is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('klondike');
    await expect(gameModuleLoaders.klondike?.()).resolves.toBe(klondikeModule);
  });
});

/* --------------------------------------------------------------- practice */

describe('/games/klondike/try (PracticeHand + the real module)', () => {
  it('opens with the coach intro, the situation and glowing cards that can move', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(klondikeModule.practice.intro);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      '0 cards of 52 are home on the foundations, and 21 face-down cards are still hidden in the columns.',
    );
    // The three Aces can go home: they glow; so does the stock.
    for (const ace of ['AC', 'AS', 'AD']) {
      expect(
        screen.getByTestId(`klondike-card-${ace}`).querySelector('[data-highlighted]'),
      ).not.toBeNull();
    }
    expect(screen.getByTestId('klondike-stock')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('klondike-readout')).toHaveAttribute('data-home', '0');
  });

  it('"What would a pro do?" pulses a card and its foundation and explains why', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    const pick = readPick();
    expect(pick.kind).toBe('move');
    expect(pick.card).toHaveAttribute('data-testid', 'klondike-card-AD');
    expect(pick.to).toHaveAttribute('data-testid', 'klondike-foundation-D');
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/Ace/);
  });

  it('explains a mistake, then — following the coach by tapping — clears the board', async () => {
    await renderPractice();
    // A mistake first: the Six of Spades can't go on the Ten of Clubs.
    fireEvent.click(screen.getByTestId('klondike-card-6S'));
    fireEvent.click(screen.getByTestId('klondike-col-1'));
    expect(screen.getByTestId('coach-error')).toHaveTextContent(/must go on a red 7/);
    await flush(BETWEEN_TAPS_MS);
    fireEvent.keyDown(document.body, { key: 'Escape' });

    const kinds: string[] = [];
    while (screen.getByTestId('practice-hand').dataset.state !== 'over') {
      kinds.push(await followByTapping());
      if (kinds.length > 200) throw new Error('The practice game did not end');
    }
    expect(kinds).toHaveLength(118);
    expect(kinds).toContain('draw');
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      'You moved all 52 cards to the foundations',
    );
    expect(screen.getByTestId('klondike-readout')).toHaveAttribute('data-home', '52');
    expect(useProgress.getState().games.klondike?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});

/* -------------------------------------------------------------- play mode */

describe('/games/klondike/play (GameShell + the real module)', () => {
  it('offers the Klondike bet: chips, the Vegas payout line, no picker, just you and the deck', async () => {
    await renderShell(KLONDIKE_SEEDS.quickLoss);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(klondikeModule.betting.describe);
    expect(within(panel).queryByText('Bot difficulty')).not.toBeInTheDocument();
    expect(screen.getByText('Just you and the deck')).toBeInTheDocument();
  });

  it('never puts the stock or the face-down column cards in the page', async () => {
    const dealt = klondikeModule.engine.setup(
      { ...klondikeModule.defaultConfig, affordableUnits: 99 },
      createRng(String(KLONDIKE_SEEDS.quickLoss)),
    );
    await renderShell(KLONDIKE_SEEDS.quickLoss);
    await dealFor(10);
    const secrets = [...dealt.stock, ...dealt.tableau.flatMap((p) => p.faceDown)].filter(
      (c) => !c.startsWith('A'), // Aces are named by the empty foundations' labels
    );
    for (const code of secrets) expect(document.body.innerHTML).not.toContain(cardName(code));
    expect(screen.getByTestId('sr-announcer')).toHaveTextContent('Bet placed: 10 Jeet.');
  });

  it('explains an illegal move in the error callout instead of applying it', async () => {
    await renderShell(KLONDIKE_SEEDS.quickLoss);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('klondike-col-0'));
    fireEvent.click(screen.getByTestId('klondike-foundation-S'));
    expect(screen.getByTestId('move-error')).toBeInTheDocument();
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
    expect(screen.getByTestId('klondike-readout')).toHaveAttribute('data-home', '0');
  });

  it('"I’m done" straight away: the stake is lost and a roast with a Klondike tip opens', async () => {
    await renderShell(KLONDIKE_SEEDS.quickLoss);
    await dealFor(25);
    expect(useWallet.getState().balance).toBe(975);
    fireEvent.click(screen.getByTestId('klondike-resign'));
    fireEvent.click(screen.getByTestId('klondike-resign-confirm'));
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('−25 Jeet');
    expect(useWallet.getState().balance).toBe(975);
    expect(ledger()).toEqual([['bet', -25]]);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });

  it('partialWin, keyboard only: the coach banks 13 cards, a title, +25 on a 100 stake', async () => {
    await renderShell(KLONDIKE_SEEDS.partialWin);
    await dealFor(100);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    screen.getByTestId('coach-toggle').focus();
    pressEnter();

    const kinds: string[] = [];
    while (screen.queryByTestId('celebration') === null && screen.queryByTestId('roast') === null) {
      if (screen.queryByTestId('coach-hint') === null) {
        // The game has ended: the result overlay opens after the reveal pause.
        await flush(RESULT_REVEAL_MS);
        continue;
      }
      kinds.push(await followByKeyboard());
      if (kinds.length > 100) throw new Error('The game did not end');
    }
    expect(kinds).toHaveLength(47);
    expect(kinds.at(-1)).toBe('resign');
    expect(screen.getByTestId('klondike-readout')).toHaveAttribute('data-home', '13');
    const title = screen.getByTestId('win-title').textContent ?? '';
    expect(titles.map((x) => x.text)).toContain(title);
    expect(within(screen.getByTestId('celebration')).getByText('+25 Jeet')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1025);
    expect(ledger()).toEqual([
      ['bet', -100],
      ['payout', 125],
    ]);
  });

  it('settles and records exactly once under React StrictMode', async () => {
    await renderShell(KLONDIKE_SEEDS.breakEven, { strict: true });
    await dealFor(50);
    fireEvent.click(screen.getByTestId('coach-toggle'));
    let n = 0;
    while (screen.queryByTestId('coach-hint') !== null) {
      await followByTapping();
      if (++n > 150) throw new Error('The game did not end');
    }
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('klondike-readout')).toHaveAttribute('data-home', '11');
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    // 11 cards: 50 × (55/52 − 1) = 2.88… → +3 Jeet.
    expect(useWallet.getState().balance).toBe(1003);
    expect(ledger()).toEqual([
      ['bet', -50],
      ['payout', 53],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
  });
});
