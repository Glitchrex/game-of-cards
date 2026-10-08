import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, sortHand, suitOf, type CardCode } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError, type Difficulty } from '@/games/core/types';
import spadesDefault, { spadesEngine as E, type SpadesMove, type SpadesState } from './engine';
import {
  beats,
  checkPlay,
  legalPlays,
  payoutUnits,
  scoreHand,
  scoreTeam,
  tricksNeeded,
  winningPlay,
} from './rules';
import { bidState, cards, finishedHand, playState, winnersFor } from './test-helpers';

const play = (card: string): SpadesMove => ({ type: 'play', card: card as CardCode });
const bid = (tricks: number): SpadesMove => ({ type: 'bid', tricks });
const keys = (moves: SpadesMove[]) => moves.map((m) => E.moveKey(m));
const reasonFor = (s: SpadesState, seat: number, m: unknown) => {
  const check = E.checkMove(s, seat, m as SpadesMove);
  expect(check.ok).toBe(false);
  expect(check.reason).toBeTruthy();
  return check.reason ?? '';
};
const freshDeal = (seed: number | string = 1, options?: Record<string, unknown>) =>
  E.setup({ players: 4, options }, createRng(seed));

/** Make the four bids in turn order. */
function bidAll(state: SpadesState, bids: readonly number[]): SpadesState {
  let s = state;
  for (let k = 0; k < 4; k++) s = E.applyMove(s, bid(bids[s.turn] ?? 3));
  return s;
}

/** Play out a whole hand with bots; returns every state visited. */
function playOut(state: SpadesState, seed: string, diff: Difficulty = 'normal'): SpadesState[] {
  const rng = createRng(seed);
  const states = [state];
  let s = state;
  while (!E.isOver(s)) {
    const p = E.currentPlayer(s)!;
    s = E.applyMove(s, E.botMove(s, p, diff, rng));
    states.push(s);
  }
  return states;
}

const ALL_HEARTS = 'AH KH QH JH TH 9H 8H 7H 6H 5H 4H 3H 2H';

describe('spades setup', () => {
  it('deals 13 different cards to each of 4 seats and starts with bidding', () => {
    const s = freshDeal(42);
    expect(E.id).toBe('spades');
    expect(spadesDefault).toBe(E);
    expect(s.phase).toBe('bid');
    expect(s.hands).toHaveLength(4);
    for (const h of s.hands) {
      expect(h).toHaveLength(13);
      expect(h).toEqual(sortHand(h));
    }
    expect([...s.hands.flat()].sort()).toEqual(makeDeck().sort());
    expect(s.bids).toEqual([null, null, null, null]);
    expect(s.tricksWon).toEqual([0, 0, 0, 0]);
    expect(s.tricks).toEqual([]);
    expect(s.trick).toEqual([]);
    expect(s.spadesBroken).toBe(false);
  });

  it('chooses the dealer from the seed; bidding starts on the dealer’s left', () => {
    const dealers = new Set<number>();
    for (let seed = 0; seed < 40; seed++) {
      const s = freshDeal(seed);
      dealers.add(s.dealer);
      expect(s.turn).toBe((s.dealer + 1) % 4);
      expect(s.leader).toBe((s.dealer + 1) % 4);
      expect(E.currentPlayer(s)).toBe((s.dealer + 1) % 4);
    }
    expect([...dealers].sort()).toEqual([0, 1, 2, 3]);
  });

  it('deals one card at a time starting with the player left of the dealer', () => {
    const s = freshDeal('deal-order', { dealer: 1 });
    const deck = shuffle(makeDeck(), createRng('deal-order'));
    for (let seat = 0; seat < 4; seat++) {
      const offset = (seat - 2 + 4) % 4; // seat 2 (left of dealer 1) gets the first card
      expect(s.hands[seat]).toEqual(sortHand(deck.filter((_, i) => i % 4 === offset)));
    }
  });

  it('accepts a fixed dealer and rejects bad options or seat counts', () => {
    expect(freshDeal(5, { dealer: 2 }).dealer).toBe(2);
    expect(freshDeal(5, { dealer: 2 }).turn).toBe(3);
    expect(() => freshDeal(5, { dealer: 4 })).toThrow(RangeError);
    expect(() => freshDeal(5, { dealer: 'north' })).toThrow(RangeError);
    expect(() => freshDeal(5, { dealer: 1.5 })).toThrow(RangeError);
    expect(() => E.setup({ players: 3 }, createRng(1))).toThrow(RangeError);
    expect(() => E.setup({ players: 5 }, createRng(1))).toThrow(RangeError);
  });

  it('is deterministic: same seed → same deal and same bot game', () => {
    expect(freshDeal('same')).toEqual(freshDeal('same'));
    expect(freshDeal('same')).not.toEqual(freshDeal('other'));
    const a = playOut(freshDeal(77), 'bots-77');
    const b = playOut(freshDeal(77), 'bots-77');
    expect(a).toEqual(b);
    expect(E.result(a[a.length - 1]!)).toEqual(E.result(b[b.length - 1]!));
  });

  it('produces plain JSON-serialisable state', () => {
    const states = playOut(freshDeal(9), 'json');
    for (const s of [states[0]!, states[20]!, states[states.length - 1]!]) {
      expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    }
  });
});

