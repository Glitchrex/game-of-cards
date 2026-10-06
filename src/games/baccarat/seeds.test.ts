/**
 * The curated seeds deal exactly what their names promise — checked with the real engine,
 * seeded the way the play shell (?seed=<n>, a string) and the practice hand (a number) do.
 */
import { createRng } from '@/games/core/rng';
import { type GameConfig } from '@/games/core/types';
import {
  baccaratEngine as E,
  handTotal,
  isNatural,
  LEARNER,
  PRACTICE_SEED,
  settle,
  type BaccaratState,
  type BetOn,
} from './engine';
import baccaratModule from './index';
import { BACCARAT_SEEDS } from './seeds';

/** What GameShell passes for a 10-Jeet bet from a full wallet. */
const PLAY_CONFIG: GameConfig = { ...baccaratModule.defaultConfig, affordableUnits: 99 };
const PRACTICE_CONFIG: GameConfig = {
  ...baccaratModule.defaultConfig,
  ...baccaratModule.practice.config,
};

function dealSeed(seed: number | string, config: GameConfig = PLAY_CONFIG): BaccaratState {
  return E.setup(config, createRng(seed));
}

/** Bet on `on`, then let the croupier deal the whole coup. Returns every state on the way. */
function playOut(seed: number | string, on: BetOn, config = PLAY_CONFIG) {
  let state = E.applyMove(dealSeed(seed, config), { type: 'bet', on });
  const states = [state];
  while (!E.isOver(state)) {
    state = E.applyMove(state, { type: 'deal' });
    states.push(state);
  }
  return { final: state, deals: states.length - 1 };
}

describe('BACCARAT_SEEDS', () => {
  it('deal the same shoe from the URL string, the number, the practice config and any wallet', () => {
    for (const seed of Object.values(BACCARAT_SEEDS)) {
      const fromNumber = dealSeed(seed);
      expect(dealSeed(String(seed))).toEqual(fromNumber);
      expect(dealSeed(seed, PRACTICE_CONFIG)).toEqual(fromNumber);
      expect(dealSeed(seed, { ...PLAY_CONFIG, affordableUnits: 0 })).toEqual(fromNumber);
      // The cards never depend on the bet.
      const coups = (['player', 'banker', 'tie'] as const).map((on) => playOut(seed, on).final);
      for (const coup of coups) {
        expect(coup.player).toEqual(coups[0]!.player);
        expect(coup.banker).toEqual(coups[0]!.banker);
      }
    }
  });

  it('practice: the module uses it, it is the engine’s practice seed, and the coach’s bet wins', () => {
    expect(baccaratModule.practice.seed).toBe(BACCARAT_SEEDS.practice);
    expect(BACCARAT_SEEDS.practice).toBe(PRACTICE_SEED);
    const start = dealSeed(BACCARAT_SEEDS.practice, PRACTICE_CONFIG);
    const advice = E.coach(start, LEARNER);
    expect(advice.suggestion).toEqual({ type: 'bet', on: 'banker' });

    const { final, deals } = playOut(BACCARAT_SEEDS.practice, 'banker', PRACTICE_CONFIG);
    expect(final.player).toEqual(['KC', '2D', '3D']);
    expect(final.banker).toEqual(['JC', '4D', '5C']);
    // Six cards: both third-card rules get used, Banker's via the table (4 vs a third card 3).
    expect(deals).toBe(6);
    expect(isNatural(final.player.slice(0, 2)) || isNatural(final.banker.slice(0, 2))).toBe(false);
    expect(handTotal(final.banker.slice(0, 2))).toBe(4);
    expect(settle(final)).toMatchObject({
      winner: 'banker',
      bankerTotal: 9,
      playerTotal: 5,
      outcome: 'win',
      net: 0.95,
    });
  });

  it('bankerNatural: a two-card natural 9 for Banker ends the coup after four cards', () => {
    const { final, deals } = playOut(BACCARAT_SEEDS.bankerNatural, 'banker');
    expect(deals).toBe(4);
    expect(isNatural(final.banker)).toBe(true);
    expect(handTotal(final.banker)).toBe(9);
    expect(isNatural(final.player)).toBe(false);
    expect(settle(final)).toMatchObject({ winner: 'banker', outcome: 'win', net: 0.95 });
    expect(E.result(final).flags.perfect).toBe(true);
  });

  it('playerNatural: a natural 8 for Player beats a Banker bet at once (and pays a Player bet)', () => {
    const { final, deals } = playOut(BACCARAT_SEEDS.playerNatural, 'banker');
    expect(deals).toBe(4);
    expect(isNatural(final.player)).toBe(true);
    expect(handTotal(final.player)).toBe(8);
    expect(settle(final)).toMatchObject({ winner: 'player', outcome: 'loss', net: -1 });
    expect(settle(playOut(BACCARAT_SEEDS.playerNatural, 'player').final).net).toBe(1);
  });

  it('tie: both hands finish on 8 — a Banker bet pushes, a Tie bet pays 8 to 1', () => {
    const { final } = playOut(BACCARAT_SEEDS.tie, 'banker');
    expect(final.player).toHaveLength(3);
    expect(final.banker).toHaveLength(3);
    expect(settle(final)).toMatchObject({
      winner: 'tie',
      playerTotal: 8,
      bankerTotal: 8,
      outcome: 'push',
      net: 0,
    });
    expect(settle(playOut(BACCARAT_SEEDS.tie, 'tie').final)).toMatchObject({
      outcome: 'win',
      net: 8,
    });
  });

  it('bothStand: Player stands on 6 and Banker on 7 — four cards, Banker wins 7 to 6', () => {
    const { final, deals } = playOut(BACCARAT_SEEDS.bothStand, 'banker');
    expect(deals).toBe(4);
    expect(isNatural(final.player) || isNatural(final.banker)).toBe(false);
    expect(settle(final)).toMatchObject({ winner: 'banker', playerTotal: 6, bankerTotal: 7 });
    expect(E.result(final).flags.closeFinish).toBe(true);
  });

  it('playerStandsBankerDraws: Player stands on 7, Banker draws on 5 and makes 0', () => {
    const { final, deals } = playOut(BACCARAT_SEEDS.playerStandsBankerDraws, 'player');
    expect(deals).toBe(5);
    expect(final.player).toHaveLength(2);
    expect(final.banker).toHaveLength(3);
    expect(handTotal(final.banker.slice(0, 2))).toBe(5);
    expect(settle(final)).toMatchObject({
      winner: 'player',
      playerTotal: 7,
      bankerTotal: 0,
      outcome: 'win',
      net: 1,
    });
  });
});
