import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, suitOf, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError, type Difficulty } from '@/games/core/types';
import heartsDefault, { heartsEngine as E, type HeartsMove, type HeartsState } from './engine';
import {
  cardPoints,
  checkPlay,
  legalPlays,
  lowestScorers,
  passSource,
  passTarget,
  payoutUnits,
  pointsIn,
  scoreHand,
  winningPlay,
} from './rules';
import { ALL_HEARTS, cards, finishedHand, playState } from './test-helpers';

const ALL_CLUBS = '2C 3C 4C 5C 6C 7C 8C 9C TC JC QC KC AC';
const play = (card: string): HeartsMove => ({ type: 'play', card: card as CardCode });
const pass = (list: string): HeartsMove => ({ type: 'pass', cards: cards(list) });
const keys = (moves: HeartsMove[]) => moves.map((m) => E.moveKey(m));
const reasonFor = (s: HeartsState, seat: number, m: HeartsMove) => {
  const check = E.checkMove(s, seat, m);
  expect(check.ok).toBe(false);
  return check.reason ?? '';
};
const freshDeal = (seed: number | string = 1, options?: Record<string, unknown>) =>
  E.setup({ players: 4, options }, createRng(seed));

/** Pass the first three cards of each hand, seat by seat. */
function passAll(state: HeartsState, pick = (h: CardCode[]) => h.slice(0, 3)): HeartsState {
  let s = state;
  while (s.phase === 'pass') s = E.applyMove(s, { type: 'pass', cards: pick(s.hands[s.turn]!) });
  return s;
}