describe('spades bidding', () => {
  it('offers bids 0 (Nil) to 13 to the bidder only', () => {
    const s = freshDeal(3, { dealer: 3 });
    expect(keys(E.legalMoves(s, 0))).toEqual(Array.from({ length: 14 }, (_, n) => `bid:${n}`));
    for (const p of [1, 2, 3]) expect(E.legalMoves(s, p)).toEqual([]);
  });

  it('goes clockwise from the dealer’s left, then the same player leads', () => {
    let s = freshDeal(3, { dealer: 1 });
    const order: number[] = [];
    for (let k = 0; k < 4; k++) {
      order.push(s.turn);
      s = E.applyMove(s, bid(k + 1));
    }
    expect(order).toEqual([2, 3, 0, 1]);
    expect(s.bids).toEqual([3, 4, 1, 2]);
    expect(s.phase).toBe('play');
    expect(s.turn).toBe(2);
    expect(s.leader).toBe(2);
    expect(s.hands.every((h) => h.length === 13)).toBe(true);
  });

  it('records a Nil bid as 0', () => {
    const s = E.applyMove(freshDeal(3, { dealer: 3 }), bid(0));
    expect(s.bids[0]).toBe(0);
    expect(s.turn).toBe(1);
  });

  it('explains every illegal bid', () => {
    const s = freshDeal(3, { dealer: 3 });
    expect(reasonFor(s, 0, bid(14))).toMatch(/0 \(Nil\) up to 13 tricks/);
    expect(reasonFor(s, 0, bid(-1))).toMatch(/0 \(Nil\) up to 13 tricks/);
    expect(reasonFor(s, 0, bid(2.5))).toMatch(/whole number/);
    expect(reasonFor(s, 0, bid(Number.NaN))).toMatch(/whole number/);
    expect(reasonFor(s, 0, play(s.hands[0]![0]!))).toMatch(/Everyone bids before any card/);
    expect(reasonFor(s, 0, { type: 'pass', cards: [] })).toMatch(/isn't a Spades move/);
    expect(reasonFor(s, 0, null)).toMatch(/isn't a Spades move/);
    expect(reasonFor(s, 0, { type: 'bid', tricks: '3' })).toMatch(/isn't a Spades move/);
    expect(reasonFor(s, 2, bid(3))).toBe("It's your turn to bid, not Player 2's.");
    const s1 = E.applyMove(s, bid(3));
    expect(reasonFor(s1, 0, bid(3))).toBe("It's Player 1's turn to bid, not yours.");
    expect(reasonFor(s1, 2, bid(3))).toBe("It's Player 1's turn to bid, not Player 2's.");
    expect(() => E.applyMove(s, bid(14))).toThrow(IllegalMoveError);
    expect(() => E.applyMove(s, play(s.hands[0]![0]!))).toThrow(IllegalMoveError);
  });
});

describe('spades play rules', () => {
  it('only the player whose turn it is has legal moves', () => {
    const s = bidAll(freshDeal(8, { dealer: 3 }), [3, 3, 3, 3]);
    expect(E.currentPlayer(s)).toBe(0);
    expect(E.legalMoves(s, 0).length).toBeGreaterThan(0);
    for (const p of [1, 2, 3]) expect(E.legalMoves(s, p)).toEqual([]);
  });

  it('must follow suit when able — with a specific explanation', () => {
    const s = playState({
      hands: ['7H 2H KC 4C 9D 3S 5S 8S 9S TS JS QS', null, null, null],
      trick: '3: 9H',
      history: ['0: 2D 3D 4D AD'],
    });
    expect(s.turn).toBe(0);
    expect(keys(E.legalMoves(s, 0)).sort()).toEqual(['play:2H', 'play:7H']);
    expect(reasonFor(s, 0, play('KC'))).toBe(
      'You must follow suit: Hearts were led and you still have a Heart (like your 2♥), so you have to play one.',
    );
    expect(reasonFor(s, 0, play('3S'))).toMatch(
      /You must follow suit.*only trump with a Spade when you have no cards of the led suit/,
    );
  });

  it('lets a player with none of the led suit trump or throw away any card', () => {
    const s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '3: 9H',
      history: ['0: 2D 3D 4D AD'],
    });
    expect(E.legalMoves(s, 0)).toHaveLength(12);
    expect(E.checkMove(s, 0, play('3S')).ok).toBe(true);
    expect(E.checkMove(s, 0, play('4C')).ok).toBe(true);
  });

  it('forbids leading a Spade before Spades are broken (unless you hold only Spades)', () => {
    const s = playState({
      hands: ['KC 4C 9D 3S 5S 8S 9S TS JS QS AS KS 2S', null, null, null],
    });
    expect(s.spadesBroken).toBe(false);
    expect(keys(E.legalMoves(s, 0)).sort()).toEqual(['play:4C', 'play:9D', 'play:KC']);
    expect(reasonFor(s, 0, play('AS'))).toBe(
      "Spades aren't broken yet — you can't lead a Spade until someone has played a Spade on a trick of another suit (because they had none of the suit that was led). Lead a Club or a Diamond instead.",
    );
    const onlySpades = playState({
      hands: ['AS KS QS JS TS 9S 8S 7S 6S 5S 4S 3S 2S', null, null, null],
    });
    expect(E.legalMoves(onlySpades, 0)).toHaveLength(13);
    expect(E.checkMove(onlySpades, 0, play('2S')).ok).toBe(true);
  });

  it('allows leading Spades once broken', () => {
    const s = playState({
      hands: ['KC 4C 3S 5S 8S 9S TS JS QS AS KS 2S', null, null, null],
      dealer: 0,
      history: ['1: 2D 3D 4D 7S'],
    });
    expect(s.tricks[0]!.winner).toBe(0);
    expect(s.spadesBroken).toBe(true);
    expect(s.turn).toBe(0);
    expect(E.legalMoves(s, 0)).toHaveLength(12);
  });

  it('breaks Spades when a Spade is played on a trick of another suit', () => {
    const s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '3: 9H',
      history: ['0: 2D 3D 4D AD'],
    });
    const after = E.applyMove(s, play('3S'));
    expect(after.spadesBroken).toBe(true);
    const plain = E.applyMove(s, play('KC'));
    expect(plain.spadesBroken).toBe(false);
  });

  it('a Spade led by a Spades-only hand (and Spades following it) does not break Spades', () => {
    // Seat 1 cashes its four Hearts (nobody plays a Spade), is left with nothing but
    // Spades and must lead one. Seat 2 wins it with the A♠ — but Spades are still
    // unbroken, so seat 2 (which holds other suits) may not lead its K♠ next.
    let s = playState({
      hands: [
        'JS QC KC AC TD JD QD KD AD',
        '3S 4S 5S 6S 7S 8S 9S TS',
        'AS KS 5C 6C 7C 8C 2D 3D 4D',
        'QS 9C TC JC 5D 6D 7D 8D 9D',
      ],
      dealer: 0,
      history: ['1: AH 3H 4H 2H', '1: KH 6H 7H 5H', '1: QH 9H TH 8H', '1: JH 2C 3C 4C'],
      trick: '1: 2S',
    });
    expect(s.spadesBroken).toBe(false);
    expect(s.turn).toBe(2);
    s = E.applyMove(s, play('AS'));
    s = E.applyMove(s, play('QS'));
    s = E.applyMove(s, play('JS'));
    expect(s.tricks).toHaveLength(5);
    expect(s.tricks[4]!.winner).toBe(2);
    expect(s.spadesBroken).toBe(false);
    expect(E.currentPlayer(s)).toBe(2);
    expect(keys(E.legalMoves(s, 2))).not.toContain('play:KS');
    expect(reasonFor(s, 2, play('KS'))).toMatch(/^Spades aren't broken yet/);
    // The Spades-only seat itself may still lead a Spade whenever it gets the lead.
    expect(checkPlay(s.hands[1]!, { trick: [], spadesBroken: false }, '3S').ok).toBe(true);
  });

  it('a Spade thrown away (not even winning) on another suit still breaks Spades', () => {
    const s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '1: 9H 2S KS',
      history: ['0: 2D AD 3D 4D'],
    });
    expect(s.spadesBroken).toBe(true);
    // The current trick already holds a Spade on a Heart lead: breaking happened mid-trick.
    const before = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '1: 9H 2H',
      history: ['0: 2D AD 3D 4D'],
    });
    expect(before.spadesBroken).toBe(false);
  });

  it('explains other illegal plays', () => {
    const s = playState({ hands: ['KC 4C 9D 3S 5S 8S 9S TS JS QS AS KS 2S', null, null, null] });
    const missing = s.hands[1]![0]!;
    expect(reasonFor(s, 0, play(missing))).toBe(
      `You don't have the ${cardName(missing)} in your hand — pick one of your own cards.`,
    );
    expect(reasonFor(s, 0, play('ZZ'))).toBe("That isn't a real card — play one from your hand.");
    expect(reasonFor(s, 0, bid(3))).toBe(
      "Bidding is over — you bid 3 tricks. Now it's time to play a card.",
    );
    expect(reasonFor(s, 1, play(missing))).toBe("It's your turn to play, not Player 1's.");
    const s1 = E.applyMove(s, play('KC'));
    expect(reasonFor(s1, 0, play('4C'))).toBe("It's Player 1's turn to play, not yours.");
    expect(() => E.applyMove(s, play('AS'))).toThrow(IllegalMoveError);
    expect(() => E.applyMove(s, play(missing))).toThrow(IllegalMoveError);
  });

  it('describes a Nil bid in the "bidding is over" reason', () => {
    const s = playState({ hands: [null, null, null, null], bids: [0, 3, 3, 3] });
    expect(reasonFor(s, 0, bid(2))).toMatch(/you bid Nil/);
  });

  it('highest Spade wins; otherwise the highest card of the led suit', () => {
    const p = (seat: number, card: string) => ({ seat, card: card as CardCode });
    expect(winningPlay([p(0, '9H'), p(1, 'AH'), p(2, '2S'), p(3, 'KH')]).seat).toBe(2);
    expect(winningPlay([p(0, '9H'), p(1, 'AH'), p(2, '2S'), p(3, '3S')]).seat).toBe(3);
    expect(winningPlay([p(0, '9H'), p(1, 'AC'), p(2, '2D'), p(3, 'TH')]).seat).toBe(3);
    expect(winningPlay([p(0, '4S'), p(1, 'AH'), p(2, '2S'), p(3, 'KH')]).seat).toBe(0);
    expect(() => winningPlay([])).toThrow();
    expect(beats('2S', 'AH', 'H')).toBe(true);
    expect(beats('AC', '2H', 'H')).toBe(false);
    expect(beats('3H', '2H', 'H')).toBe(true);
    expect(beats('KH', '2S', 'H')).toBe(false);
  });

  it('resolves a trick on the 4th card: winner collects it and leads next', () => {
    let s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '1: 9H 2H TH',
      history: ['0: 2D AD 3D 4D'],
    });
    expect(s.turn).toBe(0);
    s = E.applyMove(s, play('3S'));
    expect(s.trick).toEqual([]);
    expect(s.tricks).toHaveLength(2);
    expect(s.tricks[1]!.winner).toBe(0);
    expect(s.tricks[1]!.leader).toBe(1);
    expect(s.tricksWon).toEqual([1, 1, 0, 0]);
    expect(s.turn).toBe(0);
    expect(s.leader).toBe(0);
    expect(s.hands[0]).toHaveLength(11);
  });

  it('ends after 13 tricks', () => {
    const states = playOut(freshDeal(12), 'end');
    const last = states[states.length - 1]!;
    expect(last.phase).toBe('over');
    expect(E.isOver(last)).toBe(true);
    expect(E.currentPlayer(last)).toBeNull();
    expect(last.tricks).toHaveLength(13);
    expect(last.tricksWon.reduce((a, b) => a + b, 0)).toBe(13);
    expect(last.hands.every((h) => h.length === 0)).toBe(true);
    for (const p of [0, 1, 2, 3]) expect(E.legalMoves(last, p)).toEqual([]);
    expect(reasonFor(last, 0, play('AS'))).toMatch(/hand is over/);
    expect(() => E.applyMove(last, play('AS'))).toThrow(IllegalMoveError);
    // 4 bids + 52 cards
    expect(states).toHaveLength(57);
    for (const s of states.slice(0, -1)) expect(E.isOver(s)).toBe(false);
  });

  it('checkPlay / legalPlays agree with the engine', () => {
    const hand = cards('KC 4C 9D 3S 5S');
    expect(legalPlays(hand, { trick: [], spadesBroken: false }).sort()).toEqual(['4C', '9D', 'KC']);
    expect(legalPlays(hand, { trick: [], spadesBroken: true })).toHaveLength(5);
    expect(
      legalPlays(hand, { trick: [{ seat: 1, card: '2C' }], spadesBroken: false }).sort(),
    ).toEqual(['4C', 'KC']);
    expect(
      legalPlays(hand, { trick: [{ seat: 1, card: '2H' }], spadesBroken: false }),
    ).toHaveLength(5);
    expect(checkPlay(hand, { trick: [], spadesBroken: false }, '2H').ok).toBe(false);
  });

  it('never mutates its input (deep-frozen states)', () => {
    let s = freshDeal(31);
    const rng = createRng('freeze');
    while (!E.isOver(s)) {
      const snapshot = JSON.stringify(s);
      deepFreeze(s);
      const p = E.currentPlayer(s)!;
      const next = E.applyMove(s, E.botMove(s, p, 'normal', rng));
      expect(JSON.stringify(s)).toBe(snapshot);
      s = next;
    }
  });

  it('gives every legal move a unique, stable key', () => {
    const s = freshDeal(4);
    const k = keys(E.legalMoves(s, s.turn));
    expect(new Set(k).size).toBe(k.length);
    expect(E.moveKey(bid(0))).toBe('bid:0');
    expect(E.moveKey(play('AS'))).toBe('play:AS');
    expect(E.moveKey({ card: 'AS' as CardCode, type: 'play' })).toBe('play:AS');
  });
});

