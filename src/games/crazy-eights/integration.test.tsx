// @vitest-environment jsdom
/**
 * Crazy Eights end to end at the component level: the generated registry → GameShell
 * (/games/crazy-eights/play) and PracticeHand (/games/crazy-eights/try) → the real engine
 * and Board, on the curated seeds the Playwright tests use, with fake timers for the bots.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/crazy-eights';
import { roasts, titles } from '@content/titles';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { GameShell, RESULT_REVEAL_MS } from '@/components/play/GameShell';
import { PracticeHand } from '@/components/play/PracticeHand';
import { stripTipPrefix } from '@/components/play/personas';
import { clearGameModuleCache } from '@/components/play/useGameModule';
import { dismissAllToasts } from '@/components/ui/Toast';
import { cardName, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { gameModuleLoaders, TIER1_SLUGS } from '@/games/registry.generated';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { crazyEightsEngine as E, isEight, type CrazyEightsMove } from './engine';
import crazyEightsModule from './index';
import { CRAZY_EIGHTS_SEEDS } from './seeds';

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

const board = () => screen.getByTestId('c8-board');
const isOver = () => board().dataset.phase === 'over';
const myTurn = () => board().dataset.turn === '0';

/** Let the bots play (each one at most one thinking delay per move) until it's our turn. */
async function botsPlay() {
  for (let i = 0; i < 60 && !isOver() && !myTurn(); i++) await flush(BOT_DELAY_MS.normal);
  expect(isOver() || myTurn()).toBe(true);
}

/** The learner's moves when following the coach against normal bots (the engine's view). */
function coachLine(seed: number): CrazyEightsMove[] {
  let s = E.setup(crazyEightsModule.defaultConfig, createRng(seed));
  const bots = createRng(`bot-${seed}`);
  const mine: CrazyEightsMove[] = [];
  while (!E.isOver(s)) {
    const p = E.currentPlayer(s)!;
    const m =
      p === 0 ? (E.coach(s, 0).suggestion as CrazyEightsMove) : E.botMove(s, p, 'normal', bots);
    if (p === 0) mine.push(m);
    s = E.applyMove(s, m);
  }
  return mine;
}

const handCard = (code: CardCode) =>
  within(screen.getByTestId('c8-hand')).getByRole('button', { name: new RegExp(cardName(code)) });

/** Make one move through the UI: press a card (and name a suit), the stock, or Pass. */
function press(move: CrazyEightsMove) {
  if (move.type === 'draw') fireEvent.click(screen.getByTestId('c8-draw'));
  else if (move.type === 'pass') fireEvent.click(screen.getByTestId('c8-pass'));
  else {
    fireEvent.click(handCard(move.card));
    if (move.suit) fireEvent.click(screen.getByTestId(`c8-suit-${move.suit}`));
  }
}

async function renderShell(seed: number, { strict = false }: { strict?: boolean } = {}) {
  const Wrap = strict ? StrictMode : ({ children }: { children: ReactNode }) => <>{children}</>;
  const view = render(
    <Wrap>
      <StoreHydrator />
      <GameShell
        slug="crazy-eights"
        gameName="Crazy Eights"
        tips={content.tips}
        seed={String(seed)}
      />
    </Wrap>,
  );
  await flush();
  return view;
}

async function dealFor(stake = 10) {
  fireEvent.click(screen.getByTestId(`stake-${stake}`));
  fireEvent.click(screen.getByTestId('deal-button'));
  await flush();
}

/** Play the seed's coach line through the UI, letting the bots take their turns. */
async function playCoachLine(seed: number) {
  for (const move of coachLine(seed)) {
    await botsPlay();
    expect(myTurn()).toBe(true);
    press(move);
    await flush();
  }
  await botsPlay();
  expect(isOver()).toBe(true);
}

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

describe('Crazy Eights is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('crazy-eights');
    await expect(gameModuleLoaders['crazy-eights']?.()).resolves.toBe(crazyEightsModule);
  });

  it('the module matches the engine: 3 seats, 2 bots, one stake at risk', () => {
    expect(crazyEightsModule.defaultConfig).toEqual({ players: 3 });
    expect(crazyEightsModule.bots).toHaveLength(2);
    expect(crazyEightsModule.betting.maxLossUnits).toBe(1);
    expect(crazyEightsModule.difficulties).toEqual(['easy', 'normal']);
    expect(
      crazyEightsModule.moveLabel?.(
        { type: 'play', card: '8H', suit: 'C' },
        E.setup({ players: 3 }, createRng(1)),
      ),
    ).toBe('Play the 8♥ and name Clubs');
  });
});

