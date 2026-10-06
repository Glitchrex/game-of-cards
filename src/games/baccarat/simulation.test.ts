/**
 * Seeded learner-bot vs dealer simulations. Besides the generic contract checks in
 * simulate() (legal bot moves, no input mutation, termination…), every step is checked
 * against an independent implementation of the Punto Banco rules written only for this
 * test (it does not use the engine's helpers): every card is accounted for exactly once,
 * each deal moves the top card of the shoe to the hand the written rules name, and the
 * coup stops exactly when the rules say. Every result — payout, outcome and flags — is
 * re-derived from the final state. A large run then compares the empirical Banker /
 * Player / Tie frequencies with the exact values.
 */
import { describe, expect, it } from 'vitest';
import { makeDeck } from '@/games/core/cards';
import { simulate, type SimulationSummary } from '@/games/core/simulate';
import type { GameConfig, GameResult } from '@/games/core/types';
import {
  baccaratEngine,
  COUP_ODDS,
  DEALER,
  LEARNER,
  MAX_GAME_MOVES,
  type BaccaratState,
} from './engine';

// ---------------------------------------------------------------------------
// Independent reference rules (deliberately not using the engine's helpers).
// ---------------------------------------------------------------------------

type RefHand = 'player' | 'banker';
type RefWinner = RefHand | 'tie';

const value = (c: string): number => {
  const r = c.charAt(0);
  if (r === 'A') return 1;
  if ('TJQK'.includes(r)) return 0;
  return Number(r);
};
const total = (cards: readonly string[]): number =>
  cards.reduce((sum, c) => sum + value(c), 0) % 10;
const natural = (cards: readonly string[]) => cards.length === 2 && total(cards) >= 8;

/** Banker's tableau as printed on a casino layout: row = Banker total, column = "-" or 0–9. */
const TABLEAU: Record<number, string> = {
  //  -0123456789
  0: 'DDDDDDDDDDD',
  1: 'DDDDDDDDDDD',
  2: 'DDDDDDDDDDD',
  3: 'DDDDDDDDDSD',
  4: 'DSSDDDDDDSS',
  5: 'DSSSSDDDDSS',
  6: 'SSSSSSSDDSS',
  7: 'SSSSSSSSSSS',
};

/** Which hand the written rules give the next card to, or null when the coup is complete. */
function refNext(player: readonly string[], banker: readonly string[]): RefHand | null {
  const order: RefHand[] = ['player', 'banker', 'player', 'banker'];
  const dealt = player.length + banker.length;
  if (dealt < 4) return order[dealt]!;
  if (natural(player.slice(0, 2)) || natural(banker.slice(0, 2))) return null;
  const p2 = total(player.slice(0, 2));
  if (player.length === 2 && banker.length === 2 && p2 <= 5) return 'player';
  if (banker.length === 3) return null;
  const third = player[2];
  const column = third === undefined ? 0 : value(third) + 1;
  return TABLEAU[total(banker.slice(0, 2))]?.[column] === 'D' ? 'banker' : null;
}

const refWinner = (p: number, b: number): RefWinner =>
  p > b ? 'player' : b > p ? 'banker' : 'tie';

const PAYS = { player: 1, banker: 0.95, tie: 8 } as const;

interface RefOutcome {
  winner: RefWinner;
  p: number;
  b: number;
  net: number;
}

