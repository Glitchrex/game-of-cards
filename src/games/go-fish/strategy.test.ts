import { describe, expect, it } from 'vitest';
import { RANKS, rankOf, type CardCode, type Rank } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import type { PlayerId } from '@/games/core/types';
import { goFishEngine as engine, type GoFishEvent, type GoFishState } from './engine';
import { countRank, rankIndex } from './rules';
import {
  easyMove,
  holdChance,
  normalDecision,
  rateAsks,
  seatView,
  type SeatView,
} from './strategy';
import { makeState } from './test-helpers';

const ask = (seat: PlayerId, target: PlayerId, rank: Rank, got: number): GoFishEvent => ({
  type: 'ask',
  seat,
  target,
  rank,
  got,
});

/** Play `moves` bot moves of a seeded game (normal bots) and return the position. */
function midGame(seed: number, players: number, moves: number): GoFishState {
  let s = engine.setup({ players }, createRng(seed));
  const rng = createRng(`mid-${seed}`);
  for (let i = 0; i < moves && !engine.isOver(s); i++) {
    const p = engine.currentPlayer(s)!;
    s = engine.applyMove(s, engine.botMove(s, p, i % 3 === 0 ? 'easy' : 'normal', rng));
  }
  return s;
}

/** The public bounds of the view hold for the real hands. */
function expectSound(s: GoFishState, view: SeatView): void {
  for (let seat = 0; seat < s.players; seat++) {
    if (seat === view.seat) continue;
    const hand = s.hands[seat]!;
    for (const rank of RANKS) {
      const r = rankIndex(rank);
      const actual = countRank(hand, rank);
      const known = view.known[seat]![r]!;
      const room = Math.min(view.maybe[seat]![r]!, view.unknown[seat]!);
      expect(known).toBeLessThanOrEqual(actual);
      expect(actual).toBeLessThanOrEqual(known + room);
      if (view.absence[seat]![r] !== null) expect(actual).toBe(0);
      const chance = holdChance(view, seat, rank);
      if (chance >= 1) expect(actual).toBeGreaterThan(0);
      if (chance <= 0 && view.bookOwner[r] === null) expect(actual).toBe(0);
    }
  }
}

