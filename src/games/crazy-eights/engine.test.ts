import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, SUITS, type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError, type PlayerId } from '@/games/core/types';
import crazyEightsDefault, {
  canDraw,
  canReshuffle,
  crazyEightsEngine as engine,
  isBlocked,
  MAX_RESHUFFLES,
  type CrazyEightsMove,
  type CrazyEightsState,
} from './engine';
import {
  canPlay,
  cardPoints,
  handPoints,
  handSizeFor,
  lowestSeats,
  payoutUnits,
  playableCards,
} from './rules';
import { allCards, cards, FULL_DECK, makeState } from './test-helpers';

const keys = (moves: readonly CrazyEightsMove[]) => moves.map((m) => engine.moveKey(m));
const play = (card: string, suit?: string): CrazyEightsMove =>
  (suit === undefined
    ? { type: 'play', card: card as CardCode }
    : { type: 'play', card: card as CardCode, suit }) as CrazyEightsMove;
const DRAW: CrazyEightsMove = { type: 'draw' };
const PASS: CrazyEightsMove = { type: 'pass' };

function reason(state: CrazyEightsState, player: PlayerId, move: unknown): string {
  const check = engine.checkMove(state, player, move as CrazyEightsMove);
  expect(check.ok).toBe(false);
  return check.reason ?? '';
}

function expectLegal(state: CrazyEightsState, player: PlayerId, move: CrazyEightsMove) {
  expect(engine.checkMove(state, player, move)).toEqual({ ok: true });
  expect(keys(engine.legalMoves(state, player))).toContain(engine.moveKey(move));
}

/** Apply a sequence of moves, each by the current player. */
function run(state: CrazyEightsState, ...moves: CrazyEightsMove[]): CrazyEightsState {
  return moves.reduce((s, m) => engine.applyMove(s, m), state);
}

/** 3 players, the K♥ on top; you hold 7♠ 3♥ 2♣ K♣ 8♦. */
const basic = () =>
  makeState({
    hands: ['3H KC 7S 8D 2C', '4S 5S', '9D TD JD'],
    top: 'KH',
  });

/** Player 2 played the 8♥ and named Spades; your turn. */
const afterEight = () =>
  makeState({
    hands: ['5H 9S 8C 4D', '2D 3D', 'JC QC'],
    top: '8H',
    activeSuit: 'S',
    namedBy: 2,
  });

describe('setup', () => {
  it.each([2, 3, 4])('deals the right number of cards with %i players', (players) => {
    const s = engine.setup({ players }, createRng(`deal-${players}`));
    const size = players === 2 ? 7 : 5;
    expect(handSizeFor(players)).toBe(size);
    expect(s.players).toBe(players);
    expect(s.hands).toHaveLength(players);
    for (const h of s.hands) expect(h).toHaveLength(size);
    expect(s.discard).toEqual([s.starter]);
    expect(s.stock).toHaveLength(52 - size * players - 1);
    expect(allCards(s)).toBe(FULL_DECK);
    expect(s.activeSuit).toBe(s.starter[1]);
    expect(s.starter[0]).not.toBe('8');
    expect(s.turn).toBe(0);
    expect(s.phase).toBe('play');
    expect(s.log).toEqual([]);
    expect(s.draws).toEqual(new Array(players).fill(0));
    expect(s.reshuffle).toBe(false);
    expect(engine.currentPlayer(s)).toBe(0);
    expect(engine.isOver(s)).toBe(false);
  });

  it('keeps every hand sorted for display (by suit, Ace low)', () => {
    const s = engine.setup({ players: 3 }, createRng(9));
    for (const h of s.hands) {
      const sorted = h.slice().sort((a, b) => {
        const order = 'SHCD';
        const ranks = 'A23456789TJQK';
        const sd = order.indexOf(a[1]!) - order.indexOf(b[1]!);
        return sd !== 0 ? sd : ranks.indexOf(a[0]!) - ranks.indexOf(b[0]!);
      });
      expect(h).toEqual(sorted);
    }
  });

  it('buries an Eight turned up as the starter in the bottom half of the stock', () => {
    // Seed 4 turns up an Eight first (found by scanning seeds).
    const s = engine.setup({ players: 3 }, createRng(4));
    expect(s.buried).toHaveLength(1);
    const eight = s.buried[0]!;
    expect(eight[0]).toBe('8');
    expect(s.starter[0]).not.toBe('8');
    // Strictly in the bottom half of the 36-card stock: index 18–35.
    expect(s.stock.indexOf(eight)).toBeGreaterThanOrEqual(s.stock.length / 2);
    expect(s.stock).toHaveLength(52 - 15 - 1);
    expect(allCards(s)).toBe(FULL_DECK);
  });

  it('keeps burying until a non-Eight is turned up', () => {
    const s = engine.setup({ players: 3 }, createRng(251));
    expect(s.buried.length).toBeGreaterThanOrEqual(2);
    expect(s.starter[0]).not.toBe('8');
    for (const e of s.buried) {
      expect(s.stock.indexOf(e)).toBeGreaterThanOrEqual(s.stock.length / 2);
    }
    expect(allCards(s)).toBe(FULL_DECK);
  });

  it('is deterministic: the same seed gives the same deal, another seed a different one', () => {
    const a = engine.setup({ players: 3 }, createRng(42));
    const b = engine.setup({ players: 3 }, createRng(42));
    const c = engine.setup({ players: 3 }, createRng(43));
    expect(a).toEqual(b);
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
  });

  it('starts with options.firstPlayer and deals the first card to that seat', () => {
    const base = engine.setup({ players: 3 }, createRng(7));
    const s = engine.setup({ players: 3, options: { firstPlayer: 1 } }, createRng(7));
    expect(s.turn).toBe(1);
    expect(engine.currentPlayer(s)).toBe(1);
    expect(s.starter).toBe(base.starter);
    // Same deck, dealing starts one seat later.
    expect(s.hands[1]).toEqual(base.hands[0]);
    expect(s.hands[2]).toEqual(base.hands[1]);
    expect(s.hands[0]).toEqual(base.hands[2]);
  });

  it('records the reshuffle house rule option', () => {
    const s = engine.setup({ players: 2, options: { reshuffle: true } }, createRng(1));
    expect(s.reshuffle).toBe(true);
    expect(s.reshuffles).toBe(0);
  });

  it('rejects bad configs', () => {
    for (const players of [0, 1, 5, 2.5, Number.NaN]) {
      expect(() => engine.setup({ players }, createRng(1))).toThrow(RangeError);
    }
    expect(() => engine.setup({ players: 3, options: { reshuffle: 'yes' } }, createRng(1))).toThrow(
      RangeError,
    );
    for (const firstPlayer of [-1, 3, 1.5, '1']) {
      expect(() => engine.setup({ players: 3, options: { firstPlayer } }, createRng(1))).toThrow(
        RangeError,
      );
    }
  });

  it('exports the same engine as default with the game slug as id', () => {
    expect(crazyEightsDefault).toBe(engine);
    expect(engine.id).toBe('crazy-eights');
  });
});

