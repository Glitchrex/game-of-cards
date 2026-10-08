import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, type CardCode, type Rank } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError, type PlayerId } from '@/games/core/types';
import goFishDefault, {
  askableSeats,
  askLabel,
  bookCounts,
  bookOwner,
  booksMade,
  goFishEngine as engine,
  type GoFishEvent,
  type GoFishMove,
  type GoFishState,
} from './engine';
import {
  completeRanks,
  countRank,
  handSizeFor,
  heldRanksWords,
  isRank,
  MAX_LOSS_UNITS,
  maxWinUnits,
  mostBooks,
  payoutUnits,
  rankCounts,
  rankCountWords,
  rankPlural,
  ranksHeld,
  rankWithArticle,
  sortByRank,
  TOTAL_BOOKS,
} from './rules';
import { allCards, cards, fourOf, FULL_DECK, makeState } from './test-helpers';

const ask = (target: PlayerId, rank: string): GoFishMove => ({
  type: 'ask',
  target,
  rank: rank as Rank,
});
const keys = (moves: readonly GoFishMove[]) => moves.map((m) => engine.moveKey(m));

function reason(state: GoFishState, player: PlayerId, move: unknown): string {
  const check = engine.checkMove(state, player, move as GoFishMove);
  expect(check.ok).toBe(false);
  expect(check.reason?.length ?? 0).toBeGreaterThan(20);
  return check.reason ?? '';
}

function expectLegal(state: GoFishState, player: PlayerId, move: GoFishMove) {
  expect(engine.checkMove(state, player, move)).toEqual({ ok: true });
  expect(keys(engine.legalMoves(state, player))).toContain(engine.moveKey(move));
}

/** Apply a sequence of moves, each by the current player. */
function run(state: GoFishState, ...moves: GoFishMove[]): GoFishState {
  return moves.reduce((s, m) => engine.applyMove(s, m), state);
}

const newEvents = (before: GoFishState, after: GoFishState): GoFishEvent[] =>
  after.log.slice(before.log.length);

/** 3 players with a full pond; the next pond cards are 9♠ then 3♣. */
const basic = () =>
  makeState({
    hands: ['7S 7H KD 4C', '7C 2S 9D', 'KS KH 2H 5D'],
    stock: '9S 3C',
  });

/**
 * Empty pond, 3 players. Sevens: you 7♠ 7♥, Player 2 7♣ 7♦. Kings: you K♦, Player 1 K♣,
 * Player 2 K♠ K♥. Twos: Player 1 2♠, Player 2 2♥ 2♦ 2♣. Ten books are already down.
 */
const dryPond = () =>
  makeState({
    hands: ['7S 7H KD', '2S KC', '7C 7D KS KH 2H 2D 2C'],
    books: ['A 3 4', '5 6 8 9', 'T J Q'],
    exactStock: true,
  });

/**
 * One rank (Sevens) left: you hold three, `target` holds the last one; the other twelve
 * ranks are already booked as given.
 */
function lastSevens(books: string[], target: PlayerId = 1): GoFishState {
  return makeState({
    hands: books.map((_, seat) => (seat === 0 ? '7S 7H 7D' : seat === target ? '7C' : '')),
    books,
    exactStock: true,
  });
}

/** Play the final ask of `lastSevens` and return the finished state. */
function finish(books: string[], extra: Partial<GoFishState> = {}): GoFishState {
  const end = engine.applyMove({ ...lastSevens(books), ...extra }, ask(1, '7'));
  expect(end.phase).toBe('over');
  return end;
}

describe('rules helpers', () => {
  it('deals 7 cards with 2–3 players and 5 with 4–5', () => {
    expect([2, 3, 4, 5].map(handSizeFor)).toEqual([7, 7, 5, 5]);
  });

  it('groups a hand by rank (Ace low), then suit', () => {
    expect(sortByRank(cards('KD 2C AS 2S 7H AD'))).toEqual(cards('AS AD 2S 2C 7H KD'));
    expect(sortByRank(cards('2S 2C')).join()).toBe(sortByRank(cards('2C 2S')).join());
  });

  it('counts ranks and finds complete books', () => {
    const hand = cards('7S 7H 7D 7C KD 2S 2H');
    expect(countRank(hand, '7')).toBe(4);
    expect(countRank(hand, 'Q')).toBe(0);
    expect(ranksHeld(hand)).toEqual(['2', '7', 'K']);
    expect(completeRanks(hand)).toEqual(['7']);
    expect(rankCounts(hand)[6]).toBe(4);
    expect(isRank('T')).toBe(true);
    expect(isRank('X1')).toBe(false);
    expect(isRank(7)).toBe(false);
  });

  it('names ranks the way a beginner says them', () => {
    expect(rankPlural('6')).toBe('Sixes');
    expect(rankPlural('A')).toBe('Aces');
    expect(rankWithArticle('8')).toBe('an Eight');
    expect(rankWithArticle('K')).toBe('a King');
    expect(rankCountWords(1, '7')).toBe('one Seven');
    expect(rankCountWords(3, '6')).toBe('three Sixes');
    expect(heldRanksWords(cards('7S 7H KD 4C 4S 4D'))).toBe('Fours, Sevens or Kings');
    expect(heldRanksWords(cards('7S 7H KD 4C 4S 4D QS'), 2)).toBe('Fours or Sevens');
  });

  it('finds every seat tied for the most books', () => {
    expect(mostBooks([5, 4, 4])).toEqual([0]);
    expect(mostBooks([4, 5, 4])).toEqual([1]);
    expect(mostBooks([5, 3, 5])).toEqual([0, 2]);
  });

  it('pays the pot: sole winner +(n−1), k tied winners (n−k)/k, losers −1', () => {
    expect(payoutUnits(0, [0], 3)).toBe(2);
    expect(payoutUnits(0, [0], 5)).toBe(4);
    expect(payoutUnits(0, [0], 2)).toBe(1);
    expect(payoutUnits(0, [0, 2], 3)).toBe(0.5);
    expect(payoutUnits(0, [0, 1], 5)).toBe(1.5);
    expect(payoutUnits(0, [0, 1, 2], 4)).toBeCloseTo(1 / 3, 12);
    expect(payoutUnits(0, [1], 3)).toBe(-1);
    expect(payoutUnits(0, [1, 2], 3)).toBe(-1);
    expect(payoutUnits(0, [0, 1, 2], 3)).toBe(0);
    expect(MAX_LOSS_UNITS).toBe(1);
    expect(maxWinUnits(5)).toBe(4);
    // Zero-sum for every table size and every tie size.
    for (let n = 2; n <= 5; n++) {
      for (let k = 1; k <= n; k++) {
        const winners = Array.from({ length: k }, (_, i) => i);
        let sum = 0;
        for (let s = 0; s < n; s++) sum += payoutUnits(s, winners, n);
        expect(sum).toBeCloseTo(0, 12);
      }
    }
  });
});