function refSettle(s: BaccaratState): RefOutcome {
  if (s.bet === null) throw new Error('reference: no bet was placed');
  const p = total(s.player);
  const b = total(s.banker);
  const winner = refWinner(p, b);
  const net = s.bet === winner ? PAYS[s.bet] : winner === 'tie' ? 0 : -1;
  return { winner, p, b, net };
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

function fail(step: number, message: string, s: BaccaratState): never {
  throw new Error(
    `[step ${step}] ${message}\n${JSON.stringify({ ...s, shoe: `${s.shoe.length} cards` })}`,
  );
}

const fullShoeCounts = new Map<number, Map<string, number>>();
function expectedCounts(decks: number): Map<string, number> {
  let m = fullShoeCounts.get(decks);
  if (!m) {
    m = new Map();
    for (const c of makeDeck({ copies: decks })) m.set(c, (m.get(c) ?? 0) + 1);
    fullShoeCounts.set(decks, m);
  }
  return m;
}

/** Every card of the `decks` complete decks is in exactly one place: shoe, Player or Banker. */
function checkConservation(s: BaccaratState, step: number): void {
  const expected = expectedCounts(s.decks);
  const seen = new Map<string, number>();
  for (const c of [...s.shoe, ...s.player, ...s.banker]) seen.set(c, (seen.get(c) ?? 0) + 1);
  if (s.shoe.length + s.player.length + s.banker.length !== 52 * s.decks) {
    fail(step, 'cards were created or lost', s);
  }
  for (const [c, n] of expected) {
    if (seen.get(c) !== n) fail(step, `${c} appears ${seen.get(c) ?? 0} times, not ${n}`, s);
  }
  if (seen.size !== expected.size) fail(step, 'a foreign card appeared', s);
}

/** Checked after every move; remembers the previous state of the current game. */
function makeStepInvariant() {
  let prev: BaccaratState | null = null;
  return (s: BaccaratState, step: number): void => {
    checkConservation(s, step);
    if (step === 1) {
      // The first move is the learner's bet: no card is dealt yet.
      if (s.bet === null || s.phase !== 'deal') fail(step, 'the first move must be the bet', s);
      if (s.player.length + s.banker.length !== 0) fail(step, 'a card was dealt with the bet', s);
    } else {
      if (prev === null) fail(step, 'missing previous state', s);
      const due = refNext(prev.player, prev.banker);
      if (due === null) fail(step, 'a card was dealt after the coup was complete', s);
      const top = prev.shoe[0];
      if (s.shoe.length !== prev.shoe.length - 1) fail(step, 'a deal must use one card', s);
      const grew = s[due];
      if (grew.length !== prev[due].length + 1 || grew.at(-1) !== top) {
        fail(step, `the top card ${top} should have gone to ${due}`, s);
      }
      const other = due === 'player' ? 'banker' : 'player';
      if (s[other].length !== prev[other].length) fail(step, `${other} changed out of turn`, s);
      if (s.bet !== prev.bet) fail(step, 'the bet changed during the deal', s);
    }
    const complete = refNext(s.player, s.banker) === null;
    if (complete !== (s.phase === 'over')) {
      fail(step, `phase ${s.phase} but the written rules say complete=${complete}`, s);
    }
    if (s.player.length > 3 || s.banker.length > 3) fail(step, 'a hand has four cards', s);
    if (complete) {
      if (s.winner !== refWinner(total(s.player), total(s.banker))) fail(step, 'wrong winner', s);
      if (baccaratEngine.currentPlayer(s) !== null) fail(step, 'currentPlayer after the end', s);
    } else {
      if (s.winner !== null) fail(step, 'a winner was named mid-coup', s);
      if (baccaratEngine.currentPlayer(s) !== DEALER) fail(step, 'the dealer must be dealing', s);
    }
    prev = s;
  };
}

/** Totals after four cards and after each third card, rebuilt independently. */
function refHistory(s: BaccaratState): [number, number][] {
  const p2 = total(s.player.slice(0, 2));
  const b2 = total(s.banker.slice(0, 2));
  const out: [number, number][] = [[p2, b2]];
  if (s.player.length === 3) out.push([total(s.player), b2]);
  if (s.banker.length === 3) out.push([total(s.player), total(s.banker)]);
  return out;
}

interface Tally {
  games: number;
  player: number;
  banker: number;
  tie: number;
  bets: Record<'player' | 'banker' | 'tie', number>;
  naturals: number;
  sixCardCoups: number;
  flags: Record<'perfect' | 'luckyLastCard' | 'comeback' | 'closeFinish' | 'bigPot', number>;
}

const newTally = (): Tally => ({
  games: 0,
  player: 0,
  banker: 0,
  tie: 0,
  bets: { player: 0, banker: 0, tie: 0 },
  naturals: 0,
  sixCardCoups: 0,
  flags: { perfect: 0, luckyLastCard: 0, comeback: 0, closeFinish: 0, bigPot: 0 },
});

function tallyGame(s: BaccaratState, ref: RefOutcome, r: GameResult, t: Tally): void {
  t.games++;
  t[ref.winner]++;
  if (s.bet) t.bets[s.bet]++;
  if (natural(s.player) || natural(s.banker)) t.naturals++;
  if (s.player.length + s.banker.length === 6) t.sixCardCoups++;
  for (const f of Object.keys(t.flags) as (keyof Tally['flags'])[]) if (r.flags[f]) t.flags[f]++;
}

function makeOnGameEnd(t: Tally) {
  return (s: BaccaratState, r: GameResult, seed: number): void => {
    const at = `[seed ${seed}]`;
    const ref = refSettle(s);
    const bet = s.bet!;
    // Scoring re-derived independently.
    expect(s.winner, `${at} winner`).toBe(ref.winner);
    expect(r.humanNetUnits, `${at} net`).toBe(ref.net);
    const outcome = ref.net > 0 ? 'win' : ref.net < 0 ? 'loss' : 'push';
    expect(r.humanOutcome, `${at} outcome`).toBe(outcome);
    expect(r.winners).toEqual(outcome === 'win' ? [LEARNER] : outcome === 'loss' ? [DEALER] : []);
    // Payout bounds: lose at most the one escrowed unit, win at most 8 to 1.
    expect([-1, 0, 0.95, 1, 8]).toContain(r.humanNetUnits);
    expect(r.humanNetUnits).toBeGreaterThanOrEqual(-1);
    expect(r.humanNetUnits).toBeLessThanOrEqual(8);
    if (r.humanNetUnits === 0) expect(ref.winner).toBe('tie');
    // Chip conservation: the escrowed unit plus the net comes back (never negative), and
    // what the learner wins the house pays, unit for unit.
    expect(1 + r.humanNetUnits).toBeGreaterThanOrEqual(0);
    const houseNet = -ref.net;
    expect(houseNet + r.humanNetUnits).toBe(0);
    // Flags re-derived from what happened.
    const won = outcome === 'win';
    const nine = (cards: string[]) => natural(cards) && total(cards) === 9;
    const perfect = won && (bet === 'tie' ? nine(s.player) && nine(s.banker) : nine(s[bet]));
    expect(r.flags.perfect, `${at} perfect`).toBe(perfect);
    expect(r.flags.closeFinish, `${at} closeFinish`).toBe(Math.abs(ref.p - ref.b) === 1);
    expect(r.flags.bigPot).toBe(bet === 'tie' && ref.winner === 'tie');
    expect(r.flags.bust).toBe(false);
    expect(r.flags.folded).toBe(false);
    const hasNatural = natural(s.player) || natural(s.banker);
    expect(r.flags.tags?.includes('natural')).toBe(hasNatural);
    expect(r.flags.tags?.includes('tie')).toBe(ref.winner === 'tie');
    const history = refHistory(s);
    let lucky: boolean;
    if (ref.winner === 'tie') {
      const before = history[history.length - 2];
      lucky = before !== undefined && before[0] !== before[1];
    } else {
      const mine = s[ref.winner];
      const theirs = ref.winner === 'player' ? ref.b : ref.p;
      lucky = mine.length === 3 && total(mine.slice(0, 2)) <= theirs;
    }
    expect(r.flags.luckyLastCard, `${at} luckyLastCard`).toBe(lucky);
    const behind = history.some(([p, b]) =>
      bet === 'tie' ? p !== b : bet === 'player' ? p < b : b < p,
    );
    expect(r.flags.comeback, `${at} comeback`).toBe(won && behind);
    // The summary names the result.
    if (ref.winner === 'tie') expect(r.summary).toContain(`Both hands finished on ${ref.p}`);
    else {
      const [hi, lo] = ref.winner === 'player' ? [ref.p, ref.b] : [ref.b, ref.p];
      const name = ref.winner === 'player' ? 'Player' : 'Banker';
      expect(r.summary).toContain(`${name} won ${hi} to ${lo}`);
    }
    tallyGame(s, ref, r, t);
  };
}

/** Vary the shoe size and the wallet (which has no effect: there are no extra bets). */
function variedConfig(seed: number): GameConfig {
  const decks = [8, 8, 6, 1, 2, 8, 4][seed % 7];
  const affordable = [undefined, 0, 1, 3, undefined][seed % 5];
  return { players: 2, affordableUnits: affordable, options: { decks } };
}

function report(label: string, sum: SimulationSummary, t: Tally): void {
  const pct = (n: number) => `${((100 * n) / t.games).toFixed(2)}%`;
  console.info(
    `[baccarat sim] ${label}: ${sum.games} games, avg ${(sum.totalMoves / sum.games).toFixed(2)} ` +
      `moves (max ${sum.maxMovesInAGame}), win/loss/push ${sum.outcomes.win}/` +
      `${sum.outcomes.loss}/${sum.outcomes.push}, net/game ${(sum.netUnits / sum.games).toFixed(4)}; ` +
      `coups: Banker ${pct(t.banker)}, Player ${pct(t.player)}, Tie ${pct(t.tie)}, naturals ` +
      `${pct(t.naturals)}, six-card ${pct(t.sixCardCoups)}; bets P/B/T ${t.bets.player}/` +
      `${t.bets.banker}/${t.bets.tie}; flags ${JSON.stringify(t.flags)}`,
  );
}

describe('baccarat simulations', () => {
  it('1,500 games with the normal bot (varied shoes): every invariant holds, always Banker', () => {
    const t = newTally();
    const sum = simulate(baccaratEngine, {
      games: 1500,
      seedBase: 1,
      config: variedConfig,
      difficulty: () => 'normal',
      maxMoves: MAX_GAME_MOVES,
      freezeEvery: 3,
      invariant: makeStepInvariant(),
      onGameEnd: makeOnGameEnd(t),
    });
    report('normal', sum, t);
    expect(sum.games).toBe(1500);
    expect(t.bets.banker).toBe(1500);
    expect(sum.maxMovesInAGame).toBeLessThanOrEqual(MAX_GAME_MOVES);
    // Every way a Banker bet can end happened: wins, losses and pushes.
    expect(sum.outcomes.win).toBeGreaterThan(500);
    expect(sum.outcomes.loss).toBeGreaterThan(500);
    expect(sum.outcomes.push).toBeGreaterThan(50);
    expect(t.flags.perfect).toBeGreaterThan(0);
    expect(t.flags.comeback).toBeGreaterThan(0);
    expect(t.flags.luckyLastCard).toBeGreaterThan(0);
  }, 60_000);

  it('1,500 games with the easy bot (varied shoes): every invariant holds, all bets used', () => {
    const t = newTally();
    const sum = simulate(baccaratEngine, {
      games: 1500,
      seedBase: 100_000,
      config: variedConfig,
      difficulty: () => 'easy',
      maxMoves: MAX_GAME_MOVES,
      freezeEvery: 2,
      invariant: makeStepInvariant(),
      onGameEnd: makeOnGameEnd(t),
    });
    report('easy', sum, t);
    expect(sum.games).toBe(1500);
    // Random bets: about 500 each (σ ≈ 18), so 400–600 is a very safe band.
    for (const n of Object.values(t.bets)) {
      expect(n).toBeGreaterThan(400);
      expect(n).toBeLessThan(600);
    }
    // Winning Tie bets (8 to 1) actually happened.
    expect(t.flags.bigPot).toBeGreaterThan(10);
  }, 60_000);

  it('Banker / Player / Tie frequencies match the exact 8-deck odds over 60,000 coups', () => {
    const games = 60_000;
    const t = newTally();
    const sum = simulate(baccaratEngine, {
      games,
      seedBase: 1_000_000,
      config: { players: 2 },
      difficulty: () => 'normal',
      maxMoves: MAX_GAME_MOVES,
      freezeEvery: 0,
      onGameEnd: (s, r, seed) => {
        const ref = refSettle(s);
        if (r.humanNetUnits !== ref.net || s.winner !== ref.winner) {
          throw new Error(`[seed ${seed}] wrong settlement`);
        }
        tallyGame(s, ref, r, t);
      },
    });
    report('frequencies (normal, 60k, 8 decks)', sum, t);
    const exact = COUP_ODDS[8]!;
    // The known values: Banker 45.86%, Player 44.62%, Tie 9.52%.
    expect(exact.banker).toBeCloseTo(0.4586, 4);
    expect(exact.player).toBeCloseTo(0.4462, 4);
    expect(exact.tie).toBeCloseTo(0.0952, 4);
    // σ at 60,000 coups: ≈ 0.0020 for Banker/Player and ≈ 0.0012 for Tie → 4.5σ bands.
    const band = (p: number) => 4.5 * Math.sqrt((p * (1 - p)) / games);
    for (const w of ['banker', 'player', 'tie'] as const) {
      expect(Math.abs(t[w] / games - exact[w]), w).toBeLessThan(band(exact[w]));
    }
    // Always betting Banker loses ≈ 1.06% per coup (σ of the mean ≈ 0.0038). Paying Banker
    // 1 to 1 instead would make it ≈ +1.24% — far outside this band.
    const mean = sum.netUnits / games;
    const edge = -(0.95 * exact.banker - exact.player);
    expect(Math.abs(mean + edge)).toBeLessThan(0.015);
    // A game is the bet plus one move per card: 4–6 cards, ≈ 5.94 moves on average.
    expect(sum.totalMoves / games).toBeGreaterThan(5);
    expect(sum.maxMovesInAGame).toBeLessThanOrEqual(MAX_GAME_MOVES);
  }, 60_000);
});
