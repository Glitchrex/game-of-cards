/**
 * Seeded learner-bot vs dealer simulations. Besides the generic contract checks in
 * simulate() (legal bot moves, no input mutation, termination…), every step and every final
 * state is checked against Andar Bahar invariants, and every result is re-derived by an
 * independent implementation of the rules written only for this test. A large run then
 * compares the empirical win rates with the exact theoretical values.
 */
import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze, simulate, type SimulationSummary } from '@/games/core/simulate';
import { IllegalMoveError, type GameConfig, type GameResult } from '@/games/core/types';
import {
  andarBaharEngine,
  DEALER,
  LEARNER,
  MAX_GAME_MOVES,
  type AndarBaharMove,
  type AndarBaharState,
} from './engine';

// ---------------------------------------------------------------------------
// Independent reference rules (deliberately not using the engine's helpers).
// ---------------------------------------------------------------------------

const FULL_DECK = new Set<CardCode>(makeDeck());

/** The dealt cards in deal order, rebuilt from the two piles: A1, B1, A2, B2, … */
function refSequence(s: AndarBaharState): { card: CardCode; side: 'andar' | 'bahar' }[] {
  const out: { card: CardCode; side: 'andar' | 'bahar' }[] = [];
  for (let i = 0; i < Math.max(s.andar.length, s.bahar.length); i++) {
    const a = s.andar[i];
    const b = s.bahar[i];
    if (a !== undefined) out.push({ card: a, side: 'andar' });
    if (b !== undefined) out.push({ card: b, side: 'bahar' });
  }
  return out;
}

const rankOfCode = (c: CardCode) => c.slice(0, 1);

interface RefOutcome {
  winner: 'andar' | 'bahar';
  matchNumber: number;
  net: number;
}