describe('setup', () => {
  it.each([2, 3, 4, 5])('deals the right number of cards with %i players', (players) => {
    const s = engine.setup({ players }, createRng(`deal-${players}`));
    const size = handSizeFor(players);
    expect(s.players).toBe(players);
    expect(s.hands).toHaveLength(players);
    const dealtBooks = booksMade(s);
    expect(s.hands.flat().length + dealtBooks * 4).toBe(size * players);
    expect(s.stock).toHaveLength(52 - size * players);
    expect(allCards(s)).toBe(FULL_DECK);
    expect(s.turn).toBe(0);
    expect(s.phase).toBe('play');
    expect(s.winners).toEqual([]);
    expect(engine.currentPlayer(s)).toBe(0);
    expect(engine.isOver(s)).toBe(false);
    for (const h of s.hands) expect(h).toEqual(sortByRank(h));
  });

  it('deals one card at a time from the top, starting with the first player', () => {
    const deck = shuffle(makeDeck(), createRng(42));
    const s = engine.setup({ players: 3, options: { firstPlayer: 2 } }, createRng(42));
    const expected: CardCode[][] = [[], [], []];
    for (let i = 0; i < 21; i++) expected[(2 + i) % 3]!.push(deck[i]!);
    // A dealt book has already left the hand, so add its four cards back before comparing.
    const dealt = s.hands.map((h, seat) =>
      [...h, ...s.books[seat]!.flatMap((b) => fourOf(b.rank))].sort().join(),
    );
    expect(dealt).toEqual(expected.map((h) => h.slice().sort().join()));
    expect(s.stock).toEqual(deck.slice(21));
    expect(s.turn).toBe(2);
  });

  it('lays down four of a kind dealt to a player straight away', () => {
    let found: GoFishState | null = null;
    for (let seed = 1; seed < 3000 && !found; seed++) {
      const s = engine.setup({ players: 2 }, createRng(seed));
      if (booksMade(s) > 0) found = s;
    }
    expect(found).not.toBeNull();
    const s = found!;
    const seat = s.books.findIndex((b) => b.length > 0);
    const book = s.books[seat]![0]!;
    expect(book.via).toBe('deal');
    expect(s.hands[seat]).toHaveLength(7 - 4);
    expect(countRank(s.hands[seat]!, book.rank)).toBe(0);
    expect(s.log).toEqual([{ type: 'book', seat, rank: book.rank, via: 'deal' }]);
    expect(allCards(s)).toBe(FULL_DECK);
    // The learner's comeback tracking starts from the deal.
    expect(s.maxBehind).toBe(seat === 0 ? 0 : 1);
  });

  it('is deterministic: the same seed gives the same deal, different seeds differ', () => {
    const a = engine.setup({ players: 4 }, createRng('same'));
    const b = engine.setup({ players: 4 }, createRng('same'));
    const c = engine.setup({ players: 4 }, createRng('other'));
    expect(a).toEqual(b);
    expect(a.hands).not.toEqual(c.hands);
  });

  it('rejects unsupported tables and options', () => {
    for (const players of [0, 1, 6, 2.5, Number.NaN]) {
      expect(() => engine.setup({ players }, createRng(1))).toThrow(RangeError);
    }
    for (const firstPlayer of [-1, 3, 1.5, '1']) {
      expect(() => engine.setup({ players: 3, options: { firstPlayer } }, createRng(1))).toThrow(
        RangeError,
      );
    }
  });

  it('exposes the engine as the default export with the right id', () => {
    expect(goFishDefault).toBe(engine);
    expect(engine.id).toBe('go-fish');
  });
});

