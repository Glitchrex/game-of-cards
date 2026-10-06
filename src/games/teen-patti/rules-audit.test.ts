/**
 * Rules audit for Teen Patti: one focused test per rule in docs/RULES_DECISIONS.md and
 * docs/engine-notes/teen-patti.md (plus the standard rules they rely on), written so each
 * fails if the engine gets that rule wrong — and regression tests for every bug found while
 * verifying the engine (pot-limit coaching, seat-aware reasons, split-pot flags).
 */
import { describe, expect, it } from 'vitest';
import {
  type CardCode,
  isJoker,
  makeDeck,
  RANKS,
  rankNumberAceHigh,
  SUITS,
  suitOf,
  card,
} from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { IllegalMoveError } from '@/games/core/types';
import engine, {
  BOOT,
  MAX_LOSS_UNITS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  type TeenPattiMove,
  type TeenPattiOptions,
  type TeenPattiState,
  hitsPotLimit,
  moveCost,
} from './engine';
import { compareHands, rankHand } from './hand-eval';
import { aboutPct } from './strategy';

// ------------------------------------------------------------------ helpers

const h = (s: string) => s.split(' ') as CardCode[];
const M = (type: TeenPattiMove['type']) => ({ type }) as TeenPattiMove;
const TYPES = ['see', 'chaal', 'raise', 'show', 'pack'] as const;

/** A table with chosen hands. Dealer = last seat (so seat 0 acts first) unless overridden. */
function table(hands: string[], options: TeenPattiOptions = {}): TeenPattiState {
  const players = hands.length;
  const base = engine.setup(
    { players, options: { dealer: players - 1, ...options } },
    createRng('audit'),
  );
  const dealt = hands.map(h);
  const used = new Set<string>(dealt.flat());
  return { ...base, hands: dealt, stock: makeDeck().filter((c) => !used.has(c)) };
}

function play(state: TeenPattiState, ...types: TeenPattiMove['type'][]): TeenPattiState {
  return types.reduce((s, t) => engine.applyMove(s, M(t)), state);
}

const keys = (s: TeenPattiState, p: number) =>
  engine.legalMoves(s, p).map((m) => engine.moveKey(m));
const contributedBy = (before: TeenPattiState, after: TeenPattiState, p: number) =>
  (after.contributed[p] ?? 0) - (before.contributed[p] ?? 0);

const A_HIGH = 'AS 9D 4C';
const K_HIGH = 'KH QD 8C';
const PAIR_7 = '7S 7H KD';
const WEAK = 'TS 7D 2C';

// ------------------------------------------------------- table and the deal

describe('rule: 3 seats by default, 2–5 supported, one deal per game', () => {
  it('accepts exactly 2–5 players', () => {
    expect([MIN_PLAYERS, MAX_PLAYERS]).toEqual([2, 5]);
    for (let n = 2; n <= 5; n++) {
      expect(engine.setup({ players: n }, createRng(n)).players).toBe(n);
    }
    for (const n of [1, 6]) expect(() => engine.setup({ players: n }, createRng(n))).toThrow();
  });

  it('plays a single deal: the hands never change and nothing can happen after the end', () => {
    let s = engine.setup({ players: 4 }, createRng('one-deal'));
    const dealt = JSON.stringify(s.hands);
    const rng = createRng('one-deal-bots');
    while (!engine.isOver(s)) {
      const p = engine.currentPlayer(s) ?? 0;
      s = engine.applyMove(s, engine.botMove(s, p, 'normal', rng));
      expect(JSON.stringify(s.hands)).toBe(dealt);
    }
    for (let p = 0; p < 4; p++) {
      expect(engine.legalMoves(s, p)).toEqual([]);
      for (const t of TYPES) expect(engine.checkMove(s, p, M(t)).ok).toBe(false);
    }
    expect(() => engine.applyMove(s, M('chaal'))).toThrow(IllegalMoveError);
  });

  it('uses one standard 52-card deck with no jokers', () => {
    for (let n = 2; n <= 5; n++) {
      const s = engine.setup({ players: n }, createRng(`deck-${n}`));
      const all = [...s.hands.flat(), ...s.stock];
      expect(all.some(isJoker)).toBe(false);
      expect([...all].sort()).toEqual([...makeDeck()].sort());
    }
  });

  it('the player on the dealer’s left (the next seat) acts first, for every dealer', () => {
    for (let n = 2; n <= 5; n++) {
      for (let dealer = 0; dealer < n; dealer++) {
        const s = engine.setup({ players: n, options: { dealer } }, createRng(dealer));
        expect(engine.currentPlayer(s)).toBe((dealer + 1) % n);
      }
    }
  });
});

