/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * seeded the way the play shell (?seed=<n>, a string) and the practice hand (a number) do,
 * with the bots drawing from the controller's `bot-<seed>` stream at the normal level and
 * the learner following the coach.
 */
import { createRng } from '@/games/core/rng';
import { type Difficulty, type GameConfig } from '@/games/core/types';
import { rankHand, teenPattiEngine as E, type TeenPattiMove, type TeenPattiState } from './engine';
import teenPattiModule from './index';
import { TEENPATTI_SEEDS } from './seeds';

/** What GameShell passes for a 5-Jeet bet from a full wallet (affordableUnits is ignored). */
const PLAY_CONFIG: GameConfig = { ...teenPattiModule.defaultConfig, affordableUnits: 136 };

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): TeenPattiState {
  return E.setup(config, createRng(seed));
}

interface Played {
  start: TeenPattiState;
  end: TeenPattiState;
  /** Every move as "<seat>:<type>". */
  moves: string[];
}

/** Play a seed out like the controller: the learner follows the coach, bots share one rng. */
function playOut(seed: number | string, difficulty: Difficulty = 'normal'): Played {
  const start = dealSeed(seed);
  const bot = createRng(`bot-${String(seed)}`);
  let s = start;
  const moves: string[] = [];
  for (let i = 0; i < 200 && !E.isOver(s); i++) {
    const p = E.currentPlayer(s)!;
    const move: TeenPattiMove =
      p === 0 ? (E.coach(s, 0).suggestion as TeenPattiMove) : E.botMove(s, p, difficulty, bot);
    moves.push(`${p}:${move.type}`);
    s = E.applyMove(s, move);
  }
  return { start, end: s, moves };
}

const learnerMoves = (p: Played) => p.moves.filter((m) => m.startsWith('0:'));

describe('TEENPATTI_SEEDS', () => {
  it('deal the same cards from the URL string, the number and the practice config', () => {
    for (const seed of Object.values(TEENPATTI_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      const practice = dealSeed(seed, {
        ...teenPattiModule.defaultConfig,
        ...teenPattiModule.practice.config,
      });
      expect(practice).toEqual(E.setup(teenPattiModule.defaultConfig, createRng(seed)));
      expect(practice.hands).toEqual(fromNumber.hands);
      expect(practice.dealer).toBe(fromNumber.dealer);
      // The whole hand replays identically from the string seed too.
      expect(playOut(String(seed)).moves).toEqual(playOut(seed).moves);
    }
  });

  it('practice: blind and seen prices, a see, a raise, a pack and a show the learner wins', () => {
    expect(teenPattiModule.practice.seed).toBe(TEENPATTI_SEEDS.practice);
    const played = playOut(TEENPATTI_SEEDS.practice);
    const { start, end } = played;
    expect(start.players).toBe(3);
    expect(rankHand(start.hands[0]!).name).toBe('Pair of Kings');
    expect(played.moves).toEqual([
      '2:raise',
      '0:chaal',
      '1:chaal',
      '2:chaal',
      '0:see',
      '0:raise',
      '1:see',
      '1:pack',
      '2:see',
      '2:show',
    ]);
    expect(learnerMoves(played)).toHaveLength(3);
    // The coach's first situation: blind, after a blind raise.
    const first = E.applyMove(start, { type: 'raise' });
    expect(E.coach(first, 0).situation).toContain('a blind chaal costs 2 boots');
    expect(end.outcome).toMatchObject({ kind: 'show', winners: [0], asker: 2 });
    const r = teenPattiModule.engine.result(end);
    expect(r).toMatchObject({ humanOutcome: 'win', humanNetUnits: 16 });
    expect(r.summary).toBe(
      "Bindiya Bioscope asked for a show: your Pair of Kings beat Bindiya Bioscope's Pair of Fours, so you won the 27-boot pot.",
    );
  });

  it('blindWin: one blind chaal, and the unseen hand wins the show', () => {
    const played = playOut(TEENPATTI_SEEDS.blindWin);
    expect(learnerMoves(played)).toEqual(['0:chaal']);
    expect(played.end.seen[0]).toBe(false);
    expect(played.end.outcome).toMatchObject({ kind: 'show', winners: [0], asker: 2 });
    const r = E.result(played.end);
    expect(r).toMatchObject({ humanOutcome: 'win', humanNetUnits: 6 });
    expect(r.flags.tags).toContain('blind-win');
  });

  it('everyonePacks: one blind chaal, then both bots pack', () => {
    const played = playOut(TEENPATTI_SEEDS.everyonePacks);
    expect(learnerMoves(played)).toEqual(['0:chaal']);
    expect(played.end.outcome).toMatchObject({ kind: 'last-standing', winners: [0] });
    expect(played.end.packed).toEqual([false, true, true]);
    expect(E.result(played.end)).toMatchObject({ humanOutcome: 'win', humanNetUnits: 4 });
  });

  it('quickLoss: one blind chaal, and a bot wins the show it asks for', () => {
    const played = playOut(TEENPATTI_SEEDS.quickLoss);
    expect(learnerMoves(played)).toEqual(['0:chaal']);
    expect(played.end.outcome).toMatchObject({ kind: 'show', winners: [2], asker: 2 });
    expect(played.end.outcome?.showdown).toEqual([0, 2]);
    const r = E.result(played.end);
    expect(r).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -2 });
    expect(r.flags.closeFinish).toBe(true);
  });

  it('packed: the coach packs a weak hand after seeing it', () => {
    const played = playOut(TEENPATTI_SEEDS.packed);
    expect(learnerMoves(played)).toEqual(['0:chaal', '0:see', '0:pack']);
    expect(rankHand(played.start.hands[0]!).category).toBe('high-card');
    const r = E.result(played.end);
    expect(r).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -2 });
    expect(r.flags.folded).toBe(true);
  });

  it('potLimit: the pot reaches 64 boots, everyone shows and the learner loses 36', () => {
    const played = playOut(TEENPATTI_SEEDS.potLimit);
    expect(rankHand(played.start.hands[0]!).category).toBe('colour');
    expect(learnerMoves(played)).toEqual(['0:chaal', '0:see', '0:raise', '0:raise', '0:chaal']);
    expect(played.end.pot).toBe(64);
    expect(played.end.outcome).toMatchObject({ kind: 'pot-limit', winners: [1] });
    expect(played.end.outcome?.showdown).toEqual([0, 1]);
    const r = E.result(played.end);
    expect(r).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -36 });
    expect(r.flags.bigPot).toBe(true);
  });
});
