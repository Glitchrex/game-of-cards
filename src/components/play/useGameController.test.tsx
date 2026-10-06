// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { type GameModule } from '@/games/core/module';
import { type GameResult } from '@/games/core/types';
import {
  makeToyModule,
  TOY_CHEAT_REASON,
  type ToyMove,
  type ToyState,
} from './__fixtures__/toy-game';
import { personalise, useGameController, type ControllerOptions } from './useGameController';

function setup(
  overrides: Partial<ControllerOptions<ToyState, ToyMove>> = {},
  mod: GameModule<ToyState, ToyMove> = makeToyModule({ rounds: 2 }),
) {
  return renderHook((props: Partial<ControllerOptions<ToyState, ToyMove>>) =>
    useGameController<ToyState, ToyMove>({
      module: mod,
      config: mod.defaultConfig,
      seed: 1,
      difficulty: 'normal',
      botDelayMs: 500,
      coachMode: false,
      ...overrides,
      ...props,
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useGameController', () => {
  it('applies legal moves, logs them with persona names, and runs bots after the delay', () => {
    const { result } = setup();
    expect(result.current.current).toBe(0);
    expect(result.current.busy).toBe(false);
    act(() => {
      result.current.attempt({ kind: 'play' });
    });
    expect(result.current.thinking).toBe(1);
    expect(result.current.busy).toBe(true);
    expect(result.current.log.map((e) => e.text)).toEqual(['You play.']);
    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.state.botPlays).toBe(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.state.botPlays).toBe(1);
    expect(result.current.log.at(-1)?.text).toBe('Mona replies.');
    expect(result.current.nameOf(1)).toBe('Mona');
    expect(result.current.nameOf(0)).toBe('You');
  });

  it('rejects illegal moves with a reason and bumps errorSeq even for a repeat', () => {
    const { result } = setup();
    let check = { ok: true } as { ok: boolean; reason?: string };
    act(() => {
      check = result.current.attempt({ kind: 'cheat' });
    });
    expect(check).toEqual({ ok: false, reason: TOY_CHEAT_REASON });
    expect(result.current.lastError).toBe(TOY_CHEAT_REASON);
    const first = result.current.errorSeq;
    act(() => {
      result.current.attempt({ kind: 'cheat' });
    });
    expect(result.current.errorSeq).toBe(first + 1);
    expect(result.current.state.humanPlays).toBe(0);
    act(() => {
      result.current.clearError();
    });
    expect(result.current.lastError).toBeNull();
  });

  it('explains why the learner cannot move when paused, on a bot turn, or after the end', () => {
    const paused = setup({ paused: true });
    act(() => {
      paused.result.current.attempt({ kind: 'play' });
    });
    expect(paused.result.current.lastError).toBe('Place your bet first.');
    expect(paused.result.current.thinking).toBeNull();

    const { result } = setup();
    act(() => {
      result.current.attempt({ kind: 'play' });
    });
    act(() => {
      result.current.attempt({ kind: 'pass' });
    });
    expect(result.current.lastError).toBe('Hold on — it’s Mona’s turn.');
  });

  it('highlights legal moves and reveals the suggestion only in coach mode', () => {
    const { result } = setup({ coachMode: true });
    expect([...result.current.highlight].sort()).toEqual(['pass', 'play']);
    expect(result.current.advice?.why).toBe('Playing keeps the pressure on Mona.');
    expect(result.current.suggestedKey).toBeNull();
    act(() => {
      result.current.showHint();
    });
    expect(result.current.suggestedKey).toBe('play');
    act(() => {
      result.current.attempt({ kind: 'pass' });
    });
    expect(result.current.suggestedKey).toBeNull();
    const plain = setup({ coachMode: false });
    expect(plain.result.current.highlight.size).toBe(0);
  });

  it('fires onOver exactly once and restarts cleanly', () => {
    const onOver = vi.fn<(r: GameResult, s: ToyState) => void>();
    const mod = makeToyModule({ rounds: 1, outcome: 'loss' });
    const { result } = setup({ onOver }, mod);
    act(() => {
      result.current.attempt({ kind: 'play' });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.over).toBe(true);
    expect(result.current.result?.humanOutcome).toBe('loss');
    expect(onOver).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.restart(2);
    });
    expect(result.current.over).toBe(false);
    expect(result.current.log).toEqual([]);
    act(() => {
      result.current.attempt({ kind: 'play' });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(onOver).toHaveBeenCalledTimes(2);
  });

  it('falls back to a legal move if a bot throws, so the table never freezes', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const base = makeToyModule({ rounds: 1 });
    const mod: GameModule<ToyState, ToyMove> = {
      ...base,
      engine: {
        ...base.engine,
        botMove: () => {
          throw new Error('bot bug');
        },
      },
    };
    const { result } = setup({}, mod);
    act(() => {
      result.current.attempt({ kind: 'play' });
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current.over).toBe(true);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('personalise', () => {
  it('swaps "Player N" for persona names', () => {
    const bots = makeToyModule().bots;
    expect(personalise('Player 1 plays the 7 of Clubs.', bots)).toBe('Mona plays the 7 of Clubs.');
    expect(personalise('Player 4 waits.', bots)).toBe('Player 4 waits.');
  });
});