describe('/games/crazy-eights/play (GameShell + the real module)', () => {
  it('offers the Crazy Eights bet: chips, payout line and a bot difficulty picker', async () => {
    await renderShell(CRAZY_EIGHTS_SEEDS.quickWin);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(crazyEightsModule.betting.describe);
    expect(within(panel).getByText('Bot difficulty')).toBeInTheDocument();
    expect(screen.getByText('You vs Jugnu the Juggler and Madame Matinee')).toBeInTheDocument();
  });

  it('quickWin: bet, deal, follow the coach through the UI — celebration and a 2× payout', async () => {
    render(<LiveAnnouncer />);
    await renderShell(CRAZY_EIGHTS_SEEDS.quickWin);
    await dealFor(10);
    expect(useWallet.getState().balance).toBe(990);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');

    // Nothing the learner can't see is on the page: the bots' hands and the stock.
    const dealt = E.setup(
      crazyEightsModule.defaultConfig,
      createRng(String(CRAZY_EIGHTS_SEEDS.quickWin)),
    );
    for (const code of [...dealt.hands[1]!, ...dealt.hands[2]!, ...dealt.stock]) {
      expect(document.body.innerHTML).not.toContain(`data-card="${code}"`);
      expect(document.body.textContent).not.toContain(cardName(code));
    }

    await playCoachLine(CRAZY_EIGHTS_SEEDS.quickWin);
    await flush(RESULT_REVEAL_MS);
    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+20 Jeet')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      'You emptied your hand first and won the pot',
    );
    expect(useWallet.getState().balance).toBe(1020);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 30],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    // Every bot move was announced with its persona's name.
    expect(screen.getByTestId('move-log')).toHaveTextContent(/Jugnu the Juggler|Madame Matinee/);
    expect(screen.getByTestId('move-log')).not.toHaveTextContent(/Player \d/);
  });

  it('quickLoss: a bot goes out first — roast, tip and one stake lost', async () => {
    await renderShell(CRAZY_EIGHTS_SEEDS.quickLoss);
    await dealFor(25);
    await playCoachLine(CRAZY_EIGHTS_SEEDS.quickLoss);
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(TIPS.some((x) => tip.includes(x))).toBe(true);
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('−25 Jeet');
    expect(useWallet.getState().balance).toBe(975);
    expect(ledger()).toEqual([['bet', -25]]);
    // The winner's seat shows it went out, and every bot's cards are now face up.
    expect(screen.getAllByText('Out — winner!')).toHaveLength(1);
  });

  it('explains an illegal card and an illegal pass instead of applying them', async () => {
    await renderShell(CRAZY_EIGHTS_SEEDS.practice);
    await dealFor(10);
    fireEvent.click(handCard('7C'));
    expect(screen.getByTestId('move-error')).toHaveTextContent("The 7♣ doesn't match the K♦");
    fireEvent.keyDown(document.body, { key: 'p' });
    expect(screen.getByTestId('move-error')).toHaveTextContent('You can only pass when nothing');
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
    expect(screen.getByTestId('c8-hand')).toHaveAccessibleName(/Seven of Clubs/);
  });

  it('plays a whole game from the keyboard only, under StrictMode, settled once', async () => {
    await renderShell(CRAZY_EIGHTS_SEEDS.quickWin, { strict: true });
    await dealFor(50);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    for (const move of coachLine(CRAZY_EIGHTS_SEEDS.quickWin)) {
      await botsPlay();
      if (move.type === 'draw') fireEvent.keyDown(document.body, { key: 'd' });
      else if (move.type === 'pass') fireEvent.keyDown(document.body, { key: 'p' });
      else {
        // Walk the hand with the arrow keys to the card, then press it.
        const hand = screen.getByTestId('c8-hand');
        const first = within(hand).getAllByRole('button')[0]!;
        act(() => first.focus());
        fireEvent.keyDown(hand, { key: 'Home' });
        const target = handCard(move.card);
        for (let i = 0; i < 20 && document.activeElement !== target; i++) {
          fireEvent.keyDown(hand, { key: 'ArrowRight' });
        }
        expect(target).toHaveFocus();
        fireEvent.click(target); // Enter/Space on a focused <button> clicks it
        if (isEight(move.card) && move.suit) {
          fireEvent.keyDown(document.activeElement ?? document.body, { key: move.suit });
        }
      }
      await flush();
    }
    await botsPlay();
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1100);
    expect(ledger()).toEqual([
      ['bet', -50],
      ['payout', 150],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
  });

  it('eightFirst: the coach toggle lights the Eight, and the suit chooser names the suit', async () => {
    await renderShell(CRAZY_EIGHTS_SEEDS.eightFirst);
    await dealFor(10);
    const first = coachLine(CRAZY_EIGHTS_SEEDS.eightFirst)[0]!;
    expect(first.type === 'play' && isEight(first.card)).toBe(true);
    if (first.type !== 'play' || !first.suit) return;
    fireEvent.click(handCard(first.card));
    expect(screen.getByRole('group', { name: 'Name the next suit' })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(`c8-suit-${first.suit}`));
    await flush();
    expect(screen.getByTestId('c8-suit-badge')).toHaveAttribute('data-suit', first.suit);
    expect(screen.getByTestId('move-log')).toHaveTextContent(
      `You played the ${cardName(first.card)} and named`,
    );
  });
});

