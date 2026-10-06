// @vitest-environment jsdom
/**
 * Andar Bahar end to end at the component level: the generated registry → GameShell
 * (/games/andar-bahar/play) and PracticeHand (/games/andar-bahar/try) → the real engine and
 * Board, on the curated seeds the Playwright tests use.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/andar-bahar';
import { roasts, titles } from '@content/titles';
import { announce, LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
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
import andarBaharModule from './index';
import { ANDARBAHAR_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

/** The controller's delay for the dealer's forced (single-option) deals. */
const DEALER_MS = Math.round(BOT_DELAY_MS.normal * 0.6);
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
      <GameShell
        slug="andar-bahar"
        gameName="Andar Bahar"
        tips={content.tips}
        seed={String(seed)}
      />
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

/** Let the dealer deal `cards` cards (one forced move each), then the result overlay open. */
async function dealerDeals(cards: number, { reveal = true }: { reveal?: boolean } = {}) {
  for (let i = 0; i < cards; i++) await flush(DEALER_MS);
  if (reveal) await flush(RESULT_REVEAL_MS);
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

describe('Andar Bahar is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('andar-bahar');
    await expect(gameModuleLoaders['andar-bahar']?.()).resolves.toBe(andarBaharModule);
  });

  it('starts from a config the engine accepts, with the dealer in seat 1', () => {
    const state = andarBaharModule.engine.setup(andarBaharModule.defaultConfig, createRng(1));
    expect(state.phase).toBe('bet');
    expect(andarBaharModule.bots.map((b) => b.name)).toEqual(['Jhatpat Jamuna']);
    expect(andarBaharModule.moveLabel?.({ type: 'bet', side: 'bahar' }, state)).toBe(
      'Bet on Bahar',
    );
    expect(andarBaharModule.moveLabel?.({ type: 'deal' }, state)).toBe('Deal a card');
  });
});

