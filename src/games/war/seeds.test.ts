/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * seeded the way the play shell (?seed=<n>, a string) and the practice hand (a number, with
 * the practice config) do.
 */
import { createRng } from '@/games/core/rng';
import { type GameConfig } from '@/games/core/types';
import { warEngine as E, type WarState } from './engine';
import warModule from './index';
import { WAR_PRACTICE_BATTLES, WAR_SEEDS } from './seeds';
import { playOut } from './test-helpers';

/** What GameShell passes to setup (it adds what the wallet can cover; War ignores it). */
const PLAY_CONFIG: GameConfig = { ...warModule.defaultConfig, affordableUnits: 99 };
/** What PracticeHand passes to setup. */
const PRACTICE_CONFIG: GameConfig = { ...warModule.defaultConfig, ...warModule.practice.config };

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): WarState {
  return E.setup(config, createRng(seed));
}

/** Play the whole game (the learner only ever flips) and return the final state. */
function finish(seed: number | string, config: GameConfig = PLAY_CONFIG): WarState {
  return playOut(dealSeed(seed, config)).at(-1)!;
}

describe('WAR_SEEDS', () => {
  it('deal the same piles from the URL string, the number and any wallet', () => {
    for (const seed of Object.values(WAR_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      expect(dealSeed(seed, { ...PLAY_CONFIG, affordableUnits: 0 })).toEqual(fromNumber);
      // The practice config only shortens the game; the deal is the same.
      expect(dealSeed(seed, PRACTICE_CONFIG).piles).toEqual(fromNumber.piles);
    }
  });

  it('practice: a short coached game with a war won early and a win at the cap', () => {
    expect(warModule.practice.seed).toBe(WAR_SEEDS.practice);
    expect(PRACTICE_CONFIG).toEqual({ players: 2, options: { maxBattles: WAR_PRACTICE_BATTLES } });
    const s = dealSeed(WAR_SEEDS.practice, PRACTICE_CONFIG);
    expect(s.maxBattles).toBe(20);
    expect(E.coach(s, 0).situation).toContain('Flip to start battle 1 of 20');
    expect(E.coach(s, 0).suggestion).toEqual({ type: 'flip' });

    const states = playOut(s);
    const end = states.at(-1)!;
    // Following the coach (Flip every time) ends the game in exactly 20 moves.
    expect(states).toHaveLength(21);
    const battles = end.history;
    expect(battles[0]).toMatchObject({ winner: 0, wars: 0 });
    expect(battles[1]).toMatchObject({ winner: 0, wars: 0 });
    // Battle 3: two Aces tie → war, won by the learner for all 10 cards.
    expect(states[3]!.lastBattle).toMatchObject({
      number: 3,
      wars: 1,
      winner: 0,
      decidedBy: 'higher-card',
    });
    expect(states[3]!.lastBattle!.rounds.map((r) => r.up)).toEqual([
      ['AS', 'AD'],
      ['AH', 'JC'],
    ]);
    expect(states[3]!.lastBattle!.won).toHaveLength(10);
    // Luck cuts both ways: the opponent wins the next two battles.
    expect(battles[3]!.winner).toBe(1);
    expect(battles[4]!.winner).toBe(1);

    const r = E.result(end);
    expect(end.endReason).toBe('battle-cap');
    expect(r).toMatchObject({ humanOutcome: 'win', humanNetUnits: 1, scores: [36, 16] });
    expect(r.summary).toBe("After 20 battles you held 36 cards to Player 1's 16, so you win!");
  });

  it('practice: "Try another practice hand" seeds also finish within the 20-battle cap', () => {
    for (let next = 1; next <= 5; next++) {
      const end = finish(WAR_SEEDS.practice + next, PRACTICE_CONFIG);
      expect(end.battles).toBeLessThanOrEqual(WAR_PRACTICE_BATTLES);
      expect(E.isOver(end)).toBe(true);
    }
  });

  it('quickWin: three wars won and all 52 cards in 18 battles', () => {
    const end = finish(WAR_SEEDS.quickWin);
    expect(end).toMatchObject({ battles: 18, endReason: 'all-cards', winner: 0 });
    expect(end.piles[0]).toHaveLength(52);
    expect(end.history.filter((h) => h.wars > 0 && h.winner === 0)).toHaveLength(3);
    const r = E.result(end);
    expect(r).toMatchObject({ humanOutcome: 'win', humanNetUnits: 1 });
    expect(r.summary).toBe('You won all 52 cards in 18 battles — total victory!');
  });

  it('quickLoss: a triple war, a short-handed last war, and all 52 cards lost in 11 battles', () => {
    const states = playOut(dealSeed(WAR_SEEDS.quickLoss));
    const end = states.at(-1)!;
    expect(end).toMatchObject({ battles: 11, endReason: 'all-cards', winner: 1 });
    expect(states[5]!.lastBattle).toMatchObject({ wars: 3, winner: 1 });
    expect(states[5]!.lastBattle!.won).toHaveLength(26);
    // The last war: the learner had only 3 cards, so 2 went face down.
    const last = end.lastBattle!;
    expect(last.wars).toBe(1);
    expect(last.rounds[1]!.down[0]).toHaveLength(2);
    expect(last.rounds[1]!.down[1]).toHaveLength(3);
    expect(E.result(end)).toMatchObject({ humanOutcome: 'loss', humanNetUnits: -1 });
  });

  it('capWin: 60 battles, then the bigger pile wins (38–14)', () => {
    const end = finish(WAR_SEEDS.capWin);
    expect(end).toMatchObject({ battles: 60, endReason: 'battle-cap', winner: 0 });
    expect(E.result(end)).toMatchObject({ humanOutcome: 'win', scores: [38, 14] });
  });

  it('push: battle 1 is a war, and 60 battles later the piles are level', () => {
    const s = dealSeed(WAR_SEEDS.push);
    const first = E.applyMove(s, { type: 'flip' });
    expect(first.lastBattle).toMatchObject({ wars: 1, winner: 0 });
    const end = finish(WAR_SEEDS.push);
    expect(end).toMatchObject({ battles: 60, endReason: 'battle-cap', winner: null });
    const r = E.result(end);
    expect(r).toMatchObject({ humanOutcome: 'push', humanNetUnits: 0, scores: [26, 26] });
    expect(r.flags.closeFinish).toBe(true);
  });

  it('luckyLastCard: battle 60 is a war of Aces that turns a level game into a win', () => {
    const end = finish(WAR_SEEDS.luckyLastCard);
    expect(end.battles).toBe(60);
    expect(end.lastBattle).toMatchObject({ number: 60, wars: 1, winner: 0 });
    expect(end.lastBattle!.rounds[0]!.up).toEqual(['AC', 'AS']);
    const r = E.result(end);
    expect(r).toMatchObject({ humanOutcome: 'win', scores: [36, 16] });
    expect(r.flags.luckyLastCard).toBe(true);
  });
});