describe('spades scoring', () => {
  it('made contract: 10 per trick bid plus 1 per bag', () => {
    const exact = scoreTeam(0, [4, 3, 3, 3], [4, 3, 3, 3]);
    expect(exact).toMatchObject({ contract: 7, contractTricks: 7, made: true, bags: 0, total: 70 });
    const over = scoreTeam(0, [3, 3, 2, 3], [5, 2, 4, 2]);
    expect(over).toMatchObject({ contract: 5, contractTricks: 9, made: true, bags: 4, total: 54 });
  });

  it('failed contract: minus 10 per trick bid (no bags)', () => {
    const set = scoreTeam(0, [5, 3, 4, 3], [4, 3, 3, 3]);
    expect(set).toMatchObject({ contract: 9, made: false, bags: 0, contractPoints: -90 });
    expect(set.total).toBe(-90);
  });

  it('Nil made scores +100 on top of the partner’s contract', () => {
    const s = scoreTeam(0, [0, 3, 4, 3], [0, 3, 5, 5]);
    expect(s.nils).toEqual([{ seat: 0, made: true, tricks: 0 }]);
    expect(s).toMatchObject({
      contract: 4,
      contractTricks: 5,
      bags: 1,
      nilPoints: 100,
      total: 141,
    });
  });

  it('a failed Nil is −100 and its tricks do not help the partner’s contract (but are bags)', () => {
    const s = scoreTeam(0, [0, 3, 4, 3], [2, 4, 3, 4]);
    expect(s.nils).toEqual([{ seat: 0, made: false, tricks: 2 }]);
    expect(s.made).toBe(false); // partner bid 4, took 3 — the Nil bidder's 2 don't count
    expect(s).toMatchObject({ contractPoints: -40, bags: 2, nilPoints: -100, total: -138 });
    const partnerMade = scoreTeam(0, [0, 3, 3, 3], [1, 3, 4, 5]);
    expect(partnerMade).toMatchObject({ contractPoints: 30, bags: 2, nilPoints: -100, total: -68 });
  });

  it('two Nil bids on one team are scored separately; the contract is then 0', () => {
    expect(scoreTeam(0, [0, 4, 0, 4], [0, 6, 0, 7])).toMatchObject({
      contract: 0,
      made: true,
      contractPoints: 0,
      nilPoints: 200,
      total: 200,
    });
    expect(scoreTeam(0, [0, 4, 0, 4], [1, 6, 0, 6])).toMatchObject({
      nilPoints: 0,
      bags: 1,
      total: 1,
    });
  });

  it('scoreHand scores both partnerships; payout is ±1 unit or a push', () => {
    const [us, them] = scoreHand([4, 3, 3, 3], [4, 3, 3, 3]);
    expect(us.total).toBe(70);
    expect(them.total).toBe(60);
    expect(us.tricks + them.tricks).toBe(13);
    expect(payoutUnits(70, 60)).toBe(1);
    expect(payoutUnits(60, 70)).toBe(-1);
    expect(payoutUnits(-80, -80)).toBe(0);
  });

  it('tricksNeeded counts only non-Nil bidders', () => {
    expect(tricksNeeded(0, [3, 2, 4, 2], [1, 0, 2, 0])).toBe(4);
    expect(tricksNeeded(0, [0, 2, 4, 2], [3, 0, 2, 0])).toBe(2);
    expect(tricksNeeded(1, [3, 2, 4, 2], [0, 3, 0, 3])).toBe(0);
    expect(tricksNeeded(1, [3, null, 4, null], [0, 0, 0, 0])).toBe(0);
  });
});