describe('rule: everyone posts a 1-unit boot and starts blind', () => {
  it('for every table size', () => {
    expect(BOOT).toBe(1);
    for (let n = 2; n <= 5; n++) {
      const s = engine.setup({ players: n }, createRng(`boot-${n}`));
      expect(s.contributed).toEqual(Array.from({ length: n }, () => 1));
      expect(s.pot).toBe(n);
      expect(s.seen.every((x) => !x)).toBe(true);
      expect(s.stake).toBe(1);
    }
  });
});

// ------------------------------------------------------------------ actions

describe('rule: on your turn — pack, chaal or see (then act)', () => {
  it('see is free, keeps the turn and can happen at any of your turns (not only the first)', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'chaal', 'chaal');
    const seen = play(s, 'see'); // seat 2 looks on its first turn
    expect(engine.currentPlayer(seen)).toBe(2);
    expect(seen.pot).toBe(s.pot);
    const later = play(seen, 'chaal', 'see'); // seat 0 looks on its second turn
    expect(later.seen).toEqual([true, false, true]);
    expect(engine.currentPlayer(later)).toBe(0);
    expect(keys(later, 0)).not.toContain('see');
  });

  it('pack loses only what you put in', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'raise', 'chaal', 'chaal', 'pack');
    expect(s.packed[0]).toBe(true);
    const done = play(s, 'pack');
    const r = engine.result(done);
    expect(r.humanNetUnits).toBe(-(s.contributed[0] ?? 0));
    expect(r.humanNetUnits).toBe(-5);
  });
});

describe('rule: blind bets the stake (1×) or raises 2×; seen bets 2× or raises 4×', () => {
  it('pays the right amount for each of the four bets at stakes 1, 2 and 4', () => {
    for (const raises of [0, 1, 2]) {
      const prefix: TeenPattiMove['type'][] = Array.from({ length: raises }, () => 'raise');
      const start = play(table([A_HIGH, K_HIGH, PAIR_7, WEAK], { dealer: 3 }), ...prefix);
      const stake = 2 ** raises;
      expect(start.stake).toBe(stake);
      const p = engine.currentPlayer(start) ?? 0;
      const blindChaal = play(start, 'chaal');
      expect(contributedBy(start, blindChaal, p)).toBe(stake);
      expect(blindChaal.stake).toBe(stake);
      const blindRaise = play(start, 'raise');
      expect(contributedBy(start, blindRaise, p)).toBe(2 * stake);
      expect(blindRaise.stake).toBe(2 * stake);
      const seenChaal = play(start, 'see', 'chaal');
      expect(contributedBy(start, seenChaal, p)).toBe(2 * stake);
      expect(seenChaal.stake).toBe(stake);
      const seenRaise = play(start, 'see', 'raise');
      expect(contributedBy(start, seenRaise, p)).toBe(4 * stake);
      expect(seenRaise.stake).toBe(2 * stake);
    }
  });

  it('the stake is the blind-equivalent: after a seen chaal of 2, a blind player still pays 1', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'chaal');
    expect(s.contributed[0]).toBe(3);
    expect(s.stake).toBe(1);
    const next = play(s, 'chaal');
    expect(contributedBy(s, next, 1)).toBe(1);
  });

  it('after a seen raise of 4, a blind player pays 2 and a seen player 4', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'see', 'raise');
    expect(s.stake).toBe(2);
    expect(contributedBy(s, play(s, 'chaal'), 1)).toBe(2);
    expect(contributedBy(s, play(s, 'see', 'chaal'), 1)).toBe(4);
  });
});

