/**
 * Adversarial rules audit for Baccarat (Punto Banco), written by the rules verifier.
 *
 *  1. An EXHAUSTIVE walk of every possible coup: the engine is driven card by card through
 *     every sequence of card values it can ask for (339,400 complete coups), and each one is
 *     checked against a reference written straight from docs/RULES_DECISIONS.md and the
 *     engine notes (not from the engine's helpers): which hand gets each card, when the
 *     deal stops, the winner, the payout of all three bets, every result flag, the summary,
 *     the move log and the coach's "why" for every card. Weighting each coup by its exact
 *     probability then reproduces the published 8-deck and 1-deck odds and house edges
 *     from the ENGINE's own play (odds.ts computes them separately, with rules.ts).
 *  2. Focused tests for each rule edge case (naturals on both sides, three-card 8s and 9s,
 *     every boundary of the Banker table, ties made by the last card…).
 *  3. Regression tests for the bugs found during verification.
 *  4. Fuzzing with uniformly random legal moves, every seat and illegal moves, deep-frozen
 *     and JSON round-tripped states; hidden-information checks; normal vs easy bots.
 */
import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, removeCard, type CardCode, type Rank } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { deepFreeze, simulate } from '@/games/core/simulate';
import { IllegalMoveError, type GameResult } from '@/games/core/types';
import engine, {
  COUP_ODDS,
  DEALER,
  houseEdges,
  LEARNER,
  MAX_GAME_MOVES,
  MAX_LOSS_UNITS,
  setupWithShoe,
  type BaccaratMove,
  type BaccaratState,
  type BetOn,
} from './engine';

// ---------------------------------------------------------------------------
// Reference rules, transcribed from docs/RULES_DECISIONS.md + docs/engine-notes/baccarat.md
// ---------------------------------------------------------------------------

type Side = 'player' | 'banker';
type Outcome = Side | 'tie';
const BETS: readonly BetOn[] = ['player', 'banker', 'tie'];
const DEAL: BaccaratMove = { type: 'deal' };
const bet = (on: BetOn): BaccaratMove => ({ type: 'bet', on });

/** "Ace = 1, 2–9 face value, 10/J/Q/K = 0." */
const VALUE: Record<Rank, number> = {
  A: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 0,
  J: 0,
  Q: 0,
  K: 0,
};
const val = (c: CardCode): number => VALUE[c[0] as Rank];
/** "Hand value = sum mod 10." */
const sum10 = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) % 10;

/**
 * "Banker 0–2 draws; 3 draws unless Player's third card is 8; 4 draws if it is 2–7; 5 draws
 * if 4–7; 6 draws if 6–7; 7 stands." Index = Banker's two-card total.
 */
const BANKER_DRAWS_AGAINST: readonly (readonly number[])[] = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [0, 1, 2, 3, 4, 5, 6, 7, 9],
  [2, 3, 4, 5, 6, 7],
  [4, 5, 6, 7],
  [6, 7],
  [],
];

interface RefCoup {
  player: number[];
  banker: number[];
  /** Cards the written rules use from the front of `values`. */
  used: number;
}

/** Deal a coup by the written rules from card values in shoe order. */
function refCoup(values: readonly number[]): RefCoup {
  let i = 0;
  const next = (): number => {
    const v = values[i++];
    if (v === undefined) throw new Error(`the written rules need card ${i}, the engine stopped`);
    return v;
  };
  // "ONE CARD per move in the correct order (Player, Banker, Player, Banker…)"
  const player = [next()];
  const banker = [next()];
  player.push(next());
  banker.push(next());
  const p2 = sum10(player);
  const b2 = sum10(banker);
  // "Naturals 8/9 stop the deal."
  if (p2 >= 8 || b2 >= 8) return { player, banker, used: i };
  if (p2 <= 5) {
    // "Player draws on 0–5"; then Banker follows the table using that card's value.
    const third = next();
    player.push(third);
    if ((BANKER_DRAWS_AGAINST[b2] ?? []).includes(third)) banker.push(next());
  } else if (b2 <= 5) {
    // "If Player stood, Banker draws on 0–5 and stands on 6–7."
    banker.push(next());
  }
  return { player, banker, used: i };
}

const refWinner = (p: number, b: number): Outcome => (p > b ? 'player' : b > p ? 'banker' : 'tie');

/** "Player win +1, Banker win +0.95, Tie bet win +8; P/B push on a tie; losses −1." */
function refNet(on: BetOn, w: Outcome): number {
  if (on === w) return { player: 1, banker: 0.95, tie: 8 }[on];
  return w === 'tie' ? 0 : -1;
}

