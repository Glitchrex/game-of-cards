// @vitest-environment jsdom
/**
 * Baccarat end to end at the component level: the generated registry → GameShell
 * (/games/baccarat/play) and PracticeHand (/games/baccarat/try) → the real engine and
 * Board, on the curated seeds the Playwright tests use.
 */
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode, type ReactNode } from 'react';
import content from '@content/games/baccarat';
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
import baccaratModule from './index';
import { BACCARAT_SEEDS } from './seeds';

vi.mock('@/lib/share-card', () => ({
  createShareImage: vi.fn(() => Promise.resolve(new Blob(['png'], { type: 'image/png' }))),
  shareOrDownload: vi.fn(() => Promise.resolve('downloaded')),
}));

/** The controller's delay for the croupier's forced (single-option) deals. */
const DEAL_MS = Math.round(BOT_DELAY_MS.normal * 0.6);
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
        slug="baccarat"
        gameName="Baccarat (Punto Banco)"
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

/** Let the croupier deal `cards` cards (one forced move each) and the result overlay open. */
async function croupierDeals(cards: number, { reveal = true } = {}) {
  for (let i = 0; i < cards; i++) await flush(DEAL_MS);
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

describe('Baccarat is a Tier 1 game', () => {
  it('is in the generated registry and loads this module', async () => {
    expect(TIER1_SLUGS).toContain('baccarat');
    await expect(gameModuleLoaders.baccarat?.()).resolves.toBe(baccaratModule);
  });
});

describe('/games/baccarat/play (GameShell + the real module)', () => {
  it('offers the Baccarat bet: its chips, payout line and no difficulty picker', async () => {
    await renderShell(BACCARAT_SEEDS.practice);
    const panel = screen.getByTestId('bet-panel');
    for (const stake of [10, 25, 50, 100, 250]) {
      expect(within(panel).getByTestId(`stake-${stake}`)).toBeInTheDocument();
    }
    expect(panel).toHaveTextContent(
      'Player pays 1:1, Banker pays 0.95:1 (5% commission), Tie pays 8:1. Player and Banker bets push on a tie.',
    );
    expect(within(panel).queryByText('Bot difficulty')).not.toBeInTheDocument();
    expect(screen.getByText('You vs Croupier Chandni')).toBeInTheDocument();
  });

  it('practice seed: bet Banker, watch six cards, Banker wins 9 to 5 → celebration and +95', async () => {
    await renderShell(BACCARAT_SEEDS.practice);
    await dealFor(100);
    expect(useWallet.getState().balance).toBe(900);
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Your turn');
    expect(screen.getByTestId('bac-prompt')).toHaveTextContent('Place your bet');

    fireEvent.click(screen.getByTestId('bac-banker'));
    await flush();
    expect(screen.getByTestId('turn-indicator')).toHaveTextContent('Croupier Chandni is playing…');
    expect(screen.getByTestId('bac-banker')).toHaveAttribute('data-chosen', 'true');
    expect(screen.getByTestId('bac-player')).toHaveAttribute('aria-disabled', 'true');

    await croupierDeals(4, { reveal: false });
    expect(screen.getByTestId('bac-player-total')).toHaveAttribute('data-total', '2');
    expect(screen.getByTestId('bac-banker-total')).toHaveAttribute('data-total', '4');
    expect(screen.getByTestId('bac-rules')).toHaveTextContent('Player has 2 → draws a third card');
    await croupierDeals(2, { reveal: false });
    expect(screen.getByTestId('bac-banker-math')).toHaveTextContent('J + 4 + 5 = 9');
    expect(screen.getByTestId('bac-result')).toHaveAttribute('data-winner', 'banker');
    await flush(RESULT_REVEAL_MS);

    const celebration = screen.getByTestId('celebration');
    expect(titles.map((x) => x.text)).toContain(screen.getByTestId('win-title').textContent);
    expect(within(celebration).getByText('+95 Jeet')).toBeInTheDocument();
    expect(screen.getByTestId('celebration-summary')).toHaveTextContent(
      'Banker won 9 to 5, so your Banker bet wins 0.95 to 1',
    );
    expect(useWallet.getState().balance).toBe(1095);
    expect(ledger()).toEqual([
      ['bet', -100],
      ['payout', 195],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards[0]).toMatchObject({ gameSlug: 'baccarat', jeet: 95 });
    expect(
      within(screen.getByTestId('move-log')).getByText(
        /Croupier Chandni deals Banker a third card, the Five of Clubs/,
      ),
    ).toBeInTheDocument();
  });

  it('playerNatural: a Banker bet loses at once to a natural 8 — roasted, with a Baccarat tip', async () => {
    await renderShell(BACCARAT_SEEDS.playerNatural);
    await dealFor(50);
    fireEvent.click(screen.getByTestId('bac-banker'));
    await flush();
    await croupierDeals(4);
    expect(screen.getByTestId('bac-player-natural')).toHaveTextContent('Natural 8');
    const roast = screen.getByTestId('roast');
    expect(roasts.map((r) => r.text)).toContain(screen.getByTestId('roast-text').textContent);
    const tip = screen.getByTestId('roast-tip').textContent ?? '';
    expect(TIPS.some((x) => tip.includes(x))).toBe(true);
    expect(within(roast).getByTestId('rematch-button')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(950);
    expect(ledger()).toEqual([['bet', -50]]);
    expect(useStats.getState()).toMatchObject({ played: 1, losses: 1 });
  });

  it('tie: a Banker bet pushes — the stake comes back, no title and no roast', async () => {
    await renderShell(BACCARAT_SEEDS.tie);
    await dealFor(50);
    fireEvent.click(screen.getByTestId('bac-banker'));
    await flush();
    await croupierDeals(6);
    expect(screen.getByTestId('push-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('push-summary')).toHaveTextContent(
      'Both hands finished on 8 — a tie — so your Banker bet is a push',
    );
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    expect(screen.queryByTestId('roast')).not.toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1000);
    expect(useStats.getState()).toMatchObject({ played: 1, pushes: 1, awards: [] });
  });

  it('tie: a Tie bet pays 8 to 1 (+200 on 25), played from the keyboard alone', async () => {
    await renderShell(BACCARAT_SEEDS.tie);
    await dealFor(25);
    expect(screen.getByTestId('play-table')).toHaveFocus();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 't' });
    await flush();
    expect(screen.getByTestId('bac-tie')).toHaveAttribute('data-chosen', 'true');
    await croupierDeals(6);
    expect(screen.getByTestId('bac-tie-banner')).toBeInTheDocument();
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1200);
    expect(ledger()).toEqual([
      ['bet', -25],
      ['payout', 225],
    ]);
  });

  it('a Player bet on a Player natural pays 1 to 1', async () => {
    await renderShell(BACCARAT_SEEDS.playerNatural);
    await dealFor(10);
    fireEvent.click(screen.getByTestId('bac-player'));
    await flush();
    await croupierDeals(4);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1010);
  });

  it('never puts the face-down shoe in the page', async () => {
    const dealt = baccaratModule.engine.setup(
      { ...baccaratModule.defaultConfig, affordableUnits: 99 },
      createRng(String(BACCARAT_SEEDS.practice)),
    );
    const [first, , third] = dealt.shoe;
    render(<LiveAnnouncer />);
    await renderShell(BACCARAT_SEEDS.practice);
    await dealFor(10);
    const page = () => document.body.innerHTML;
    expect(page()).not.toContain(cardName(first!));
    expect(screen.getByTestId('sr-announcer')).toHaveTextContent('Bet placed: 10 Jeet.');

    fireEvent.click(screen.getByTestId('bac-banker'));
    await flush();
    await flush(DEAL_MS);
    expect(page()).toContain(cardName(first!));
    expect(page()).not.toContain(cardName(third!));
  });

  it('settles, records and logs exactly once under React StrictMode', async () => {
    await renderShell(BACCARAT_SEEDS.bankerNatural, { strict: true });
    await dealFor(100);
    fireEvent.click(screen.getByTestId('bac-banker'));
    await flush();
    await croupierDeals(4);
    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1095);
    expect(ledger()).toEqual([
      ['bet', -100],
      ['payout', 195],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
    // The bet and four deals — each logged once.
    expect(
      within(screen.getByTestId('move-log')).getByRole('button', { name: 'Show full log (5)' }),
    ).toBeInTheDocument();
  });

  it('leaving mid-coup forfeits the bet and says so', async () => {
    const view = await renderShell(BACCARAT_SEEDS.practice);
    await dealFor(50);
    fireEvent.click(screen.getByTestId('bac-banker'));
    await flush();
    await flush(DEAL_MS);
    view.unmount();
    expect(useWallet.getState().balance).toBe(950);
    expect(ledger()).toEqual([['bet', -50]]);
    render(<Toaster />);
    expect(screen.getByTestId('toast')).toHaveTextContent('your 50 Jeet bet was forfeited');
  });
});