describe('rule: chaal limit — the stake can never exceed 8 boots', () => {
  it('a seen raise from 4 to 8 is allowed (costs 16), then nobody, blind or seen, can raise', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7]), 'raise', 'raise'); // stake 4, seat 2 to act
    const raised = play(s, 'see', 'raise');
    expect(contributedBy(s, raised, 2)).toBe(16);
    expect(raised.stake).toBe(8);
    expect(keys(raised, 0)).not.toContain('raise'); // seat 0 blind
    const seenNext = play(raised, 'see');
    expect(keys(seenNext, 0)).not.toContain('raise'); // seat 0 seen
    expect(engine.checkMove(seenNext, 0, M('raise')).reason).toMatch(/chaal limit/);
    expect(moveCost(seenNext, 0, M('chaal'))).toBe(16);
    expect(moveCost(raised, 0, M('chaal'))).toBe(8);
  });

  it('the stake never passes the limit in long games, for every allowed limit', () => {
    for (const stakeLimit of [1, 2, 4, 8]) {
      for (let seed = 0; seed < 40; seed++) {
        let s = engine.setup({ players: 3, options: { stakeLimit } }, createRng(`sl-${seed}`));
        const rng = createRng(`sl-moves-${seed}`);
        while (!engine.isOver(s)) {
          const p = engine.currentPlayer(s) ?? 0;
          const legal = engine.legalMoves(s, p).filter((m) => m.type !== 'pack');
          s = engine.applyMove(s, rng.pick(legal));
          expect(s.stake).toBeLessThanOrEqual(stakeLimit);
        }
      }
    }
  });
});

describe('rule: pot limit 64 — the bet is capped and everyone still in shows', () => {
  /** Four blind chaals with a 9-boot limit: the pot is 1 boot below it, all 4 players in. */
  function nearLimit(): TeenPattiState {
    return play(table([A_HIGH, K_HIGH, PAIR_7, '2D 3S 5H'], { potLimit: 9 }), ...chaals(4));
  }
  const chaals = (n: number) => Array.from({ length: n }, () => 'chaal' as const);

  it('a pot 1 below the limit does not end the hand; the next bet is cut to 1 boot', () => {
    const s = nearLimit();
    expect(s.pot).toBe(8);
    expect(engine.isOver(s)).toBe(false);
    const seen = play(s, 'see');
    for (const state of [s, seen]) {
      for (const t of ['chaal', 'raise'] as const) {
        expect(moveCost(state, 0, M(t))).toBe(1);
        expect(hitsPotLimit(state, 0, M(t))).toBe(true);
      }
    }
    const end = play(seen, 'chaal');
    expect(end.pot).toBe(9);
    expect(end.contributed[0]).toBe(3); // a seen chaal of 2 cut to 1
    expect(end.outcome?.kind).toBe('pot-limit');
    expect(end.outcome?.showdown).toEqual([0, 1, 2, 3]);
    // Pair of Sevens is the best hand among the four.
    expect(end.outcome?.winners).toEqual([2]);
    expect(end.outcome?.payouts).toEqual([0, 0, 9, 0]);
  });

  it('see and pack never trigger the pot limit, even one boot below it', () => {
    const s = nearLimit();
    expect(engine.isOver(play(s, 'see'))).toBe(false);
    const packed = play(s, 'pack');
    expect(engine.isOver(packed)).toBe(false);
    expect(packed.pot).toBe(8);
  });

  it('a raise that would pass the limit is capped too', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7], { potLimit: 6 }), 'see', 'raise');
    expect(s.contributed[0]).toBe(4); // a seen raise of 4 cut to 3
    expect(s.pot).toBe(6);
    expect(s.outcome?.kind).toBe('pot-limit');
  });

  it('heads-up, a chaal that reaches the limit is a pot-limit show: an exact tie splits', () => {
    const s = play(table(['AS KD 9C', 'AH KC 9D'], { potLimit: 6 }), ...chaals(4));
    expect(s.outcome).toMatchObject({ kind: 'pot-limit', winners: [0, 1], asker: null });
    expect(s.outcome?.payouts).toEqual([3, 3]);
  });

  it('a three-way exact tie splits the pot, odd boots going round from the dealer’s left', () => {
    const hands = ['AS KH 9D', 'AH KD 9C', 'AD KC 9S'];
    const s = play(table(hands, { potLimit: 8 }), ...chaals(5));
    expect(s.pot).toBe(8);
    expect(s.outcome?.winners).toEqual([0, 1, 2]);
    expect(s.outcome?.payouts).toEqual([3, 3, 2]); // dealer 2: seats 0 then 1 get the odd boots
    const r = engine.result(s);
    expect(r.humanNetUnits).toBe(0);
    expect(r.humanOutcome).toBe('push');
  });

  it('a packed player is never paid, even holding the best hand', () => {
    const s = play(table(['AS AH AD', K_HIGH, '5S 9D 4C'], { potLimit: 7 }), 'pack', ...chaals(4));
    expect(s.outcome?.kind).toBe('pot-limit');
    expect(s.outcome?.showdown).toEqual([1, 2]);
    expect(s.outcome?.payouts[0]).toBe(0);
  });
});