describe('spades result', () => {
  const over = (bids: number[], counts: number[]) =>
    finishedHand({ bids, winners: winnersFor(counts) });

  it('a win pays +1 unit, lists the learner’s team and shows team scores per seat', () => {
    const r = E.result(over([4, 3, 3, 3], [4, 3, 3, 3]));
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(1);
    expect(r.winners).toEqual([0, 2]);
    expect(r.scores).toEqual([70, 60, 70, 60]);
    expect(r.summary).toBe(
      'Your team won 70 to 60: your team bid 7 and made it exactly, while the opponents bid 6 and made it exactly.',
    );
    expect(r.flags).toMatchObject({
      perfect: true,
      closeFinish: true,
      bigPot: false,
      bust: false,
      folded: false,
    });
    expect(r.flags.tags).toContain('exactBid');
  });

  it('a loss costs 1 unit; getting set is a bust', () => {
    const r = E.result(over([5, 3, 4, 3], [4, 3, 3, 3]));
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.winners).toEqual([1, 3]);
    expect(r.scores).toEqual([-90, 60, -90, 60]);
    expect(r.summary).toBe(
      'The opponents won 60 to -90: your team bid 9 but took only 7 and got set, while the opponents bid 6 and made it exactly.',
    );
    expect(r.flags).toMatchObject({
      bust: true,
      perfect: false,
      bigPot: false,
      closeFinish: false,
    });
    expect(r.flags.tags).toContain('set');
  });

  it('a tie is a push', () => {
    const r = E.result(over([4, 4, 4, 4], [3, 4, 3, 3]));
    expect(r.scores).toEqual([-80, -80, -80, -80]);
    expect(r.humanOutcome).toBe('push');
    expect(r.humanNetUnits).toBe(0);
    expect(r.winners).toEqual([]);
    expect(r.flags.closeFinish).toBe(true);
    expect(r.flags.bust).toBe(false);
    expect(r.flags.tags).toEqual(expect.arrayContaining(['tie', 'set', 'setOpponents']));
    expect(r.summary).toMatch(/^It's a tie at -80 points each: /);
  });

  it('bags and a big win: bigPot when winning by 100 or more', () => {
    const r = E.result(over([3, 3, 2, 3], [5, 2, 4, 2]));
    expect(r.scores).toEqual([54, -60, 54, -60]);
    expect(r.flags).toMatchObject({ bigPot: true, perfect: false, closeFinish: false });
    expect(r.flags.tags).toContain('setOpponents');
    expect(r.summary).toBe(
      'Your team won 54 to -60: your team bid 5 and took 9, while the opponents bid 6 but took only 4 and got set.',
    );
    // Losing by 100+ is not a big pot.
    expect(E.result(over([5, 3, 4, 3], [4, 3, 3, 3])).flags.bigPot).toBe(false);
  });

  it('a successful Nil by the learner is perfect and tagged "nil"', () => {
    const r = E.result(over([0, 3, 4, 3], [0, 3, 5, 5]));
    expect(r.scores).toEqual([141, 62, 141, 62]);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toContain('nil');
    expect(r.summary).toBe(
      'Your team won 141 to 62: your team bid 4 and took 5 and your Nil succeeded, while the opponents bid 6 and took 8.',
    );
  });

  it('a partner’s successful Nil also counts as perfect', () => {
    const r = E.result(over([4, 3, 0, 3], [5, 4, 0, 4]));
    expect(r.scores).toEqual([141, 62, 141, 62]);
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toContain('nil');
    expect(r.summary).toMatch(/Player 2's Nil succeeded/);
  });

  it('a failed learner Nil is a bust when the hand is lost', () => {
    const r = E.result(over([0, 3, 4, 3], [2, 4, 3, 4]));
    expect(r.scores).toEqual([-138, 62, -138, 62]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.bust).toBe(true);
    expect(r.flags.perfect).toBe(false);
    expect(r.flags.tags).toEqual(expect.arrayContaining(['nilFailed', 'set']));
    expect(r.summary).toMatch(/your Nil failed/);
  });

  it('breaking an opponent’s Nil is tagged', () => {
    const r = E.result(over([3, 0, 4, 3], [3, 1, 4, 5]));
    expect(r.scores).toEqual([70, -67, 70, -67]);
    expect(r.flags.tags).toContain('bustedNil');
    expect(r.flags.bigPot).toBe(true);
    expect(r.summary).toMatch(/Player 1's Nil failed/);
    const made = E.result(over([3, 0, 4, 3], [3, 0, 4, 6]));
    expect(made.flags.tags).toContain('opponentNil');
  });

  it('describes a double Nil', () => {
    const r = E.result(over([0, 4, 0, 4], [0, 6, 0, 7]));
    expect(r.scores).toEqual([200, 85, 200, 85]);
    expect(r.summary).toBe(
      "Your team won 200 to 85: your team bid two Nils, your Nil succeeded and Player 2's Nil succeeded, while the opponents bid 8 and took 13.",
    );
    expect(r.flags).toMatchObject({ perfect: true, bigPot: true });
    const oneFailed = E.result(over([0, 4, 0, 4], [1, 6, 0, 6]));
    expect(oneFailed.scores).toEqual([1, 84, 1, 84]);
    expect(oneFailed.flags.bust).toBe(true);
    expect(oneFailed.flags.tags).toEqual(expect.arrayContaining(['nil', 'nilFailed']));
  });

  it('a loss without being set (and without a failed Nil) is not a bust', () => {
    const r = E.result(over([2, 4, 2, 4], [2, 4, 3, 4]));
    expect(r.scores).toEqual([41, 80, 41, 80]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.bust).toBe(false);
  });

  it('comeback: behind on tricks needed with 4 or fewer left, and still made it', () => {
    const behind = finishedHand({
      bids: [3, 3, 3, 3],
      winners: [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2],
    });
    const r = E.result(behind);
    expect(r.scores).toEqual([61, 60, 61, 60]);
    expect(r.flags.comeback).toBe(true);
    expect(r.flags.closeFinish).toBe(true);
    const comfortable = finishedHand({
      bids: [3, 3, 3, 3],
      winners: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 1, 1],
    });
    expect(E.result(comfortable).flags.comeback).toBe(false);
    // Behind and never caught up: no comeback.
    const failed = finishedHand({
      bids: [3, 3, 3, 3],
      winners: [0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2],
    });
    expect(E.result(failed).flags.comeback).toBe(false);
    expect(E.result(failed).flags.tags).toContain('set');
  });

  it('luckyLastCard: the 13th trick turned the hand into a win', () => {
    const lucky = finishedHand({
      bids: [3, 3, 3, 2],
      winners: [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0],
    });
    const r = E.result(lucky);
    expect(r.scores).toEqual([60, 52, 60, 52]);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.luckyLastCard).toBe(true);
    const safe = E.result(over([4, 3, 3, 3], [4, 3, 3, 3]));
    expect(safe.flags.luckyLastCard).toBe(false);
  });

  it('closeFinish only when the scores are within 10 points', () => {
    expect(E.result(over([4, 3, 3, 3], [4, 3, 3, 3])).flags.closeFinish).toBe(true); // 70–60
    expect(E.result(over([4, 2, 3, 3], [4, 2, 3, 4])).flags.closeFinish).toBe(false); // 70–51
  });

  it('refuses to score an unfinished hand', () => {
    expect(() => E.result(freshDeal(1))).toThrow();
  });
});