describe('rule helpers', () => {
  it('scores cards for a blocked game: Eight 50, faces and tens 10, Ace 1, others pip', () => {
    expect(cardPoints('8S')).toBe(50);
    for (const c of ['KH', 'QD', 'JC', 'TS'] as const) expect(cardPoints(c)).toBe(10);
    expect(cardPoints('AH')).toBe(1);
    expect(cardPoints('2C')).toBe(2);
    expect(cardPoints('9D')).toBe(9);
    expect(handPoints(cards('8S KH AH 2C 9D'))).toBe(72);
    expect(handPoints([])).toBe(0);
    expect(makeDeck().reduce((a, c) => a + cardPoints(c), 0)).toBe(
      4 * (50 + 40 + 1 + (2 + 3 + 4 + 5 + 6 + 7 + 9)),
    );
  });

  it('matches by suit or rank, and Eights are always playable', () => {
    const pile = { top: 'KH', activeSuit: 'H' } as const;
    expect(canPlay('3H', pile)).toBe(true);
    expect(canPlay('KC', pile)).toBe(true);
    expect(canPlay('8D', pile)).toBe(true);
    expect(canPlay('7S', pile)).toBe(false);
    expect(playableCards(cards('7S 3H 2C KC 8D'), pile)).toEqual(cards('3H KC 8D'));
  });

  it('after an Eight only the named suit (or another Eight) can be played', () => {
    const pile = { top: '8H', activeSuit: 'S' } as const;
    expect(canPlay('9S', pile)).toBe(true);
    expect(canPlay('8C', pile)).toBe(true);
    expect(canPlay('5H', pile)).toBe(false); // the Eight's own suit no longer counts
    expect(canPlay('4D', pile)).toBe(false);
  });

  it('pays the pot to the winner(s): +(n−1) alone, shared when tied, 0 when everyone ties', () => {
    expect(payoutUnits(0, [0], 2)).toBe(1);
    expect(payoutUnits(0, [0], 3)).toBe(2);
    expect(payoutUnits(0, [0], 4)).toBe(3);
    expect(payoutUnits(0, [1], 4)).toBe(-1);
    expect(payoutUnits(0, [0, 1], 3)).toBe(0.5);
    expect(payoutUnits(0, [0, 2], 4)).toBe(1);
    expect(payoutUnits(0, [0, 1, 2], 4)).toBeCloseTo(1 / 3, 12);
    expect(payoutUnits(0, [0, 1, 2], 3)).toBe(0);
    for (const [winners, n] of [
      [[0], 3],
      [[1, 2], 3],
      [[0, 1, 3], 4],
      [[1], 2],
    ] as const) {
      let sum = 0;
      for (let seat = 0; seat < n; seat++) sum += payoutUnits(seat, winners, n);
      expect(sum).toBeCloseTo(0, 12);
    }
  });

  it('finds every seat tied for the lowest total', () => {
    expect(lowestSeats([5, 5, 10])).toEqual([0, 1]);
    expect(lowestSeats([12, 3, 7])).toEqual([1]);
  });
});

describe('legal moves', () => {
  it('lists matching cards, every suit for each Eight, and drawing', () => {
    expect(keys(engine.legalMoves(basic(), 0))).toEqual([
      'play:3H',
      'play:KC',
      'play:8D:S',
      'play:8D:H',
      'play:8D:D',
      'play:8D:C',
      'draw',
    ]);
  });

  it('is empty for everyone but the current player', () => {
    const s = basic();
    expect(engine.legalMoves(s, 1)).toEqual([]);
    expect(engine.legalMoves(s, 2)).toEqual([]);
  });

  it('after an Eight follows the named suit', () => {
    expect(keys(engine.legalMoves(afterEight(), 0))).toEqual([
      'play:9S',
      'play:8C:S',
      'play:8C:H',
      'play:8C:D',
      'play:8C:C',
      'draw',
    ]);
  });

  it('allows drawing even with a playable card (you may draw instead of playing)', () => {
    expectLegal(basic(), 0, DRAW);
  });

  it('offers only drawing when nothing matches and the stock has cards', () => {
    const s = makeState({ hands: ['7S 2C', '3H', '4H'], top: 'KH' });
    expect(engine.legalMoves(s, 0)).toEqual([DRAW]);
  });

  it('offers only passing when nothing matches and the stock is empty', () => {
    const s = makeState({ hands: ['7S 2C', '3H', '4H'], top: 'KH', stock: '' });
    expect(engine.legalMoves(s, 0)).toEqual([PASS]);
    expect(canDraw(s)).toBe(false);
  });

  it('with an empty stock you must play if you can (no draw, no pass)', () => {
    const s = makeState({ hands: ['7S 3H', '4H', '5H'], top: 'KH', stock: '' });
    expect(keys(engine.legalMoves(s, 0))).toEqual(['play:3H']);
  });

  it('under the reshuffle house rule an empty stock can still be drawn from', () => {
    const s = makeState({ hands: ['7S 2C', '3H', '4H'], top: 'KH', stock: '', reshuffle: true });
    expect(canReshuffle(s)).toBe(true);
    expect(engine.legalMoves(s, 0)).toEqual([DRAW]);
  });

  it('stops reshuffling after MAX_RESHUFFLES', () => {
    const s = makeState({
      hands: ['7S 2C', '3H', '4H'],
      top: 'KH',
      stock: '',
      reshuffle: true,
      reshuffles: MAX_RESHUFFLES,
    });
    expect(canReshuffle(s)).toBe(false);
    expect(engine.legalMoves(s, 0)).toEqual([PASS]);
  });

  it('cannot reshuffle when the discard pile is only its top card', () => {
    const base = makeState({ hands: ['7S 2C', '3H', '4H'], top: 'KH', stock: '', reshuffle: true });
    const s: CrazyEightsState = {
      ...base,
      hands: [base.hands[0]!, [...base.hands[1]!, ...base.discard.slice(0, -1)], base.hands[2]!],
      discard: ['KH'],
    };
    expect(allCards(s)).toBe(FULL_DECK);
    expect(canReshuffle(s)).toBe(false);
    expect(engine.legalMoves(s, 0)).toEqual([PASS]);
  });

  it('gives every legal move a unique, stable key', () => {
    const moves = engine.legalMoves(basic(), 0);
    expect(new Set(keys(moves)).size).toBe(moves.length);
    expect(engine.moveKey({ type: 'play', card: '8D', suit: 'S' })).toBe('play:8D:S');
    expect(engine.moveKey({ type: 'play', card: '3H' })).toBe('play:3H');
    expect(engine.moveKey(DRAW)).toBe('draw');
    expect(engine.moveKey(PASS)).toBe('pass');
    expect(engine.moveKey({ type: 'play', card: '8D', suit: 'S' })).toBe(
      engine.moveKey({ suit: 'S', card: '8D', type: 'play' }),
    );
  });
});