describe('legal moves', () => {
  it('lists every rank you hold × every other player who has cards', () => {
    const s = basic();
    expect(keys(engine.legalMoves(s, 0))).toEqual([
      'ask:1:4',
      'ask:1:7',
      'ask:1:K',
      'ask:2:4',
      'ask:2:7',
      'ask:2:K',
    ]);
  });

  it('starts from the asker’s left and skips players without cards', () => {
    const s = makeState({
      hands: ['7S 7H KD', '', '7D KS KH', 'KC 7C'],
      books: ['', 'A 2 3 4 5 6', '8 9 T', 'J Q'],
      exactStock: true,
      turn: 2,
    });
    expect(askableSeats(s, 2)).toEqual([3, 0]);
    expect(keys(engine.legalMoves(s, 2))).toEqual(['ask:3:7', 'ask:3:K', 'ask:0:7', 'ask:0:K']);
  });

  it('is empty for everyone but the player to act, and once the game is over', () => {
    const s = basic();
    expect(engine.legalMoves(s, 1)).toEqual([]);
    expect(engine.legalMoves(s, 2)).toEqual([]);
    const over = finish(['A 2 3 4 5', 'K Q J T', '6 8 9']);
    for (let p = 0; p < 3; p++) expect(engine.legalMoves(over, p)).toEqual([]);
  });

  it('gives every move a stable, unique key', () => {
    const moves = engine.legalMoves(basic(), 0);
    expect(new Set(keys(moves)).size).toBe(moves.length);
    expect(engine.moveKey(ask(2, 'T'))).toBe('ask:2:T');
    expect(engine.moveKey({ rank: 'T', target: 2, type: 'ask' })).toBe('ask:2:T');
  });
});

