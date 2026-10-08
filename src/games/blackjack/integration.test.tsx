// @vitest-environment jsdom
/**
 * Blackjack end to end at the component level: the generated registry → GameShell
 * (/games/blackjack/play) and PracticeHand (/games/blackjack/try) → the real engine and
 * Board, on the curated seeds the Playwright tests use.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/blackjack';
import { roasts, titles } from '@content/titles';
import { GameShell, RESULT_REVEAL_MS } from '@/components/play/GameShell';
import { PracticeHand } from '@/components/play/PracticeHand';
import { stripTipPrefix } from '@/components/play/personas';
import { clearGameModuleCache } from '@/components/play/useGameModule';
import { dismissAllToasts, Toaster } from '@/components/ui/Toast';
import { gameModuleLoaders, TIER1_SLUGS } from '@/games/registry.generated';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { LiveAnnouncer } from '@/components/layout/LiveAnnouncer';
import { cardName } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import blackjackModule from './index';
import { BLACKJACK_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

/** The controller's delay for the dealer's forced (single-option) moves. */
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
      <GameShell slug="blackjack" gameName="Blackjack" tips={content.tips} seed={String(seed)} />
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

/** Let the dealer play out (one forced move at a time) and the result overlay open. */
async function dealerPlaysOut(moves: number) {
  for (let i = 0; i < moves; i++) await flush(DEALER_MS);
  await flush(RESULT_REVEAL_MS);
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

describe('Blackjack is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('blackjack');
    await expect(gameModuleLoaders.blackjack?.()).resolves.toBe(blackjackModule);
  });
});