describe('checkMove explains every illegal move', () => {
  it('a card that matches neither suit nor rank, pointing at a card that works', () => {
    expect(reason(basic(), 0, play('7S'))).toBe(
      "The 7♠ doesn't match the K♥: you need a Heart or a King — or a wild Eight. Your 3♥ would work.",
    );
  });

  it('suggests the Eight when it is the only card that works', () => {
    const s = makeState({ hands: ['7S 8D 2C', '4S', '5S'], top: 'KH' });
    expect(reason(s, 0, play('7S'))).toMatch(
      /doesn't match the K♥.*Your 8♦ is wild, so you could play that and name a suit\.$/,
    );
  });

  it('says to draw when nothing matches, or to pass when the stock is empty', () => {
    const s = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH' });
    expect(reason(s, 0, play('2C'))).toMatch(
      /Nothing in your hand matches, so draw a card from the stock\.$/,
    );
    const empty = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH', stock: '' });
    expect(reason(empty, 0, play('2C'))).toMatch(
      /Nothing in your hand matches and the stock is empty, so you have to pass\.$/,
    );
  });

  it('a card of the wrong suit after an Eight names who changed the suit', () => {
    expect(reason(afterEight(), 0, play('4D'))).toBe(
      "Player 2 played an Eight and named Spades, so you need a Spade or another Eight — the 4♦ won't do. Your 9♠ would work.",
    );
  });

  it("a card of the Eight's own suit explains that the named suit wins", () => {
    expect(reason(afterEight(), 0, play('5H'))).toBe(
      'The Eight on the pile is a Heart, but Player 2 named Spades — so you need a Spade or another Eight. Your 9♠ would work.',
    );
  });

  it('uses "you" when you named the suit yourself', () => {
    const s = makeState({
      hands: ['5H 4D', '2D 3D'],
      top: '8H',
      activeSuit: 'S',
      namedBy: 0,
    });
    expect(reason(s, 0, play('5H'))).toMatch(/^The Eight on the pile is a Heart, but you named/);
    expect(reason(s, 0, play('4D'))).toMatch(/^You played an Eight and named Spades/);
  });

  it('a card you do not hold', () => {
    expect(reason(basic(), 0, play('9D'))).toBe(
      "You don't have the 9♦ — pick a card from your own hand.",
    );
  });

  it('an Eight without a named suit, or with a made-up suit', () => {
    expect(reason(basic(), 0, play('8D'))).toBe(
      'Eights are wild! Choose the suit the next player must follow — Spades, Hearts, Diamonds or Clubs — when you play your 8♦.',
    );
    expect(reason(basic(), 0, play('8D', 'Z'))).toBe(
      'Pick one of the four suits for your Eight to name: Spades, Hearts, Diamonds or Clubs.',
    );
  });

  it('naming a suit with a card that is not an Eight', () => {
    expect(reason(basic(), 0, play('3H', 'S'))).toBe(
      'Only an Eight lets you name a new suit — the 3♥ simply plays as a Heart.',
    );
  });

  it('a made-up card or a joker', () => {
    expect(reason(basic(), 0, play('ZZ'))).toBe(
      "That isn't a real card — play one from your hand.",
    );
    expect(reason(basic(), 0, play('X1'))).toBe(
      "That isn't a real card — play one from your hand.",
    );
  });

  it('something that is not a Crazy Eights move at all', () => {
    const msg = "That isn't a Crazy Eights move — play a card, draw from the stock, or pass.";
    expect(reason(basic(), 0, { type: 'fold' })).toBe(msg);
    expect(reason(basic(), 0, null)).toBe(msg);
    expect(reason(basic(), 0, { type: 'play' })).toBe(msg);
  });

  it('playing out of turn says whose turn it is', () => {
    const s = { ...basic(), turn: 1 };
    expect(reason(s, 0, play('3H'))).toBe("It's Player 1's turn, not yours.");
    expect(reason(s, 2, DRAW)).toBe("It's Player 1's turn, not Player 2's.");
    expect(reason(basic(), 1, DRAW)).toBe("It's your turn, not Player 1's.");
  });

  it('drawing from an empty stock', () => {
    const playable = makeState({ hands: ['7S 3H', '4H', '5H'], top: 'KH', stock: '' });
    expect(reason(playable, 0, DRAW)).toBe(
      "The stock is empty, so there's nothing left to draw. But you can play the 3♥!",
    );
    const stuck = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH', stock: '' });
    expect(reason(stuck, 0, DRAW)).toBe(
      "The stock is empty, so there's nothing left to draw. Nothing in your hand matches, so pass this turn.",
    );
  });

  it('drawing after the reshuffle limit is used up', () => {
    const s = makeState({
      hands: ['7S 2C', '4H', '5H'],
      top: 'KH',
      stock: '',
      reshuffle: true,
      reshuffles: MAX_RESHUFFLES,
    });
    expect(reason(s, 0, DRAW)).toBe(
      `The stock is empty and the discard pile has already been reshuffled ${MAX_RESHUFFLES} times, so there's nothing left to draw. Nothing in your hand matches, so pass this turn.`,
    );
  });

  it('passing while holding a playable card', () => {
    expect(reason(basic(), 0, PASS)).toBe(
      'You can only pass when nothing in your hand can be played — your 3♥ matches, so play it.',
    );
    const onlyEight = makeState({ hands: ['7S 8D', '4H', '5H'], top: 'KH', stock: '' });
    expect(reason(onlyEight, 0, PASS)).toBe(
      'You can only pass when nothing in your hand can be played — your 8♦ is wild, so you can play it.',
    );
  });

  it('passing while the stock still has cards', () => {
    const s = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH' });
    expect(reason(s, 0, PASS)).toBe(
      "You can't pass while the stock still has cards — when you can't play, draw a card instead.",
    );
  });

  it('passing when a reshuffle would refill the stock', () => {
    const s = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH', stock: '', reshuffle: true });
    expect(reason(s, 0, PASS)).toBe(
      'The stock is empty, but the discard pile can be shuffled into a new stock — draw a card instead of passing.',
    );
  });

  it('passing is fine when stuck with an empty stock', () => {
    const s = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH', stock: '' });
    expectLegal(s, 0, PASS);
  });

  it('any move once the game is over', () => {
    const out = run(makeState({ hands: ['3H', '4S 5S', '9D'], top: 'KH' }), play('3H'));
    expect(reason(out, 0, DRAW)).toBe('The game is over — you already emptied your hand.');
    const botOut = run(makeState({ hands: ['7S 2C', '4H', '9D'], top: 'KH', turn: 1 }), play('4H'));
    expect(reason(botOut, 2, DRAW)).toBe('The game is over — Player 1 already emptied their hand.');
    const blocked = run(
      makeState({ hands: ['2C 3S', '4H 9D'], top: 'KH', stock: '', turn: 1 }),
      play('4H'),
    );
    expect(reason(blocked, 0, PASS)).toBe(
      'The game is over — it was blocked: the stock ran out and nobody could play.',
    );
  });

  it('accepts every move legalMoves lists and rejects every other card in hand', () => {
    for (const s of [basic(), afterEight()]) {
      const legal = new Set(keys(engine.legalMoves(s, 0)));
      for (const card of s.hands[0]!) {
        const candidates = card[0] === '8' ? SUITS.map((suit) => play(card, suit)) : [play(card)];
        for (const m of candidates) {
          expect(engine.checkMove(s, 0, m).ok).toBe(legal.has(engine.moveKey(m)));
        }
      }
    }
  });
});

