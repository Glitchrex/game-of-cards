// @vitest-environment jsdom
/**
 * The play shell under React StrictMode (as `next dev` runs it): double rendering and the
 * mount → unmount → mount effect replay must never double a bet, a payout, a stats record,
 * a move-log entry, a sound or a screen-reader announcement.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { StrictMode } from 'react';
import type * as LiveAnnouncerModule from '@/components/layout/LiveAnnouncer';
import { type GameModule } from '@/games/core/module';
import type * as SoundModule from '@/lib/sound';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import { makeToyModule, TOY_TIPS, type ToyOptions } from './__fixtures__/toy-game';
import { GameShell, RESULT_REVEAL_MS } from './GameShell';
import { PracticeHand } from './PracticeHand';
import { clearGameModuleCache } from './useGameModule';

const spy = vi.hoisted(() => ({ module: null as unknown, announce: vi.fn(), sound: vi.fn() }));

vi.mock('@/games/registry.generated', () => ({
  TIER1_SLUGS: ['toy'],
  gameModuleLoaders: { toy: () => Promise.resolve(spy.module) },
}));

vi.mock('@/components/layout/LiveAnnouncer', async (importOriginal) => ({
  ...(await importOriginal<typeof LiveAnnouncerModule>()),
  announce: spy.announce,
}));

vi.mock('@/lib/sound', async (importOriginal) => ({
  ...(await importOriginal<typeof SoundModule>()),
  playSound: spy.sound,
}));

const BOT_MS = BOT_DELAY_MS.normal;

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function useToy(options: ToyOptions = {}) {
  spy.module = makeToyModule(options) as unknown as GameModule;
}

async function renderStrictShell() {
  const view = render(
    <StrictMode>
      <StoreHydrator />
      <GameShell slug="toy" gameName="Toy Duel" tips={TOY_TIPS} />
    </StrictMode>,
  );
  await flush();
  return view;
}

async function playHand(stake: number) {
  fireEvent.click(screen.getByTestId(`stake-${stake}`));
  fireEvent.click(screen.getByTestId('deal-button'));
  await flush();
  fireEvent.click(screen.getByTestId('move-play'));
  await flush(BOT_MS);
  await flush(RESULT_REVEAL_MS);
}

const sounds = () => spy.sound.mock.calls.map(([name]) => String(name));
const announced = () => spy.announce.mock.calls.map(([text]) => String(text));
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
  spy.announce.mockClear();
  spy.sound.mockClear();
  clearGameModuleCache();
  localStorage.clear();
  sessionStorage.clear();
  useWallet.setState({ balance: 1000, lastUdhaarAt: null, ledger: [] });
  useStats.getState().reset();
  useProgress.getState().reset();
  useSettings.setState({ botSpeed: 'normal', motion: 'full', muted: true });
  useToy();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('GameShell under StrictMode', () => {
  it('escrows, settles, records, logs, plays sounds and announces exactly once', async () => {
    await renderStrictShell();
    await playHand(50);

    expect(screen.getByTestId('celebration')).toBeInTheDocument();
    expect(useWallet.getState().balance).toBe(1050);
    expect(ledger()).toEqual([
      ['bet', -200],
      ['payout', 250],
    ]);
    expect(useStats.getState()).toMatchObject({ played: 1, wins: 1 });
    expect(useStats.getState().awards).toHaveLength(1);
    expect(useProgress.getState().games.toy?.wins).toBe(1);
    expect(screen.getByTestId('move-log').querySelectorAll('li')).toHaveLength(2);

    expect(sounds()).toEqual(['chip', 'shuffle', 'card', 'card', 'win']);
    const said = announced();
    expect(said.filter((x) => x.startsWith('Bet placed: 50 Jeet.'))).toHaveLength(1);
    expect(said.filter((x) => x === 'You play.')).toHaveLength(1);
    expect(said.filter((x) => x === 'Mona replies.')).toHaveLength(1);
    // The outcome is announced once, starting with the engine's own summary.
    const outcome = said.filter((x) => x.includes('You won 50 Jeet!'));
    expect(outcome).toHaveLength(1);
    expect(outcome[0]).toMatch(/^You out-played Mona in the toy duel\. You won 50 Jeet!/);
  });

  it('debits an over-escrow loss once and refunds an abandoned hand once', async () => {
    useToy({ outcome: 'loss', net: 6 });
    const view = await renderStrictShell();
    await playHand(50);
    expect(useWallet.getState().balance).toBe(700);
    expect(ledger()).toEqual([
      ['bet', -200],
      ['bet', -100],
    ]);
    expect(sounds().filter((x) => x === 'lose')).toHaveLength(1);

    fireEvent.click(screen.getByTestId('rematch-button'));
    await flush();
    fireEvent.click(screen.getByTestId('deal-button'));
    await flush();
    expect(useWallet.getState().balance).toBe(500);
    view.unmount();
    // Escrow 200 − one 50 stake.
    expect(useWallet.getState().balance).toBe(650);
    expect(useStats.getState().played).toBe(1);
  });
});

describe('PracticeHand under StrictMode', () => {
  it('logs every move once and marks the example done once the hand ends', async () => {
    render(
      <StrictMode>
        <StoreHydrator />
        <PracticeHand slug="toy" gameName="Toy Duel" tips={TOY_TIPS} />
      </StrictMode>,
    );
    await flush();
    fireEvent.click(screen.getByTestId('move-play'));
    await flush(BOT_MS);
    expect(screen.getByTestId('practice-summary')).toBeInTheDocument();
    expect(screen.getByTestId('move-log').querySelectorAll('li')).toHaveLength(2);
    expect(announced().filter((x) => x === 'Mona replies.')).toHaveLength(1);
    expect(useProgress.getState().games.toy?.exampleDone).toBe(true);
    expect(useWallet.getState().balance).toBe(1000);
  });
});