/** Every flag, as documented in docs/rules-drafts/baccarat.md → Result flags. */
function refFlags(player: readonly number[], banker: readonly number[], on: BetOn) {
  const p = sum10(player);
  const b = sum10(banker);
  const w = refWinner(p, b);
  const net = refNet(on, w);
  const won = net > 0;
  const natural = (h: readonly number[]) => h.length === 2 && sum10(h) >= 8;
  const nine = (h: readonly number[]) => natural(h) && sum10(h) === 9;
  const snapshots: [number, number][] = [[sum10(player.slice(0, 2)), sum10(banker.slice(0, 2))]];
  if (player.length === 3) snapshots.push([p, sum10(banker.slice(0, 2))]);
  if (banker.length === 3) snapshots.push([p, b]);
  let lucky: boolean;
  if (w === 'tie') {
    const before = snapshots[snapshots.length - 2];
    lucky = before !== undefined && before[0] !== before[1];
  } else {
    const hand = w === 'player' ? player : banker;
    const other = w === 'player' ? b : p;
    lucky = hand.length === 3 && sum10(hand.slice(0, 2)) <= other;
  }
  const behind = snapshots.some(([sp, sb]) =>
    on === 'tie' ? sp !== sb : on === 'player' ? sp < sb : sb < sp,
  );
  const tags: string[] = [];
  if (natural(player) || natural(banker)) tags.push('natural');
  if (w === 'tie') tags.push('tie');
  return {
    comeback: won && behind,
    closeFinish: Math.abs(p - b) === 1,
    luckyLastCard: lucky,
    bigPot: on === 'tie' && w === 'tie',
    perfect:
      won &&
      (on === 'tie' ? nine(player) && nine(banker) : nine(on === 'player' ? player : banker)),
    bust: false,
    folded: false,
    tags,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FlagSet = ReturnType<typeof refFlags>;
const FLAG_NAMES = [
  'comeback',
  'closeFinish',
  'luckyLastCard',
  'bigPot',
  'perfect',
  'bust',
  'folded',
] as const;

/** Every boolean flag equal (an absent flag counts as a mismatch) and the same tags. */
function sameFlags(actual: GameResult['flags'], expected: FlagSet): boolean {
  for (const f of FLAG_NAMES) if (actual[f] !== expected[f]) return false;
  return (actual.tags ?? []).join() === expected.tags.join();
}

/** A complete `decks`-deck shoe whose first cards are `first` (deal order P, B, P, B, …). */
function shoeWith(first: CardCode[], decks = 8): CardCode[] {
  let rest = makeDeck({ copies: decks });
  for (const c of first) rest = removeCard(rest, c);
  return [...first, ...rest];
}

function table(first: CardCode[], decks = 8): BaccaratState {
  return setupWithShoe({ players: 2, options: { decks } }, shoeWith(first, decks));
}

function coup(first: CardCode[], on: BetOn): BaccaratState {
  let s = engine.applyMove(table(first), bet(on));
  while (!engine.isOver(s)) s = engine.applyMove(s, DEAL);
  return s;
}

const reason = (s: BaccaratState, p: number, m: unknown): string => {
  const check = engine.checkMove(s, p, m as BaccaratMove);
  expect(check.ok).toBe(false);
  return check.reason ?? '';
};

/** One card of each value, varying rank and suit with depth so every rank gets dealt. */
const ZERO_RANKS = ['T', 'J', 'Q', 'K'] as const;
const SUITS = ['S', 'H', 'D', 'C'] as const;
function cardFor(value: number, depth: number): CardCode {
  const suit = SUITS[depth % 4] ?? 'S';
  if (value === 0) return `${ZERO_RANKS[depth % 4] ?? 'K'}${suit}`;
  if (value === 1) return `A${suit}`;
  return `${value}${suit}` as CardCode;
}

// ---------------------------------------------------------------------------
// 1. Exhaustive walk
// ---------------------------------------------------------------------------

interface WalkTotals {
  coups: number;
  won: Record<Outcome, number>;
  ev: Record<BetOn, number>;
  problems: string[];
}

/**
 * Drive the engine through every card-value sequence it asks for, weighting each branch by
 * the chance of drawing that value from a fresh `decks`-deck shoe (without replacement).
 * With `audit`, every node and every finished coup is checked against the reference.
 */
function walkEveryCoup(decks: number, audit: boolean): WalkTotals {
  const counts = Array.from({ length: 10 }, (_, v) => (v === 0 ? 16 : 4) * decks);
  let left = 52 * decks;
  const out: WalkTotals = {
    coups: 0,
    won: { player: 0, banker: 0, tie: 0 },
    ev: { player: 0, banker: 0, tie: 0 },
    problems: [],
  };
  const problem = (seq: readonly number[], what: string) => {
    if (out.problems.length < 20) out.problems.push(`[values ${seq.join(',')}] ${what}`);
  };

  const finished = (s: BaccaratState, seq: readonly number[], lastLine: string, w: number) => {
    out.coups++;
    let ref: RefCoup;
    try {
      ref = refCoup(seq);
    } catch (err) {
      return problem(seq, err instanceof Error ? err.message : String(err));
    }
    const pv = s.player.map(val);
    const bv = s.banker.map(val);
    if (ref.used !== seq.length)
      problem(seq, `engine dealt ${seq.length} cards, rules ${ref.used}`);
    if (pv.join() !== ref.player.join() || bv.join() !== ref.banker.join()) {
      problem(seq, `hands P[${pv}] B[${bv}], rules P[${ref.player}] B[${ref.banker}]`);
    }
    const p = sum10(ref.player);
    const b = sum10(ref.banker);
    const winner = refWinner(p, b);
    out.won[winner] += w;
    if (s.winner !== winner) problem(seq, `winner ${s.winner}, rules ${winner}`);
    if (!audit) return;
    for (const on of BETS) {
      const r: GameResult = engine.result({ ...s, bet: on });
      out.ev[on] += w * r.humanNetUnits;
      const net = refNet(on, winner);
      const outcome = net > 0 ? 'win' : net < 0 ? 'loss' : 'push';
      if (r.humanNetUnits !== net) problem(seq, `${on} bet nets ${r.humanNetUnits}, rules ${net}`);
      if (r.humanOutcome !== outcome) problem(seq, `${on} bet outcome ${r.humanOutcome}`);
      if (r.humanNetUnits < -MAX_LOSS_UNITS || r.humanNetUnits > 8) problem(seq, 'out of bounds');
      const winners = outcome === 'win' ? [LEARNER] : outcome === 'loss' ? [DEALER] : [];
      if (r.winners.join() !== winners.join()) problem(seq, `${on} winners ${r.winners}`);
      const flags = refFlags(ref.player, ref.banker, on);
      if (!sameFlags(r.flags, flags)) {
        problem(seq, `${on} flags ${JSON.stringify(r.flags)}, rules ${JSON.stringify(flags)}`);
      }
      const lead =
        winner === 'tie'
          ? `Both hands finished on ${p}`
          : winner === 'player'
            ? `Player won ${p} to ${b}`
            : `Banker won ${b} to ${p}`;
      const verdict = { win: ' wins ', loss: ' loses.', push: ' is a push ' }[outcome];
      if (
        !r.summary.startsWith(lead) ||
        !r.summary.includes(
          `your ${on === 'tie' ? 'Tie' : on === 'player' ? 'Player' : 'Banker'} bet${verdict}`,
        )
      ) {
        problem(seq, `${on} summary "${r.summary}"`);
      }
    }
    const ending =
      winner === 'tie'
        ? `It’s a tie at ${p}.`
        : winner === 'player'
          ? `Player wins, ${p} to ${b}.`
          : `Banker wins, ${b} to ${p}.`;
    if (!lastLine.endsWith(ending)) problem(seq, `last log line "${lastLine}"`);
    if (engine.currentPlayer(s) !== null || engine.legalMoves(s, DEALER).length !== 0) {
      problem(seq, 'moves after the coup ended');
    }
  };

  const walk = (s: BaccaratState, seq: number[], lastLine: string, w: number): void => {
    if (engine.isOver(s)) return finished(s, seq, lastLine, w);
    if (seq.length >= 6) return problem(seq, 'the engine wants a seventh card');
    if (engine.currentPlayer(s) !== DEALER) return problem(seq, 'the dealer is not dealing');
    const dealt = s.player.length + s.banker.length;
    const advice = audit ? engine.coach(s, DEALER) : null;
    for (let v = 0; v < 10; v++) {
      const n = counts[v] ?? 0;
      if (n === 0) continue;
      const card = cardFor(v, seq.length);
      const at: BaccaratState = { ...s, shoe: [card] };
      const line = audit ? engine.describeMove(at, DEALER, DEAL) : '';
      const weight = (w * n) / left;
      const next = engine.applyMove(at, DEAL);
      if (audit && advice) {
        const to: Side = next.player.length > s.player.length ? 'player' : 'banker';
        const name = to === 'player' ? 'Player' : 'Banker';
        const third = s[to].length === 2;
        // The log names exactly the card turned face up and the hand it went to.
        const expected = third
          ? `Player 1 deals ${name} a third card, the ${cardName(card)}`
          : `Player 1 deals the ${cardName(card)} to ${name}`;
        if (!line.startsWith(expected)) problem([...seq, v], `log "${line}"`);
        // The coach announced that hand before the card came…
        const announced = third
          ? `Next, ${name} gets a third card.`
          : `The next card goes to ${name}.`;
        if (!advice.situation.endsWith(announced)) {
          problem([...seq, v], `coach said "${advice.situation}" before a card to ${name}`);
        }
        // …and its "why" names the rule that really applied.
        if (dealt >= 4) {
          const rule =
            to === 'player'
              ? 'Player always draws a third card on 0–5'
              : 'so Banker draws a third card';
          if (!(advice.why ?? '').includes(rule)) problem([...seq, v], `why "${advice.why}"`);
        }
        if (JSON.stringify(advice.suggestion) !== JSON.stringify(DEAL)) {
          problem(seq, 'the coach did not suggest the deal');
        }
      }
      counts[v] = n - 1;
      left--;
      walk(next, [...seq, v], line, weight);
      counts[v] = n;
      left++;
    }
  };

  const start = engine.applyMove(table([], decks), bet('banker'));
  walk(start, [], '', 1);
  return out;
}

describe('every possible coup, through the engine', () => {
  it('8 decks: all 339,400 coups follow the written rules — hands, payouts, flags, words', () => {
    const t = walkEveryCoup(8, true);
    expect(t.problems).toEqual([]);
    expect(t.coups).toBe(339_400);
    // The engine's own play reproduces the published 8-deck figures exactly.
    expect(t.won.banker).toBeCloseTo(0.458597, 6);
    expect(t.won.player).toBeCloseTo(0.446247, 6);
    expect(t.won.tie).toBeCloseTo(0.095156, 6);
    const exact = COUP_ODDS[8]!;
    for (const w of ['player', 'banker', 'tie'] as const)
      expect(t.won[w]).toBeCloseTo(exact[w], 12);
    // What the engine pays matches the house edges the coach and the lesson quote.
    const edges = houseEdges(8);
    for (const on of BETS) expect(-t.ev[on]).toBeCloseTo(edges[on], 10);
    expect(-t.ev.banker).toBeCloseTo(0.010579, 6);
    expect(-t.ev.player).toBeCloseTo(0.012351, 6);
    expect(-t.ev.tie).toBeCloseTo(0.143596, 6);
  }, 60_000);

  it('1 deck: the engine’s deal reproduces the published single-deck odds', () => {
    // Payouts were checked coup by coup above; here only the deal itself is weighted.
    const t = walkEveryCoup(1, false);
    expect(t.problems).toEqual([]);
    // Fewer than with 8 decks: a single deck has only four cards of each value 1–9, so
    // sequences such as five 9s cannot happen.
    expect(t.coups).toBe(339_215);
    expect(t.won.banker).toBeCloseTo(0.459624, 6);
    expect(t.won.player).toBeCloseTo(0.44676, 6);
    expect(t.won.tie).toBeCloseTo(0.093615, 5);
    for (const w of ['player', 'banker', 'tie'] as const) {
      expect(t.won[w]).toBeCloseTo(COUP_ODDS[1]![w], 12);
    }
  }, 60_000);
});

// ---------------------------------------------------------------------------
// 2. Focused rule edge cases
// ---------------------------------------------------------------------------

describe('rule edge cases', () => {
  const totalsOf = (s: BaccaratState) => [sum10(s.player.map(val)), sum10(s.banker.map(val))];

  it('a Banker natural 9 beats a Player natural 8, and nobody draws', () => {
    const s = coup(['8C', '4D', 'KH', '5S'], 'banker');
    expect([s.player.length, s.banker.length]).toEqual([2, 2]);
    expect(s.winner).toBe('banker');
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(0.95);
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.closeFinish).toBe(true);
  });

  it('a Banker natural stops Player drawing on 0, and a Player natural stops Banker on 0', () => {
    const banker = coup(['KC', '4D', 'QH', '4S'], 'player');
    expect(banker.player).toEqual(['KC', 'QH']);
    expect(banker.winner).toBe('banker');
    const player = coup(['4C', 'KD', '5H', 'QS'], 'banker');
    expect(player.banker).toEqual(['KD', 'QS']);
    expect(player.winner).toBe('player');
  });

  it('two nines make a natural 8 (18 → 8); a 9 and a 10 make a natural 9', () => {
    const s = coup(['9C', '2D', '9H', '3S'], 'player');
    expect(totalsOf(s)).toEqual([8, 5]);
    expect(s.player).toHaveLength(2);
    expect(s.banker).toHaveLength(2);
    const t = coup(['9C', '2D', 'TH', '3S'], 'player');
    expect(totalsOf(t)).toEqual([9, 5]);
    expect(engine.result(t).flags.perfect).toBe(true);
  });

  it('a three-card 9 is not a natural: no "natural" tag and no perfect flag', () => {
    // Player 2 + 2 = 4 draws a 5 → 9; Banker on 7 stands.
    const s = coup(['2C', '3D', '2H', '4S', '5D'], 'player');
    expect(totalsOf(s)).toEqual([9, 7]);
    const r = engine.result(s);
    expect(r.flags.perfect).toBe(false);
    expect(r.flags.tags).toEqual([]);
    expect(r.summary).toBe('Player won 9 to 7, so your Player bet wins 1 to 1!');
  });

  it('two picture cards make 0 ("baccarat"), and 0 always draws', () => {
    // Player K + Q = 0 draws a 6; Banker 3 + 4 = 7 stands. Banker wins 7–6.
    const s = coup(['KC', '3D', 'QH', '4S', '6D'], 'banker');
    expect(s.player).toEqual(['KC', 'QH', '6D']);
    expect(s.banker).toEqual(['3D', '4S']);
    expect(s.winner).toBe('banker');
  });

  it('Player stands on 7 and Banker stands on 6: Player wins 7–6 with no third cards', () => {
    const s = coup(['3C', '3D', '4H', '3S'], 'player');
    expect([s.player.length, s.banker.length]).toEqual([2, 2]);
    expect(s.winner).toBe('player');
    expect(engine.result(s).flags.closeFinish).toBe(true);
  });

  it('Player stands on 6 and Banker draws on 5', () => {
    const s = coup(['3C', '3D', '3H', '2S', '4D'], 'banker');
    expect(s.player).toHaveLength(2);
    expect(s.banker).toEqual(['3D', '2S', '4D']);
    expect(s.winner).toBe('banker');
  });

  // Every boundary of the Banker table, played through the engine. Player 2 + 3 = 5 always
  // draws; Banker's first two cards make `bankerTotal`; then Player's third card `third`.
  const boundaries: [string, CardCode, CardCode, number, CardCode, boolean][] = [
    // label, Banker card 1, Banker card 2, Banker total, Player third card, Banker draws?
    ['Banker 2 draws even against an 8', '2D', 'KS', 2, '8H', true],
    ['Banker 3 draws against a 9', '3D', 'KS', 3, '9H', true],
    ['Banker 3 draws against a ten (worth 0)', '3D', 'KS', 3, 'TH', true],
    ['Banker 3 stands against an 8', '3D', 'KS', 3, '8H', false],
    ['Banker 4 stands against an Ace (1)', '4D', 'KS', 4, 'AH', false],
    ['Banker 4 stands against a Jack (0)', '4D', 'KS', 4, 'JH', false],
    ['Banker 4 draws against a 2', '4D', 'KS', 4, '2H', true],
    ['Banker 4 draws against a 7', '4D', 'KS', 4, '7H', true],
    ['Banker 4 stands against an 8', '4D', 'KS', 4, '8H', false],
    ['Banker 5 stands against a 3', '5D', 'KS', 5, '3H', false],
    ['Banker 5 draws against a 4', '5D', 'KS', 5, '4H', true],
    ['Banker 5 draws against a 7', '5D', 'KS', 5, '7H', true],
    ['Banker 5 stands against a 9', '5D', 'KS', 5, '9H', false],
    ['Banker 6 stands against a 5', '6D', 'KS', 6, '5H', false],
    ['Banker 6 draws against a 6', '6D', 'KS', 6, '6H', true],
    ['Banker 6 draws against a 7', '6D', 'KS', 6, '7H', true],
    ['Banker 6 stands against an 8', '6D', 'KS', 6, '8H', false],
    ['Banker 7 stands against a 6', '7D', 'KS', 7, '6H', false],
    ['Banker 7 stands against a 7', '3D', '4S', 7, '7H', false],
  ];
  for (const [label, b1, b2, bankerTotal, third, draws] of boundaries) {
    it(label, () => {
      const s = coup(['2C', b1, '3C', b2, third, '9C'], 'banker');
      expect(sum10(s.banker.slice(0, 2).map(val))).toBe(bankerTotal);
      expect(s.player).toEqual(['2C', '3C', third]);
      expect(s.banker).toHaveLength(draws ? 3 : 2);
      if (draws) expect(s.banker[2]).toBe('9C');
    });
  }

  it('a tie made by the very last card: Tie bet wins 8, the others push', () => {
    // Player 2 + 2 = 4 draws a 3 → 7; Banker 3 + K = 3 draws (against a 3) a 4 → 7.
    const first: CardCode[] = ['2C', '3D', '2H', 'KS', '3H', '4D'];
    const tie = engine.result(coup(first, 'tie'));
    expect(tie.humanNetUnits).toBe(8);
    expect(tie.flags.luckyLastCard).toBe(true);
    expect(tie.flags.comeback).toBe(true);
    expect(tie.flags.bigPot).toBe(true);
    expect(tie.flags.tags).toEqual(['tie']);
    for (const on of ['player', 'banker'] as const) {
      const r = engine.result(coup(first, on));
      expect(r.humanNetUnits).toBe(0);
      expect(r.humanOutcome).toBe('push');
      expect(r.winners).toEqual([]);
      expect(r.flags.comeback).toBe(false);
    }
  });

  it('every payout stays between −maxLossUnits and +8', () => {
    for (const first of [
      ['9H', '5S', 'KC', '2D'],
      ['6C', '6D', 'KC', 'QD'],
      ['2C', '3D', '2H', 'KS', '3H', '4D'],
    ] as CardCode[][]) {
      for (const on of BETS) {
        const n = engine.result(coup(first, on)).humanNetUnits;
        expect(n).toBeGreaterThanOrEqual(-MAX_LOSS_UNITS);
        expect(n).toBeLessThanOrEqual(8);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Regressions for the bugs found during verification
// ---------------------------------------------------------------------------

describe('regressions', () => {
  const betting = table(['9H', '5S', 'KC', '2D']);
  const dealing = engine.applyMove(betting, bet('banker'));
  const midDeal = engine.applyMove(engine.applyMove(dealing, DEAL), DEAL);

  it('a bet on something that does not exist, once the dealing has started, says bets are locked', () => {
    for (const s of [dealing, midDeal]) {
      for (const m of [{ type: 'bet', on: 'dealer' }, { type: 'bet' }]) {
        const why = reason(s, LEARNER, m);
        expect(why).toBe(
          'Bets are locked once the dealing starts — your bet stays on Banker. Just watch the cards!',
        );
        expect(why).not.toMatch(/Pick a bet/);
      }
    }
  });

  it('the dealer never bets — whatever it tries to bet on', () => {
    for (const s of [betting, dealing]) {
      for (const m of [
        { type: 'bet', on: 'dealer' },
        { type: 'bet' },
        { type: 'bet', on: 'tie' },
      ]) {
        expect(reason(s, DEALER, m)).toBe(
          'The dealer never bets — the dealer only deals the cards. Only you place a bet.',
        );
      }
    }
  });

  it('the move log never says "can’t bet right now" for a bet that does not exist', () => {
    const odd = { type: 'bet', on: 'dealer' } as unknown as BaccaratMove;
    expect(engine.describeMove(betting, LEARNER, odd)).toBe(
      'That isn’t a bet at this table — you can bet on Player, Banker or Tie.',
    );
    expect(engine.describeMove(betting, LEARNER, bet('player'))).toBe(
      'You bet on Player, which pays 1 to 1.',
    );
  });

  it('coach and checkMove agree that a missing seat is missing, even after the coup', () => {
    let over = dealing;
    while (!engine.isOver(over)) over = engine.applyMove(over, DEAL);
    for (const s of [betting, dealing, over]) {
      expect(engine.coach(s, 2).situation).toBe(
        'There’s no Player 2 at this table — it’s just you and the dealer.',
      );
      expect(reason(s, 2, bet('player'))).toMatch(/no Player 2/);
    }
  });

  it('the move objects the engine hands out are frozen, so callers cannot corrupt them', () => {
    const [dealMove] = engine.legalMoves(dealing, DEALER);
    expect(Object.isFrozen(dealMove)).toBe(true);
    expect(Object.isFrozen(engine.botMove(dealing, DEALER, 'normal', createRng(1)))).toBe(true);
    expect(engine.coach(dealing, DEALER).suggestion).toEqual(DEAL);
  });
});

// ---------------------------------------------------------------------------
// 4. Fuzzing, hidden information, bots
// ---------------------------------------------------------------------------

const CANDIDATES: unknown[] = [
  bet('player'),
  bet('banker'),
  bet('tie'),
  DEAL,
  { type: 'bet', on: 'dealer' },
  { type: 'bet' },
  { type: 'hit' },
  { type: 'stand' },
  null,
  'deal',
];

function conservationProblem(s: BaccaratState): string | null {
  const all = [...s.shoe, ...s.player, ...s.banker];
  if (all.length !== 52 * s.decks) return `${all.length} cards for ${s.decks} decks`;
  const counts = new Map<string, number>();
  for (const c of all) counts.set(c, (counts.get(c) ?? 0) + 1);
  if (counts.size !== 52) return `${counts.size} distinct cards`;
  for (const [c, n] of counts) if (n !== s.decks) return `${c} × ${n}`;
  return null;
}

describe('fuzzing', () => {
  it('3,000 coups with uniformly random legal moves, every seat and illegal moves', () => {
    const rng = createRng('baccarat-audit-fuzz');
    const problems: string[] = [];
    const flag = (g: number, what: string) => {
      if (problems.length < 20) problems.push(`[game ${g}] ${what}`);
    };
    const totals = { win: 0, loss: 0, push: 0, moves: 0, maxMoves: 0 };
    for (let g = 0; g < 3000; g++) {
      const decks = 1 + rng.int(8);
      const config = {
        players: 2,
        affordableUnits: [undefined, 0, 1, 5][rng.int(4)],
        options: { decks },
      };
      let s = deepFreeze(engine.setup(config, createRng(`audit-${g}`)));
      let steps = 0;
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s);
        if (p === null) {
          flag(g, 'currentPlayer null before the end');
          break;
        }
        const legal = engine.legalMoves(s, p);
        if (legal.length === 0) flag(g, `stuck: seat ${p} has no moves at step ${steps}`);
        const legalKeys = new Set(legal.map((m) => engine.moveKey(m)));
        for (const seat of [LEARNER, DEALER, 2, -1]) {
          if (seat !== p && engine.legalMoves(s, seat).length !== 0) flag(g, `seat ${seat} moves`);
          const advice = engine.coach(s, seat);
          if (!advice.situation) flag(g, 'empty coach situation');
          if (seat === p) {
            const sug = advice.suggestion as BaccaratMove | undefined;
            if (!sug || !legalKeys.has(engine.moveKey(sug))) flag(g, 'coach suggestion not legal');
          }
          for (const m of CANDIDATES) {
            const move = m as BaccaratMove;
            const check = engine.checkMove(s, seat, move);
            const isLegal = seat === p && legalKeys.has(engine.moveKey(move));
            if (check.ok !== isLegal) flag(g, `checkMove ${engine.moveKey(move)} for ${seat}`);
            if (!check.ok && !check.reason) flag(g, 'illegal move without a reason');
            if (typeof engine.describeMove(s, seat, move) !== 'string') flag(g, 'describeMove');
            if (seat === p && !check.ok) {
              try {
                engine.applyMove(s, move);
                flag(g, `applyMove accepted ${engine.moveKey(move)}`);
              } catch (err) {
                if (!(err instanceof IllegalMoveError)) flag(g, `not an IllegalMoveError: ${err}`);
              }
            }
          }
        }
        const move = rng.pick(legal);
        const before = JSON.stringify(s);
        const next = engine.applyMove(s, move);
        if (JSON.stringify(s) !== before) flag(g, 'applyMove mutated its input');
        // Plain JSON: a round-tripped state continues exactly the same way.
        const again = engine.applyMove(JSON.parse(before) as BaccaratState, move);
        if (JSON.stringify(again) !== JSON.stringify(next)) flag(g, 'JSON round trip differs');
        s = deepFreeze(next);
        steps++;
        const lost = conservationProblem(s);
        if (lost) flag(g, `cards: ${lost}`);
        if (steps > MAX_GAME_MOVES) {
          flag(g, 'did not end within the bet plus six cards');
          break;
        }
      }
      if (engine.currentPlayer(s) !== null) flag(g, 'currentPlayer after the end');
      const r = engine.result(s);
      if (![-1, 0, 0.95, 1, 8].includes(r.humanNetUnits)) flag(g, `net ${r.humanNetUnits}`);
      if (r.humanNetUnits < -MAX_LOSS_UNITS) flag(g, 'lost more than maxLossUnits');
      totals[r.humanOutcome]++;
      totals.moves += steps;
      totals.maxMoves = Math.max(totals.maxMoves, steps);
    }
    console.info(
      `[baccarat audit] fuzz: 3000 coups, avg ${(totals.moves / 3000).toFixed(2)} moves (max ` +
        `${totals.maxMoves}), win/loss/push ${totals.win}/${totals.loss}/${totals.push}`,
    );
    expect(problems).toEqual([]);
    expect(totals.maxMoves).toBeLessThanOrEqual(MAX_GAME_MOVES);
    expect(totals.win + totals.loss + totals.push).toBe(3000);
  }, 60_000);

  it('nothing the learner reads or a bot chooses depends on the face-down shoe', () => {
    const problems: string[] = [];
    for (let seed = 1; seed <= 300; seed++) {
      const rng = createRng(`peek-${seed}`);
      let s = engine.setup({ players: 2, options: { decks: 1 + (seed % 8) } }, createRng(seed));
      while (true) {
        // Same face-up cards, a completely different shoe.
        const other: BaccaratState = { ...s, shoe: shuffle(s.shoe, rng) };
        // Same face-up cards and the same next card (it is turned face up by the deal).
        const top: BaccaratState = {
          ...s,
          shoe: [...s.shoe.slice(0, 1), ...shuffle(s.shoe.slice(1), rng)],
        };
        for (const seat of [LEARNER, DEALER]) {
          if (JSON.stringify(engine.coach(s, seat)) !== JSON.stringify(engine.coach(other, seat))) {
            problems.push(`[seed ${seed}] coach for ${seat} reads the shoe`);
          }
          for (const m of engine.legalMoves(s, seat)) {
            const viewOf = m.type === 'deal' ? top : other;
            if (engine.describeMove(s, seat, m) !== engine.describeMove(viewOf, seat, m)) {
              problems.push(`[seed ${seed}] describeMove ${engine.moveKey(m)} reads the shoe`);
            }
          }
          if (engine.currentPlayer(s) === seat) {
            for (const d of ['easy', 'normal'] as const) {
              const a = engine.botMove(s, seat, d, createRng(seed));
              const b = engine.botMove(other, seat, d, createRng(seed));
              if (engine.moveKey(a) !== engine.moveKey(b)) {
                problems.push(`[seed ${seed}] ${d} bot reads the shoe`);
              }
            }
          }
        }
        const p = engine.currentPlayer(s);
        if (p === null) break;
        // The coach never names a card that is still face down in the shoe.
        const text = JSON.stringify(engine.coach(s, LEARNER));
        for (const c of new Set(s.shoe)) {
          if (!s.player.includes(c) && !s.banker.includes(c) && text.includes(cardName(c))) {
            problems.push(`[seed ${seed}] coach names ${c}`);
          }
        }
        s = engine.applyMove(s, engine.botMove(s, p, seed % 2 ? 'easy' : 'normal', rng));
      }
      if (problems.length > 20) break;
    }
    expect(problems).toEqual([]);
  });

  it('the normal bot is the better bettor: more wins and a smaller average loss than easy', () => {
    const run = (difficulty: 'easy' | 'normal') =>
      simulate(engine, {
        games: 30_000,
        seedBase: 7_000_000,
        config: { players: 2 },
        difficulty: () => difficulty,
        maxMoves: MAX_GAME_MOVES,
        freezeEvery: 0,
      });
    const normal = run('normal');
    const easy = run('easy');
    const rate = (n: number) => `${((100 * n) / 30_000).toFixed(2)}%`;
    console.info(
      `[baccarat audit] 30,000 coups each — normal: win ${rate(normal.outcomes.win)}, net/coup ` +
        `${(normal.netUnits / 30_000).toFixed(4)}; easy: win ${rate(easy.outcomes.win)}, net/coup ` +
        `${(easy.netUnits / 30_000).toFixed(4)}`,
    );
    expect(normal.outcomes.win).toBeGreaterThan(easy.outcomes.win);
    expect(normal.netUnits).toBeGreaterThan(easy.netUnits);
    // Always Banker: ≈ 45.86% wins and ≈ −1.06% a coup (σ of the mean ≈ 0.0055).
    expect(Math.abs(normal.outcomes.win / 30_000 - 0.4586)).toBeLessThan(0.013);
    expect(Math.abs(normal.netUnits / 30_000 + 0.0106)).toBeLessThan(0.025);
  }, 60_000);
});