describe('applyMove', () => {
  it('throws IllegalMoveError with the friendly reason', () => {
    expect(() => engine.applyMove(basic(), play('7S'))).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(basic(), play('7S'))).toThrow(/doesn't match the K♥/);
  });

  it('playing a matching card moves it to the pile and passes the turn clockwise', () => {
    const s = engine.applyMove(basic(), play('3H'));
    expect(s.hands[0]).toEqual(cards('7S 2C KC 8D'));
    expect(s.discard[s.discard.length - 1]).toBe('3H');
    expect(s.activeSuit).toBe('H');
    expect(s.turn).toBe(1);
    expect(s.log[s.log.length - 1]).toEqual({ type: 'play', seat: 0, card: '3H', suit: 'H' });
    expect(allCards(s)).toBe(FULL_DECK);
  });

  it('matching by rank switches the suit', () => {
    const s = engine.applyMove(basic(), play('KC'));
    expect(s.activeSuit).toBe('C');
  });

  it('an Eight changes the suit to the one named', () => {
    const s = engine.applyMove(basic(), play('8D', 'S'));
    expect(s.discard[s.discard.length - 1]).toBe('8D');
    expect(s.activeSuit).toBe('S');
    expect(s.log[s.log.length - 1]).toEqual({ type: 'play', seat: 0, card: '8D', suit: 'S' });
    // Next player must now follow Spades.
    expect(keys(engine.legalMoves(s, 1))).toEqual(['play:4S', 'play:5S', 'draw']);
  });

  it('an Eight can be played on an Eight', () => {
    const s = engine.applyMove(afterEight(), play('8C', 'D'));
    expect(s.activeSuit).toBe('D');
  });

  it('drawing takes the top of the stock and keeps the turn', () => {
    const before = basic();
    const top = before.stock[0]!;
    const s = engine.applyMove(before, DRAW);
    expect(s.hands[0]).toContain(top);
    expect(s.hands[0]).toHaveLength(6);
    expect(s.stock).toEqual(before.stock.slice(1));
    expect(s.turn).toBe(0);
    expect(s.drawnThisTurn).toBe(1);
    expect(s.draws).toEqual([1, 0, 0]);
    expect(s.log[s.log.length - 1]).toEqual({
      type: 'draw',
      seat: 0,
      card: top,
      facing: 'H',
      reshuffled: false,
    });
    expect(allCards(s)).toBe(FULL_DECK);
  });

  it('draws one card at a time until you can play, then the play ends the turn', () => {
    const start = makeState({
      hands: ['7S 2C', '4S', '5S'],
      top: 'KH',
      stock: '9C TC 6H JD',
    });
    let s = run(start, DRAW, DRAW);
    expect(s.hands[0]).toEqual(cards('7S 2C 9C TC'));
    expect(engine.legalMoves(s, 0)).toEqual([DRAW]);
    s = run(s, DRAW);
    expect(s.drawnThisTurn).toBe(3);
    expect(keys(engine.legalMoves(s, 0))).toEqual(['play:6H', 'draw']);
    s = run(s, play('6H'));
    expect(s.turn).toBe(1);
    expect(s.drawnThisTurn).toBe(0);
    expect(s.draws[0]).toBe(3);
  });

  it('keeps hands sorted after a draw', () => {
    const s = run(makeState({ hands: ['7S KC', '4S', '5S'], top: 'KH', stock: '2C' }), DRAW);
    expect(s.hands[0]).toEqual(cards('7S 2C KC'));
  });

  it('passing moves the turn on without changing anything else', () => {
    const before = makeState({ hands: ['7S 2C', '3H', '4H'], top: 'KH', stock: '' });
    const s = engine.applyMove(before, PASS);
    expect(s.turn).toBe(1);
    expect(s.hands).toEqual(before.hands);
    expect(s.discard).toEqual(before.discard);
    expect(s.log[s.log.length - 1]).toEqual({ type: 'pass', seat: 0 });
    expect(engine.isOver(s)).toBe(false);
  });

  it('the turn wraps around from the last seat to seat 0', () => {
    const s = run(makeState({ hands: ['3H', '4S', '9H 2D'], top: 'KH', turn: 2 }), play('9H'));
    expect(s.turn).toBe(0);
  });

  it('emptying your hand wins at once', () => {
    const s = run(makeState({ hands: ['3H', '4S 5S', '9D'], top: 'KH' }), play('3H'));
    expect(engine.isOver(s)).toBe(true);
    expect(s.endReason).toBe('out');
    expect(s.winners).toEqual([0]);
    expect(engine.currentPlayer(s)).toBeNull();
    for (const p of [0, 1, 2]) expect(engine.legalMoves(s, p)).toEqual([]);
    expect(() => engine.applyMove(s, DRAW)).toThrow(IllegalMoveError);
  });

  it('you can go out with an Eight (a suit is still named)', () => {
    const s = makeState({ hands: ['8C', '4S 5S', '9D'], top: 'KH' });
    expect(keys(engine.legalMoves(s, 0))).toEqual([
      'play:8C:S',
      'play:8C:H',
      'play:8C:D',
      'play:8C:C',
      'draw',
    ]);
    const done = engine.applyMove(s, play('8C', 'H'));
    expect(done.endReason).toBe('out');
    expect(done.winners).toEqual([0]);
  });

  it('a pass is required when you are stuck but someone else can still play', () => {
    const s = makeState({ hands: ['7S 2C', '3H', '4D'], top: 'KH', stock: '' });
    expect(isBlocked(s)).toBe(false);
    const next = run(s, PASS);
    expect(next.turn).toBe(1);
    expect(engine.legalMoves(next, 1)).toEqual([play('3H')]);
  });

  it('ends the game as blocked when the stock is empty and nobody can play', () => {
    const s = run(
      makeState({ hands: ['2C 3S', '4H 9D'], top: 'KH', stock: '', turn: 1 }),
      play('4H'),
    );
    expect(engine.isOver(s)).toBe(true);
    expect(s.endReason).toBe('blocked');
    expect(s.winners).toEqual([0]); // 5 points against 9
    expect(engine.currentPlayer(s)).toBeNull();
  });

  it('a draw that empties the stock can block the game', () => {
    const s = run(makeState({ hands: ['2C', '3D'], top: 'KH', stock: 'QS' }), DRAW);
    expect(s.stock).toEqual([]);
    expect(s.endReason).toBe('blocked');
    expect(s.winners).toEqual([1]); // you hold 2 + 10 = 12, Player 1 holds 3
  });

  it('reshuffles the discard pile (except the top card) into a new stock', () => {
    const before = makeState({
      hands: ['7C', '9D 3S', '2S'],
      top: '8H',
      activeSuit: 'S',
      namedBy: 2,
      stock: '',
      reshuffle: true,
    });
    // 7♣ doesn't follow the named Spades → must draw from a reshuffled stock.
    expect(engine.legalMoves(before, 0)).toEqual([DRAW]);
    const s = engine.applyMove(before, DRAW);
    expect(s.discard).toEqual(['8H']);
    expect(s.activeSuit).toBe('S');
    expect(s.reshuffles).toBe(1);
    expect(s.rngState).not.toBe(before.rngState);
    expect(s.stock).toHaveLength(before.discard.length - 2);
    expect(s.hands[0]).toHaveLength(2);
    expect(s.log[s.log.length - 1]).toMatchObject({ type: 'draw', reshuffled: true, facing: 'S' });
    expect(allCards(s)).toBe(FULL_DECK);
    // Pure and deterministic: the same state reshuffles the same way.
    expect(engine.applyMove(before, DRAW)).toEqual(s);
    // The new stock is a real shuffle, not the old pile order.
    const drawn = s.hands[0]!.find((c) => c !== '7C');
    expect(s.stock).not.toEqual(before.discard.slice(0, -1).filter((c) => c !== drawn));
  });

  it('does not mutate its input (deep-frozen states)', () => {
    const states: [CrazyEightsState, CrazyEightsMove][] = [
      [basic(), play('3H')],
      [basic(), play('8D', 'C')],
      [basic(), DRAW],
      [makeState({ hands: ['7S 2C', '3H', '4H'], top: 'KH', stock: '' }), PASS],
      [makeState({ hands: ['3H', '4S', '5S'], top: 'KH' }), play('3H')],
      [makeState({ hands: ['2C', '3D'], top: 'KH', stock: 'QS' }), DRAW],
      [makeState({ hands: ['7S', '3H', '4H'], top: 'KH', stock: '', reshuffle: true }), DRAW],
    ];
    for (const [s, m] of states) {
      const before = JSON.stringify(s);
      deepFreeze(s);
      expect(() => engine.applyMove(s, m)).not.toThrow();
      engine.describeMove(s, s.turn, m);
      engine.coach(s, 0);
      expect(JSON.stringify(s)).toBe(before);
    }
  });

  it('tracks how far behind the learner fell (for the comeback flag)', () => {
    const start = makeState({
      hands: ['2C 3C 4C', '9H 9S 9D'],
      top: 'KH',
      stock: '5C 6C 7C QH',
    });
    const s = run(start, DRAW, DRAW, DRAW);
    expect(s.maxBehind).toBe(3);
    const after = run(s, DRAW, play('QH'));
    expect(after.maxBehind).toBe(4);
  });
});