describe('spades describeMove', () => {
  it('announces bids, Nil and the final contracts', () => {
    const s = bidState({ dealer: 3 });
    expect(E.describeMove(s, 0, bid(4))).toBe('You bid 4 tricks.');
    const s1 = E.applyMove(s, bid(4));
    expect(E.describeMove(s1, 1, bid(0))).toBe(
      'Player 1 bid Nil — they are aiming to win no tricks at all.',
    );
    const s2 = E.applyMove(s1, bid(0));
    expect(E.describeMove(s2, 2, bid(1))).toBe('Player 2 bid 1 trick.');
    const s3 = E.applyMove(s2, bid(1));
    expect(E.describeMove(s3, 3, bid(5))).toBe(
      "Player 3 bid 5 tricks. Bidding is over: your team's contract is 5 tricks, and the opponents' is 5 tricks plus Player 1's Nil.",
    );
    expect(E.describeMove(s, 0, bid(0))).toBe(
      'You bid Nil — you are aiming to win no tricks at all.',
    );
  });

  it('announces leads, follows, trumps, discards, trick winners and the end', () => {
    const s = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '1: 9H 2H TH',
      history: ['0: 2D AD 3D 4D'],
      bids: [3, 3, 3, 3],
    });
    expect(E.describeMove(s, 0, play('3S'))).toBe(
      "You couldn't follow suit and trumped with the Three of Spades. Spades are broken! You win the trick.",
    );
    expect(E.describeMove(s, 0, play('KC'))).toBe(
      "You couldn't follow suit and threw away the King of Clubs. Player 3 wins the trick.",
    );
    const lead = playState({ hands: ['KH 3H 4C 9D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null] });
    expect(E.describeMove(lead, 0, play('KH'))).toBe('You led the King of Hearts.');
    // The auto-filled seat 0 holds all 13 Spades: leading one does NOT break Spades.
    const spadesOnly = playState({ hands: [null, null, null, null] });
    expect(E.describeMove(spadesOnly, 0, play('2S'))).toBe('You led the Two of Spades.');
    // Once broken, trumping is announced without repeating "Spades are broken!".
    const broken = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS', null, null, null],
      trick: '1: 9H 2H TH',
      history: ['0: 2D AD 3D 4D', '1: 5D 6D AS 7D'],
    });
    expect(broken.spadesBroken).toBe(true);
    expect(E.describeMove(broken, 0, play('3S'))).toBe(
      "You couldn't follow suit and trumped with the Three of Spades. You win the trick.",
    );
    const follow = playState({
      hands: ['KH 3H 4C 9D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
      dealer: 2,
      trick: '3: 9H',
    });
    expect(E.describeMove(follow, 0, play('3H'))).toBe('You played the Three of Hearts.');
  });

  it('announces a made bid and a broken Nil', () => {
    // Team 0 bid 2 (1 + 1) and has 1 trick; seat 0 wins the 2nd.
    const made = playState({
      hands: ['KC 4C 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '1: 9H 2H TH',
      history: ['0: AD 2D 3D 4D', '0: 5D KD 6D 7D'],
      bids: [1, 3, 1, 3],
    });
    expect(made.tricksWon).toEqual([1, 1, 0, 0]);
    expect(E.describeMove(made, 0, play('3S'))).toMatch(
      /You win the trick\. Your team has made its bid!$/,
    );
    // Seat 3 bid Nil and wins the trick with the Ten of Hearts.
    const nil = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '1: 9H 2H TH',
      history: ['0: 2D AD 3D 4D'],
      bids: [3, 3, 3, 0],
    });
    expect(E.describeMove(nil, 0, play('KC'))).toBe(
      "You couldn't follow suit and threw away the King of Clubs. Player 3 wins the trick. That breaks Player 3's Nil bid.",
    );
    const opp = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '1: 9H 2H TH',
      history: ['0: 2D AD 3D 4D'],
      bids: [3, 1, 3, 1],
    });
    expect(E.describeMove(opp, 0, play('KC'))).toMatch(/The opponents have made their bid\.$/);
  });

  it('announces the last trick and never reveals hidden cards', () => {
    const states = playOut(freshDeal(21), 'describe');
    const beforeLast = states[states.length - 2]!;
    const p = E.currentPlayer(beforeLast)!;
    const lastMove = E.legalMoves(beforeLast, p)[0]!;
    expect(E.describeMove(beforeLast, p, lastMove)).toMatch(/That was the last trick\.$/);
    // Bid announcements mention no cards at all.
    const s = states[0]!;
    const text = E.describeMove(s, s.turn, bid(3));
    for (const c of makeDeck()) expect(text).not.toContain(cardName(c));
    // Bot seats are "Player N"; the learner is "You".
    for (let i = 0; i < states.length - 1; i++) {
      const st = states[i]!;
      const seat = E.currentPlayer(st)!;
      const next = states[i + 1]!;
      const move: SpadesMove =
        st.phase === 'bid'
          ? bid(next.bids[seat]!)
          : play(st.hands[seat]!.find((c) => !next.hands[seat]!.includes(c))!);
      const d = E.describeMove(st, seat, move);
      expect(d.startsWith(seat === 0 ? 'You ' : `Player ${seat} `)).toBe(true);
    }
  });
});