describe('rule: show — two players left, costs a chaal, asker loses an exact tie', () => {
  it('is only legal with exactly two players left, at every table size', () => {
    for (let n = 3; n <= 5; n++) {
      const hands = [A_HIGH, K_HIGH, PAIR_7, WEAK, '2D 3S 5H'].slice(0, n);
      let s = table(hands);
      for (let packs = 0; packs < n - 2; packs++) {
        const p = engine.currentPlayer(s) ?? 0;
        expect(keys(s, p)).not.toContain('show');
        expect(engine.checkMove(s, p, M('show')).ok).toBe(false);
        s = play(s, 'pack');
      }
      const p = engine.currentPlayer(s) ?? 0;
      expect(keys(s, p)).toContain('show');
    }
  });

  it('a blind player may ask a seen player for a show (and pays the blind price)', () => {
    const s = play(table([PAIR_7, A_HIGH]), 'see', 'chaal'); // seat 0 seen, seat 1 blind
    const shown = play(s, 'show');
    expect(contributedBy(s, shown, 1)).toBe(1);
    expect(shown.outcome).toMatchObject({ kind: 'show', asker: 1, winners: [0] });
  });

  it('exact tie between two bots: the bot that asked loses', () => {
    const s = play(table([A_HIGH, 'AH KD 9C', 'AC KH 9S']), 'pack', 'show');
    expect(compareHands(s.hands[1] ?? [], s.hands[2] ?? [])).toBe(0);
    expect(s.outcome).toMatchObject({ kind: 'show', asker: 1, winners: [2] });
  });

  it('the asker wins outright with the better hand, and loses outright with the worse one', () => {
    expect(play(table([PAIR_7, A_HIGH]), 'show').outcome?.winners).toEqual([0]);
    expect(play(table([A_HIGH, PAIR_7]), 'show').outcome?.winners).toEqual([1]);
  });
});

describe('rule: last player standing wins the pot', () => {
  it('with five players, after four packs, without anyone showing', () => {
    const s = play(
      table([WEAK, K_HIGH, PAIR_7, A_HIGH, '2D 3S 5H']),
      'chaal',
      'pack',
      'pack',
      'pack',
      'pack',
    );
    expect(s.outcome).toMatchObject({ kind: 'last-standing', winners: [0], showdown: [] });
    expect(s.outcome?.payouts).toEqual([6, 0, 0, 0, 0]);
    expect(engine.result(s).humanNetUnits).toBe(4);
  });
});

// ------------------------------------------------------------------ hands