describe('result and payouts', () => {
  it('cannot be read before the game is over', () => {
    expect(() => engine.result(basic())).toThrow();
  });

  it.each([
    [2, 1],
    [3, 2],
    [4, 3],
  ])('learner going out with %i players wins %i units', (players, units) => {
    const hands = ['3H', '4S 5S', '9D TD JD', 'QC KC'].slice(0, players);
    const s = run(makeState({ hands, top: 'KH' }), play('3H'));
    const r = engine.result(s);
    expect(r.winners).toEqual([0]);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(units);
    expect(r.scores).toEqual(s.hands.map(handPoints));
    expect(r.scores?.[0]).toBe(0);
    expect(r.flags.bigPot).toBe(units >= 3);
  });

  it('a bot going out costs the learner 1 unit', () => {
    const s = run(makeState({ hands: ['7S 2C', '4H', '9D'], top: 'KH', turn: 1 }), play('4H'));
    const r = engine.result(s);
    expect(r.winners).toEqual([1]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.scores).toEqual([9, 0, 9]);
    expect(r.summary).toBe(
      'Player 1 emptied their hand first and won the pot; you were left with 2 cards.',
    );
  });

  it('summarises a learner win with what everyone else still held', () => {
    const s = run(makeState({ hands: ['3H', '4S 5S', '9D'], top: 'KH' }), play('3H'));
    expect(engine.result(s).summary).toBe(
      'You emptied your hand first and won the pot, leaving Player 1 with 2 cards and Player 2 with 1 card.',
    );
  });

  it('blocked game: the lowest points total wins the pot', () => {
    const s = run(
      makeState({ hands: ['2C 3S', '4H 9D', 'TC'], top: 'KH', stock: '', turn: 1 }),
      play('4H'),
    );
    const r = engine.result(s);
    expect(r.scores).toEqual([5, 9, 10]);
    expect(r.winners).toEqual([0]);
    expect(r.humanNetUnits).toBe(2);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.tags).toContain('blocked');
    expect(r.summary).toMatch(/blocked.*your 5 points were the lowest/);
  });

  it('blocked game: tied lowest totals share the pot', () => {
    const s = run(makeState({ hands: ['4H 5C', '2S 3D', 'TC'], top: 'KH', stock: '' }), play('4H'));
    expect(s.endReason).toBe('blocked');
    const r = engine.result(s);
    expect(r.winners).toEqual([0, 1]);
    expect(r.humanNetUnits).toBe(0.5);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.tags).toContain('sharedWin');
    expect(r.flags.closeFinish).toBe(true);
    expect(r.summary).toBe(
      'The game was blocked and you tied with Player 1 for the lowest total (5 points), so you share the pot.',
    );
  });

  it('blocked game: everyone tied is a push', () => {
    const s = run(makeState({ hands: ['4H 5C', '2S 3D'], top: 'KH', stock: '' }), play('4H'));
    const r = engine.result(s);
    expect(r.winners).toEqual([0, 1]);
    expect(r.humanNetUnits).toBe(0);
    expect(r.humanOutcome).toBe('push');
    expect(r.summary).toMatch(/push/);
  });

  it('blocked game: a lower bot total beats the learner', () => {
    const s = run(makeState({ hands: ['4H TC', '2S 3D', 'QC'], top: 'KH', stock: '' }), play('4H'));
    const r = engine.result(s);
    expect(r.winners).toEqual([1]);
    expect(r.humanNetUnits).toBe(-1);
    expect(r.humanOutcome).toBe('loss');
    expect(r.summary).toBe(
      'The game was blocked: Player 1 had the lowest total (5 points) and you had 10 points.',
    );
  });
});