function refSettle(s: AndarBaharState): RefOutcome {
  const seq = refSequence(s);
  const idx = seq.findIndex((d) => rankOfCode(d.card) === rankOfCode(s.joker));
  if (idx < 0) throw new Error('reference: no matching card was dealt');
  const hit = seq[idx]!;
  const odds = { andar: 0.9, bahar: 1 } as const;
  const net = s.bet === hit.side ? odds[hit.side] : -1;
  return { winner: hit.side, matchNumber: idx + 1, net };
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

function fail(step: number, message: string, s: AndarBaharState): never {
  throw new Error(`[step ${step}] ${message}\n${JSON.stringify({ ...s, stock: s.stock.length })}`);
}

/** Checked after every move. */
function stepInvariant(s: AndarBaharState, step: number): void {
  // Card conservation: joker + stock + both piles = one complete deck, each card once.
  const all = [s.joker, ...s.stock, ...s.andar, ...s.bahar];
  if (all.length !== 52) fail(step, `there are ${all.length} cards, not 52`, s);
  if (new Set(all).size !== 52) fail(step, 'a card appears twice', s);
  if (!all.every((c) => FULL_DECK.has(c))) fail(step, 'a foreign card appeared', s);

  // The deal alternates starting with Andar, one card per step after the bet.
  const dealt = s.andar.length + s.bahar.length;
  const diff = s.andar.length - s.bahar.length;
  if (diff !== 0 && diff !== 1) fail(step, 'the piles are not alternating from Andar', s);
  if (dealt !== step - 1) fail(step, `expected ${step - 1} cards dealt after the bet`, s);
  if (s.stock.length !== 51 - dealt) fail(step, 'the stock size is wrong', s);

  // Nothing before the last card matched; the bet is placed and never changes.
  const seq = refSequence(s);
  const matches = seq.filter((d) => rankOfCode(d.card) === rankOfCode(s.joker));
  if (s.bet === null) fail(step, 'the deal started without a bet', s);
  if (s.phase === 'deal') {
    if (matches.length !== 0) fail(step, 'a match was dealt but the deal went on', s);
    if (s.winner !== null) fail(step, 'a winner was named mid-deal', s);
    if (andarBaharEngine.currentPlayer(s) !== DEALER) fail(step, 'the dealer must be dealing', s);
    if (s.stock.filter((c) => rankOfCode(c) === rankOfCode(s.joker)).length !== 3) {
      fail(step, 'all three matches must still be in the stock', s);
    }
  } else if (s.phase === 'over') {
    if (matches.length !== 1) fail(step, 'the deal must end on the first match', s);
    const last = seq.at(-1);
    if (!last || rankOfCode(last.card) !== rankOfCode(s.joker)) {
      fail(step, 'the last card dealt must be the match', s);
    }
    if (s.winner !== last.side) fail(step, 'the winner is not the side of the match', s);
    if (andarBaharEngine.currentPlayer(s) !== null) fail(step, 'currentPlayer after the end', s);
  } else {
    fail(step, `unexpected phase ${s.phase} after a move`, s);
  }
  if (dealt > 49) fail(step, 'the deal ran past card 49', s);
}

interface Tally {
  games: number;
  andarWins: number;
  betAndar: number;
  firstCard: number;
  longDeals: number;
  matchNumberSum: number;
}

const newTally = (): Tally => ({
  games: 0,
  andarWins: 0,
  betAndar: 0,
  firstCard: 0,
  longDeals: 0,
  matchNumberSum: 0,
});

function tallyGame(s: AndarBaharState, ref: RefOutcome, t: Tally): void {
  t.games++;
  if (ref.winner === 'andar') t.andarWins++;
  if (s.bet === 'andar') t.betAndar++;
  if (ref.matchNumber === 1) t.firstCard++;
  if (ref.matchNumber >= 26) t.longDeals++;
  t.matchNumberSum += ref.matchNumber;
}

function makeOnGameEnd(t: Tally) {
  return (s: AndarBaharState, r: GameResult, seed: number): void => {
    const at = `[seed ${seed}]`;
    const ref = refSettle(s);
    // Scoring re-derived independently.
    expect(s.winner, `${at} winner`).toBe(ref.winner);
    expect(r.humanNetUnits, `${at} net`).toBe(ref.net);
    expect(r.humanOutcome, `${at} outcome`).toBe(ref.net > 0 ? 'win' : 'loss');
    expect(r.winners).toEqual(ref.net > 0 ? [LEARNER] : [DEALER]);
    // Payout bounds: lose at most the one escrowed unit, win at most 1 to 1.
    expect([-1, 0.9, 1]).toContain(r.humanNetUnits);
    if (r.humanNetUnits === 0.9) expect(s.bet).toBe('andar');
    if (r.humanNetUnits === 1) expect(s.bet).toBe('bahar');
    // Chip conservation: the escrowed unit plus the net comes back (never negative), and
    // what the learner wins the house pays, unit for unit.
    const returned = 1 + r.humanNetUnits;
    expect(returned).toBeGreaterThanOrEqual(0);
    const houseNet = ref.net > 0 ? -ref.net : 1;
    expect(houseNet + r.humanNetUnits).toBeCloseTo(0, 12);
    // Flags re-derived from what happened.
    expect(r.flags.closeFinish).toBe(ref.matchNumber <= 3);
    expect(r.flags.luckyLastCard).toBe(ref.matchNumber === 1 || ref.matchNumber - 1 >= 25);
    expect(r.flags.tags?.includes('first-card-match')).toBe(ref.matchNumber === 1);
    expect(r.flags.tags?.includes('long-deal')).toBe(ref.matchNumber >= 26);
    expect(r.flags.tags?.includes(`${ref.winner}-wins`)).toBe(true);
    expect(r.flags.bigPot).toBe(false);
    expect(r.flags.folded).toBe(false);
    expect(r.flags.bust).toBe(false);
    expect(r.summary).toContain(
      ref.matchNumber === 1 ? 'The very first card' : `as card ${ref.matchNumber}`,
    );
    expect(r.summary).toContain(ref.winner === 'andar' ? 'on Andar' : 'on Bahar');
    tallyGame(s, ref, t);
  };
}

/** The wallet does not matter (no extra bets), but vary it to prove that. */
function variedConfig(seed: number): GameConfig {
  const affordable = [undefined, 0, 1, 3, undefined][seed % 5];
  return { players: 2, affordableUnits: affordable, options: seed % 3 === 0 ? {} : undefined };
}

function report(label: string, sum: SimulationSummary, t: Tally): void {
  console.info(
    `[andar-bahar sim] ${label}: ${sum.games} games, avg ${(sum.totalMoves / sum.games).toFixed(2)} ` +
      `moves (max ${sum.maxMovesInAGame}), win/loss/push ${sum.outcomes.win}/` +
      `${sum.outcomes.loss}/${sum.outcomes.push}, net/game ${(sum.netUnits / sum.games).toFixed(4)}, ` +
      `Andar won ${((100 * t.andarWins) / t.games).toFixed(2)}%, bet Andar ${t.betAndar}, ` +
      `first-card matches ${t.firstCard}, 26+ card deals ${t.longDeals}, avg match card ` +
      `${(t.matchNumberSum / t.games).toFixed(2)}`,
  );
}

// Exact theory (see rules.ts): Andar wins 10,725 of the C(51,3) = 20,825 equally likely deals.
const P_ANDAR = 10_725 / 20_825;

describe('andar-bahar simulations', () => {
  it('1,500 games with the normal bot: every invariant holds, always bets Andar', () => {
    const t = newTally();
    const sum = simulate(andarBaharEngine, {
      games: 1500,
      seedBase: 1,
      config: variedConfig,
      difficulty: () => 'normal',
      maxMoves: MAX_GAME_MOVES,
      freezeEvery: 3,
      invariant: stepInvariant,
      onGameEnd: makeOnGameEnd(t),
    });
    report('normal', sum, t);
    expect(sum.games).toBe(1500);
    expect(sum.outcomes.push).toBe(0);
    expect(t.betAndar).toBe(1500);
    expect(sum.maxMovesInAGame).toBeLessThanOrEqual(MAX_GAME_MOVES);
  }, 60_000);

  it('1,500 games with the easy bot: every invariant holds, bets both sides', () => {
    const t = newTally();
    const sum = simulate(andarBaharEngine, {
      games: 1500,
      seedBase: 100_000,
      config: variedConfig,
      difficulty: () => 'easy',
      maxMoves: MAX_GAME_MOVES,
      freezeEvery: 2,
      invariant: stepInvariant,
      onGameEnd: makeOnGameEnd(t),
    });
    report('easy', sum, t);
    expect(sum.games).toBe(1500);
    expect(sum.outcomes.push).toBe(0);
    // Random sides: about 750 each (σ ≈ 19), so 650–850 is a very safe band.
    expect(t.betAndar).toBeGreaterThan(650);
    expect(t.betAndar).toBeLessThan(850);
    // Both payouts actually occurred.
    expect(sum.outcomes.win).toBeGreaterThan(500);
  }, 60_000);

  it('statistics match the exact theory over 40,000 deals', () => {
    const games = 40_000;
    const t = newTally();
    const sum = simulate(andarBaharEngine, {
      games,
      seedBase: 1_000_000,
      config: { players: 2 },
      difficulty: () => 'normal',
      maxMoves: MAX_GAME_MOVES,
      freezeEvery: 0,
      onGameEnd: (s, r, seed) => {
        const ref = refSettle(s);
        if (r.humanNetUnits !== ref.net) throw new Error(`[seed ${seed}] wrong net`);
        tallyGame(s, ref, t);
      },
    });
    report('theory (normal, 40k)', sum, t);
    // Andar win rate: p ≈ 0.5150, σ ≈ 0.0025 at 40,000 deals → ±0.01 is a 4σ band. A deal
    // that started on Bahar (p ≈ 0.485) or ignored the alternation (≈ 0.5) falls outside.
    expect(t.andarWins / games).toBeGreaterThan(P_ANDAR - 0.01);
    expect(t.andarWins / games).toBeLessThan(P_ANDAR + 0.01);
    // Always betting Andar loses ≈ 2.15% per game (σ ≈ 0.0048): a 1:1 Andar payout would
    // make it +3%, a 0.95 payout +0.4% — both far outside this band.
    const mean = sum.netUnits / games;
    expect(mean).toBeGreaterThan(-0.0215 - 0.02);
    expect(mean).toBeLessThan(-0.0215 + 0.02);
    // The match comes on card 13 on average (σ of the mean ≈ 0.05).
    expect(t.matchNumberSum / games).toBeGreaterThan(12.75);
    expect(t.matchNumberSum / games).toBeLessThan(13.25);
    // First-card matches: 3/51 ≈ 5.88% (σ ≈ 0.12%). Card 26 or later: 2,600/20,825 ≈ 12.5%.
    expect(t.firstCard / games).toBeGreaterThan(3 / 51 - 0.006);
    expect(t.firstCard / games).toBeLessThan(3 / 51 + 0.006);
    expect(t.longDeals / games).toBeGreaterThan(2600 / 20_825 - 0.008);
    expect(t.longDeals / games).toBeLessThan(2600 / 20_825 + 0.008);
    // A game is the bet plus one move per card: 14 moves on average.
    expect(sum.totalMoves / games).toBeCloseTo(1 + t.matchNumberSum / games, 10);
  }, 60_000);

  it('fuzz: random legal play with illegal and malformed attempts from every seat', () => {
    const engine = andarBaharEngine;
    const attempts: unknown[] = [
      { type: 'bet', side: 'andar' },
      { type: 'bet', side: 'bahar' },
      { type: 'deal' },
      { type: 'bet', side: 'middle' },
      { type: 'bet' },
      { type: 'hit' },
      {},
      null,
      'deal',
    ];
    const wellFormed = (m: unknown): m is AndarBaharMove =>
      typeof m === 'object' &&
      m !== null &&
      ((m as { type?: unknown }).type === 'deal' ||
        ((m as { type?: unknown }).type === 'bet' &&
          ['andar', 'bahar'].includes(String((m as { side?: unknown }).side))));
    // Plain checks (not expect) keep ~1M assertions fast; any failure names seed and step.
    const check = (ok: boolean, what: string) => {
      if (!ok) throw new Error(what);
    };
    const names = (cards: readonly CardCode[]) => cards.map((c) => cardName(c));
    let games = 0;
    let attemptsChecked = 0;
    for (let g = 0; g < 1000; g++) {
      const r = createRng(`fuzz-${g}`);
      let s = engine.setup({ players: 2, affordableUnits: r.int(4) }, createRng(`fz-deal-${g}`));
      let steps = 0;
      while (!engine.isOver(s)) {
        const at = `[game ${g} step ${steps}]`;
        const p = engine.currentPlayer(s);
        check(p !== null, `${at} currentPlayer is null mid-game`);
        const hidden = names(s.stock);
        for (const seat of [LEARNER, DEALER, 2]) {
          const legal = engine.legalMoves(s, seat);
          check(seat === p || legal.length === 0, `${at} seat ${seat} has moves out of turn`);
          const legalKeys = new Set(legal.map((m) => engine.moveKey(m)));
          for (const m of attempts) {
            const label = `${at} seat ${seat} ${JSON.stringify(m)}`;
            const verdict = engine.checkMove(s, seat, m as AndarBaharMove);
            const expected = wellFormed(m) && legalKeys.has(engine.moveKey(m));
            check(verdict.ok === expected, `${label}: checkMove disagrees with legalMoves`);
            if (!verdict.ok) {
              check((verdict.reason?.length ?? 0) > 20, `${label}: no friendly reason`);
            }
            if (!verdict.ok && seat === p) {
              let threw: unknown = null;
              try {
                engine.applyMove(s, m as AndarBaharMove);
              } catch (err) {
                threw = err;
              }
              check(threw instanceof IllegalMoveError, `${label}: applyMove did not refuse`);
            }
            // Only the card being turned face up by a legal deal may ever be named.
            const text = engine.describeMove(s, seat, m as AndarBaharMove);
            const shown = verdict.ok && wellFormed(m) && m.type === 'deal' ? 1 : 0;
            check(
              hidden.slice(shown).every((h) => !text.includes(h)),
              `${label}: describeMove leaks a face-down card: ${text}`,
            );
            attemptsChecked++;
          }
          const advice = engine.coach(s, seat);
          const said = `${advice.situation} ${advice.why ?? ''}`;
          check(
            hidden.every((h) => !said.includes(h)),
            `${at} coach leaks a face-down card: ${said}`,
          );
          if (advice.suggestion !== undefined) {
            const ok = engine.checkMove(s, seat, advice.suggestion as AndarBaharMove).ok;
            check(ok, `${at} coach suggests an illegal move for seat ${seat}`);
          }
        }
        const legal = engine.legalMoves(s, p!);
        check(legal.length > 0, `${at} stuck: no legal moves for the current player`);
        const move = legal[r.int(legal.length)]!;
        const before = JSON.stringify(s);
        const next = engine.applyMove(deepFreeze(s), move);
        check(JSON.stringify(s) === before, `${at} applyMove mutated its input`);
        stepInvariant(next, steps + 1);
        check(
          JSON.stringify(JSON.parse(JSON.stringify(next))) === JSON.stringify(next),
          `${at} JSON`,
        );
        s = next;
        steps++;
        check(steps <= MAX_GAME_MOVES, `${at} the game ran past ${MAX_GAME_MOVES} moves`);
      }
      const result = engine.result(s);
      check(result.humanNetUnits === refSettle(s).net, `[game ${g}] wrong net`);
      check(
        JSON.stringify(engine.coach(s, LEARNER)) === JSON.stringify({ situation: result.summary }),
        `[game ${g}] coach after the deal should repeat the result`,
      );
      games++;
    }
    expect(games).toBe(1000);
    expect(attemptsChecked).toBeGreaterThan(300_000);
  }, 60_000);
});