describe('seat view (public memory)', () => {
  it('starts with nothing known about anyone else', () => {
    const s = engine.setup({ players: 3 }, createRng(5));
    const v = seatView(s, 0);
    expect(v.hand).toEqual(s.hands[0]);
    expect(v.handCounts).toEqual(s.hands.map((h) => h.length));
    expect(v.unknown).toEqual([0, s.hands[1]!.length, s.hands[2]!.length]);
    expect(v.pool).toBe(s.stock.length + s.hands[1]!.length + s.hands[2]!.length);
    expect(v.known.flat().every((n) => n === 0)).toBe(true);
    for (const rank of RANKS) {
      const r = rankIndex(rank);
      const booked = v.bookOwner[r] !== null;
      expect(v.outstanding[r]).toBe(booked ? 0 : 4 - countRank(s.hands[0]!, rank));
    }
  });

  it('remembers who asked for what, who caught what and who handed it over', () => {
    const log: GoFishEvent[] = [
      ask(1, 2, '7', 0), // Player 1 asked for Sevens: holds at least one; Player 2 has none.
      { type: 'fish', seat: 1, card: '3S', wish: false },
      ask(2, 1, 'K', 2), // Player 2 caught two Kings from Player 1: holds at least three.
    ];
    const s = makeState({
      hands: ['7S 4C', '7H 3S 9D', 'KS KH KD 2H 5D'],
      log,
      turn: 2,
    });
    const v = seatView(s, 0);
    const r7 = rankIndex('7');
    const rK = rankIndex('K');
    expect(v.known[1]![r7]).toBe(1);
    expect(v.proof[1]![r7]).toBe('asked');
    expect(v.known[2]![rK]).toBe(3);
    expect(v.proof[2]![rK]).toBe('caught');
    expect(v.known[1]![rK]).toBe(0);
    expect(v.absence[1]![rK]).toBe('gave');
    // Player 2 said "Go Fish" to Sevens and has drawn nothing since.
    expect(v.absence[2]![r7]).toBe('denied');
    expect(v.maybe[2]![r7]).toBe(0);
    expect(holdChance(v, 2, '7')).toBe(0);
    expect(holdChance(v, 1, '7')).toBe(1);
    // Player 1's Go Fish card is face down: it could be anything except a Seven.
    expect(v.maybe[1]![rankIndex('3')]).toBeGreaterThan(0);
    expect(v.unknown).toEqual([0, 2, 2]);
    expect(v.outstanding[r7]).toBe(4 - 1 - 1);
    expectSound(s, v);
  });

  it('forgets a "Go Fish" once that player draws a face-down card', () => {
    const s = makeState({
      hands: ['7S 4C', '2S 9D', 'KS 5D 3H'],
      log: [
        ask(0, 2, '7', 0),
        { type: 'fish', seat: 0, card: '4C', wish: false },
        ask(1, 0, '2', 0),
      ],
      turn: 2,
    });
    const before = seatView(s, 1);
    expect(before.absence[2]![rankIndex('7')]).toBe('denied');
    const later = {
      ...s,
      log: [...s.log, { type: 'refill', seat: 2, card: '3H' } as GoFishEvent],
    };
    const after = seatView(later, 1);
    expect(after.absence[2]![rankIndex('7')]).toBeNull();
    expect(after.maybe[2]![rankIndex('7')]).toBe(1);
  });

  it('a fished wish is public; a book wipes the rank from memory', () => {
    const s = makeState({
      hands: ['4C', '7S 7H 9D', 'KS 5D'],
      books: ['', '', 'Q'],
      log: [
        ask(1, 2, '7', 0),
        { type: 'fish', seat: 1, card: '7H', wish: true },
        ask(2, 0, 'Q', 1),
        { type: 'book', seat: 2, rank: 'Q', via: 'catch' },
      ],
    });
    const v = seatView(s, 0);
    expect(v.known[1]![rankIndex('7')]).toBe(2);
    expect(v.proof[1]![rankIndex('7')]).toBe('wish');
    expect(v.known[2]![rankIndex('Q')]).toBe(0);
    expect(v.bookOwner[rankIndex('Q')]).toBe(2);
    expect(holdChance(v, 2, 'Q')).toBe(0);
    expectSound(s, v);
  });

  it('works out the last copies exactly when only one player can hold them', () => {
    // Heads-up with an empty pond: every Seven you don't hold is in the other hand.
    const s = makeState({
      hands: ['7S KD 2C', '7H 7D 7C KS KH KC 2S 2H 2D'],
      books: ['A 3 4 5 6', '8 9 T J Q'],
      exactStock: true,
    });
    expect(s.stock).toEqual([]);
    const v = seatView(s, 0);
    expect(holdChance(v, 1, '7')).toBe(1);
    expect(holdChance(v, 1, 'K')).toBe(1);
    expect(holdChance(v, 1, '2')).toBe(1);
    const d = normalDecision(v);
    expect(d.why).toMatch(
      /^Count the cards: the pond is empty and nobody else can be hiding any, so every (Seven|King|Two) you can't see must be in Player 1's hand\./,
    );
    expect(d.why).toContain('completes your book');
  });

  it('never depends on hidden cards: other hands, the pond order or face-down draws', () => {
    for (const [seed, players] of [
      [3, 3],
      [11, 4],
      [19, 5],
      [23, 2],
    ] as const) {
      const s = midGame(seed, players, 18);
      if (engine.isOver(s)) continue;
      const viewer = engine.currentPlayer(s)!;
      // Swap every hidden card (other hands + pond) for a different arrangement.
      const hidden = [...s.hands.filter((_, i) => i !== viewer).flat(), ...s.stock];
      const rotated = [...hidden.slice(5), ...hidden.slice(0, 5)];
      let k = 0;
      const hands = s.hands.map((h, i) => (i === viewer ? h : h.map(() => rotated[k++]!)));
      const stock = s.stock.map(() => rotated[k++]!);
      const log = s.log.map((e): GoFishEvent => {
        if (e.type === 'refill') return { ...e, card: '2C' };
        if (e.type === 'fish' && !e.wish) return { ...e, card: '2C' };
        return e;
      });
      const twin: GoFishState = { ...s, hands, stock, log };
      expect(seatView(twin, viewer)).toEqual(seatView(s, viewer));
      expect(normalDecision(seatView(twin, viewer))).toEqual(normalDecision(seatView(s, viewer)));
      expect(easyMove(seatView(twin, viewer), createRng(1))).toEqual(
        easyMove(seatView(s, viewer), createRng(1)),
      );
    }
  });

  it('stays sound (never claims more than the truth) all through real games', () => {
    for (let seed = 1; seed <= 12; seed++) {
      let s = engine.setup({ players: 2 + (seed % 4) }, createRng(`sound-${seed}`));
      const rng = createRng(`sound-bots-${seed}`);
      while (!engine.isOver(s)) {
        for (let viewer = 0; viewer < s.players; viewer++) expectSound(s, seatView(s, viewer));
        const p = engine.currentPlayer(s)!;
        s = engine.applyMove(s, engine.botMove(s, p, seed % 2 ? 'easy' : 'normal', rng));
      }
    }
  });
});