describe('result flags', () => {
  const learnerOut = (extra: Partial<Parameters<typeof makeState>[0]> = {}, hands?: string[]) =>
    run(makeState({ hands: hands ?? ['3H', '4S 5S', '9D TD'], top: 'KH', ...extra }), play('3H'));

  it('perfect: winning without drawing a single card', () => {
    const r = engine.result(learnerOut());
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toContain('neverDrew');
    const drew = engine.result(learnerOut({ draws: [2, 0, 0] }));
    expect(drew.flags.perfect).toBe(false);
    expect(drew.flags.tags).not.toContain('neverDrew');
  });

  it('luckyLastCard: the learner went out with an Eight', () => {
    const s = run(makeState({ hands: ['8C', '4S 5S', '9D'], top: 'KH' }), play('8C', 'S'));
    const r = engine.result(s);
    expect(r.flags.luckyLastCard).toBe(true);
    expect(r.flags.tags).toContain('eightFinish');
    expect(engine.result(learnerOut()).flags.luckyLastCard).toBe(false);
  });

  it('comeback: the learner was 3+ cards behind the leader at some point and still won', () => {
    expect(engine.result(learnerOut({ maxBehind: 3 })).flags.comeback).toBe(true);
    expect(engine.result(learnerOut({ maxBehind: 2 })).flags.comeback).toBe(false);
    const lost = run(
      makeState({ hands: ['7S 2C 3C 4C 5C', '4H', '9D'], top: 'KH', turn: 1, maxBehind: 5 }),
      play('4H'),
    );
    expect(engine.result(lost).flags.comeback).toBe(false);
  });

  it('closeFinish when winning: the runner-up had 1 card left', () => {
    expect(engine.result(learnerOut({}, ['3H', '4S', '9D TD'])).flags.closeFinish).toBe(true);
    expect(engine.result(learnerOut({}, ['3H', '4S 5S', '9D TD'])).flags.closeFinish).toBe(false);
  });

  it('closeFinish when losing: the learner was the runner-up with 1 card left', () => {
    const close = run(makeState({ hands: ['7S', '4H', '9D TD'], top: 'KH', turn: 1 }), play('4H'));
    expect(engine.result(close).flags.closeFinish).toBe(true);
    const far = run(makeState({ hands: ['7S 2C 3C', '4H', '9D'], top: 'KH', turn: 1 }), play('4H'));
    expect(engine.result(far).flags.closeFinish).toBe(false);
  });

  it('closeFinish in a blocked game: totals within 3 points', () => {
    const close = run(
      makeState({ hands: ['4H 2C 3S', '7D', 'TC'], top: 'KH', stock: '' }),
      play('4H'),
    );
    expect(close.endReason).toBe('blocked');
    expect(engine.result(close).winners).toEqual([0]);
    expect(engine.result(close).flags.closeFinish).toBe(true); // 5 against 7
    const far = run(
      makeState({ hands: ['2C 3S', '4H 9D', 'TC'], top: 'KH', stock: '', turn: 1 }),
      play('4H'),
    );
    expect(engine.result(far).flags.closeFinish).toBe(false); // 5 against 9 is 4 apart
  });

  it('bigPot only for a 3-unit swing; bust and folded never apply', () => {
    const four = run(makeState({ hands: ['3H', '4S', '5S', '6S'], top: 'KH' }), play('3H'));
    expect(engine.result(four).flags.bigPot).toBe(true);
    const r = engine.result(learnerOut());
    expect(r.flags.bigPot).toBe(false);
    expect(r.flags.bust).toBe(false);
    expect(r.flags.folded).toBe(false);
    expect(r.flags.tags).toContain('wentOut');
  });

  it('tags a loss while still holding an Eight', () => {
    const s = run(makeState({ hands: ['8S 2C', '4H', '9D'], top: 'KH', turn: 1 }), play('4H'));
    expect(engine.result(s).flags.tags).toContain('caughtWithEight');
  });

  it('tags games where the discard pile was reshuffled', () => {
    const reshuffled = run(
      makeState({ hands: ['3H', '4S 5S', '9D'], top: 'KH', reshuffles: 1, reshuffle: true }),
      play('3H'),
    );
    expect(engine.result(reshuffled).flags.tags).toContain('reshuffled');
  });
});