describe('checkMove explains every illegal ask', () => {
  it('accepts a legal ask', () => {
    expectLegal(basic(), 0, ask(1, '7'));
    expectLegal(basic(), 0, ask(2, '4'));
  });

  it('only the player whose turn it is may ask', () => {
    expect(reason(basic(), 1, ask(0, '7'))).toBe(
      "It's your turn, not Player 1's — wait until it comes round to Player 1.",
    );
    const theirs = { ...basic(), turn: 2 };
    expect(reason(theirs, 0, ask(1, '7'))).toBe(
      "It's Player 2's turn, not yours — wait until it comes round to you.",
    );
  });

  it('rejects things that are not asks', () => {
    for (const move of [null, 'ask', { type: 'draw' }, { type: 'play', card: '7S' }]) {
      expect(reason(basic(), 0, move)).toMatch(/isn't a Go Fish move — on your turn, ask/);
    }
  });

  it('you must ask one of the other players', () => {
    for (const target of [-1, 3, 1.5, '1', undefined]) {
      expect(reason(basic(), 0, { type: 'ask', target, rank: '7' })).toBe(
        'Pick one of the other players at the table to ask.',
      );
    }
    expect(reason(basic(), 0, ask(0, '7'))).toBe(
      "You can't ask yourself! Pick one of the other players and ask them for a rank.",
    );
  });

  it('you must name a real rank', () => {
    for (const rank of ['Z', 'X1', '10', 7, undefined]) {
      expect(reason(basic(), 0, { type: 'ask', target: 1, rank })).toBe(
        'Pick a rank to ask for — like Fours or Sevens — from the cards in your hand.',
      );
    }
  });

  it('you may only ask for a rank you already hold', () => {
    expect(reason(basic(), 0, ask(1, '9'))).toBe(
      "You can only ask for a rank you already hold — you don't have any Nines. Ask for a rank you hold instead, like your Fours, Sevens or Kings.",
    );
  });

  it('explains that a booked rank is gone for good', () => {
    const s = makeState({ hands: ['7S KD', '7C 2S', 'KS 5D'], books: ['Q', 'A', ''] });
    expect(reason(s, 0, ask(1, 'A'))).toBe(
      "All four Aces are already in Player 1's book, so nobody has any left to give. Ask for a rank you hold instead, like your Sevens or Kings.",
    );
    expect(reason(s, 0, ask(1, 'Q'))).toMatch(/^All four Queens are already in your own book/);
  });

  it('you cannot ask a player who has no cards left', () => {
    const s = makeState({
      hands: ['7S 7H KD', '', '7D KS KH', 'KC 7C'],
      books: ['', 'A 2 3 4 5 6', '8 9 T', 'J Q'],
      exactStock: true,
    });
    expect(reason(s, 0, ask(1, '7'))).toBe(
      "Player 1 has no cards left, so there's nothing to ask Player 1 for. Ask Player 2 or Player 3 instead.",
    );
  });

  it('explains that the game is over', () => {
    const over = finish(['A 2 3 4 5', 'K Q J T', '6 8 9']);
    expect(reason(over, 0, ask(1, '7'))).toBe(
      'The game is over — all 13 books have been made and you won with the most books.',
    );
    const shared = finish(['A 2 3 4', 'K Q J T 5', '6 8 9']);
    expect(reason(shared, 1, ask(0, '7'))).toBe(
      'The game is over — all 13 books have been made and you and Player 1 shared the win.',
    );
  });

  it('applyMove refuses illegal asks with the same friendly reason', () => {
    const s = basic();
    expect(() => engine.applyMove(s, ask(1, '9'))).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(s, ask(1, '9'))).toThrow(/don't have any Nines/);
    expect(() => engine.applyMove(s, ask(0, '7'))).toThrow(/can't ask yourself/);
    const over = finish(['A 2 3 4 5', 'K Q J T', '6 8 9']);
    expect(() => engine.applyMove(over, ask(1, '7'))).toThrow(/already over/);
  });
});

describe('asking: a catch', () => {
  it('the target hands over ALL their cards of the rank and you go again', () => {
    const s = makeState({ hands: ['7S KD', '7C 7H 2S', 'KS 5D'] });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(t.hands[0]).toEqual(cards('7S 7H 7C KD'));
    expect(t.hands[1]).toEqual(cards('2S'));
    expect(newEvents(s, t)).toEqual([{ type: 'ask', seat: 0, target: 1, rank: '7', got: 2 }]);
    expect(t.turn).toBe(0);
    expect(t.stock).toEqual(s.stock);
    expect(allCards(t)).toBe(FULL_DECK);
  });

  it('completing four of a kind lays the book down at once', () => {
    const s = makeState({ hands: ['7S 7H 7D KD', '7C 2S', 'KS 5D'] });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(t.hands[0]).toEqual(cards('KD'));
    expect(t.books[0]).toEqual([{ rank: '7', via: 'catch' }]);
    expect(newEvents(s, t)).toEqual([
      { type: 'ask', seat: 0, target: 1, rank: '7', got: 1 },
      { type: 'book', seat: 0, rank: '7', via: 'catch' },
    ]);
    expect(t.turn).toBe(0);
    expect(bookOwner(t, '7')).toBe(0);
    expect(allCards(t)).toBe(FULL_DECK);
  });
});

describe('asking: Go Fish', () => {
  it('draw the top card of the pond; a different rank passes the turn', () => {
    const s = basic();
    const t = engine.applyMove(s, ask(1, 'K'));
    expect(newEvents(s, t)).toEqual([
      { type: 'ask', seat: 0, target: 1, rank: 'K', got: 0 },
      { type: 'fish', seat: 0, card: '9S', wish: false },
    ]);
    expect(t.hands[0]).toEqual(cards('4C 7S 7H 9S KD'));
    expect(t.stock).toEqual(s.stock.slice(1));
    expect(t.turn).toBe(1);
    expect(allCards(t)).toBe(FULL_DECK);
  });

  it('drawing the rank you asked for ("fishing your wish") is shown and you go again', () => {
    const s = makeState({ hands: ['7S 7H KD', '2S 9D', 'KS 5D'], stock: '7D' });
    const t = engine.applyMove(s, ask(2, '7'));
    expect(newEvents(s, t)).toEqual([
      { type: 'ask', seat: 0, target: 2, rank: '7', got: 0 },
      { type: 'fish', seat: 0, card: '7D', wish: true },
    ]);
    expect(t.turn).toBe(0);
  });

  it('a wish that completes four of a kind is a book "via wish"', () => {
    const s = makeState({ hands: ['7S 7H 7D KD', '2S 9D', 'KS 5D'], stock: '7C' });
    const t = engine.applyMove(s, ask(2, '7'));
    expect(t.books[0]).toEqual([{ rank: '7', via: 'wish' }]);
    expect(t.hands[0]).toEqual(cards('KD'));
    expect(t.turn).toBe(0);
  });

  it('a draw that completes a different book is laid down, but the turn still passes', () => {
    const s = makeState({ hands: ['7S 7H 7D KD', '2S 9D', 'KS 5D'], stock: '7C' });
    const t = engine.applyMove(s, ask(1, 'K'));
    expect(newEvents(s, t)).toEqual([
      { type: 'ask', seat: 0, target: 1, rank: 'K', got: 0 },
      { type: 'fish', seat: 0, card: '7C', wish: false },
      { type: 'book', seat: 0, rank: '7', via: 'fish' },
    ]);
    expect(t.hands[0]).toEqual(cards('KD'));
    expect(t.turn).toBe(1);
  });

  it('with an empty pond there is nothing to draw and the turn passes', () => {
    const s = dryPond();
    const t = engine.applyMove(s, ask(1, '7'));
    expect(newEvents(s, t)).toEqual([{ type: 'ask', seat: 0, target: 1, rank: '7', got: 0 }]);
    expect(t.hands).toEqual(s.hands);
    expect(t.turn).toBe(1);
  });

  it('the turn passes clockwise and wraps round to seat 0', () => {
    const s = { ...basic(), turn: 2 };
    const t = engine.applyMove(s, ask(1, '5'));
    expect(t.turn).toBe(0);
  });
});

describe('empty hands', () => {
  it('a target who hands over their last card draws a new one at once', () => {
    const s = makeState({ hands: ['7S KD', '7C', 'KS 5D'], stock: '9S' });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(newEvents(s, t)).toEqual([
      { type: 'ask', seat: 0, target: 1, rank: '7', got: 1 },
      { type: 'refill', seat: 1, card: '9S' },
    ]);
    expect(t.hands[1]).toEqual(['9S']);
    expect(t.turn).toBe(0);
  });

  it('an asker whose book empties their hand draws a card and carries on', () => {
    const s = makeState({ hands: ['7S 7H 7D', '7C 2S', 'KS 5D'], stock: '9S' });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(newEvents(s, t).slice(1)).toEqual([
      { type: 'book', seat: 0, rank: '7', via: 'catch' },
      { type: 'refill', seat: 0, card: '9S' },
    ]);
    expect(t.hands[0]).toEqual(['9S']);
    expect(t.turn).toBe(0);
  });

  it('when both empty, the target draws first, then the asker', () => {
    const s = makeState({ hands: ['7S 7H 7D', '7C', 'KS 5D'], stock: '9S 3C' });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(newEvents(s, t)).toEqual([
      { type: 'ask', seat: 0, target: 1, rank: '7', got: 1 },
      { type: 'book', seat: 0, rank: '7', via: 'catch' },
      { type: 'refill', seat: 1, card: '9S' },
      { type: 'refill', seat: 0, card: '3C' },
    ]);
    expect(t.turn).toBe(0);
    expect(allCards(t)).toBe(FULL_DECK);
  });

  it('with an empty pond, a player who runs out of cards is out and is skipped', () => {
    const s = makeState({
      hands: ['7S 7H KD', '7C', '7D KS KH', 'KC'],
      books: ['A 2 3', '4 5 6', '8 9 T', 'J Q'],
      exactStock: true,
    });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(newEvents(s, t)).toEqual([
      { type: 'ask', seat: 0, target: 1, rank: '7', got: 1 },
      { type: 'out', seat: 1 },
    ]);
    expect(t.turn).toBe(0);
    expect(reason(t, 0, ask(1, 'K'))).toMatch(/^Player 1 has no cards left/);
    // You miss with Player 3; the turn skips Player 1 and goes to Player 2.
    const u = engine.applyMove(t, ask(3, '7'));
    expect(u.turn).toBe(2);
  });

  it('an asker who runs out with an empty pond is out and the turn passes', () => {
    const s = makeState({
      hands: ['7S 7H 7D', '7C 2S', '2H 2D 2C'],
      books: ['A 3 4 5', '6 8 9 T', 'J Q K'],
      exactStock: true,
    });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(newEvents(s, t)).toEqual([
      { type: 'ask', seat: 0, target: 1, rank: '7', got: 1 },
      { type: 'book', seat: 0, rank: '7', via: 'catch' },
      { type: 'out', seat: 0 },
    ]);
    expect(t.turn).toBe(1);
    expect(engine.isOver(t)).toBe(false);
    // Player 1 catches the last Twos and the game ends.
    const end = engine.applyMove(t, ask(2, '2'));
    expect(end.phase).toBe('over');
    expect(bookCounts(end)).toEqual([5, 5, 3]);
    expect(end.winners).toEqual([0, 1]);
  });
});

describe('the end of the game', () => {
  it('ends the moment the 13th book is made', () => {
    const s = lastSevens(['A 2 3 4 5', 'K Q J T', '6 8 9']);
    const end = engine.applyMove(s, ask(1, '7'));
    expect(booksMade(end)).toBe(TOTAL_BOOKS);
    expect(end.phase).toBe('over');
    expect(engine.isOver(end)).toBe(true);
    expect(engine.currentPlayer(end)).toBeNull();
    expect(end.hands.flat()).toEqual([]);
    expect(end.stock).toEqual([]);
    expect(end.winners).toEqual([0]);
    // No "out" or refill noise after the final book.
    expect(newEvents(s, end)).toEqual([
      { type: 'ask', seat: 0, target: 1, rank: '7', got: 1 },
      { type: 'book', seat: 0, rank: '7', via: 'catch' },
    ]);
    expect(allCards(end)).toBe(FULL_DECK);
  });

  it('result() refuses to score an unfinished game', () => {
    expect(() => engine.result(basic())).toThrow(/before the game ended/);
  });
});

describe('result and payouts', () => {
  it('a sole win collects the pot: +(players − 1)', () => {
    const r = engine.result(finish(['A 2 3 4 5', 'K Q J T', '6 8 9']));
    expect(r.winners).toEqual([0]);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(2);
    expect(r.scores).toEqual([6, 4, 3]);
    expect(r.summary).toBe(
      'You collected 6 books — the most at the table (Player 1 4 and Player 2 3) — and won the pot!',
    );
  });

  it('a 5-player sole win is +4 and a big pot', () => {
    const r = engine.result(finish(['A 2 3 4 5', 'K Q', 'J T', '6 8', '9']));
    expect(r.humanNetUnits).toBe(4);
    expect(r.flags.bigPot).toBe(true);
  });

  it('a loss costs the 1-unit ante', () => {
    const r = engine.result(finish(['A 2', 'K Q J T 3 4', '6 8 9 5']));
    expect(r.winners).toEqual([1]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-1);
    expect(r.scores).toEqual([3, 6, 4]);
    expect(r.summary).toBe('Player 1 collected the most books (6); you finished with 3 books.');
    expect(r.flags.bigPot).toBe(false);
  });

  it('tied winners share the pot: (players − k)/k', () => {
    const r3 = engine.result(finish(['A 2 3 4', 'K Q J T 5', '6 8 9']));
    expect(r3.winners).toEqual([0, 1]);
    expect(r3.humanOutcome).toBe('win');
    expect(r3.humanNetUnits).toBe(0.5);
    expect(r3.summary).toBe(
      'You tied with Player 1 for the most books (5 each), so you share the pot.',
    );
    expect(r3.flags.tags).toContain('sharedWin');
    const r4 = engine.result(finish(['A 2 3', 'K Q', 'T 5 6', '8 9 4 J']));
    expect(r4.winners).toEqual([0, 3]);
    expect(r4.humanNetUnits).toBe(1);
    const r5 = engine.result(finish(['A 2', 'K Q', 'J T 3', '5 6', '8 9 4']));
    expect(r5.winners).toEqual([0, 2, 4]);
    expect(r5.humanNetUnits).toBeCloseTo(2 / 3, 12);
  });

  it('a tie between other players is still a loss for you', () => {
    const r = engine.result(finish(['A 4', 'K Q J T 5', '6 8 9 2 3']));
    expect(r.winners).toEqual([1, 2]);
    expect(r.humanNetUnits).toBe(-1);
    expect(r.summary).toBe(
      'Player 1 and Player 2 tied for the most books (5 each); you finished with 3 books.',
    );
  });
});

describe('result flags', () => {
  it('closeFinish when the margin to the best opponent is exactly one book', () => {
    expect(engine.result(finish(['A 2 3 4', 'K Q J T', '6 8 9 5'])).flags.closeFinish).toBe(true);
    expect(engine.result(finish(['A 2 3', 'K Q J T 4', '6 8 9 5'])).flags.closeFinish).toBe(true);
    expect(engine.result(finish(['A 2 3 4', 'K Q J T 5', '6 8 9'])).flags.closeFinish).toBe(false);
    expect(engine.result(finish(['A 2 3 4 5', 'K Q J T', '6 8 9'])).flags.closeFinish).toBe(false);
  });

  it('comeback when you won after trailing by three or more books', () => {
    const books = ['A 2 3 4 5', 'K Q J T', '6 8 9'];
    expect(engine.result(finish(books, { maxBehind: 3 })).flags.comeback).toBe(true);
    expect(engine.result(finish(books, { maxBehind: 2 })).flags.comeback).toBe(false);
    const lost = ['A 2', 'K Q J T 3 4', '6 8 9 5'];
    expect(engine.result(finish(lost, { maxBehind: 5 })).flags.comeback).toBe(false);
  });

  it('tracks how far behind you fell, move by move', () => {
    // Player 1 is on 3 books, you on 0; their catch makes it 4–0.
    const s = makeState({
      hands: ['2S', '7S 7H 7D KD', '7C 2H', ''],
      books: ['', 'A 3 4', '', ''],
      turn: 1,
      maxBehind: 3,
    });
    const t = engine.applyMove(s, ask(2, '7'));
    expect(t.maxBehind).toBe(4);
    expect(t.turn).toBe(1);
    // It never goes down again, even when the gap closes.
    expect(engine.applyMove(t, ask(2, 'K')).maxBehind).toBe(4);
    expect(
      engine.applyMove({ ...t, books: [t.books[1]!, [], [], []] }, ask(2, 'K')).maxBehind,
    ).toBe(4);
  });

  it('perfect for seven or more books (nine heads-up, where seven is any win)', () => {
    expect(engine.result(finish(['A 2 3 4 5 6', 'K Q J', 'T 8 9'])).flags.perfect).toBe(true);
    expect(engine.result(finish(['A 2 3 4 5', 'K Q J T', '6 8 9'])).flags.perfect).toBe(false);
    expect(engine.result(finish(['A 2 3 4 5 6', 'K Q J T 8 9'])).flags.perfect).toBe(false);
    expect(engine.result(finish(['A 2 3 4 5 6 8 9', 'K Q J T'])).flags.perfect).toBe(true);
  });

  it('luckyLastCard when your winning final book came from fishing your wish and decided it', () => {
    // Kings and Sevens are left: you fish your wish for the last Seven, then sit out while
    // Player 1 books the Kings. 7–6–0: without that Seven book you would only have tied.
    const s = makeState({
      hands: ['7S 7H 7D', 'KS KH', 'KD KC'],
      books: ['A 2 3 4 5 6', 'Q J T 8 9', ''],
      stock: '7C',
      exactStock: true,
    });
    const t = engine.applyMove(s, ask(1, '7'));
    expect(t.books[0]!.at(-1)).toEqual({ rank: '7', via: 'wish' });
    expect(newEvents(s, t).at(-1)).toEqual({ type: 'out', seat: 0 });
    expect(t.turn).toBe(1);
    const end = engine.applyMove(t, ask(2, 'K'));
    const r = engine.result(end);
    expect(r.humanOutcome).toBe('win');
    expect(r.flags.luckyLastCard).toBe(true);
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toEqual(expect.arrayContaining(['fishedWish', 'luckyFinalBook']));
    expect(r.flags.tags).toContain('ranOutOfCards');
  });

  it('no luckyLastCard when the final book was a catch, or when you lost', () => {
    const earlierWish = finish(['A 2 3 4 5', 'K Q J T', '6 8 9']);
    const withWish = {
      ...earlierWish,
      books: [
        [{ rank: 'A', via: 'wish' } as const, ...earlierWish.books[0]!.slice(1)],
        ...earlierWish.books.slice(1),
      ],
    };
    const r = engine.result(withWish);
    expect(r.flags.luckyLastCard).toBe(false);
    expect(r.flags.tags).toContain('fishedWish');
    expect(r.flags.tags).not.toContain('luckyFinalBook');
    // Same lucky final book, but Player 1 still has more books.
    const s = makeState({
      hands: ['7S 7H 7D', 'KS KH', 'KD KC'],
      books: ['A', 'Q J 2 3 4 5 6', 'T 8 9'],
      stock: '7C',
      exactStock: true,
    });
    const end = run(s, ask(1, '7'), ask(2, 'K'));
    const lost = engine.result(end);
    expect(lost.humanOutcome).toBe('loss');
    expect(lost.flags.luckyLastCard).toBe(false);
    expect(lost.flags.tags).toContain('luckyFinalBook');
  });

  it('never sets bust or folded, and tags a bookless game', () => {
    const s = makeState({
      hands: ['7S', '7H 7D 7C', ''],
      books: ['', 'A 2 3 4 5 6', 'K Q J T 8 9'],
      exactStock: true,
      turn: 1,
    });
    const r = engine.result(engine.applyMove(s, ask(0, '7')));
    expect(r.scores).toEqual([0, 7, 6]);
    expect(r.flags.bust).toBe(false);
    expect(r.flags.folded).toBe(false);
    expect(r.flags.tags).toContain('noBooks');
    expect(r.flags.perfect).toBe(false);
  });
});

describe('immutability and determinism', () => {
  it('applyMove never mutates its (deep-frozen) input', () => {
    const scenarios: [GoFishState, GoFishMove][] = [
      [basic(), ask(1, '7')],
      [basic(), ask(1, 'K')],
      [makeState({ hands: ['7S 7H 7D', '7C', 'KS 5D'], stock: '9S 3C' }), ask(1, '7')],
      [dryPond(), ask(1, '7')],
      [lastSevens(['A 2 3 4 5', 'K Q J T', '6 8 9']), ask(1, '7')],
    ];
    for (const [state, move] of scenarios) {
      const before = JSON.stringify(state);
      deepFreeze(state);
      expect(() => engine.applyMove(state, move)).not.toThrow();
      expect(JSON.stringify(state)).toBe(before);
    }
  });

  it('the same seed and the same bots replay the same game', () => {
    const play = (seed: number) => {
      let s = engine.setup({ players: 4 }, createRng(seed));
      const rng = createRng(`bots-${seed}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s)!;
        s = engine.applyMove(s, engine.botMove(s, p, p % 2 === 0 ? 'normal' : 'easy', rng));
      }
      return s;
    };
    const a = play(7);
    expect(play(7)).toEqual(a);
    expect(play(8).log).not.toEqual(a.log);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
  });
});

describe('describeMove', () => {
  it('describes a catch from your point of view', () => {
    const s = makeState({ hands: ['7S KD', '7C 7H 2S', 'KS 5D'] });
    expect(engine.describeMove(s, 0, ask(1, '7'))).toBe(
      'You asked Player 1 for Sevens. Player 1 handed over two Sevens. You go again.',
    );
  });

  it('keeps a bot’s Go Fish draw secret', () => {
    const s = { ...basic(), turn: 1 };
    const text = engine.describeMove(s, 1, ask(0, '2'));
    expect(text).toBe(
      "Player 1 asked you for Twos. Go Fish! Player 1 drew a card from the pond. Now it's Player 2's turn.",
    );
    expect(text).not.toContain(cardName('9S'));
  });

  it('tells you which card you drew yourself', () => {
    expect(engine.describeMove(basic(), 0, ask(1, 'K'))).toBe(
      "You asked Player 1 for Kings. Go Fish! You drew the Nine of Spades from the pond. Now it's Player 1's turn.",
    );
  });

  it('names a fished wish, because it is shown to everyone', () => {
    const s = makeState({ hands: ['2S 9D', '7S 7H 7D KD', 'KS 5D'], stock: '7C', turn: 1 });
    expect(engine.describeMove(s, 1, ask(2, '7'))).toBe(
      'Player 1 asked Player 2 for Sevens. Go Fish! Player 1 drew the Seven of Clubs — the very rank they asked for! Player 1 laid down a book of Sevens! Player 1 goes again.',
    );
  });

  it('mentions a book made with a different card from the pond', () => {
    const s = makeState({ hands: ['7S 7H 7D KD', '2S 9D', 'KS 5D'], stock: '7C' });
    expect(engine.describeMove(s, 0, ask(1, 'K'))).toBe(
      "You asked Player 1 for Kings. Go Fish! You drew the Seven of Clubs from the pond. You laid down a book of Sevens thanks to the card from the pond! Now it's Player 1's turn.",
    );
  });

  it('describes refills without revealing a bot’s new card', () => {
    const s = makeState({ hands: ['7S 7H 7D', '7C', 'KS 5D'], stock: '9S 3C' });
    expect(engine.describeMove(s, 0, ask(1, '7'))).toBe(
      "You asked Player 1 for Sevens. Player 1 handed over one Seven. You laid down a book of Sevens! Player 1's hand was empty, so they drew a card from the pond. Your hand was empty, so you drew the Three of Clubs from the pond. You go again.",
    );
  });

  it('describes an empty pond, a player going out and the end of the game', () => {
    expect(engine.describeMove(dryPond(), 0, ask(1, '7'))).toBe(
      "You asked Player 1 for Sevens. Go Fish! The pond is empty, so there is nothing to draw. Now it's Player 1's turn.",
    );
    const s = makeState({
      hands: ['7S 7H KD', '7C', '7D KS KH', 'KC'],
      books: ['A 2 3', '4 5 6', '8 9 T', 'J Q'],
      exactStock: true,
    });
    expect(engine.describeMove(s, 0, ask(1, '7'))).toBe(
      'You asked Player 1 for Sevens. Player 1 handed over one Seven. Player 1 has no cards left and the pond is empty, so they are out for the rest of the game. You go again.',
    );
    expect(engine.describeMove(lastSevens(['A 2 3 4 5', 'K Q J T', '6 8 9']), 0, ask(1, '7'))).toBe(
      'You asked Player 1 for Sevens. Player 1 handed over one Seven. You laid down a book of Sevens! That was the last book — the game is over!',
    );
  });

  it('labels asks for buttons', () => {
    expect(askLabel(ask(2, '6'))).toBe('Ask Player 2 for Sixes');
  });

  it('still says something sensible about an illegal ask', () => {
    expect(engine.describeMove(basic(), 0, ask(1, '9'))).toBe('You asked Player 1 for Nines.');
    expect(engine.describeMove(basic(), 0, { type: 'ask', target: 9, rank: 'Z' } as never)).toBe(
      'You asked another player for a rank.',
    );
  });
});

describe('coach', () => {
  it('describes the table and suggests a legal ask with a reason', () => {
    const s = basic();
    const advice = engine.coach(s, 0);
    expect(advice.situation).toContain('You hold 4 cards: one Four, two Sevens and one King.');
    expect(advice.situation).toContain('The pond has');
    expect(advice.situation).toContain('Ask Player 1 or Player 2 for any rank you hold.');
    const move = advice.suggestion as GoFishMove;
    expect(keys(engine.legalMoves(s, 0))).toContain(engine.moveKey(move));
    expect(engine.moveKey(move)).toBe(engine.moveKey(engine.botMove(s, 0, 'normal', createRng(1))));
    expect(advice.why?.length ?? 0).toBeGreaterThan(40);
  });

  it('points at a player who has proven they hold the rank', () => {
    // Player 2 asked Player 1 for Kings and missed: Player 2 must still hold a King.
    const log: GoFishEvent[] = [
      { type: 'ask', seat: 2, target: 1, rank: 'K', got: 0 },
      { type: 'fish', seat: 2, card: '3H', wish: false },
    ];
    const s = makeState({ hands: ['7S 7H KD', '7C 2S 9D', 'KS KH 3H 5D'], log });
    const advice = engine.coach(s, 0);
    expect(advice.suggestion).toEqual(ask(2, 'K'));
    expect(advice.why).toMatch(/^Player 2 asked for Kings earlier/);
    expect(advice.situation).toContain(
      'From the asking so far you know that Player 2 holds Kings.',
    );
  });

  it('only gives a situation when it is not your turn, and the summary at the end', () => {
    const s = { ...basic(), turn: 1 };
    const advice = engine.coach(s, 0);
    expect(advice.situation).toMatch(/^It's Player 1's turn to ask\./);
    expect(advice.suggestion).toBeUndefined();
    const over = finish(['A 2 3 4 5', 'K Q J T', '6 8 9']);
    expect(engine.coach(over, 0)).toEqual({ situation: engine.result(over).summary });
  });

  it('mentions an empty pond', () => {
    expect(engine.coach(dryPond(), 0).situation).toContain('The pond is empty');
  });
});

describe('bots', () => {
  it('easy picks a random held rank from a random player with cards', () => {
    const s = basic();
    const seen = new Set<string>();
    const rng = createRng('easy');
    for (let i = 0; i < 200; i++) {
      const m = engine.botMove(s, 0, 'easy', rng);
      expectLegal(s, 0, m);
      seen.add(engine.moveKey(m));
    }
    expect(seen.size).toBe(engine.legalMoves(s, 0).length);
  });

  it('refuses to move for a seat whose turn it is not', () => {
    expect(() => engine.botMove(basic(), 1, 'normal', createRng(1))).toThrow(/not their turn/);
  });

  it('normal never repeats an ask the history shows must fail', () => {
    // Player 1 said "Go Fish" to your Sevens and has drawn nothing since.
    const log: GoFishEvent[] = [{ type: 'ask', seat: 0, target: 1, rank: '7', got: 0 }];
    const s = makeState({ hands: ['7S 7H 7D KD', '2S 9D', 'KS 5D'], stock: '', log, turn: 0 });
    const m = engine.botMove(s, 0, 'normal', createRng(1));
    expect(engine.moveKey(m)).not.toBe('ask:1:7');
  });

  it('normal stays legal in every position of many seeded games', () => {
    for (let seed = 1; seed <= 30; seed++) {
      let s = engine.setup({ players: 2 + (seed % 4) }, createRng(seed));
      const rng = createRng(`legal-${seed}`);
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s)!;
        const normal = engine.botMove(s, p, 'normal', rng);
        expectLegal(s, p, normal);
        const easy = engine.botMove(s, p, 'easy', rng);
        expectLegal(s, p, easy);
        s = engine.applyMove(s, seed % 2 === 0 ? normal : easy);
      }
    }
  });
});