describe('/games/blackjack/play (GameShell + the real module)', () => {
  it('offers the Blackjack bet: its chips, payout line and no difficulty picker', async () => {
    await renderShell(BLACKJACK_SEEDS.practice);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(
      'Win pays 1:1, Blackjack pays 3:2, a tie (push) returns your bet. Doubles and splits need extra Jeet.',
    );
    expect(within(panel).queryByText('Bot difficulty')).not.toBeInTheDocument();
    expect(screen.getByText('You vs Dealer Sitara')).toBeInTheDocument();
  });

  it('naturalWin: Blackjack pays 3 to 2 and the celebration shows a title', async () => {
    await renderShell(BLACKJACK_SEEDS.naturalWin);
    await dealFor(10);
    expect(useWallet.getState().balance).toBe(990);
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('21');
    expect(screen.getByTestId('bj-badge-blackjack')).toBeInTheDocument();
    expect(screen.getByTestId('bj-dealer-hand')).toHaveAttribute('data-hole', 'hidden');

    await dealerPlaysOut(1);
    expect(screen.getByTestId('bj-dealer-hand')).toHaveAttribute('data-hole', 'revealed');
    const celebration = screen.getByTestId('celebration');
    const title = screen.getByTestId('win-title').textContent ?? '';
    expect(titles.map((x) => x.text)).toContain(title);
    expect(within(celebration).getByText('+15 Jeet')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1015);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards[0]).toMatchObject({ gameSlug: 'blackjack', jeet: 15 });
  });

  it('dealerBlackjack: the round ends at the deal with a roast and a Blackjack tip', async () => {
    await renderShell(BLACKJACK_SEEDS.dealerBlackjack);
    await dealFor(25);
    // The learner never gets a turn: every action waits for the dealer.
    expect(screen.getByTestId('bj-hit')).toHaveAttribute('aria-disabled', 'true');

    await dealerPlaysOut(1);
    const roast = screen.getByTestId('roast');
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(TIPS.some((t) => tip.includes(t))).toBe(true);
    expect(within(roast).getByTestId('rematch-button')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(975);
    expect(
      within(screen.getByTestId('move-log')).getByText(/Dealer Sitara has Blackjack!/),
    ).toBeInTheDocument();
  });

  it('bustOnHit: hitting busts the learner — announced, logged and roasted', async () => {
    await renderShell(BLACKJACK_SEEDS.bustOnHit);
    await dealFor(10);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
    fireEvent.click(screen.getByTestId('bj-hit'));
    await flush();
    expect(screen.getByTestId('bj-badge-bust')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('move-log')).getByText(/You hit and drew .* bust!/),
    ).toBeInTheDocument();

    await dealerPlaysOut(1);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(screen.getByTestId('bj-outcome')).toHaveAttribute('data-outcome', 'loss');
    expect(useWallet.getState().balance).toBe(990);
  });

  it('plays a whole hand from the keyboard: S stands, the dealer draws one card at a time', async () => {
    await renderShell(BLACKJACK_SEEDS.practice);
    await dealFor(50);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 's' });
    await flush();
    // The dealer has no choices, so she "is playing" rather than "thinking".
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Dealer Sitara is playing…');

    await flush(DEALER_MS); // the hole card turns over: 16
    expect(screen.getByTestId('bj-dealer-total')).toHaveTextContent('Hard 16');
    await flush(DEALER_MS); // the dealer must draw: bust
    expect(screen.getByTestId('bj-dealer-total')).toHaveTextContent('26');
    await flush(RESULT_REVEAL_MS);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1050);
  });

  it('never puts the hole card or the next card from the shoe in the page', async () => {
    const dealt = blackjackModule.engine.setup(
      { ...blackjackModule.defaultConfig, affordableUnits: 99 },
      createRng(String(BLACKJACK_SEEDS.practice)),
    );
    const hole = dealt.dealer[1]!;
    const next = dealt.shoe[0]!;
    render(<LiveAnnouncer />);
    await renderShell(BLACKJACK_SEEDS.practice);
    await dealFor(10);
    const secrets = [hole, next].flatMap((code) => [code, cardName(code)]);
    const page = () => document.body.innerHTML;
    for (const secret of secrets) expect(page()).not.toContain(secret);
    // The deal is announced with what the learner can see.
    expect(screen.getByTestId('sr-announcer')).toHaveTextContent(
      'Bet placed: 10 Jeet. Shuffling up and dealing… You have hard 13 (7 + 6). The dealer shows a 6.',
    );

    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    await flush(DEALER_MS); // the hole card turns over …
    expect(page()).toContain(cardName(hole));
    expect(page()).not.toContain(cardName(next));
    await flush(DEALER_MS); // … then the dealer draws
    expect(page()).toContain(cardName(next));
  });

  it('explains an unavailable action instead of applying it', async () => {
    await renderShell(BLACKJACK_SEEDS.practice);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('bj-split'));
    expect(screen.getByTestId('move-error')).toHaveTextContent(
      'You can only split a pair — two cards of the same value',
    );
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
  });

  it('splitWin: splitting takes a second bet from the wallet at settlement and pays both hands', async () => {
    await renderShell(BLACKJACK_SEEDS.splitWin);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('bj-split'));
    await flush();
    expect(screen.getByTestId('bj-hand-0')).toHaveAttribute('data-active', 'true');
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    expect(screen.getByTestId('bj-hand-1')).toHaveAttribute('data-active', 'true');
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    await dealerPlaysOut(2);
    expect(screen.getAllByTestId('bj-outcome').map((el) => el.dataset.outcome)).toEqual([
      'win',
      'win',
    ]);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1020);
  });

  it('doubleWin: doubling down needs Jeet the wallet can cover', async () => {
    useWallet.setState({ balance: 10 });
    await renderShell(BLACKJACK_SEEDS.doubleWin);
    await dealFor(10);
    fireEvent.keyDown(document.body, { key: 'd' });
    expect(screen.getByTestId('move-error')).toHaveTextContent(
      'Doubling down means adding a second bet the same size as your first',
    );
  });
});

describe('/games/blackjack/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="blackjack" gameName="Blackjack" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro, the situation and glowing legal moves', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(blackjackModule.practice.intro);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'You have hard 13 (7 + 6). The dealer shows a 6. You can hit, stand or double down.',
    );
    expect(screen.getByTestId('bj-player-total')).toHaveTextContent('Hard 13');
    expect(screen.getByTestId('bj-dealer-total')).toHaveTextContent('Shows 6');
    for (const id of ['bj-hit', 'bj-stand', 'bj-double']) {
      expect(screen.getByTestId(id)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(screen.getByTestId('bj-split')).not.toHaveAttribute('data-highlighted');
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"What would a pro do?" makes Stand pulse and explains why', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    expect(screen.getByTestId('bj-stand')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('bj-hit')).not.toHaveAttribute('data-suggested');
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/stand/i);
  });

  it('explains a mistake, then finishes the hand with a summary and a tip', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('bj-split'));
    expect(screen.getByTestId('coach-error')).toHaveTextContent('Your 7 and 6 aren’t a pair.');

    fireEvent.keyDown(document.body, { key: 'S' });
    await flush();
    expect(screen.queryByTestId('practice-intro')).not.toBeInTheDocument();
    await flush(DEALER_MS);
    await flush(DEALER_MS);
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      'The dealer busted with 26, so your 13 wins!',
    );
    expect(useProgress.getState().games.blackjack?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});

