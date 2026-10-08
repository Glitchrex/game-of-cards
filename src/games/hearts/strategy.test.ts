import { describe, expect, it } from 'vitest';
import { suitOf, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import type { Difficulty } from '@/games/core/types';
import { heartsEngine as E, type HeartsMove, type HeartsState } from './engine';
import { moonThreat, normalDecision, seatView } from './strategy';
import { ALL_HEARTS, cards, playState } from './test-helpers';

const card = (m: HeartsMove) => (m.type === 'play' ? m.card : null);
const normal = (s: HeartsState) => E.botMove(s, E.currentPlayer(s)!, 'normal', createRng(0));
const why = (s: HeartsState) => normalDecision(seatView(s, E.currentPlayer(s)!)).why;
const isLegal = (s: HeartsState, m: HeartsMove) =>
  E.legalMoves(s, E.currentPlayer(s)!).some((x) => E.moveKey(x) === E.moveKey(m));

/** Pass-phase state where seat 0 holds `hand` (other seats get the rest). */
function passState(hand: string): HeartsState {
  const base = E.setup({ players: 4 }, createRng('pass-base'));
  const mine = cards(hand);
  const rest = base.hands.flat().filter((c) => !mine.includes(c));
  return {
    ...base,
    hands: [mine, rest.slice(0, 13), rest.slice(13, 26), rest.slice(26, 39)],
  };
}

/** Every state of a seeded bot game. */
function gameStates(seed: number, diff: (seat: number) => Difficulty): HeartsState[] {
  const rng = createRng(`states-${seed}`);
  let s = E.setup({ players: 4 }, createRng(`deal-${seed}`));
  const out = [s];
  while (!E.isOver(s)) {
    const p = E.currentPlayer(s)!;
    s = E.applyMove(s, E.botMove(s, p, diff(p), rng));
    out.push(s);
  }
  return out;
}

describe('hearts normal bot: passing', () => {
  it('passes an unguarded Queen of Spades and high Hearts', () => {
    const s = passState('QS 3S AH KH 2H 2D 5D 9D 4C 6C 8C TC JC');
    const m = normal(s);
    expect(m.type).toBe('pass');
    expect(m.type === 'pass' && [...m.cards].sort()).toEqual(['AH', 'KH', 'QS']);
    expect(why(s)).toBe(
      'Pass the Queen of Spades (13 points, and you have too few low Spades to hide her behind) and the A♥ and K♥ (high Hearts tend to win tricks full of points) to Player 1. Keep your low cards — they help you lose tricks safely.',
    );
    expect(why(s)).toMatch(/high Hearts tend to win tricks full of points/);
  });

  it('keeps the Queen of Spades when four lower Spades guard her', () => {
    const s = passState('QS 2S 3S 4S 5S 2H 3H 4H 2D 3D 4C 5C 6C');
    const m = normal(s);
    expect(m.type === 'pass' && m.cards).not.toContain('QS');
  });

  it('passes A♠/K♠ when the Queen is not guarded by low Spades', () => {
    const s = passState('AS KS 2S 2H 3H 4H 2D 3D 4D 5D 2C 3C 4C');
    const m = normal(s);
    expect(m.type === 'pass' && m.cards).toEqual(expect.arrayContaining(['AS', 'KS']));
    expect(why(s)).toMatch(/high Spades can get stuck catching the Queen of Spades/);
  });

  it('empties a short suit to create a void', () => {
    const s = passState('2S 3S 4S 5S 2H 3H 4H 2C 3C 4C 5C 6C 8D');
    const m = normal(s);
    expect(m.type === 'pass' && m.cards).toContain('8D');
    expect(why(s)).toMatch(/with no Diamonds left you can throw away points/);
  });

  it("does not peek at other seats' passes", () => {
    const a = E.setup({ players: 4 }, createRng('peek'));
    const p0 = a.hands[0]!.slice(0, 3);
    const p0b = a.hands[0]!.slice(3, 6);
    const p1 = a.hands[1]!.slice(0, 3);
    const p1b = a.hands[1]!.slice(5, 8);
    const s1 = E.applyMove(E.applyMove(a, { type: 'pass', cards: p0 }), {
      type: 'pass',
      cards: p1,
    });
    const s2 = E.applyMove(E.applyMove(a, { type: 'pass', cards: p0b }), {
      type: 'pass',
      cards: p1b,
    });
    for (const d of ['normal', 'easy'] as const) {
      expect(E.botMove(s1, 2, d, createRng(5))).toEqual(E.botMove(s2, 2, d, createRng(5)));
    }
  });
});

describe('hearts normal bot: playing', () => {
  // After a clean first trick (won by seat 3's 5♣), seat 3 leads trick 2.
  const afterFirst = ['0: 2C 3C 4C 5C'];

  it('ducks under the winning card with its highest lower card', () => {
    const s = playState({
      hands: ['2D 9D JD AD 2S 3S 4S 5S 6S 7S 8S 9S', null, null, null],
      history: afterFirst,
      trick: '3: TD',
    });
    expect(card(normal(s))).toBe('9D');
    expect(why(s)).toMatch(/lower than the 10♦/);
  });

  it('wins a clean trick when last to play, getting rid of a high card', () => {
    const s = playState({
      hands: [null, null, '5D KD 2S 3S 4S 5S 6S 7S 8S 9S TS JS', null],
      history: afterFirst,
      trick: '3: 4D 6D 8D',
    });
    expect(E.currentPlayer(s)).toBe(2);
    expect(card(normal(s))).toBe('KD');
    expect(why(s)).toMatch(/last to play and this trick has no points/);
  });

  it('ducks when last to play and the trick holds points', () => {
    const s = playState({
      hands: [null, null, '5D KD 2S 3S 4S 5S 6S 7S 8S 9S TS JS', null],
      history: afterFirst,
      trick: '3: 4D 6D 2H',
    });
    expect(card(normal(s))).toBe('5D');
  });

  it('dumps the Queen of Spades when void in the led suit', () => {
    const s = playState({
      hands: [null, null, 'QS 2S 3S 4S 5S 6S 7S 8S 2H 3H 4H 5H', null],
      history: afterFirst,
      trick: '3: 4D 6D 8D',
    });
    expect(card(normal(s))).toBe('QS');
    expect(why(s)).toMatch(/dump the Queen of Spades! Her 13 points go to Player 1, not you/);
  });

  it('drops the Queen of Spades under a higher Spade', () => {
    const s = playState({
      hands: ['QS 2S 3S 4S 2D 3D 4D 5D 6D 7D 8D 9D', null, null, null],
      history: afterFirst,
      trick: '3: AS',
    });
    expect(card(normal(s))).toBe('QS');
    expect(why(s)).toBe(
      "Drop the Queen of Spades under the A♠ — she can't win this trick now, so Player 3 will take her 13 points, not you.",
    );
  });

  it('keeps its high Spades out of a low Spade lead while the Queen is out', () => {
    const s = playState({
      hands: ['3S KS AS 2D 3D 4D 5D 6D 7D 8D 9D TD', null, null, null],
      history: afterFirst,
      trick: '3: 5S',
    });
    expect(card(normal(s))).toBe('3S');
  });

  it('discards its highest Heart when void and holding no Spade danger', () => {
    const s = playState({
      hands: [null, null, '2S 3S 4S 5S 6S 7S 8S 9H TH KH 6C 7C', null],
      history: afterFirst,
      trick: '3: 4D 6D 8D',
      heartsBroken: false,
    });
    expect(card(normal(s))).toBe('KH');
    expect(why(s)).toMatch(/unload your highest Heart/);
  });

  it('dumps a high Spade when void while the Queen is still out', () => {
    const s = playState({
      hands: [null, null, 'KS 2S 3S 4S 5S 6S 7S 9H TH 6C 7C 8C', null],
      history: afterFirst,
      trick: '3: 4D 6D 8D',
    });
    expect(card(normal(s))).toBe('KS');
  });

  it('plays its highest Club on the first trick (no points allowed there)', () => {
    const s = playState({
      hands: [null, '3C 9C KC 2S 3S 4S 5S 6S 7S 8S 9S TS JS', null, null],
      trick: '0: 2C',
    });
    expect(E.currentPlayer(s)).toBe(1);
    expect(card(normal(s))).toBe('KC');
  });

  it('leads low rather than leading the Queen or a high Spade', () => {
    const s = playState({
      hands: [null, null, null, 'QS AS 2D 9D KD 3H 6C 7C 8C 9C TC JC'],
      history: afterFirst,
    });
    const c = card(normal(s));
    expect(c).not.toBe('QS');
    expect(c).not.toBe('AS');
    expect(['2D', '6C']).toContain(c);
  });

  it('smokes out the Queen with a low Spade lead when it holds no high Spades', () => {
    const s = playState({
      hands: [null, null, null, '2S 3S 9D TD JD KD AD 9C TC JC QC KC'],
      history: afterFirst,
    });
    expect(card(normal(s))).toBe('2S');
    expect(why(s)).toMatch(/Queen of Spades is still out there/);
  });

  it('stops a moon: overtakes the player who has every point so far', () => {
    // Player 1 took the Queen of Spades on trick 2 and nobody else has a point.
    const s = playState({
      hands: [null, null, null, 'TD 3D 2S 3S 4S 5S 6S 7S 8S 9S TS'],
      history: ['0: 2C 3C 4C 5C', '3: 6C 7C KC QS'],
      trick: '1: 9D 2H',
    });
    expect(E.currentPlayer(s)).toBe(3);
    expect(moonThreat(seatView(s, 3))).toBe(1);
    expect(card(normal(s))).toBe('TD');
    expect(why(s)).toMatch(/Player 1 has taken every point so far and might shoot the moon/);
  });

  it('without a moon threat the same position is a simple duck', () => {
    const s = playState({
      hands: [null, null, null, 'TD 3D 2S 3S 4S 5S 6S 7S 8S 9S TS'],
      history: ['0: 2C 3C 4C 5C', '3: 6C 7C KC 8C'],
      trick: '1: 9D 2H',
    });
    expect(moonThreat(seatView(s, 3))).toBeNull();
    expect(card(normal(s))).toBe('3D');
  });

  it("won't feed points to a possible moon shooter when it can't follow", () => {
    const s = playState({
      hands: [null, null, null, '2H 3H 4H 2S 3S 4S 5S 6S 7S 8S AC'],
      history: ['0: 2C 3C 4C 5C', '3: 6C 7C KC QS'],
      trick: '1: AD 5H',
    });
    expect(card(normal(s))).toBe('AC');
    expect(why(s)).toMatch(/don't feed them any — throw away the A♣ instead/);
  });
});

describe('hearts bots: always legal, even in tricky spots', () => {
  const tricky: [string, HeartsState][] = [
    [
      'first trick, only Hearts',
      playState({ hands: [ALL_HEARTS, null, null, null], trick: '1: 2C 3C 4C' }),
    ],
    [
      'first trick, only Hearts and the Queen',
      playState({
        hands: ['QS KH QH JH TH 9H 8H 7H 6H 5H 4H 3H 2H', null, null, null],
        trick: '1: 2C 3C 4C',
      }),
    ],
    [
      'first trick, void with points and safe cards',
      playState({
        hands: ['QS AH KH QH 2H 3D 4D 5D 6D 7D 8D 9D TD', null, null, null],
        trick: '1: 2C 3C 4C',
      }),
    ],
    [
      'leading before Hearts are broken with only Hearts',
      playState({
        hands: [null, null, null, '2H 3H 4H 5H 6H 7H 8H 9H TH JH QH KH'],
        history: ['0: 2C 3C 4C 5C'],
      }),
    ],
    [
      'leading before Hearts are broken with Hearts and one other card',
      playState({
        hands: [null, null, null, '2H 3H 4H 5H 6H 7H 8H 9H TH JH QH 6D'],
        history: ['0: 2C 3C 4C 5C'],
      }),
    ],
    [
      'leading the first trick',
      playState({ hands: ['2C 3C 4C 5C 6C 7C 8C 9C TC JC QC KC AC', null, null, null] }),
    ],
  ];

  for (const [name, s] of tricky) {
    it(name, () => {
      const p = E.currentPlayer(s)!;
      for (const d of ['easy', 'normal'] as const) {
        for (let i = 0; i < 25; i++) {
          const m = E.botMove(s, p, d, createRng(`${name}-${i}`));
          expect(isLegal(s, m)).toBe(true);
          expect(E.checkMove(s, p, m).ok).toBe(true);
        }
      }
    });
  }

  it('first-trick void with safe cards: never a point card', () => {
    const s = tricky[2]![1];
    for (let i = 0; i < 50; i++) {
      const m = E.botMove(s, 0, 'easy', createRng(i));
      expect(['QS', 'AH', 'KH', 'QH', '2H']).not.toContain(card(m));
    }
  });

  it('refuses to move for a seat whose turn it is not', () => {
    const s = tricky[5]![1];
    expect(() => E.botMove(s, 1, 'normal', createRng(1))).toThrow(/not their turn/);
  });
});

describe('hearts bots: information and speed', () => {
  it('decisions do not depend on the other seats’ hidden cards', () => {
    let checked = 0;
    for (let seed = 1; seed <= 6; seed++) {
      const states = gameStates(seed, (p) => (p % 2 ? 'easy' : 'normal'));
      for (const s of states) {
        if (s.phase !== 'play') continue;
        const p = s.turn;
        const others = [1, 2, 3].map((d) => (p + d) % 4);
        const [a, b] = [others[0]!, others[1]!];
        const ha = s.hands[a]!;
        const hb = s.hands[b]!;
        if (ha.length === 0 || hb.length === 0) continue;
        // Swap one hidden card between two opponents.
        const ca = ha[0] as CardCode;
        const cb = hb[hb.length - 1] as CardCode;
        const hands = s.hands.map((h, i) =>
          i === a
            ? [...h.filter((c) => c !== ca), cb]
            : i === b
              ? [...h.filter((c) => c !== cb), ca]
              : h,
        );
        const swapped: HeartsState = { ...s, hands };
        for (const d of ['normal', 'easy'] as const) {
          expect(E.botMove(swapped, p, d, createRng(seed))).toEqual(
            E.botMove(s, p, d, createRng(seed)),
          );
        }
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('easy bots are random but legal; normal bots are deterministic', () => {
    const s = playState({
      hands: [null, null, '2S 3S 4S 5S 6S 7S 8S 9H TH KH 6C 7C', null],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 4D 6D 8D',
    });
    const easy = new Set<string>();
    const norm = new Set<string>();
    for (let i = 0; i < 60; i++) {
      easy.add(E.moveKey(E.botMove(s, 2, 'easy', createRng(i))));
      norm.add(E.moveKey(E.botMove(s, 2, 'normal', createRng(i))));
    }
    expect(easy.size).toBeGreaterThan(2);
    expect(norm.size).toBe(1);
  });

  it('a normal decision takes well under 30ms', () => {
    const states = gameStates(99, () => 'normal').filter((s) => !E.isOver(s));
    const t0 = performance.now();
    let n = 0;
    for (let rep = 0; rep < 5; rep++) {
      for (const s of states) {
        E.botMove(s, s.turn, 'normal', createRng(rep));
        n++;
      }
    }
    const avg = (performance.now() - t0) / n;
    expect(avg).toBeLessThan(5);
  });

  it('normal bots clearly beat easy bots', () => {
    let normalPts = 0;
    let easyPts = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const states = gameStates(seed, (p) => (p === 0 ? 'normal' : 'easy'));
      const r = E.result(states[states.length - 1]!);
      normalPts += r.scores![0]!;
      easyPts += (r.scores![1]! + r.scores![2]! + r.scores![3]!) / 3;
    }
    expect(normalPts / 120).toBeLessThan((easyPts / 120) * 0.6);
  });

  it('every suit discard is legal across random games (sanity)', () => {
    for (let seed = 200; seed < 230; seed++) {
      for (const s of gameStates(seed, () => 'easy')) {
        if (s.phase !== 'play' || s.trick.length === 0) continue;
        const led = suitOf(s.trick[0]!.card);
        const hand = s.hands[s.turn]!;
        const legal = E.legalMoves(s, s.turn).map(card);
        if (hand.some((c) => suitOf(c) === led)) {
          expect(legal.every((c) => c !== null && suitOf(c) === led)).toBe(true);
        }
      }
    }
  });
});