describe('describeMove', () => {
  it('describes plays from the actor’s perspective', () => {
    expect(engine.describeMove(basic(), 0, play('3H'))).toBe('You played the Three of Hearts.');
    expect(engine.describeMove(basic(), 0, play('KC'))).toBe(
      'You played the King of Clubs, switching the suit to Clubs.',
    );
    expect(engine.describeMove(basic(), 0, play('8D', 'S'))).toBe(
      'You played the Eight of Diamonds and named Spades.',
    );
    const s = makeState({ hands: ['2C', '8D 4C', '5S'], top: 'KH', turn: 1 });
    expect(engine.describeMove(s, 1, play('8D', 'C'))).toBe(
      'Player 1 played the Eight of Diamonds and named Clubs. Player 1 has just one card left!',
    );
  });

  it('announces when a player is down to one card', () => {
    const s = makeState({ hands: ['3H 7S', '4S', '5S'], top: 'KH' });
    expect(engine.describeMove(s, 0, play('3H'))).toBe(
      'You played the Three of Hearts. You have just one card left!',
    );
  });

  it('announces the winning last card', () => {
    const mine = makeState({ hands: ['3H', '4S', '5S'], top: 'KH' });
    expect(engine.describeMove(mine, 0, play('3H'))).toBe(
      'You played the Three of Hearts — your last card! You win.',
    );
    const theirs = makeState({ hands: ['2C', '4S', '9H'], top: 'KH', turn: 2 });
    expect(engine.describeMove(theirs, 2, play('9H'))).toBe(
      'Player 2 played the Nine of Hearts — their last card! Player 2 wins.',
    );
  });

  it("reveals your own drawn card but never a bot's", () => {
    const s = basic();
    expect(engine.describeMove(s, 0, DRAW)).toBe(`You drew the ${cardName(s.stock[0]!)}.`);
    const bot = { ...s, turn: 1 };
    const text = engine.describeMove(bot, 1, DRAW);
    expect(text).toBe('Player 1 drew a card.');
    expect(text).not.toContain(cardName(s.stock[0]!));
  });

  it('mentions the last stock card, reshuffles and passing', () => {
    const last = makeState({ hands: ['7S 3H', '4S', '5S'], top: 'KH', stock: '2C' });
    expect(engine.describeMove(last, 0, DRAW)).toBe(
      'You drew the Two of Clubs. That was the last card in the stock.',
    );
    const reshuffle = makeState({
      hands: ['7S', '4H', '5H'],
      top: 'KH',
      stock: '',
      reshuffle: true,
      turn: 1,
    });
    const botText = engine.describeMove(reshuffle, 1, DRAW);
    expect(botText).toBe(
      'The stock was empty, so the discard pile was shuffled into a new stock. Player 1 drew a card.',
    );
    const stuck = makeState({ hands: ['3H', '7S 2C', '4H'], top: 'KH', stock: '', turn: 1 });
    expect(engine.describeMove(stuck, 1, PASS)).toBe("Player 1 couldn't play and passed.");
  });

  it('explains when a move blocks the game', () => {
    const s = makeState({ hands: ['2C', '3D'], top: 'KH', stock: 'QS' });
    expect(engine.describeMove(s, 0, DRAW)).toBe(
      'You drew the Queen of Spades. That was the last card in the stock. Nobody can play and there is nothing left to draw, so the game is blocked — the lowest points total in hand wins.',
    );
  });

  it('uses exactly "Player N" for bots so the UI can substitute persona names', () => {
    const s = makeState({ hands: ['2C', '4S 9H', '5S', '6S'], top: 'KH', turn: 1 });
    expect(engine.describeMove(s, 1, play('9H'))).toMatch(/^Player 1 played/);
  });
});

describe('coach', () => {
  it('explains the situation and suggests the normal-bot move on your turn', () => {
    const advice = engine.coach(basic(), 0);
    expect(advice.situation).toBe(
      'The pile shows the K♥, so the next card must be a Heart or a King — or a wild Eight. You hold 5 cards; Player 1 has 2 and Player 2 has 3. The stock has 41 cards left. You can play the 3♥, the K♣ or the 8♦, or draw instead.',
    );
    expect(advice.suggestion).toEqual(play('KC'));
    expect(advice.why).toMatch(/switches the suit to Clubs/);
    expect(advice.why).toMatch(/Keep your Eight for later/);
  });

  it('only describes the table when it is not your turn', () => {
    const advice = engine.coach({ ...basic(), turn: 1 }, 0);
    expect(advice.situation).toMatch(/^It's Player 1's turn\./);
    expect(advice.suggestion).toBeUndefined();
    expect(advice.why).toBeUndefined();
  });

  it('describes a suit named with an Eight', () => {
    expect(engine.coach(afterEight(), 0).situation).toMatch(
      /^Player 2 played the 8♥ and named Spades, so the next card must be a Spade — or another Eight\./,
    );
  });

  it('suggests drawing when nothing matches, passing when stuck', () => {
    const draw = engine.coach(makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH' }), 0);
    expect(draw.suggestion).toEqual(DRAW);
    expect(draw.situation).toMatch(/Nothing in your hand matches, so you must draw a card\.$/);
    expect(draw.why).toMatch(/so draw/);
    const pass = engine.coach(makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH', stock: '' }), 0);
    expect(pass.suggestion).toEqual(PASS);
    expect(pass.situation).toMatch(/you must pass\.$/);
  });

  it('warns when an opponent is about to go out', () => {
    const advice = engine.coach(makeState({ hands: ['7S 3H', '4S', '5S 6S'], top: 'KH' }), 0);
    expect(advice.situation).toMatch(/Player 1 has just 1 card/);
    expect(advice.situation).toMatch(/Watch out: Player 1 could go out next turn!/);
  });

  it('summarises the result once the game is over', () => {
    const s = run(makeState({ hands: ['3H', '4S 5S', '9D'], top: 'KH' }), play('3H'));
    expect(engine.coach(s, 0)).toEqual({ situation: engine.result(s).summary });
  });

  it('always suggests a legal move', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let s = engine.setup({ players: 2 + (seed % 3) }, createRng(`coach-${seed}`));
      const rng = createRng(seed);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s)!;
        const advice = engine.coach(s, p);
        const suggestion = advice.suggestion as CrazyEightsMove;
        expect(keys(engine.legalMoves(s, p))).toContain(engine.moveKey(suggestion));
        expect(advice.why?.length ?? 0).toBeGreaterThan(10);
        s = engine.applyMove(s, engine.botMove(s, p, seed % 2 ? 'easy' : 'normal', rng));
      }
    }
  });
});