describe('/games/andar-bahar/play (GameShell + the real module)', () => {
  it('offers the Andar Bahar bet: its chips, payout line and no difficulty picker', async () => {
    await renderShell(ANDARBAHAR_SEEDS.practice);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(
      'Andar pays 0.9:1 and Bahar pays 1:1 — Andar gets the first card, so it wins slightly more often.',
    );
    expect(within(panel).queryByText('Bot difficulty')).not.toBeInTheDocument();
    expect(screen.getByText('You vs Jhatpat Jamuna')).toBeInTheDocument();
  });

  it('practice seed: bet Andar, watch nine cards, win 0.9 to 1 with a title', async () => {
    await renderShell(ANDARBAHAR_SEEDS.practice);
    await dealFor(10);
    expect(useWallet.getState().balance).toBe(990);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
    expect(screen.getByTestId('ab-joker')).toHaveAttribute('data-joker', '7H');

    fireEvent.click(screen.getByTestId('ab-andar'));
    await flush();
    expect(screen.getByTestId('ab-andar')).toHaveAttribute('data-chosen', 'true');
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Jhatpat Jamuna is playing…');
    expect(screen.getByTestId('ab-dealer-seat')).toHaveAttribute('data-thinking', 'true');

    await flush(DEALER_MS);
    expect(screen.getByTestId('ab-lane-andar')).toHaveAttribute('data-count', '1');
    expect(screen.getByTestId('ab-count')).toHaveTextContent('Card 1');
    await flush(DEALER_MS);
    expect(screen.getByTestId('ab-lane-bahar')).toHaveAttribute('data-count', '1');
    await dealerDeals(7);

    expect(screen.getByTestId('ab-board')).toHaveAttribute('data-winner', 'andar');
    expect(screen.getByTestId('ab-count')).toHaveTextContent('Match on card 9!');
    expect(screen.getByTestId('ab-outcome')).toHaveAttribute('data-outcome', 'win');
    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+9 Jeet')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      'The Seven of Spades matched the joker on Andar as card 9 — your Andar bet wins 0.9 to 1!',
    );
    expect(useWallet.getState().balance).toBe(1009);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 19],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards[0]).toMatchObject({ gameSlug: 'andar-bahar', jeet: 9 });
  });

  it('baharWin, from the keyboard: A bets Andar, the match lands on Bahar — a roast and a tip', async () => {
    await renderShell(ANDARBAHAR_SEEDS.baharWin);
    await dealFor(25);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'a' });
    await flush();
    expect(
      within(screen.getByTestId('move-log')).getByText('You bet on Andar (inside).'),
    ).toBeInTheDocument();
    await dealerDeals(8);

    expect(screen.getByTestId('ab-outcome')).toHaveAttribute('data-outcome', 'loss');
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(TIPS.some((x) => tip.includes(x))).toBe(true);
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('−25 Jeet');
    expect(useWallet.getState().balance).toBe(975);
    expect(ledger()).toEqual([['bet', -25]]);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
    expect(
      within(screen.getByTestId('move-log')).getByText(/it matches the joker, so Bahar wins!/),
    ).toBeInTheDocument();
  });

  it('quickBaharWin: a Bahar bet pays 1 to 1 (+50 on 50)', async () => {
    await renderShell(ANDARBAHAR_SEEDS.quickBaharWin);
    await dealFor(50);
    fireEvent.click(screen.getByTestId('ab-bahar'));
    await flush();
    await dealerDeals(2);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1050);
    expect(ledger()).toEqual([
      ['bet', -50],
      ['payout', 100],
    ]);
  });

  it('never puts a face-down card in the page before it is dealt', async () => {
    const start = andarBaharModule.engine.setup(
      { ...andarBaharModule.defaultConfig, affordableUnits: 99 },
      createRng(String(ANDARBAHAR_SEEDS.practice)),
    );
    const [first, second] = start.stock;
    // The announcer is app-wide: clear what earlier tests' results left in it.
    announce('', 'assertive');
    render(<LiveAnnouncer />);
    await renderShell(ANDARBAHAR_SEEDS.practice);
    await dealFor(10);
    const page = () => document.body.innerHTML;
    expect(screen.getByTestId('sr-announcer')).toHaveTextContent(
      'Bet placed: 10 Jeet. Shuffling up and dealing… The joker is the Seven of Hearts.',
    );
    for (const code of start.stock) expect(page()).not.toContain(cardName(code));

    fireEvent.click(screen.getByTestId('ab-bahar'));
    await flush();
    expect(page()).not.toContain(cardName(first!));
    await flush(DEALER_MS); // card 1 lands on Andar …
    expect(page()).toContain(cardName(first!));
    expect(page()).not.toContain(cardName(second!));
    await flush(DEALER_MS); // … then card 2 on Bahar
    expect(page()).toContain(cardName(second!));
  });

  it('ignores the bet buttons while the dealer deals (the bet is locked)', async () => {
    await renderShell(ANDARBAHAR_SEEDS.practice);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('ab-andar'));
    await flush();
    fireEvent.click(screen.getByTestId('ab-bahar'));
    fireEvent.keyDown(document.body, { key: 'b' });
    await flush();
    expect(screen.getByTestId('ab-andar')).toHaveAttribute('data-chosen', 'true');
    expect(screen.getByTestId('ab-bahar')).toHaveAttribute('aria-disabled', 'true');
    expect(within(screen.getByTestId('move-log')).getAllByText(/You bet on/)).toHaveLength(1);
  });

  it('leaving mid-deal forfeits the bet (nothing else was set aside) and says so', async () => {
    const view = await renderShell(ANDARBAHAR_SEEDS.longDeal);
    await dealFor(50);
    fireEvent.click(screen.getByTestId('ab-bahar'));
    await dealerDeals(5, { reveal: false });
    view.unmount();
    expect(useWallet.getState().balance).toBe(950);
    expect(ledger()).toEqual([['bet', -50]]);
    expect(useStats.getState().played).toBe(0);
    render(<Toaster />);
    expect(screen.getByTestId('toast')).toHaveTextContent(
      'You left in the middle of a hand, so your 50 Jeet bet was forfeited.',
    );
  });

  it('settles, records and logs exactly once under React StrictMode', async () => {
    await renderShell(ANDARBAHAR_SEEDS.practice, { strict: true });
    await dealFor(100);
    fireEvent.click(screen.getByTestId('ab-andar'));
    await flush();
    await dealerDeals(9);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1090);
    expect(ledger()).toEqual([
      ['bet', -100],
      ['payout', 190],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
    // The bet and nine deals — each logged once.
    expect(
      within(screen.getByTestId('move-log')).getByRole('button', { name: 'Show full log (10)' }),
    ).toBeInTheDocument();
  });
});

describe('/games/andar-bahar/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="andar-bahar" gameName="Andar Bahar" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro, the situation and both bets glowing', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(andarBaharModule.practice.intro);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'The joker is the Seven of Hearts.',
    );
    expect(screen.getByTestId('ab-andar')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.getByTestId('ab-bahar')).toHaveAttribute('data-highlighted', 'true');
    expect(screen.queryByTestId('ab-suggested-ring')).not.toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('follows the coach through the UI: the hint pulses Andar, the dealer deals, a summary', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    const suggested = screen.getByTestId('ab-andar');
    expect(suggested).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('ab-bahar')).not.toHaveAttribute('data-suggested');
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/51\.5%/);
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/pure chance/);

    // Follow the pulsing pick with the keyboard: focus it and press Enter (a real click).
    suggested.focus();
    fireEvent.click(suggested);
    await flush();
    expect(screen.queryByTestId('practice-intro')).not.toBeInTheDocument();
    // While the dealer deals, the coach keeps narrating the learner's live odds.
    expect(screen.getByTestId('coach-situation')).toHaveTextContent('You bet on Andar.');
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'Jhatpat Jamuna is playing — watch what they do.',
    );
    await flush(DEALER_MS);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      '1 card dealt so far, and no match yet. The next card goes to Bahar.',
    );
    await dealerDeals(8, { reveal: false });

    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      'The Seven of Spades matched the joker on Andar as card 9 — your Andar bet wins 0.9 to 1!',
    );
    expect(screen.getByTestId('ab-match')).toBeInTheDocument();
    expect(useProgress.getState().games['andar-bahar']?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});
