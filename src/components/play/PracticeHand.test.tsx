// @vitest-environment jsdom
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MotionGlobalConfig } from 'motion/react';
import { type GameModule } from '@/games/core/module';
import { createRng } from '@/games/core/rng';
import { StoreHydrator } from '@/store/hydrate';
import { useProgress } from '@/store/progress';
import { BOT_DELAY_MS, useSettings } from '@/store/settings';
import { useStats } from '@/store/stats';
import { useWallet } from '@/store/wallet';
import {
  makeToyModule,
  TOY_CHEAT_REASON,
  TOY_INTRO,
  TOY_SITUATION,
  TOY_TIPS,
} from './__fixtures__/toy-game';
import { PracticeHand } from './PracticeHand';
import { clearGameModuleCache } from './useGameModule';

const registry = vi.hoisted(() => ({ module: null as unknown }));

vi.mock('@/games/slugs.generated', () => ({
  TIER1_SLUGS: ['toy'],
  ENGINE_SLUGS: ['toy'],
}));
vi.mock('@/games/registry.generated', () => ({
  gameModuleLoaders: { toy: () => Promise.resolve(registry.module) },
}));

async function flush(ms = 0) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

async function renderPractice() {
  const view = render(
    <>
      <StoreHydrator />
      <PracticeHand slug="toy" gameName="Toy Duel" tips={TOY_TIPS} />
    </>,
  );
  await flush();
  return view;
}

const dealtFor = (seed: number) => String(createRng(seed).int(1_000_000));

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
  localStorage.clear();
  sessionStorage.clear();
  useWallet.setState({ balance: 1000, lastUdhaarAt: null, ledger: [] });
  useStats.getState().reset();
  useProgress.getState().reset();
  useSettings.setState({ botSpeed: 'normal', motion: 'full' });
  registry.module = makeToyModule({ rounds: 1 }) as unknown as GameModule;
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('PracticeHand', () => {
  it('runs the real engine on the practice seed with the intro, ribbon and glowing legal moves', async () => {
    await renderPractice();
    expect(screen.getByTestId('practice-hand')).toHaveAttribute('data-state', 'playing');
    expect(screen.getByTestId('practice-ribbon')).toHaveTextContent(
      'Practice hand — no Jeet at stake',
    );
    expect(screen.getByTestId('practice-intro')).toHaveTextContent(TOY_INTRO);
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(TOY_SITUATION);
    expect(screen.getByTestId('toy-dealt')).toHaveTextContent(dealtFor(7));
    expect(screen.getByTestId('move-play')).toHaveAttribute('data-highlighted');
    expect(screen.getByTestId('move-pass')).toHaveAttribute('data-highlighted');
    expect(screen.getByTestId('move-cheat')).not.toHaveAttribute('data-highlighted');
    expect(useProgress.getState().games.toy?.started).toBe(true);
    // No money moves in practice.
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('reveals the pro move and why on "What would a pro do?"', async () => {
    await renderPractice();
    expect(screen.queryByTestId('coach-hint-text')).not.toBeInTheDocument();
    fireEvent.click(screen.getByTestId('coach-hint'));
    expect(screen.getByTestId('coach-hint-text')).toHaveTextContent(
      'Playing keeps the pressure on Mona.',
    );
    expect(screen.getByTestId('move-play')).toHaveAttribute('data-suggested');
    expect(screen.getByTestId('move-pass')).not.toHaveAttribute('data-suggested');
  });

  it('"Play it for me" makes the coach\'s suggested move', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('coach-autoplay'));
    await flush();
    // The toy coach suggests "play"; the hand moves on to the bot's turn.
    expect(screen.queryByTestId('practice-intro')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coach-autoplay')).not.toBeInTheDocument();
    await flush(BOT_DELAY_MS.normal);
    expect(screen.getByTestId('practice-summary')).toHaveTextContent(
      'You out-played Mona in the toy duel.',
    );
  });

  it('explains an illegal move in the coach panel (role="alert")', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('move-cheat'));
    const error = screen.getByTestId('coach-error');
    expect(error).toHaveAttribute('role', 'alert');
    expect(error).toHaveTextContent(TOY_CHEAT_REASON);
  });

  it('finishes with a friendly summary, marks the example done and offers next steps', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('move-play'));
    await flush();
    expect(screen.queryByTestId('practice-intro')).not.toBeInTheDocument();
    expect(screen.getByTestId('coach-situation')).toHaveTextContent(
      'Mona is thinking — watch what they do.',
    );
    expect(screen.queryByTestId('coach-hint')).not.toBeInTheDocument();
    await flush(BOT_DELAY_MS.normal);

    const summary = screen.getByTestId('practice-summary');
    expect(summary).toHaveTextContent('You out-played Mona in the toy duel.');
    expect(useProgress.getState().games.toy?.exampleDone).toBe(true);
    expect(within(summary).getByRole('link', { name: 'Play for Jeet' })).toHaveAttribute(
      'href',
      '/games/toy/play',
    );
    expect(within(summary).getByRole('link', { name: 'Take the quiz' })).toHaveAttribute(
      'href',
      '/games/toy/quiz',
    );
    expect(within(summary).getByTestId('rating-prompt')).toBeInTheDocument();
    expect(within(summary).getByText('How was this lesson?')).toBeInTheDocument();
    // No titles, roasts or Jeet in practice.
    expect(screen.queryByTestId('celebration')).not.toBeInTheDocument();
    expect(useStats.getState().played).toBe(0);
    expect(useWallet.getState().balance).toBe(1000);
  });

  it('"Try another practice hand" restarts on the next seed', async () => {
    await renderPractice();
    fireEvent.click(screen.getByTestId('move-play'));
    await flush(BOT_DELAY_MS.normal);
    fireEvent.click(screen.getByTestId('practice-again'));
    await flush();
    expect(screen.queryByTestId('practice-summary')).not.toBeInTheDocument();
    expect(screen.getByTestId('practice-intro')).toBeInTheDocument();
    expect(screen.getByTestId('toy-dealt')).toHaveTextContent(dealtFor(8));
    expect(screen.getByRole('region', { name: 'Toy Duel practice table' })).toHaveFocus();

    fireEvent.click(screen.getByTestId('move-play'));
    await flush(BOT_DELAY_MS.normal);
    fireEvent.click(screen.getByTestId('practice-again'));
    await flush();
    expect(screen.getByTestId('toy-dealt')).toHaveTextContent(dealtFor(9));
  });

  it('rotates the end-of-hand tip from one practice hand to the next', async () => {
    await renderPractice();
    const tips: string[] = [];
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByTestId('move-play'));
      await flush(BOT_DELAY_MS.normal);
      tips.push(screen.getByTestId('practice-tip').textContent ?? '');
      fireEvent.click(screen.getByTestId('practice-again'));
      await flush();
    }
    expect(new Set(tips).size).toBe(3);
  });

  it('cheers a lost practice hand differently from a won one', async () => {
    registry.module = makeToyModule({ outcome: 'loss' }) as unknown as GameModule;
    await renderPractice();
    fireEvent.click(screen.getByTestId('move-play'));
    await flush(BOT_DELAY_MS.normal);
    const summary = screen.getByTestId('practice-summary');
    expect(within(summary).getByRole('heading', { level: 2 })).toHaveTextContent(
      'That’s how you learn!',
    );
    expect(summary).toHaveTextContent('Mona edged the toy duel this time.');
  });
});