describe('bots', () => {
  const rng = () => createRng('bot-test');

  it('easy plays the first playable card in hand order', () => {
    // Hand order: 7♠ 3♥ 2♣ K♣ 8♦ → the 3♥ comes first.
    expect(engine.botMove(basic(), 0, 'easy', rng())).toEqual(play('3H'));
  });

  it('easy plays an Eight whenever it comes first, naming a suit it holds', () => {
    const s = makeState({ hands: ['8S 3H', '4S', '5S'], top: 'KH' });
    expect(engine.botMove(s, 0, 'easy', rng())).toEqual(play('8S', 'H'));
    const only = makeState({ hands: ['8S', '4S', '5S'], top: 'KH' });
    const m = engine.botMove(only, 0, 'easy', rng());
    expect(m.type).toBe('play');
    expect(keys(engine.legalMoves(only, 0))).toContain(engine.moveKey(m));
  });

  it('both bots draw when nothing matches and pass when stuck', () => {
    const draw = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH' });
    const pass = makeState({ hands: ['7S 2C', '4H', '5H'], top: 'KH', stock: '' });
    for (const d of ['easy', 'normal'] as const) {
      expect(engine.botMove(draw, 0, d, rng())).toEqual(DRAW);
      expect(engine.botMove(pass, 0, d, rng())).toEqual(PASS);
    }
  });

  it('normal saves its Eight while another card matches', () => {
    const s = makeState({ hands: ['8S 3H 9C', '4S', '5S'], top: 'KH' });
    expect(engine.botMove(s, 0, 'normal', rng())).toEqual(play('3H'));
  });

  it('normal plays its Eight instead of drawing when nothing else matches, naming its longest suit', () => {
    const s = makeState({ hands: ['8S 9C 4C 2D', '4S', '5S'], top: 'KH' });
    expect(engine.botMove(s, 0, 'normal', rng())).toEqual(play('8S', 'C'));
  });

  it('normal breaks a tie between suits by naming the one with more points', () => {
    const s = makeState({ hands: ['8S 9C 4D', '4S', '5S'], top: 'KH' });
    expect(engine.botMove(s, 0, 'normal', rng())).toEqual(play('8S', 'C'));
  });

  it('normal matches by rank to switch to its strongest suit', () => {
    expect(engine.botMove(basic(), 0, 'normal', rng())).toEqual(play('KC'));
    const s = makeState({ hands: ['3H 5D 7D 9D JC', '4S', '5S'], top: '5H' });
    expect(engine.botMove(s, 0, 'normal', rng())).toEqual(play('5D'));
  });

  it('normal stays in a suit it holds plenty of, shedding the highest card first', () => {
    const s = makeState({ hands: ['KC 3H 5H 7H', '4S', '5S'], top: 'KH' });
    expect(engine.botMove(s, 0, 'normal', rng())).toEqual(play('7H'));
    const high = makeState({ hands: ['QH 2H 9S', '4S', '5S'], top: '5H' });
    expect(engine.botMove(high, 0, 'normal', rng())).toEqual(play('QH'));
  });

  it('normal never draws while it can play', () => {
    for (const s of [basic(), afterEight()]) {
      expect(engine.botMove(s, 0, 'normal', rng()).type).toBe('play');
    }
  });

  it('normal goes out with its last card, even an Eight', () => {
    const s = makeState({ hands: ['8C', '4S', '5S'], top: 'KH' });
    const m = engine.botMove(s, 0, 'normal', rng());
    expect(m).toMatchObject({ type: 'play', card: '8C' });
  });

  it('normal remembers which suit the next player had to draw on', () => {
    const plain = makeState({ hands: ['5C 5D 9S', '2S 3S', '4S'], top: '5H' });
    // Without history the tie goes to the first card in hand order (the 5♣)…
    expect(engine.botMove(plain, 0, 'normal', rng())).toEqual(play('5C'));
    // …but Player 1 was seen drawing when Diamonds were needed.
    const seen = {
      ...plain,
      log: [{ type: 'draw', seat: 1, card: 'JS', facing: 'D', reshuffled: false } as const],
    };
    expect(engine.botMove(seen, 0, 'normal', rng())).toEqual(play('5D'));
  });

  it('decides only from information its seat can know', () => {
    const base = engine.setup({ players: 3 }, createRng('fair'));
    let s = base;
    const r = createRng(5);
    for (let i = 0; i < 8; i++) s = engine.applyMove(s, engine.botMove(s, s.turn, 'normal', r));
    const p = s.turn;
    // Rearrange everything p cannot see: other hands, the stock, other players' drawn cards.
    const hidden = [...s.stock, ...s.hands.filter((_, i) => i !== p).flat()];
    const shuffled = hidden.slice().reverse();
    let k = 0;
    const hands = s.hands.map((h, i) => (i === p ? h : h.map(() => shuffled[k++]!)));
    const stock = s.stock.map(() => shuffled[k++]!);
    const log = s.log.map((e) =>
      e.type === 'draw' && e.seat !== p ? { ...e, card: 'AS' as const } : e,
    );
    const twin: CrazyEightsState = { ...s, hands, stock, log };
    expect(allCards(twin)).toBe(FULL_DECK);
    for (const d of ['easy', 'normal'] as const) {
      expect(engine.botMove(twin, p, d, createRng(1))).toEqual(
        engine.botMove(s, p, d, createRng(1)),
      );
    }
    expect(engine.coach(twin, p)).toEqual(engine.coach(s, p));
  });

  it('stays legal in tricky spots', () => {
    const spots: CrazyEightsState[] = [
      afterEight(),
      makeState({ hands: ['5H 4D', '2D', '3D'], top: '8H', activeSuit: 'S', namedBy: 2 }),
      makeState({
        hands: ['5H 4D', '2D', '3S'],
        top: '8H',
        activeSuit: 'S',
        namedBy: 2,
        stock: '',
      }),
      makeState({ hands: ['7S', '4H', '5H'], top: 'KH', stock: '', reshuffle: true }),
      makeState({ hands: ['8S 8H 8D', '4H', '5H'], top: 'KH' }),
      makeState({ hands: ['8S', '4H', '5H'], top: 'KH', stock: '' }),
      makeState({ hands: ['7S 2C 9C', '4H', '5H'], top: 'KH', drawnThisTurn: 4 }),
    ];
    for (const s of spots) {
      const legal = keys(engine.legalMoves(s, 0));
      for (const d of ['easy', 'normal'] as const) {
        for (let i = 0; i < 5; i++) {
          expect(legal).toContain(engine.moveKey(engine.botMove(s, 0, d, createRng(i))));
        }
      }
    }
  });

  it('refuses to move for a seat whose turn it is not', () => {
    expect(() => engine.botMove(basic(), 1, 'normal', rng())).toThrow();
  });

  it('decides quickly (normal well under 30 ms per decision)', () => {
    const big = makeState({
      hands: ['2S 3S 4S 5S 6S 7S 9S TS JS QS KS 2H 3H 4H 5H 6H 7H 9H TH JH QH KH 8C', 'AC', 'AD'],
      top: 'KD',
    });
    const t = performance.now();
    for (let i = 0; i < 200; i++) engine.botMove(big, 0, 'normal', createRng(i));
    expect((performance.now() - t) / 200).toBeLessThan(30);
  });
});

describe('determinism', () => {
  it('the same seeds replay the exact same game', () => {
    const playOut = (seed: number) => {
      let s = engine.setup({ players: 3, options: { reshuffle: true } }, createRng(seed));
      const r = createRng(`bots-${seed}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s)!;
        s = engine.applyMove(s, engine.botMove(s, p, p % 2 ? 'easy' : 'normal', r));
      }
      return s;
    };
    expect(playOut(11)).toEqual(playOut(11));
    expect(JSON.stringify(playOut(11))).not.toBe(JSON.stringify(playOut(12)));
  });

  it('states are plain JSON', () => {
    const s = engine.applyMove(basic(), DRAW);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