describe('normal bot', () => {
  it('asks a proven holder before taking any guess, biggest group first', () => {
    // Player 2 asked for Fours and Kings earlier and missed both times.
    const log: GoFishEvent[] = [
      ask(2, 1, '4', 0),
      { type: 'fish', seat: 2, card: '9H', wish: false },
      ask(2, 1, 'K', 0),
    ];
    const s = makeState({
      hands: ['7S 7H 7D 4S KD KC', '2S 9D', 'KS 4H 9H 5D'],
      log,
    });
    const d = normalDecision(seatView(s, 0));
    expect(d.move).toEqual({ type: 'ask', target: 2, rank: 'K' });
    expect(d.why).toMatch(/^Player 2 asked for Kings earlier/);
    expect(d.why).toContain('sure catch');
  });

  it('says when a sure catch completes a book', () => {
    const log: GoFishEvent[] = [ask(1, 2, '7', 1)];
    const s = makeState({ hands: ['7S 7H 4C', '7D 7C 2S', 'KS 5D'], log });
    const d = normalDecision(seatView(s, 0));
    expect(d.move).toEqual({ type: 'ask', target: 1, rank: '7' });
    expect(d.why).toMatch(/^Player 1 collected Sevens earlier/);
    expect(d.why).toContain('completes your book of Sevens');
  });

  it('with nothing proven, goes for the rank it holds most of', () => {
    const s = makeState({ hands: ['7S 7H KD 4C', '2S 9D 3C 3D TC JC QC', 'KS 5D 6D 6C 8C 8D 9C'] });
    const d = normalDecision(seatView(s, 0));
    expect(d.move.rank).toBe('7');
    expect(d.why).toContain('biggest group');
  });

  it('avoids a player who just said "Go Fish" to that rank', () => {
    const log: GoFishEvent[] = [
      ask(0, 1, '7', 0),
      { type: 'fish', seat: 0, card: '4C', wish: false },
    ];
    const s = makeState({ hands: ['7S 7H 4C', '2S 9D 3C', 'KS 5D 6D'], log });
    const d = normalDecision(seatView(s, 0));
    expect(d.move).toEqual({ type: 'ask', target: 2, rank: '7' });
    expect(d.why).toContain('Player 1 already said "Go Fish" to Sevens');
  });

  it('rates every legal ask exactly once', () => {
    const s = midGame(4, 4, 10);
    const p = engine.currentPlayer(s)!;
    const rated = rateAsks(seatView(s, p)).map((c) => engine.moveKey(c.move));
    expect(rated.sort()).toEqual(
      engine
        .legalMoves(s, p)
        .map((m) => engine.moveKey(m))
        .sort(),
    );
  });

  it('decides quickly (well under 30 ms per decision)', () => {
    let decisions = 0;
    let slowest = 0;
    const started = performance.now();
    for (let seed = 1; seed <= 20; seed++) {
      let s = engine.setup({ players: 5 }, createRng(`speed-${seed}`));
      const rng = createRng(seed);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s)!;
        const t = performance.now();
        const m = engine.botMove(s, p, 'normal', rng);
        slowest = Math.max(slowest, performance.now() - t);
        decisions++;
        s = engine.applyMove(s, m);
      }
    }
    const average = (performance.now() - started) / decisions;
    expect(decisions).toBeGreaterThan(100);
    expect(average).toBeLessThan(30);
    expect(slowest).toBeLessThan(250);
  });
});

describe('easy bot', () => {
  it('only asks for ranks it holds, from players who have cards', () => {
    const s = makeState({
      hands: ['7S 7H KD', '', '7D KS KH', 'KC 7C'],
      books: ['', 'A 2 3 4 5 6', '8 9 T', 'J Q'],
      exactStock: true,
    });
    const rng = createRng('easy-bot');
    for (let i = 0; i < 100; i++) {
      const m = easyMove(seatView(s, 0), rng);
      expect([2, 3]).toContain(m.target);
      expect(s.hands[0]!.some((c: CardCode) => rankOf(c) === m.rank)).toBe(true);
    }
  });
});