describe('settlement: the wallet ends exactly right in every outcome', () => {
  it('a natural Blackjack on 25 pays 3:2 rounded to whole Jeet (+38)', async () => {
    await renderShell(BLACKJACK_SEEDS.naturalWin);
    await dealFor(25);
    await dealerPlaysOut(1);
    expect(useWallet.getState().balance).toBe(1038);
    expect(ledger()).toEqual([
      ['bet', -25],
      ['payout', 63],
    ]);
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent('Blackjack pays 3 to 2');
  });

  it('a won double pays two bets: only the first is escrowed, the payout covers both', async () => {
    await renderShell(BLACKJACK_SEEDS.doubleWin);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('bj-double'));
    await flush();
    expect(screen.getByTestId('bj-bet')).toHaveAttribute('data-bet', '2');
    await dealerPlaysOut(3);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1020);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 30],
    ]);
  });

  it('a lost double debits the second bet at settlement (−2 bets)', async () => {
    await renderShell(BLACKJACK_SEEDS.doubleLoss);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('bj-double'));
    await flush();
    await dealerPlaysOut(3);
    expect(screen.getByTestId('roast')).toBeInTheDocument();
    expect(screen.getByTestId('roast-jeet')).toHaveTextContent('−20 Jeet');
    expect(useWallet.getState().balance).toBe(980);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['bet', -10],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });

  it('two lost split hands debit the second bet; one win + one loss is a push', async () => {
    const lost = await renderShell(BLACKJACK_SEEDS.splitLoss);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('bj-split'));
    await flush();
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    await dealerPlaysOut(3);
    expect(screen.getAllByTestId('bj-outcome').map((el) => el.dataset.outcome)).toEqual([
      'loss',
      'loss',
    ]);
    expect(useWallet.getState().balance).toBe(980);
    lost.unmount();
    expect(useWallet.getState().balance).toBe(980);

    useWallet.setState({ balance: 1000, ledger: [] });
    await renderShell(BLACKJACK_SEEDS.splitPush);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('bj-split'));
    await flush();
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    await dealerPlaysOut(3);
    expect(screen.getAllByTestId('bj-outcome').map((el) => el.dataset.outcome)).toEqual([
      'win',
      'loss',
    ]);
    // Net zero: the escrowed bet comes back and the push overlay explains how.
    expect(useWallet.getState().balance).toBe(1000);
    expect(screen.getByTestId('push-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('push-summary')).toHaveTextContent('you break even');
    expect(useStats.getState()).toMatchObject({ played: 2, losses: 1, pushes: 1, wins: 0 });
  });

  it('a tie returns the bet and gets neither a title nor a roast', async () => {
    await renderShell(BLACKJACK_SEEDS.push);
    await dealFor(50);
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    await dealerPlaysOut(3);
    expect(screen.getByTestId('push-overlay')).toBeInTheDocument();
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('roast')).not.toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1000);
    expect(useStats.getState()).toMatchObject({ played: 1, pushes: 1, awards: [] });
  });

  it('leaving mid-hand forfeits the bet (nothing else was set aside) and says so', async () => {
    const view = await renderShell(BLACKJACK_SEEDS.practice);
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

  it('settles, records and logs exactly once under React StrictMode', async () => {
    await renderShell(BLACKJACK_SEEDS.splitWin, { strict: true });
    await dealFor(10);
    fireEvent.click(screen.getByTestId('bj-split'));
    await flush();
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    fireEvent.click(screen.getByTestId('bj-stand'));
    await flush();
    await dealerPlaysOut(3);

    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1020);
    expect(ledger()).toEqual([
      ['bet', -10],
      ['payout', 30],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
    // split, stand, stand, reveal, one dealer draw — each logged once.
    expect(
      within(screen.getByTestId('move-log')).getByRole('button', { name: 'Show full log (5)' }),
    ).toBeInTheDocument();
  });
});