describe('/games/crazy-eights/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="crazy-eights" gameName="Crazy Eights" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro, the situation and glowing playable cards', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(
      crazyEightsModule.practice.intro,
    );
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'The pile shows the K♦, so the next card must be a Diamond or a King — or a wild Eight.',
    );
    for (const code of ['KS', '8H', 'QD'] as const) {
      expect(handCard(code)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(handCard('7C')).not.toHaveAttribute('data-highlighted');
    expect(screen.getByTestId('c8-draw')).toHaveAttribute('data-highlighted', 'true');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('explains a mistake, then follows "What would a pro do?" through the UI to a win', async () => {
    // Played cards leave the hand at once (no exit animation still holding the old pick).
    useSettings.setState({ motion: 'reduce' });
    await renderPractice();
    fireEvent.click(handCard('2S'));
    expect(screen.getByTestId('coach-error')).toHaveTextContent('The 2♠ doesn');

    let turns = 0;
    while (!isOver()) {
      await botsPlay();
      if (isOver()) break;
      fireEvent.click(screen.getByTestId('coach-hint'));
      expect(screen.getByTestId('coach-hint-text')).not.toBeEmptyDOMElement();
      const hand = screen.getByTestId('c8-hand');
      const pick = hand.querySelector<HTMLElement>('[data-suggested]');
      if (pick) {
        fireEvent.click(pick);
        // An Eight opens the suit chooser on the coach's suit.
        const suit = screen
          .queryByTestId('c8-suit-chooser')
          ?.querySelector<HTMLElement>('[data-suggested]');
        if (suit) {
          expect(suit).toHaveFocus();
          fireEvent.click(suit);
        }
      } else if (screen.getByTestId('c8-draw').dataset.suggested) {
        fireEvent.click(screen.getByTestId('c8-draw'));
      } else {
        fireEvent.click(screen.getByTestId('c8-pass'));
      }
      await flush();
      turns++;
      expect(turns).toBeLessThan(20);
    }
    // The coach's line: K♠ (a rank switch), Q♦, the 8♥ naming Clubs, 7♣, then 2♠ to go out.
    expect(turns).toBe(5);
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      'You emptied your hand first and won the pot',
    );
    expect(screen.getByTestId('c8-you-won')).toBeInTheDocument();
    expect(useProgress.getState().games['crazy-eights']?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"Try another practice hand" deals a fresh game', async () => {
    await renderPractice();
    const line = coachLine(CRAZY_EIGHTS_SEEDS.practice);
    for (const move of line) {
      await botsPlay();
      press(move);
      await flush();
    }
    await botsPlay();
    fireEvent.click(screen.getByTestId('practice-again'));
    await flush();
    const next = E.setup(
      crazyEightsModule.defaultConfig,
      createRng(CRAZY_EIGHTS_SEEDS.practice + 1),
    );
    expect(screen.getByTestId('c8-discard')).toHaveAttribute('data-top', next.discard[0]);
    expect(screen.getByTestId('c8-count-0')).toHaveAttribute(
      'data-count',
      String(next.hands[0]!.length),
    );
  });
});