describe('spades coach', () => {
  it('explains bidding and suggests the normal bot bid on the learner’s turn', () => {
    const s = bidState({ dealer: 2, bids: [null, null, null, 2] });
    expect(s.turn).toBe(0);
    const advice = E.coach(s, 0);
    expect(advice.situation).toMatch(/your turn to bid/);
    expect(advice.situation).toMatch(/Player 3 bid 2 tricks/);
    expect(advice.situation).toMatch(/your partner \(Player 2\) hasn't bid yet/);
    const suggestion = advice.suggestion as SpadesMove;
    expect(E.checkMove(s, 0, suggestion).ok).toBe(true);
    expect(suggestion).toEqual(E.botMove(s, 0, 'normal', createRng(1)));
    expect(advice.why).toBeTruthy();
  });

  it('describes the trick and what you may play', () => {
    const s = playState({
      hands: ['7H 2H KC 4C 9D 3S 5S 8S 9S TS JS QS', null, null, null],
      trick: '3: 9H',
      history: ['0: 2D 3D 4D AD'],
    });
    const advice = E.coach(s, 0);
    expect(advice.situation).toMatch(/^Trick 2 of 13\./);
    expect(advice.situation).toMatch(/You have Hearts, so you must play one\./);
    expect(advice.situation).toMatch(/Your team bid 6 and has won 0 tricks \(6 more needed\)/);
    expect(advice.situation).toMatch(/The opponents bid 6 and have won 1 trick \(5 more needed\)/);
    const suggestion = advice.suggestion as SpadesMove;
    expect(keys(E.legalMoves(s, 0))).toContain(E.moveKey(suggestion));
    expect(advice.why).toBeTruthy();
    const void_ = playState({
      hands: ['KC 4C 9D 8D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '3: 9H',
      history: ['0: 2D 3D 4D AD'],
    });
    expect(E.coach(void_, 0).situation).toMatch(
      /You have no Hearts, so you may trump with a Spade/,
    );
    const lead = playState({
      hands: ['KH 3H 4C 9D 3S 5S 8S 9S TS JS QS AS 2S', null, null, null],
    });
    expect(E.coach(lead, 0).situation).toMatch(
      /You lead this trick\. You may lead any card except a Spade/,
    );
  });

  it('only describes the situation when it is someone else’s turn or the hand is over', () => {
    const s = playState({ hands: [null, null, null, null], trick: '0: 2C' });
    const advice = E.coach(s, 0);
    expect(advice.suggestion).toBeUndefined();
    expect(advice.situation).toMatch(/Waiting for Player 1 to play/);
    const states = playOut(freshDeal(5), 'coach-over');
    const end = E.coach(states[states.length - 1]!, 0);
    expect(end.suggestion).toBeUndefined();
    expect(end.situation).toMatch(/hand is over/);
  });

  it('every coach suggestion over whole games is legal', () => {
    for (let seed = 0; seed < 8; seed++) {
      for (const s of playOut(freshDeal(seed), `coach-${seed}`, seed % 2 ? 'easy' : 'normal')) {
        if (E.isOver(s)) continue;
        const p = E.currentPlayer(s)!;
        const advice = E.coach(s, p);
        expect(advice.situation.length).toBeGreaterThan(10);
        expect(keys(E.legalMoves(s, p))).toContain(E.moveKey(advice.suggestion as SpadesMove));
        expect(advice.why?.length ?? 0).toBeGreaterThan(10);
      }
    }
  });
});

describe('spades bots', () => {
  it('always choose a legal move (both difficulties, many positions)', () => {
    for (let seed = 0; seed < 40; seed++) {
      const diff: Difficulty = seed % 2 ? 'easy' : 'normal';
      const states = playOut(freshDeal(seed), `legal-${seed}`, diff);
      for (const s of states) {
        if (E.isOver(s)) continue;
        const p = E.currentPlayer(s)!;
        const legal = keys(E.legalMoves(s, p));
        for (const d of ['easy', 'normal'] as const) {
          for (let k = 0; k < 3; k++) {
            const m = E.botMove(s, p, d, createRng(`${seed}-${k}`));
            expect(legal).toContain(E.moveKey(m));
          }
        }
      }
    }
  });

  it('refuse to move out of turn', () => {
    const s = freshDeal(1, { dealer: 3 });
    expect(() => E.botMove(s, 2, 'normal', createRng(1))).toThrow();
    const states = playOut(freshDeal(2), 'over');
    expect(() => E.botMove(states[states.length - 1]!, 0, 'easy', createRng(1))).toThrow();
  });

  it('lead a Spade when holding only Spades before Spades are broken', () => {
    const s = playState({ hands: ['AS KS QS JS TS 9S 8S 7S 6S 5S 4S 3S 2S', null, null, null] });
    for (const d of ['easy', 'normal'] as const) {
      const m = E.botMove(s, 0, d, createRng(3));
      expect(m.type === 'play' && suitOf(m.card)).toBe('S');
    }
  });

  it('play the only legal card', () => {
    const s = playState({
      hands: ['7H KC 4C 9D 3S 5S 8S 9S TS JS QS AS', null, null, null],
      trick: '3: 9H',
      history: ['0: 2D 3D 4D AD'],
    });
    for (const d of ['easy', 'normal'] as const) {
      expect(E.botMove(s, 0, d, createRng(4))).toEqual(play('7H'));
    }
  });

  it('use only information their seat may know', () => {
    // Shuffle the other players' hidden cards (keeping hand sizes): the bot's
    // decision must not change.
    for (let seed = 0; seed < 12; seed++) {
      const states = playOut(freshDeal(seed), `info-${seed}`);
      for (const s of states.filter((_, i) => i % 5 === 0)) {
        if (E.isOver(s)) continue;
        const p = E.currentPlayer(s)!;
        const hidden = s.hands.flatMap((h, seat) => (seat === p ? [] : h));
        const reshuffled = shuffle(hidden, createRng(`swap-${seed}`));
        const hands = s.hands.map((h, seat) => {
          if (seat === p) return h;
          return sortHand(reshuffled.splice(0, h.length));
        });
        const swapped: SpadesState = { ...s, hands };
        expect(E.botMove(swapped, p, 'normal', createRng(1))).toEqual(
          E.botMove(s, p, 'normal', createRng(1)),
        );
        expect(E.botMove(swapped, p, 'easy', createRng(7))).toEqual(
          E.botMove(s, p, 'easy', createRng(7)),
        );
      }
    }
  });

  it('decide quickly (normal well under 30 ms per decision)', () => {
    const states = playOut(freshDeal(99), 'speed');
    const t0 = performance.now();
    let n = 0;
    for (let rep = 0; rep < 5; rep++) {
      for (const s of states) {
        if (E.isOver(s)) continue;
        E.botMove(s, E.currentPlayer(s)!, 'normal', createRng(rep));
        n++;
      }
    }
    expect((performance.now() - t0) / n).toBeLessThan(5);
  });

  it('a whole hand of hearts-only leads still follows the rules', () => {
    // Seat 0 holds every Heart: it may lead them freely (Hearts are not trump).
    const s = playState({ hands: [ALL_HEARTS, null, null, null] });
    expect(E.legalMoves(s, 0)).toHaveLength(13);
    const m = E.botMove(s, 0, 'normal', createRng(1));
    expect(m.type === 'play' && suitOf(m.card)).toBe('H');
  });
});