/** Play out a whole hand with bots; returns every state visited. */
function playOut(state: HeartsState, seed: string, diff: Difficulty = 'normal'): HeartsState[] {
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

describe('hearts setup', () => {
  it('deals 13 different cards to each of 4 seats and starts with passing', () => {
    const s = freshDeal(42);
    expect(s.hands).toHaveLength(4);
    for (const h of s.hands) expect(h).toHaveLength(13);
    const all = s.hands.flat();
    expect(new Set(all).size).toBe(52);
    expect([...all].sort()).toEqual(makeDeck().sort());
    expect(s.phase).toBe('pass');
    expect(s.passDirection).toBe('left');
    expect(s.turn).toBe(0);
    expect(E.currentPlayer(s)).toBe(0);
    expect(s.heartsBroken).toBe(false);
    expect(s.points).toEqual([0, 0, 0, 0]);
    expect(s.tricks).toEqual([]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('only supports exactly 4 players', () => {
    for (const players of [2, 3, 5]) {
      expect(() => E.setup({ players }, createRng(1))).toThrow(/exactly 4 players/);
    }
  });

  it('accepts the other passing directions and rejects unknown ones', () => {
    expect(freshDeal(1, { passDirection: 'right' }).passDirection).toBe('right');
    expect(freshDeal(1, { passDirection: 'across' }).passDirection).toBe('across');
    expect(() => freshDeal(1, { passDirection: 'sideways' })).toThrow(/passDirection/);
  });

  it("with 'hold' there is no passing: the Two of Clubs holder leads at once", () => {
    const s = freshDeal(7, { passDirection: 'hold' });
    const holder = s.hands.findIndex((h) => h.includes('2C'));
    expect(s.phase).toBe('play');
    expect(E.currentPlayer(s)).toBe(holder);
    expect(E.legalMoves(s, holder)).toEqual([play('2C')]);
  });

  it('is deterministic: same seed, same deal and same bot game', () => {
    expect(freshDeal('abc')).toEqual(freshDeal('abc'));
    expect(freshDeal('abc')).not.toEqual(freshDeal('abd'));
    const a = playOut(freshDeal(9), 'bots');
    const b = playOut(freshDeal(9), 'bots');
    expect(a).toEqual(b);
    expect(E.result(a[a.length - 1]!)).toEqual(E.result(b[b.length - 1]!));
  });

  it('exports the engine as default with id "hearts"', () => {
    expect(heartsDefault).toBe(E);
    expect(E.id).toBe('hearts');
  });
});

describe('hearts passing', () => {
  it('offers every 3-card combination to the seat whose turn it is, and nothing to others', () => {
    const s = freshDeal(3);
    const moves = E.legalMoves(s, 0);
    expect(moves).toHaveLength(286); // 13 choose 3
    expect(new Set(keys(moves)).size).toBe(286);
    for (const seat of [1, 2, 3]) expect(E.legalMoves(s, seat)).toEqual([]);
    for (const m of moves.slice(0, 20)) expect(E.checkMove(s, 0, m).ok).toBe(true);
  });

  it('goes seat 0 → 1 → 2 → 3, and passed cards leave the hand straight away', () => {
    let s = freshDeal(4);
    for (const seat of [0, 1, 2]) {
      expect(E.currentPlayer(s)).toBe(seat);
      const chosen = s.hands[seat]!.slice(0, 3);
      s = E.applyMove(s, { type: 'pass', cards: chosen });
      expect(s.hands[seat]).toHaveLength(10);
      for (const c of chosen) expect(s.hands[seat]).not.toContain(c);
      expect(s.passed[seat]).toEqual(expect.arrayContaining(chosen));
      // Nobody receives anything before everyone has chosen.
      expect(s.received).toEqual([null, null, null, null]);
      expect(s.phase).toBe('pass');
    }
    expect(E.currentPlayer(s)).toBe(3);
  });

  it('exchanges to the left once all four have passed, then the 2♣ holder leads', () => {
    const start = freshDeal(5);
    const chosen = start.hands.map((h) => h.slice(0, 3));
    const s = passAll(start);
    expect(s.phase).toBe('play');
    for (let seat = 0; seat < 4; seat++) {
      const to = (seat + 1) % 4;
      expect(passTarget(seat, 'left')).toBe(to);
      expect(s.received[to]).toEqual(expect.arrayContaining(chosen[seat]!));
      for (const c of chosen[seat]!) expect(s.hands[to]).toContain(c);
      expect(s.hands[seat]).toHaveLength(13);
    }
    const holder = s.hands.findIndex((h) => h.includes('2C'));
    expect(E.currentPlayer(s)).toBe(holder);
    expect(s.leader).toBe(holder);
    expect(E.legalMoves(s, holder)).toEqual([play('2C')]);
  });

  it('the Two of Clubs leads even when it was just passed to someone else', () => {
    const start = freshDeal(11);
    const owner = start.hands.findIndex((h) => h.includes('2C'));
    const s = passAll(start, (h) =>
      h.includes('2C') ? ['2C', ...h.filter((c) => c !== '2C').slice(0, 2)] : h.slice(0, 3),
    );
    expect(E.currentPlayer(s)).toBe(passTarget(owner, 'left'));
  });

  it('passes right and across when configured', () => {
    for (const [dir, offset] of [
      ['right', 3],
      ['across', 2],
    ] as const) {
      const start = freshDeal(6, { passDirection: dir });
      const chosen = start.hands.map((h) => h.slice(0, 3));
      const s = passAll(start);
      for (let seat = 0; seat < 4; seat++) {
        const to = (seat + offset) % 4;
        expect(passTarget(seat, dir)).toBe(to);
        expect(passSource(to, dir)).toBe(seat);
        expect(s.received[to]).toEqual(expect.arrayContaining(chosen[seat]!));
      }
    }
  });

  it('explains every illegal pass', () => {
    const s = freshDeal(8);
    const h = s.hands[0]!;
    const notMine = s.hands[1]![0]!;
    expect(reasonFor(s, 0, { type: 'pass', cards: h.slice(0, 2) })).toBe(
      'Pick exactly 3 cards to pass — you picked 2.',
    );
    expect(reasonFor(s, 0, { type: 'pass', cards: h.slice(0, 4) })).toMatch(/you picked 4/);
    expect(reasonFor(s, 0, { type: 'pass', cards: [h[0]!, h[0]!, h[1]!] })).toMatch(
      /same card twice/,
    );
    expect(reasonFor(s, 0, { type: 'pass', cards: [h[0]!, h[1]!, notMine] })).toMatch(
      /You don't have the .* — pick 3 cards from your own hand/,
    );
    expect(reasonFor(s, 0, { type: 'pass', cards: [h[0]!, h[1]!, 'ZZ' as CardCode] })).toMatch(
      /isn't a real card/,
    );
    expect(reasonFor(s, 2, { type: 'pass', cards: s.hands[2]!.slice(0, 3) })).toBe(
      "It's your turn to pick cards to pass, not Player 2's.",
    );
    const later = E.applyMove(s, { type: 'pass', cards: h.slice(0, 3) });
    expect(reasonFor(later, 0, { type: 'pass', cards: later.hands[0]!.slice(0, 3) })).toBe(
      "You've already chosen 3 cards to pass — wait for Player 1 to choose too. The cards change hands once everyone has picked.",
    );
    expect(reasonFor(later, 2, { type: 'pass', cards: later.hands[2]!.slice(0, 3) })).toBe(
      "It's Player 1's turn to pick cards to pass, not yours.",
    );
    expect(reasonFor(s, 0, play(h[0]!))).toMatch(
      /^Not yet! First choose 3 cards to pass to Player 1/,
    );
    expect(reasonFor(s, 0, { type: 'deal' } as unknown as HeartsMove)).toMatch(
      /isn't a Hearts move/,
    );
    expect(() => E.applyMove(s, { type: 'pass', cards: h.slice(0, 2) })).toThrow(IllegalMoveError);
  });

  it('gives a pass the same key whatever order the cards are picked in', () => {
    expect(E.moveKey(pass('QS AH 2D'))).toBe(E.moveKey(pass('2D QS AH')));
    expect(E.moveKey(pass('QS AH 2D'))).not.toBe(E.moveKey(pass('QS AH 3D')));
    expect(E.moveKey(play('QS'))).not.toBe(E.moveKey(pass('QS AH 2D')));
  });
});

describe('hearts play rules', () => {
  // Seat 1 led the 2♣; seats 2 and 3 followed; seat 0 has no Clubs.
  const firstTrick = (hand0: string) =>
    playState({ hands: [hand0, null, null, null], trick: '1: 2C 3C 4C' });

  it('the Two of Clubs must lead the first trick', () => {
    const s = playState({ hands: [ALL_CLUBS, null, null, null] });
    expect(s.hands[0]).toContain('2C');
    expect(E.legalMoves(s, 0)).toEqual([play('2C')]);
    expect(reasonFor(s, 0, play(s.hands[0]!.find((c) => c !== '2C')!))).toBe(
      'The first trick always starts with the Two of Clubs — you hold it, so lead the 2♣.',
    );
  });

  it('you must follow suit when you can', () => {
    const s = playState({
      hands: [null, null, 'AH KH QH JH 9C 5D 6D 7D 8D 9D TD JD QD', null],
      trick: '1: 2C',
    });
    expect(E.currentPlayer(s)).toBe(2);
    expect(E.legalMoves(s, 2)).toEqual([play('9C')]);
    expect(reasonFor(s, 2, play('5D'))).toBe(
      'You must follow suit: Clubs were led and you still have a Club (like your 9♣), so you have to play one.',
    );
  });

  it('follow suit applies to Hearts too', () => {
    const s = playState({
      hands: ['3H 9S TS JS KS 2D 3D 4D 5D 6D 7D 8D', null, null, null],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 2H',
      heartsBroken: true,
    });
    expect(E.currentPlayer(s)).toBe(0);
    expect(reasonFor(s, 0, play('9S'))).toBe(
      'You must follow suit: Hearts were led and you still have a Heart (like your 3♥), so you have to play one.',
    );
    expect(E.legalMoves(s, 0)).toEqual([play('3H')]);
  });

  it('no Hearts on the first trick while you hold a safe card', () => {
    const s = firstTrick('AS KS 2S AH KH QH 2H 3D 4D 5D 6D 7D 8D');
    const legal = E.legalMoves(s, 0).map((m) => (m.type === 'play' ? m.card : ''));
    expect(legal.sort()).toEqual(cards('AS KS 2S 3D 4D 5D 6D 7D 8D').sort());
    expect(reasonFor(s, 0, play('AH'))).toBe(
      "No points on the first trick: you can't play a Heart on the first trick while you still have a card that isn't worth points (like your 2♠).",
    );
  });

  it('no Queen of Spades on the first trick while you hold a safe card', () => {
    const s = firstTrick('QS KS 2S AH KH QH 2H 3D 4D 5D 6D 7D 8D');
    expect(reasonFor(s, 0, play('QS'))).toMatch(
      /^No points on the first trick: you can't play the Queen of Spades on the first trick/,
    );
    expect(keys(E.legalMoves(s, 0))).not.toContain('play:QS');
  });

  it('a hand of only Hearts may play a Heart on the first trick (and breaks Hearts)', () => {
    const s = firstTrick(ALL_HEARTS);
    expect(E.legalMoves(s, 0)).toHaveLength(13);
    const next = E.applyMove(s, play('AH'));
    expect(next.heartsBroken).toBe(true);
    expect(next.tricks).toHaveLength(1);
    expect(next.tricks[0]!.winner).toBe(3); // the 4♣ is the highest Club
    expect(next.points).toEqual([0, 0, 0, 1]);
  });

  it('a hand of only Hearts and the Queen of Spades may play any of them on the first trick', () => {
    const s = firstTrick('QS KH QH JH TH 9H 8H 7H 6H 5H 4H 3H 2H');
    expect(E.legalMoves(s, 0)).toHaveLength(13);
    expect(E.checkMove(s, 0, play('QS')).ok).toBe(true);
    expect(E.checkMove(s, 0, play('KH')).ok).toBe(true);
  });

  it("Hearts can't be led until broken", () => {
    const s = playState({
      hands: [null, null, null, '2H 3H 4H 5H 6H 7H 8H 9H TH JH QH 6D'],
      history: ['0: 2C 3C 4C 5C'],
    });
    expect(E.currentPlayer(s)).toBe(3);
    expect(s.heartsBroken).toBe(false);
    expect(E.legalMoves(s, 3)).toEqual([play('6D')]);
    expect(reasonFor(s, 3, play('2H'))).toBe(
      "Hearts aren't broken yet — you can't lead a Heart until someone has played one on an earlier trick. Lead a Diamond instead.",
    );
  });

  it('lists every other suit you could lead instead', () => {
    const hand = ['2H', '3S', '4C', '5D'] as CardCode[];
    const check = checkPlay(hand, { trick: [], trickIndex: 3, heartsBroken: false }, '2H');
    expect(check.reason).toMatch(/Lead a Spade, a Club or a Diamond instead\.$/);
  });

  it('a leader holding only Hearts may lead one before they are broken', () => {
    const s = playState({
      hands: [null, null, null, '2H 3H 4H 5H 6H 7H 8H 9H TH JH QH KH'],
      history: ['0: 2C 3C 4C 5C'],
    });
    expect(E.legalMoves(s, 3)).toHaveLength(12);
    const next = E.applyMove(s, play('2H'));
    expect(next.heartsBroken).toBe(true);
  });

  it('once a Heart has been discarded, Hearts may be led', () => {
    const s = playState({
      hands: [
        null,
        '2H 3H 4H 5H 6H 7H 8H 9H TH JH 6D',
        'KH AS KS 2S 3S 6C 7C 8C 9C TC JC QC',
        null,
      ],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 2D 3D 4D',
    });
    const next = E.applyMove(s, play('KH'));
    expect(next.heartsBroken).toBe(true);
    expect(E.currentPlayer(next)).toBe(1); // the 4♦ won
    expect(E.checkMove(next, 1, play('2H')).ok).toBe(true);
  });

  it('the Queen of Spades does not break Hearts', () => {
    const s = playState({
      hands: [
        null,
        '2H 3H 4H 5H 6H 7H 8H 9H TH JH 6D',
        'QS AS KS 2S 3S 6C 7C 8C 9C TC JC QC',
        null,
      ],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 2D 3D 4D',
    });
    const next = E.applyMove(s, play('QS'));
    expect(next.tricks[1]!.winner).toBe(1);
    expect(next.points[1]).toBe(13);
    expect(next.heartsBroken).toBe(false);
    expect(reasonFor(next, 1, play('2H'))).toMatch(/^Hearts aren't broken yet/);
    expect(E.legalMoves(next, 1)).toEqual([play('6D')]);
  });

  it('the highest card of the led suit wins; off-suit cards never win; the winner leads next', () => {
    const s = playState({
      hands: [null, null, 'AS AH 2S 3S 4S 6C 7C 8C 9C TC JC QC', null],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 9D KD 2H',
    });
    const next = E.applyMove(s, play('AS'));
    expect(next.tricks[1]).toEqual({
      leader: 3,
      plays: [
        { seat: 3, card: '9D' },
        { seat: 0, card: 'KD' },
        { seat: 1, card: '2H' },
        { seat: 2, card: 'AS' },
      ],
      winner: 0,
      points: 1,
    });
    expect(next.won[0]).toEqual(expect.arrayContaining(cards('9D KD 2H AS')));
    expect(next.points).toEqual([1, 0, 0, 0]);
    expect(next.trick).toEqual([]);
    expect(E.currentPlayer(next)).toBe(0);
    expect(next.leader).toBe(0);
  });

  it('collects 1 point per Heart and 13 for the Queen of Spades', () => {
    expect(cardPoints('QS')).toBe(13);
    expect(cardPoints('2H')).toBe(1);
    expect(cardPoints('AH')).toBe(1);
    expect(cardPoints('KS')).toBe(0);
    expect(cardPoints('JD')).toBe(0);
    expect(pointsIn(makeDeck())).toBe(26);
    const s = playState({
      hands: [null, null, 'QS AS 2S 3S 4S 6C 7C 8C 9C TC JC QC', null],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 9D KD 2H',
    });
    const next = E.applyMove(s, play('QS'));
    expect(next.points).toEqual([14, 0, 0, 0]);
  });

  it('explains turn, phase, card and game-over problems during play', () => {
    const s = playState({ hands: [null, null, null, null], trick: '1: 2C' });
    expect(reasonFor(s, 0, play(s.hands[0]![0]!))).toBe("It's Player 2's turn to play, not yours.");
    // playState deals a 'hold' hand (no passing at all)…
    expect(reasonFor(s, 2, pass('AS KS QS'))).toBe(
      "There's no passing this hand — everyone keeps their cards, so just play a card.",
    );
    // …while after a real exchange the pass is simply over.
    const passed = passAll(freshDeal(12));
    expect(reasonFor(passed, passed.turn, pass('AS KS QS'))).toBe(
      "Passing is already finished — now it's time to play a card.",
    );
    expect(reasonFor(s, 2, play('2C'))).toBe(
      "You don't have the Two of Clubs in your hand — pick one of your own cards.",
    );
    expect(reasonFor(s, 2, play('1X'))).toMatch(/isn't a real card/);
    expect(reasonFor(s, 2, null as unknown as HeartsMove)).toMatch(/isn't a Hearts move/);
    const over = finishedHand(evenSplit());
    expect(reasonFor(over, 0, play('2C'))).toMatch(/hand is over/);
    expect(() => E.applyMove(over, play('2C'))).toThrow(IllegalMoveError);
    expect(() => E.applyMove(s, play('AH'))).toThrow(IllegalMoveError);
  });

  it('legalMoves is empty for everyone but the current player; currentPlayer is null only when over', () => {
    const s = playState({ hands: [null, null, null, null], trick: '1: 2C 3C' });
    expect(E.currentPlayer(s)).toBe(3);
    for (const seat of [0, 1, 2]) expect(E.legalMoves(s, seat)).toEqual([]);
    expect(E.legalMoves(s, 3).length).toBeGreaterThan(0);
    const over = finishedHand(evenSplit());
    expect(E.isOver(over)).toBe(true);
    expect(E.currentPlayer(over)).toBeNull();
    for (const seat of [0, 1, 2, 3]) expect(E.legalMoves(over, seat)).toEqual([]);
  });

  it('legalPlays and checkPlay agree for every card', () => {
    const states = playOut(freshDeal(21, { passDirection: 'hold' }), 'agree', 'easy');
    for (const s of states.filter((x) => x.phase === 'play')) {
      const seat = s.turn;
      const ctx = { trick: s.trick, trickIndex: s.tricks.length, heartsBroken: s.heartsBroken };
      const hand = s.hands[seat]!;
      expect(legalPlays(hand, ctx)).toEqual(hand.filter((c) => checkPlay(hand, ctx, c).ok));
      for (const c of hand) {
        const check = checkPlay(hand, ctx, c);
        if (!check.ok) expect(check.reason).toBeTruthy();
      }
    }
  });

  it('applyMove never mutates its input', () => {
    let s = freshDeal(13);
    const rng = createRng('freeze');
    while (!E.isOver(s)) {
      const before = JSON.stringify(s);
      deepFreeze(s);
      const next = E.applyMove(s, E.botMove(s, E.currentPlayer(s)!, 'normal', rng));
      expect(JSON.stringify(s)).toBe(before);
      s = next;
    }
  });

  it('completes 13 tricks and then the hand is over', () => {
    const states = playOut(freshDeal(17), 'thirteen');
    const final = states[states.length - 1]!;
    expect(final.phase).toBe('over');
    expect(final.tricks).toHaveLength(13);
    expect(final.hands.every((h) => h.length === 0)).toBe(true);
    expect(states.length - 1).toBe(4 + 52); // 4 passes + 52 cards
    for (const t of final.tricks) {
      expect(t.winner).toBe(winningPlay(t.plays).seat);
    }
  });
});

/** A plain finished hand: Q♠ to seat 1; you and Player 3 tie on 3 points. */
function evenSplit() {
  return [
    { winner: 1 },
    { winner: 1, pts: 'QS AH' },
    { winner: 2, pts: 'KH QH' },
    { winner: 3, pts: 'JH TH' },
    { winner: 0, pts: '9H 8H' },
    { winner: 2, pts: '7H 6H' },
    { winner: 3, pts: '5H' },
    { winner: 0, pts: '3H' },
    { winner: 2, pts: '2H 4H' },
    { winner: 2 },
    { winner: 3 },
    { winner: 1 },
    { winner: 1 },
  ];
}

describe('hearts scoring and payouts', () => {
  it('scoreHand applies the shoot-the-moon rule', () => {
    expect(scoreHand([3, 16, 4, 3])).toEqual({ scores: [3, 16, 4, 3], moonShooter: null });
    expect(scoreHand([0, 26, 0, 0])).toEqual({ scores: [26, 0, 26, 26], moonShooter: 1 });
    expect(lowestScorers([3, 16, 4, 3])).toEqual([0, 3]);
  });

  it('pays the pot: sole +3, two-way +1, three-way +1/3, losers −1, always summing to 0', () => {
    expect(payoutUnits(0, [0])).toBe(3);
    expect(payoutUnits(1, [0])).toBe(-1);
    expect(payoutUnits(0, [0, 2])).toBe(1);
    expect(payoutUnits(0, [0, 1, 3])).toBeCloseTo(1 / 3, 10);
    expect(payoutUnits(2, [0, 1, 3])).toBe(-1);
    for (const winners of [[0], [1], [0, 1], [2, 3], [0, 1, 2], [1, 2, 3]]) {
      const total = [0, 1, 2, 3].reduce((sum, seat) => sum + payoutUnits(seat, winners), 0);
      expect(total).toBeCloseTo(0, 10);
    }
  });

  it('sole win with no points: +3, bigPot, perfect, clean hand', () => {
    const s = finishedHand([
      { winner: 1 },
      { winner: 1, pts: 'QS AH' },
      { winner: 2, pts: 'KH QH' },
      { winner: 3, pts: 'JH TH' },
      { winner: 1, pts: '9H 8H' },
      { winner: 2, pts: '7H 6H' },
      { winner: 3, pts: '5H 4H' },
      { winner: 2, pts: '3H 2H' },
      { winner: 0 },
      { winner: 0 },
      { winner: 0 },
      { winner: 0 },
      { winner: 0 },
    ]);
    const r = E.result(s);
    expect(r.scores).toEqual([0, 16, 6, 4]);
    expect(r.winners).toEqual([0]);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(3);
    expect(r.summary).toBe('You won with 0 points — the lowest score at the table!');
    expect(r.flags).toMatchObject({
      bigPot: true,
      perfect: true,
      comeback: false,
      bust: false,
      folded: false,
      closeFinish: false,
      luckyLastCard: false,
    });
    expect(r.flags.tags).toEqual(['cleanHand']);
  });

  it('two-way tie for lowest: +1 each, shared win, not a big pot', () => {
    const s = finishedHand(evenSplit()); // 3, 14, 6, 3 — learner ties seat 3
    const r = E.result(s);
    expect(r.scores).toEqual([3, 14, 6, 3]);
    expect(r.winners).toEqual([0, 3]);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(1);
    expect(r.flags.bigPot).toBe(false);
    expect(r.flags.perfect).toBe(false);
    expect(r.flags.tags).toEqual(['sharedWin']);
    expect(r.flags.closeFinish).toBe(false); // next best is 6, three points behind
    expect(r.summary).toBe(
      'You tied for the lowest score (3 points) with Player 3, so you share the win.',
    );
  });

  it('three-way tie for lowest: +1/3 each', () => {
    const s = finishedHand([
      { winner: 0 },
      { winner: 1, pts: 'QS AH' },
      { winner: 1, pts: 'KH QH' },
      { winner: 1, pts: 'JH TH' },
      { winner: 1, pts: '9H 8H' },
      { winner: 0, pts: '7H 6H' },
      { winner: 2, pts: '5H 4H' },
      { winner: 3, pts: '3H 2H' },
      { winner: 0 },
      { winner: 2 },
      { winner: 3 },
      { winner: 0 },
      { winner: 0 },
    ]);
    const r = E.result(s);
    expect(r.scores).toEqual([2, 20, 2, 2]);
    expect(r.winners).toEqual([0, 2, 3]);
    expect(r.humanNetUnits).toBeCloseTo(1 / 3, 10);
    expect(r.summary).toBe(
      'You tied for the lowest score (2 points) with Player 2 and Player 3, so you share the win.',
    );
  });

  it('a loss costs one stake; taking the Queen of Spades and losing is a "bust"', () => {
    const s = finishedHand([
      { winner: 1 },
      { winner: 0, pts: 'QS AH' },
      { winner: 2, pts: 'KH QH' },
      { winner: 3, pts: 'JH TH' },
      { winner: 1, pts: '9H 8H' },
      { winner: 2, pts: '7H 6H' },
      { winner: 3, pts: '5H 4H' },
      { winner: 2, pts: '3H 2H' },
      { winner: 1 },
      { winner: 1 },
      { winner: 1 },
      { winner: 1 },
      { winner: 1 },
    ]);
    const r = E.result(s);
    expect(r.scores).toEqual([14, 2, 6, 4]);
    expect(r.winners).toEqual([1]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.flags.bust).toBe(true);
    expect(r.flags.bigPot).toBe(false);
    expect(r.flags.tags).toEqual(['queenOfSpades']);
    expect(r.summary).toBe('Player 1 won with 2 points; you finished with 14 points.');
  });

  it('a loss without the Queen is not a bust; a near miss is a close finish', () => {
    const s = finishedHand([
      { winner: 1 },
      { winner: 2, pts: 'QS AH' },
      { winner: 0, pts: 'KH QH' },
      { winner: 3, pts: 'JH TH' },
      { winner: 1, pts: '9H' },
      { winner: 2, pts: '7H 6H' },
      { winner: 3, pts: '5H 4H' },
      { winner: 0, pts: '3H' },
      { winner: 3, pts: '8H 2H' },
      { winner: 1 },
      { winner: 1 },
      { winner: 1 },
      { winner: 1 },
    ]);
    const r = E.result(s);
    expect(r.scores).toEqual([3, 1, 16, 6]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.flags.bust).toBe(false);
    expect(r.flags.closeFinish).toBe(true); // 3 vs the winner's 1
  });

  it('winning by one point is a close finish; winning by three or more is not', () => {
    const threeWay = finishedHand([
      { winner: 1 },
      { winner: 1, pts: 'QS AH' },
      { winner: 0, pts: 'KH QH' },
      { winner: 0, pts: 'JH TH' },
      { winner: 2, pts: '9H 8H' },
      { winner: 2, pts: '7H 6H' },
      { winner: 3, pts: '5H 4H' },
      { winner: 3, pts: '3H 2H' },
      { winner: 3 },
      { winner: 3 },
      { winner: 3 },
      { winner: 3 },
      { winner: 3 },
    ]);
    const r = E.result(threeWay);
    expect(r.scores).toEqual([4, 14, 4, 4]);
    expect(r.winners).toEqual([0, 2, 3]);
    expect(r.flags.closeFinish).toBe(false); // 10 clear of the only loser

    const byThree = finishedHand([
      { winner: 1 },
      { winner: 1, pts: 'QS AH' },
      { winner: 0, pts: 'KH QH' },
      { winner: 0, pts: 'JH' },
      { winner: 2, pts: 'TH 9H' },
      { winner: 2, pts: '8H' },
      { winner: 3, pts: '7H 6H' },
      { winner: 3, pts: '5H 4H' },
      { winner: 3, pts: '3H 2H' },
      { winner: 3 },
      { winner: 3 },
      { winner: 3 },
      { winner: 3 },
    ]);
    const r1 = E.result(byThree);
    expect(r1.scores).toEqual([3, 14, 3, 6]);
    expect(r1.winners).toEqual([0, 2]);
    expect(r1.flags.closeFinish).toBe(false); // 3 clear of Player 3

    const tight = finishedHand([
      { winner: 1 },
      { winner: 1, pts: 'QS AH' },
      { winner: 0, pts: 'KH QH' },
      { winner: 2, pts: 'JH TH' },
      { winner: 2, pts: '9H' },
      { winner: 3, pts: '8H 7H' },
      { winner: 3, pts: '6H 5H' },
      { winner: 1, pts: '4H 3H' },
      { winner: 1, pts: '2H' },
      { winner: 1 },
      { winner: 1 },
      { winner: 1 },
      { winner: 1 },
    ]);
    const r2 = E.result(tight);
    expect(r2.scores).toEqual([2, 17, 3, 4]);
    expect(r2.winners).toEqual([0]);
    expect(r2.humanNetUnits).toBe(3);
    expect(r2.flags.closeFinish).toBe(true); // one point ahead of Player 2
    expect(r2.flags.luckyLastCard).toBe(false); // already winning before the last trick
  });

  it('luckyLastCard: the final trick turned a loss into a win', () => {
    const lucky = finishedHand([
      { winner: 0 },
      { winner: 1, pts: 'QS AH' },
      { winner: 1, pts: 'KH QH' },
      { winner: 1, pts: 'JH TH' },
      { winner: 1, pts: '9H 8H' },
      { winner: 3, pts: '7H 6H' },
      { winner: 3, pts: '5H 4H' },
      { winner: 0, pts: '3H' },
      { winner: 0 },
      { winner: 0 },
      { winner: 0 },
      { winner: 0 },
      { winner: 2, pts: '2H' },
    ]);
    // Before the last trick Player 2 had 0 points and you had 1, so you were losing.
    const r = E.result(lucky);
    expect(r.scores).toEqual([1, 20, 1, 4]);
    expect(r.winners).toEqual([0, 2]);
    expect(r.flags.luckyLastCard).toBe(true);
    expect(r.flags.closeFinish).toBe(false);
  });

  it('result() refuses to score an unfinished hand', () => {
    expect(() => E.result(freshDeal(1))).toThrow(/before the hand ended/);
  });
});

describe('hearts shooting the moon (played through the engine)', () => {
  /** Each seat holds one whole suit, so the Club holder wins every trick. */
  function oneSuitEach(clubs: number): HeartsState {
    const suits = ['C', 'D', 'S', 'H'] as const;
    const hands: (string | null)[] = [null, null, null, null];
    suits.forEach((suit, i) => {
      hands[(clubs + i) % 4] = makeDeck()
        .filter((c) => suitOf(c) === suit)
        .join(' ');
    });
    return playState({ hands });
  }

  /** Play the first legal move every time. */
  function firstLegal(state: HeartsState): HeartsState {
    let s = state;
    while (!E.isOver(s)) s = E.applyMove(s, E.legalMoves(s, E.currentPlayer(s)!)[0]!);
    return s;
  }

  it('the learner taking all 26 points scores 0 and everyone else 26', () => {
    const final = firstLegal(oneSuitEach(0));
    expect(final.points).toEqual([26, 0, 0, 0]);
    const r = E.result(final);
    expect(r.scores).toEqual([0, 26, 26, 26]);
    expect(r.winners).toEqual([0]);
    expect(r.humanNetUnits).toBe(3);
    expect(r.summary).toMatch(/^You shot the moon!/);
    expect(r.flags).toMatchObject({
      perfect: true,
      comeback: true, // you were on 13+ points along the way and still won
      bigPot: true,
      luckyLastCard: true, // on 25 points before the last Heart arrived
      bust: false,
    });
    expect(r.flags.tags).toEqual(['shootTheMoon', 'queenOfSpades']);
  });

  it('an opponent shooting the moon gives the learner 26', () => {
    const final = firstLegal(oneSuitEach(2));
    expect(final.points).toEqual([0, 0, 26, 0]);
    const r = E.result(final);
    expect(r.scores).toEqual([26, 26, 0, 26]);
    expect(r.winners).toEqual([2]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.summary).toBe(
      'Player 2 shot the moon by taking every point card, so everyone else — including you — gets 26 points.',
    );
    expect(r.flags.perfect).toBe(false);
    expect(r.flags.tags).toEqual(['opponentShotMoon', 'cleanHand']);
  });

  it('describes the moon on the final card', () => {
    let s = oneSuitEach(0);
    while (s.tricks.length < 12 || s.trick.length < 3) {
      s = E.applyMove(s, E.legalMoves(s, E.currentPlayer(s)!)[0]!);
    }
    const last = E.legalMoves(s, E.currentPlayer(s)!)[0]!;
    expect(E.describeMove(s, E.currentPlayer(s)!, last)).toMatch(
      /You win the trick and take 1 point\. That was the last trick — you shot the moon!$/,
    );
  });
});

describe('hearts describeMove', () => {
  it('describes your pass in full but hides a bot pass', () => {
    const s = freshDeal(31);
    const mine = s.hands[0]!.slice(0, 3);
    expect(E.describeMove(s, 0, { type: 'pass', cards: mine })).toMatch(
      /^You passed the .+, the .+ and the .+ to Player 1\.$/,
    );
    const s1 = E.applyMove(s, { type: 'pass', cards: mine });
    const theirs = s1.hands[1]!.slice(0, 3);
    const text = E.describeMove(s1, 1, { type: 'pass', cards: theirs });
    expect(text).toBe('Player 1 passed 3 cards to Player 2.');
  });

  it('announces the exchange and what you received on the last pass', () => {
    let s = freshDeal(32);
    for (let i = 0; i < 3; i++)
      s = E.applyMove(s, { type: 'pass', cards: s.hands[s.turn]!.slice(0, 3) });
    const lastPass: HeartsMove = { type: 'pass', cards: s.hands[3]!.slice(0, 3) };
    const text = E.describeMove(s, 3, lastPass);
    expect(text).toMatch(
      /^Player 3 passed 3 cards to you\. Everyone has passed, so the cards change hands — you received the /,
    );
    const after = E.applyMove(s, lastPass);
    for (const c of after.received[0]!) expect(text).toContain(cardName(c));
  });

  it('describes leads, follows, discards, broken Hearts and who wins the trick', () => {
    const s = playState({
      hands: [
        null,
        '4H 5H 6H 7H 8H 9H TH JH QH KH TD 2D',
        'AS AH 2S 3S 4S 6C 7C 8C 9C TC JC QC',
        null,
      ],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 9D KD',
    });
    expect(E.describeMove(s, 1, play('TD'))).toBe('Player 1 played the Ten of Diamonds.');
    const lead = playState({ hands: [ALL_CLUBS, null, null, null] });
    expect(E.describeMove(lead, 0, play('2C'))).toBe('You led the Two of Clubs.');
    const s2 = E.applyMove(s, play('2D'));
    expect(E.describeMove(s2, 2, play('AH'))).toBe(
      "Player 2 couldn't follow suit and played the Ace of Hearts. Hearts are broken! You win the trick and take 1 point.",
    );
    expect(E.describeMove(s2, 2, play('AS'))).toBe(
      "Player 2 couldn't follow suit and played the Ace of Spades. You win the trick.",
    );
    const s3 = E.applyMove(s2, play('AS'));
    expect(E.describeMove(s3, 0, play(s3.hands[0]![0]!))).toMatch(/^You led the /);
  });

  it('never mentions "Player 0"', () => {
    const states = playOut(freshDeal(33), 'names');
    for (const s of states.slice(0, -1)) {
      const p = E.currentPlayer(s)!;
      for (const m of E.legalMoves(s, p).slice(0, 5)) {
        expect(E.describeMove(s, p, m)).not.toMatch(/Player 0/);
      }
      expect(E.coach(s, 0).situation).not.toMatch(/Player 0/);
    }
  });
});

describe('hearts coach', () => {
  it('suggests a legal pass with a reason when it is your turn to pass', () => {
    const s = freshDeal(41);
    const advice = E.coach(s, 0);
    expect(advice.situation).toMatch(/choose 3 cards to pass to Player 1 \(on your left\)/);
    const suggestion = advice.suggestion as HeartsMove;
    expect(E.checkMove(s, 0, suggestion).ok).toBe(true);
    expect(advice.why).toMatch(/^Pass /);
    expect(E.moveKey(suggestion)).toBe(E.moveKey(E.botMove(s, 0, 'normal', createRng(1))));
  });

  it('has no suggestion when it is not your turn', () => {
    const s = E.applyMove(freshDeal(42), pass(freshDeal(42).hands[0]!.slice(0, 3).join(' ')));
    const advice = E.coach(s, 0);
    expect(advice.suggestion).toBeUndefined();
    expect(advice.situation).toMatch(/Waiting for Player 1/);
  });

  it('explains the position and suggests the normal bot move at every turn of a game', () => {
    const states = playOut(freshDeal(43), 'coach');
    for (const s of states.slice(0, -1)) {
      const p = E.currentPlayer(s)!;
      const advice = E.coach(s, p);
      expect(advice.situation.length).toBeGreaterThan(10);
      expect(advice.why?.length ?? 0).toBeGreaterThan(10);
      const m = advice.suggestion as HeartsMove;
      expect(E.checkMove(s, p, m).ok).toBe(true);
      expect(E.moveKey(m)).toBe(E.moveKey(E.botMove(s, p, 'normal', createRng(0))));
    }
    const final = states[states.length - 1]!;
    expect(E.coach(final, 0).situation).toMatch(/^The hand is over\..*Final scores: You /);
    expect(E.coach(final, 0).suggestion).toBeUndefined();
  });

  it('tells you when you must lead the Two of Clubs or follow suit', () => {
    const lead = playState({ hands: [ALL_CLUBS, null, null, null] });
    expect(E.coach(lead, 0).situation).toMatch(/You hold the Two of Clubs/);
    expect(E.coach(lead, 0).why).toMatch(/must start the first trick/);
    const follow = playState({
      hands: ['3H 9S TS JS KS 2D 3D 4D 5D 6D 7D 8D', null, null, null],
      history: ['0: 2C 3C 4C 5C'],
      trick: '3: 2H',
      heartsBroken: true,
    });
    const advice = E.coach(follow, 0);
    expect(advice.situation).toMatch(
      /Player 3 led the 2♥.*You have Hearts, so you must play one\./,
    );
    expect(advice.why).toMatch(/only Heart/);
  });

  it('practice seed 73: pass the Q♠, follow the coach and win with 0 points', () => {
    // Recommended GameModule.practice.seed (setup rng = createRng(73)).
    let s = E.setup({ players: 4 }, createRng(73));
    expect(s.hands[0]).toEqual(expect.arrayContaining(cards('QS AS AH')));
    const first = E.coach(s, 0).suggestion as HeartsMove;
    expect(first.type === 'pass' && [...first.cards].sort()).toEqual(['AH', 'AS', 'QS']);
    while (!E.isOver(s)) {
      const p = E.currentPlayer(s)!;
      const m =
        p === 0
          ? (E.coach(s, 0).suggestion as HeartsMove)
          : E.botMove(s, p, 'normal', createRng(p));
      s = E.applyMove(s, m);
    }
    const r = E.result(s);
    expect(r.humanOutcome).toBe('win');
    expect(r.scores![0]).toBe(0);
  });
});