describe('/games/baccarat/try (PracticeHand + the real module)', () => {
  async function renderPractice() {
    render(
      <>
        <StoreHydrator />
        <PracticeHand slug="baccarat" gameName="Baccarat (Punto Banco)" tips={content.tips} />
      </>,
    );
    await flush();
  }

  it('opens with the coach intro, the situation and three glowing spots', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(baccaratModule.practice.intro);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'Two hands are about to be dealt: one called Player and one called Banker.',
    );
    for (const id of ['bac-player', 'bac-banker', 'bac-tie']) {
      expect(screen.getByTestId(id)).toHaveAttribute('data-highlighted', 'true');
    }
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"What would a pro do?" makes Banker pulse and explains the house edge', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    expect(screen.getByTestId('bac-banker')).toHaveAttribute('data-suggested', 'true');
    expect(screen.getByTestId('bac-tie')).not.toHaveAttribute('data-suggested');
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(/house edge on Banker/);
  });

  it('follows the coach through the UI to the end: summary, progress, no Jeet moved', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-hint'));
    const pick = document.querySelector<HTMLButtonElement>('[data-suggested="true"]');
    expect(pick).toBe(screen.getByTestId('bac-banker'));
    fireEvent.click(pick!);
    await flush();
    expect(screen.queryByTestId('practice-intro')).not.toBeInTheDocument();
    // While the croupier deals, the coach keeps describing the table.
    expect(screen.getByTestId('coach-situation')).toHaveTextContent('You bet on Banker.');

    await croupierDeals(6, { reveal: false });
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByTestId('practice-result')).toHaveTextContent(
      'Banker won 9 to 5, so your Banker bet wins 0.95 to 1',
    );
    expect(useProgress.getState().games.baccarat?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});