/** Independent hand key: [category 0–5, tie-breaks…], built from a fixed sequence table. */
function independentKey(cards: readonly CardCode[]): number[] {
  const v = cards.map(rankNumberAceHigh).sort((a, b) => b - a);
  const flush = new Set(cards.map(suitOf)).size === 1;
  const runs = ['4,3,2', '5,4,3', '6,5,4', '7,6,5', '8,7,6', '9,8,7', '10,9,8'];
  runs.push('11,10,9', '12,11,10', '13,12,11', '14,3,2', '14,13,12');
  const run = runs.indexOf(v.join(','));
  if (v[0] === v[2]) return [5, v[0] ?? 0];
  if (run >= 0) return [flush ? 4 : 3, run];
  if (flush) return [2, ...v];
  if (v[0] === v[1]) return [1, v[0] ?? 0, v[2] ?? 0];
  if (v[1] === v[2]) return [1, v[1] ?? 0, v[0] ?? 0];
  return [0, ...v];
}

function cmpKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

describe('rule: hand ranking Trail > Pure sequence > Sequence > Colour > Pair > High card', () => {
  const deck: CardCode[] = [];
  for (const s of SUITS) for (const r of RANKS) deck.push(card(r, s));
  const all: CardCode[][] = [];
  for (let i = 0; i < 52; i++)
    for (let j = i + 1; j < 52; j++)
      for (let k = j + 1; k < 52; k++) all.push([deck[i], deck[j], deck[k]] as CardCode[]);

  it('agrees with an independent ranking on the full order of all 22,100 hands', () => {
    const CATS = ['high-card', 'pair', 'colour', 'sequence', 'pure-sequence', 'trail'];
    const sorted = all
      .map((hand) => ({ hand, key: independentKey(hand) }))
      .sort((a, b) => cmpKeys(a.key, b.key));
    for (const { hand, key } of sorted) expect(rankHand(hand).category).toBe(CATS[key[0] ?? 0]);
    for (let i = 0; i + 1 < sorted.length; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      if (!a || !b) continue;
      const expected = Math.sign(cmpKeys(b.key, a.key));
      expect(Math.sign(compareHands(b.hand, a.hand))).toBe(expected);
    }
    const rng = createRng('random-pairs');
    for (let n = 0; n < 20_000; n++) {
      const a = rng.pick(all);
      const b = rng.pick(all);
      const expected = Math.sign(cmpKeys(independentKey(a), independentKey(b)));
      expect(Math.sign(compareHands(a, b))).toBe(expected);
    }
  });

  it('every hand gets a correct, non-empty name', () => {
    const names = new Set(all.map((hand) => rankHand(hand).name));
    expect(names.has('Trail of Aces')).toBe(true);
    expect(names.has('Pure sequence, Ace-King-Queen')).toBe(true);
    expect(names.has('Sequence, Four-Three-Two')).toBe(true);
    expect(names.has('Colour (all Spades), Five high')).toBe(true);
    expect(names.has('Pair of Twos')).toBe(true);
    expect(names.has('High card, Five')).toBe(true);
    for (const n of names) expect(n).not.toMatch(/undefined|NaN|\d/);
  });

  it('three-card wrap-arounds (Q-K-A is fine, K-A-2 is not) and A-2-3 vs 2-3-4', () => {
    expect(rankHand(h('QS KD AH')).category).toBe('sequence');
    expect(rankHand(h('KS AD 2H')).category).toBe('high-card');
    expect(compareHands(h('AS 2D 3H'), h('4S 3D 2H'))).toBeGreaterThan(0);
    expect(compareHands(h('AS 2D 3H'), h('KS QD JH'))).toBeGreaterThan(0);
    expect(compareHands(h('AS KD QH'), h('AC 2H 3D'))).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ units

describe('rule: units — humanNetUnits = boots won − boots put in, never below −64', () => {
  it('matches payouts minus contributions, scores sum to zero, and stays within the escrow', () => {
    expect(MAX_LOSS_UNITS).toBe(64);
    for (let seed = 0; seed < 400; seed++) {
      const n = 2 + (seed % 4);
      let s = engine.setup({ players: n }, createRng(`units-${seed}`));
      const rng = createRng(`units-moves-${seed}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        // Never pack and rarely show, so many games run all the way to the pot limit.
        const legal = engine.legalMoves(s, p).filter((m) => m.type !== 'pack');
        const choice = rng.pick(legal);
        s = engine.applyMove(s, choice.type === 'show' && rng.next() < 0.8 ? M('chaal') : choice);
      }
      const r = engine.result(s);
      const o = s.outcome;
      expect(o).not.toBeNull();
      expect(r.humanNetUnits).toBe((o?.payouts[0] ?? 0) - (s.contributed[0] ?? 0));
      expect(r.scores?.reduce((a, b) => a + b, 0)).toBe(0);
      expect(r.humanNetUnits).toBeGreaterThanOrEqual(-MAX_LOSS_UNITS);
      expect(s.pot).toBeLessThanOrEqual(64);
    }
  });
});

// --------------------------------------------------- regressions (audit bugs)

describe('regression: coaching near the pot limit', () => {
  it('blind, when the next bet reaches the limit: look first (free), not a blind chaal', () => {
    // potLimit 10: pot 9, stake 2 — seat 2's blind chaal is cut to 1 and forces a show.
    const s = play(table([A_HIGH, K_HIGH, PAIR_7], { potLimit: 10 }), 'see', 'raise', 'chaal');
    expect(engine.currentPlayer(s)).toBe(2);
    expect(hitsPotLimit(s, 2, M('chaal'))).toBe(true);
    const advice = engine.coach(s, 2);
    expect(advice.suggestion).toEqual({ type: 'see' });
    expect(advice.why).toMatch(/10-boot limit/);
    expect(advice.why).not.toMatch(/stay in/);
    for (let i = 0; i < 100; i++) {
      expect(engine.botMove(s, 2, 'normal', createRng(`blind-cap-${i}`)).type).toBe('see');
    }
  });

  it('the situation states the real, capped price instead of "a chaal costs double"', () => {
    const s = play(table([A_HIGH, K_HIGH, PAIR_7], { potLimit: 10 }), 'see', 'raise', 'chaal');
    const blind = engine.coach(s, 2).situation;
    expect(blind).not.toMatch(/so a blind chaal costs/);
    expect(blind).toMatch(/your next bet costs 1 boot \(cut down to fit\)/);
    expect(blind).toMatch(/everyone still in must show/);
    const seen = engine.coach(play(s, 'see'), 2).situation;
    expect(seen).not.toMatch(/you pay double/);
    expect(seen).toMatch(/10-boot pot limit/);
  });

  it('heads-up, when a chaal already forces the show: chaal (a tie splits) instead of asking', () => {
    // Pair of Twos (≈74%) against a blind player; pot 5 of a 6-boot limit.
    const s = play(table(['2S 2H 3D', K_HIGH], { potLimit: 6 }), 'see', 'chaal', 'chaal');
    expect(hitsPotLimit(s, 0, M('chaal'))).toBe(true);
    const advice = engine.coach(s, 0);
    expect(advice.suggestion).toEqual({ type: 'chaal' });
    expect(advice.why).toMatch(/exact tie splits the pot/);
    for (let i = 0; i < 100; i++) {
      expect(engine.botMove(s, 0, 'normal', createRng(`heads-up-cap-${i}`)).type).toBe('chaal');
    }
  });

  it('never raises into the pot limit with "make the others pay more" — it chaals', () => {
    // Trail of Kings; a seen raise (4) would reach the 7-boot limit, a seen chaal (2) would not.
    const s = play(table(['KS KH KD', '3C 5D 9S', '4C 8C JD'], { potLimit: 7 }), 'see');
    expect(hitsPotLimit(s, 0, M('raise'))).toBe(true);
    expect(hitsPotLimit(s, 0, M('chaal'))).toBe(false);
    const advice = engine.coach(s, 0);
    expect(advice.suggestion).toEqual({ type: 'chaal' });
    expect(advice.why).not.toMatch(/pay more to stay in/);
    expect(advice.situation).toMatch(/A raise would bring the pot to the 7-boot pot limit/);
    for (let i = 0; i < 100; i++) {
      expect(engine.botMove(s, 0, 'normal', createRng(`raise-cap-${i}`)).type).toBe('chaal');
    }
  });

  it('never bluffs into a forced showdown it cannot win', () => {
    // Weak Ten-high against two seen raisers; the 2-boot chaal would force everyone to show.
    const s = play(
      table([WEAK, K_HIGH, PAIR_7], { potLimit: 18 }),
      'chaal',
      'see',
      'raise',
      'see',
      'raise',
      'see',
    );
    expect(moveCost(s, 0, M('chaal'))).toBe(2);
    expect(hitsPotLimit(s, 0, M('chaal'))).toBe(true);
    for (let i = 0; i < 400; i++) {
      expect(engine.botMove(s, 0, 'normal', createRng(`no-bluff-${i}`)).type).toBe('pack');
    }
    expect(engine.coach(s, 0).why).toMatch(/less than 1%/);
  });

  it('never reports a misleading 0% or 100%', () => {
    expect(aboutPct(0.999)).toBe('over 99%');
    expect(aboutPct(0.001)).toBe('less than 1%');
    expect(aboutPct(0.62)).toBe('about 62%');
    const trail = engine.coach(play(table(['AS AH AD', K_HIGH, PAIR_7]), 'see'), 0);
    expect(trail.situation).toMatch(/Trail of Aces, which beats over 99% of all hands/);
    expect(`${trail.situation} ${trail.why ?? ''}`).not.toMatch(/\b(0|100)%/);
  });
});

describe('regression: checkMove reasons address the right seat', () => {
  const s3 = table([A_HIGH, K_HIGH, PAIR_7]);

  it('a bot trying to look out of turn is not told "when it’s your turn — it’s your turn"', () => {
    const reason = engine.checkMove(s3, 2, M('see')).reason ?? '';
    expect(reason).toBe(
      "Player 2 can only look at their cards on their own turn — right now it's your turn.",
    );
  });

  it('reasons for a bot seat name that seat (and "their cards")', () => {
    const s = play(s3, 'chaal');
    expect(engine.checkMove(s, 1, M('show')).reason).toBe(
      'Player 1 can only ask for a show when just two players are left, and right now 3 players are still in. Player 1 can see their cards (free), chaal for 1 boot, raise for 2 boots or pack instead.',
    );
    const seen = play(s, 'see');
    expect(engine.checkMove(seen, 1, M('see')).reason).toBe(
      'Player 1 has already seen their cards. Now Player 1 can chaal for 2 boots, raise for 4 boots or pack.',
    );
    const capped = play(s3, 'raise', 'raise', 'raise', 'chaal');
    expect(engine.checkMove(capped, 1, M('raise')).reason).toMatch(
      /nobody can raise any more\. Player 1 can still chaal for 8 boots\.$/,
    );
  });

  it('the learner’s own reasons are unchanged', () => {
    expect(engine.checkMove(play(s3, 'see'), 0, M('see')).reason).toBe(
      "You've already seen your cards. Now you can chaal for 2 boots, raise for 4 boots or pack.",
    );
  });
});

describe('regression: honest flags for a split pot', () => {
  it('a split is a close finish and never a "lucky last card" win', () => {
    // You and Player 1 tie A-K-9; Player 2's A-K-2 loses to you only on the last card.
    const s = play(
      table(['AS KH 9D', 'AH KD 9C', 'AD KC 2S'], { potLimit: 7 }),
      'chaal',
      'chaal',
      'chaal',
      'chaal',
    );
    expect(s.outcome?.winners).toEqual([0, 1]);
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('win'); // 4 of the 7 boots (odd boot) for 3 put in
    expect(r.flags.luckyLastCard).toBe(false);
    expect(r.flags.closeFinish).toBe(true);
  });

  it('a split is a close finish even when the third hand lost on category', () => {
    const s = play(
      table(['7S 7H KD', '7D 7C KS', A_HIGH], { potLimit: 7 }),
      'chaal',
      'chaal',
      'chaal',
      'chaal',
    );
    expect(s.outcome?.winners).toEqual([0, 1]);
    expect(engine.result(s).flags.closeFinish).toBe(true);
  });
});
