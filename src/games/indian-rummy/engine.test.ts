import { describe, expect, it } from 'vitest';
import { type CardCode } from '@/games/core/cards';
import { createRng } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError } from '@/games/core/types';
import engine, {
  DECK_SIZE,
  FIRST_DROP_POINTS,
  MAX_LOSS_UNITS,
  MIDDLE_DROP_POINTS,
  type IndianRummyMove,
  type IndianRummyState,
  deadwoodOf,
  indianRummyEngine,
  isWildRankCard,
  wildRankName,
} from './engine';
import { fullDeck } from './rules';
import { buildState, cards } from './test-helpers';

// The wild-joker card in hand-made positions is the 7♣: every 7 is a joker.
const WILD: CardCode = '7C';
/** 13 cards, all grouped without jokers: 4♠5♠6♠ · 9♥10♥J♥Q♥ · K♠K♦K♣ · 2♥2♣2♦. */
const VALID = cards('4S 5S 6S 9H TH JH QH KS KD KC 2H 2C 2D');
/** One card short: 4♠5♠6♠ · 9♥10♥J♥ · K♠K♦K♣ · 2♥2♣2♦ + a loose 8♣ (a Q♥ completes it). */
const ALMOST = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C 2D 8C');
/** Pure 3♣4♣5♣, set 8♥8♦8♠, loose A♠ K♦ Q♥ J♣ 9♦ 6♥ 2♠ = 57 points. */
const LOOSE = cards('3C 4C 5C 8H 8D 8S AS KD QH JC 9D 6H 2S');
/** No pure sequence, more than 80 points: pays the full 80. */
const NO_PURE = cards('9S QS KS 9H JH KH TD QD 6D JC 9C KC 4S');
/** Two pure sequences, two sets and one loose 2♠: 2 points. */
const CLOSE = cards('3C 4C 5C 8H 8D 8S AS AD AH 9D TD JD 2S');

function allCards(s: IndianRummyState): string {
  return [
    ...s.hands.flat(),
    ...s.stock,
    ...s.discard,
    s.wildCard,
    ...(s.finishCard ? [s.finishCard] : []),
  ]
    .sort()
    .join(' ');
}
const FULL = fullDeck().sort().join(' ');

function apply(s: IndianRummyState, ...moves: IndianRummyMove[]): IndianRummyState {
  return moves.reduce((st, m) => engine.applyMove(st, m), s);
}

const STOCK: IndianRummyMove = { type: 'draw', from: 'stock' };
const OPEN: IndianRummyMove = { type: 'draw', from: 'discard' };
const DROP: IndianRummyMove = { type: 'drop' };
const discard = (card: CardCode): IndianRummyMove => ({ type: 'discard', card });
const declare = (card: CardCode): IndianRummyMove => ({ type: 'declare', discard: card });

/** Seat 0 to play, holding ALMOST; the next stock card is the Q♥ that completes the hand. */
function readyToWin(
  opponent: CardCode[] = LOOSE,
  extra: Partial<Parameters<typeof buildState>[0]> = {},
) {
  return buildState({ hands: [ALMOST, opponent], wildCard: WILD, stockTop: ['QH'], ...extra });
}

// ----------------------------------------------------------------- setup

describe('setup', () => {
  it('deals 13 cards each, turns up the wild-joker card and one open card, and keeps every card', () => {
    for (const players of [2, 3, 4, 5, 6]) {
      const s = engine.setup({ players }, createRng(`deal-${players}`));
      expect(s.players).toBe(players);
      expect(s.hands).toHaveLength(players);
      for (const h of s.hands) expect(h).toHaveLength(13);
      expect(s.discard).toHaveLength(1);
      expect(s.stock).toHaveLength(DECK_SIZE - 13 * players - 2);
      expect(allCards(s)).toBe(FULL);
      expect(s.phase).toBe('draw');
      expect(s.turn).toBe((s.dealer + 1) % players);
      expect(s.outcome).toBeNull();
      expect(engine.currentPlayer(s)).toBe(s.turn);
    }
    expect(fullDeck()).toHaveLength(106);
  });

  it('makes the wild-joker card’s rank wild, and Aces wild when it is a printed joker', () => {
    const s = engine.setup({ players: 2 }, createRng('wild'));
    expect(s.wildRank).toBe(s.wildCard[0] === 'X' ? 'A' : s.wildCard[0]);
    let found: IndianRummyState | null = null;
    for (let seed = 0; seed < 5000 && !found; seed++) {
      const t = engine.setup({ players: 2 }, createRng(`printed-${seed}`));
      if (t.wildCard === 'X1' || t.wildCard === 'X2') found = t;
    }
    expect(found).not.toBeNull();
    expect(found?.wildRank).toBe('A');
    expect(wildRankName(buildState({ hands: [VALID, LOOSE], wildCard: WILD }))).toBe('Seven');
    expect(isWildRankCard(buildState({ hands: [VALID, LOOSE], wildCard: WILD }), '7H')).toBe(true);
  });

  it('lets the dealer be chosen (the next seat plays first) or picks it from the seed', () => {
    const s = engine.setup({ players: 4, options: { dealer: 2 } }, createRng('dealer'));
    expect(s.dealer).toBe(2);
    expect(s.turn).toBe(3);
    const dealers = new Set(
      Array.from({ length: 40 }, (_, i) => engine.setup({ players: 3 }, createRng(i)).dealer),
    );
    expect(dealers).toEqual(new Set([0, 1, 2]));
    expect(engine.setup({ players: 2, options: { maxTurns: 30 } }, createRng(1)).maxTurns).toBe(30);
    expect(engine.setup({ players: 2 }, createRng(1)).maxTurns).toBe(200);
  });

  it('rejects impossible configurations', () => {
    expect(() => engine.setup({ players: 1 }, createRng(1))).toThrow(RangeError);
    expect(() => engine.setup({ players: 7 }, createRng(1))).toThrow(RangeError);
    expect(() => engine.setup({ players: 2.5 }, createRng(1))).toThrow(RangeError);
    expect(() => engine.setup({ players: 2, options: { dealer: 2 } }, createRng(1))).toThrow(
      RangeError,
    );
    expect(() => engine.setup({ players: 2, options: { maxTurns: 0 } }, createRng(1))).toThrow(
      RangeError,
    );
  });

  it('is deterministic and JSON-serialisable', () => {
    const a = engine.setup({ players: 3 }, createRng('same'));
    const b = engine.setup({ players: 3 }, createRng('same'));
    expect(a).toEqual(b);
    expect(JSON.parse(JSON.stringify(a))).toEqual(a);
    expect(engine.setup({ players: 3 }, createRng('other'))).not.toEqual(a);
  });
});

// ------------------------------------------------------------ legal moves

describe('legal moves', () => {
  it('offers draw from either pile or a drop before drawing, and nothing to other seats', () => {
    const s = engine.setup({ players: 3, options: { dealer: 2 } }, createRng('legal'));
    expect(engine.legalMoves(s, 0).map(engine.moveKey)).toEqual([
      'draw:stock',
      'draw:discard',
      'drop',
    ]);
    expect(engine.legalMoves(s, 1)).toEqual([]);
    expect(engine.legalMoves(s, 2)).toEqual([]);
  });

  it('offers one discard per distinct card after drawing, plus declares that are valid', () => {
    const hand = [...VALID, 'KS'] as CardCode[]; // two K♠ — one discard move for both
    const s = buildState({ hands: [hand, LOOSE], wildCard: WILD, phase: 'discard' });
    const keys = engine.legalMoves(s, 0).map(engine.moveKey);
    expect(keys.filter((k) => k.startsWith('discard:'))).toHaveLength(13);
    expect(new Set(keys).size).toBe(keys.length);
    // Throwing either the spare K♠ or… only the K♠ leaves a complete hand.
    expect(keys.filter((k) => k.startsWith('declare:'))).toEqual(['declare:KS']);
  });

  it('offers no declare when no discard completes the hand', () => {
    const s = buildState({ hands: [[...LOOSE, '7H'], VALID], wildCard: WILD, phase: 'discard' });
    expect(engine.legalMoves(s, 0).some((m) => m.type === 'declare')).toBe(false);
  });

  it('has stable, unique move keys', () => {
    expect(engine.moveKey(STOCK)).toBe('draw:stock');
    expect(engine.moveKey(OPEN)).toBe('draw:discard');
    expect(engine.moveKey({ type: 'draw', from: 'wild' })).toBe('draw:wild');
    expect(engine.moveKey(DROP)).toBe('drop');
    expect(engine.moveKey(discard('7H'))).toBe('discard:7H');
    expect(engine.moveKey(declare('7H'))).toBe('declare:7H');
  });
});

// --------------------------------------------------------------- reasons

describe('checkMove explains every illegal move', () => {
  const draw = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, stockTop: ['3H'] });
  const after = engine.applyMove(draw, STOCK);

  it('it is not your turn / not that seat’s turn / no such seat', () => {
    const s = buildState({ hands: [ALMOST, LOOSE, CLOSE], wildCard: WILD, turn: 1 });
    expect(engine.checkMove(s, 0, STOCK)).toEqual({
      ok: false,
      reason: "It's Player 1's turn, not yours. Wait until they have discarded.",
    });
    expect(engine.checkMove(s, 2, STOCK).reason).toBe("It's Player 1's turn, not Player 2's.");
    expect(engine.checkMove(s, 7, STOCK).reason).toBe('There is no seat 7 at this table.');
  });

  it('a dropped player cannot move', () => {
    const s = buildState({
      hands: [ALMOST, LOOSE, CLOSE],
      wildCard: WILD,
      turn: 1,
      drops: ['first', 'first', null],
    });
    expect(engine.checkMove(s, 0, STOCK).reason).toMatch(/^You've dropped out of this game/);
    expect(engine.checkMove(s, 1, STOCK).reason).toBe('Player 1 has dropped out of this game.');
  });

  it('not a move at all', () => {
    for (const bad of [
      { type: 'pass' },
      null,
      { type: 'draw', from: 'deck' },
      { type: 'discard' },
    ]) {
      expect(engine.checkMove(draw, 0, bad as unknown as IndianRummyMove).reason).toMatch(
        /^That isn't an Indian Rummy move/,
      );
    }
  });

  it('before drawing: discarding, declaring and taking the wild-joker card', () => {
    expect(engine.checkMove(draw, 0, discard('8C')).reason).toMatch(/^Draw first!/);
    expect(engine.checkMove(draw, 0, declare('8C')).reason).toMatch(/^Draw a card first\./);
    expect(engine.checkMove(draw, 0, { type: 'draw', from: 'wild' }).reason).toMatch(
      /wild joker card stays face up under the stock .* nobody can take it/,
    );
    expect(engine.checkMove(draw, 0, STOCK)).toEqual({ ok: true });
    expect(engine.checkMove(draw, 0, OPEN)).toEqual({ ok: true });
    expect(engine.checkMove(draw, 0, DROP)).toEqual({ ok: true });
  });

  it('drawing from an empty pile', () => {
    const noOpen = { ...draw, discard: [] };
    expect(engine.checkMove(noOpen, 0, OPEN).reason).toBe(
      'The open pile is empty right now — draw from the closed stock instead.',
    );
    expect(engine.legalMoves(noOpen, 0).map(engine.moveKey)).toEqual(['draw:stock', 'drop']);
    const noStock = { ...draw, stock: [] };
    expect(engine.checkMove(noStock, 0, STOCK).reason).toBe(
      'The closed stock is empty — take the top card of the open pile instead.',
    );
  });

  it('after drawing: a second draw, a late drop, and cards you do not hold', () => {
    expect(engine.checkMove(after, 0, OPEN).reason).toMatch(/already drawn a card this turn/);
    expect(engine.checkMove(after, 0, DROP).reason).toMatch(
      /^You can only drop at the start of your turn, before you draw/,
    );
    expect(engine.checkMove(after, 0, discard('QS')).reason).toBe(
      "You don't have the Queen of Spades in hand.",
    );
    expect(engine.checkMove(after, 0, discard('X2')).reason).toBe(
      "You don't have a printed joker in hand.",
    );
    expect(engine.checkMove(after, 0, declare('7D')).reason).toBe(
      "You don't have the Seven of Diamonds (a wild joker) in hand.",
    );
    expect(engine.checkMove(after, 0, discard('ZZ' as CardCode)).reason).toBe(
      '"ZZ" isn\'t a card. Pick one of the cards in your hand.',
    );
  });

  it('declaring an incomplete hand says exactly what is missing (and which discard works)', () => {
    // After drawing the Q♥ the hand is complete only if the 8♣ is thrown.
    const s = engine.applyMove(readyToWin(), STOCK);
    const wrong = engine.checkMove(s, 0, declare('KS'));
    expect(wrong.ok).toBe(false);
    expect(wrong.reason).toMatch(/^You can't declare by throwing the King of Spades yet\./);
    expect(wrong.reason).toMatch(/3 cards don’t fit into any set or sequence yet: K♦, 8♣ and K♣\./);
    expect(wrong.reason).toMatch(/Tip: discard the Eight of Clubs instead and you can declare!$/);
    expect(engine.checkMove(s, 0, declare('8C'))).toEqual({ ok: true });

    const noPure = buildState({
      hands: [cards('4S 7S 6S 9H TH 7D QH KS KD KC 2H 2C 2D 3C'), LOOSE],
      wildCard: WILD,
      phase: 'discard',
    });
    const r1 = engine.checkMove(noPure, 0, declare('3C')).reason ?? '';
    expect(r1).toMatch(
      /You need at least one pure sequence — a run of 3 or more cards in one suit with no jokers/,
    );
    expect(r1).not.toMatch(/Tip:/);

    const noSecond = buildState({
      hands: [cards('4S 5S 6S KS KD KC KH 2H 2C 2D 9H 9D 9C 3C'), LOOSE],
      wildCard: WILD,
      phase: 'discard',
    });
    expect(engine.checkMove(noSecond, 0, declare('3C')).reason).toMatch(
      /You have a pure sequence, but you need a second sequence as well \(this one may use a joker\)\. Sets don’t count as sequences\./,
    );
  });

  it('once the game is over nothing is allowed', () => {
    const over = apply(readyToWin(), STOCK, declare('8C'));
    expect(engine.isOver(over)).toBe(true);
    expect(engine.currentPlayer(over)).toBeNull();
    expect(engine.legalMoves(over, 0)).toEqual([]);
    expect(engine.checkMove(over, 1, STOCK).reason).toBe(
      'The game is over — there are no more moves to make.',
    );
    expect(() => engine.applyMove(over, STOCK)).toThrow(IllegalMoveError);
  });

  it('applyMove throws IllegalMoveError carrying the reason', () => {
    expect(() => engine.applyMove(draw, discard('8C'))).toThrow(/Draw first!/);
    expect(() => engine.applyMove(draw, { type: 'draw', from: 'wild' })).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(after, declare('KS'))).toThrow(IllegalMoveError);
  });
});

// ------------------------------------------------------------ transitions

describe('turns', () => {
  it('drawing takes the top card of the chosen pile; discarding passes the turn', () => {
    const s = buildState({
      hands: [ALMOST, LOOSE],
      wildCard: WILD,
      discard: ['KH'],
      stockTop: ['QH'],
    });
    const fromStock = engine.applyMove(s, STOCK);
    expect(fromStock.hands[0]).toEqual([...ALMOST, 'QH']);
    expect(fromStock.stock).toHaveLength(s.stock.length - 1);
    expect(fromStock.phase).toBe('discard');
    expect(fromStock.drawn).toEqual({ from: 'stock', card: 'QH' });
    expect(fromStock.hasDrawn).toEqual([true, false]);
    const fromOpen = engine.applyMove(s, OPEN);
    expect(fromOpen.hands[0]?.slice(-1)).toEqual(['KH']);
    expect(fromOpen.discard).toEqual([]);
    const done = engine.applyMove(fromOpen, discard('2C'));
    expect(done.discard).toEqual(['2C']);
    expect(done.hands[0]).toHaveLength(13);
    expect(done.hands[0]).not.toContain('2C');
    expect(done.turn).toBe(1);
    expect(done.phase).toBe('draw');
    expect(done.drawn).toBeNull();
    expect(done.turnsTaken).toEqual([1, 0]);
    expect(done.turnCount).toBe(1);
    expect(allCards(done)).toBe(FULL);
  });

  it('jokers on the open pile may be picked up', () => {
    const s = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, discard: ['2S', 'X2'] });
    expect(engine.checkMove(s, 0, OPEN)).toEqual({ ok: true });
    expect(engine.applyMove(s, OPEN).hands[0]).toContain('X2');
  });

  it('skips dropped players', () => {
    const s = buildState({
      hands: [ALMOST, LOOSE, CLOSE],
      wildCard: WILD,
      drops: [null, 'first', null],
    });
    expect(apply(s, STOCK, discard('8C')).turn).toBe(2);
  });

  it('shuffles the open pile (except its top card) into a new stock when the stock runs out', () => {
    const base = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD });
    // Move all but one stock card onto the open pile.
    const s: IndianRummyState = {
      ...base,
      stock: base.stock.slice(-1),
      discard: [...base.discard, ...base.stock.slice(0, -1)],
    };
    const drawn = engine.applyMove(s, STOCK);
    expect(drawn.stock).toEqual([]);
    const next = engine.applyMove(drawn, discard('8C'));
    expect(next.reshuffles).toBe(1);
    expect(next.discard).toEqual(['8C']);
    expect(next.stock).toHaveLength(s.discard.length);
    expect(next.stock.slice().sort()).toEqual(s.discard.slice().sort());
    expect(next.stock).not.toEqual(s.discard); // actually shuffled
    expect(next.rngState).not.toBe(s.rngState);
    expect(allCards(next)).toBe(FULL);
    // Deterministic: the same position reshuffles the same way.
    expect(engine.applyMove(drawn, discard('8C'))).toEqual(next);
    expect(engine.describeMove(drawn, 0, discard('8C'))).toMatch(
      /The closed stock has run out, so the open pile \(except its top card\) is shuffled into a new stock\./,
    );
    expect(engine.legalMoves(next, 1).map(engine.moveKey)).toContain('draw:stock');
  });
});

// ------------------------------------------------------------- endings

describe('declaring', () => {
  it('the learner declares: the opponent pays their deadwood', () => {
    const s = readyToWin(LOOSE, { turnsTaken: [5, 5] });
    const over = apply(s, STOCK, declare('8C'));
    expect(over.finishCard).toBe('8C');
    expect(over.hands[0]).toHaveLength(13);
    expect(allCards(over)).toBe(FULL);
    expect(over.outcome).toMatchObject({
      kind: 'declare',
      winners: [0],
      declarer: 0,
      points: [0, 57],
      net: [57, -57],
    });
    const r = engine.result(over);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(57);
    expect(r.winners).toEqual([0]);
    expect(r.scores).toEqual([0, 57]);
    expect(r.summary).toBe(
      'You declared a valid hand after 6 turns, so Player 1 paid you 57 points for their loose cards.',
    );
    expect(r.flags).toMatchObject({ bigPot: true, closeFinish: false, folded: false, bust: false });
  });

  it('an opponent with no pure sequence pays for every card, up to 80', () => {
    const over = apply(readyToWin(NO_PURE), STOCK, declare('8C'));
    expect(over.outcome?.points).toEqual([0, 80]);
    expect(engine.result(over).humanNetUnits).toBe(MAX_LOSS_UNITS);
    expect(engine.result(over).summary).toBe(
      'You declared a valid hand after 1 turn, so Player 1 paid you 80 points — they had no pure sequence, so every card counted.',
    );
  });

  it('a bot declares: the learner pays their own deadwood (and the full 80 is a bust)', () => {
    const s = buildState({ hands: [LOOSE, ALMOST], wildCard: WILD, turn: 1, stockTop: ['QH'] });
    const over = apply(s, STOCK, declare('8C'));
    const r = engine.result(over);
    expect(r.winners).toEqual([1]);
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-57);
    expect(r.summary).toBe(
      'Player 1 declared a valid hand, so you paid 57 points for your loose cards.',
    );
    expect(r.flags.bust).toBe(false);

    const full = apply(
      buildState({ hands: [NO_PURE, ALMOST], wildCard: WILD, turn: 1, stockTop: ['QH'] }),
      STOCK,
      declare('8C'),
    );
    const rf = engine.result(full);
    expect(rf.humanNetUnits).toBe(-80);
    expect(rf.flags.bust).toBe(true);
    expect(rf.flags.tags).toContain('full-count');
    expect(rf.summary).toMatch(/without a pure sequence every card counted/);
  });

  it('with more players the declarer collects from everyone, including earlier drops', () => {
    const s = buildState({
      hands: [ALMOST, LOOSE, CLOSE, NO_PURE],
      wildCard: WILD,
      stockTop: ['QH'],
      drops: [null, null, null, 'middle'],
      hasDrawn: [true, true, true, true],
    });
    const over = apply(s, STOCK, declare('8C'));
    expect(over.outcome?.points).toEqual([0, 57, 2, MIDDLE_DROP_POINTS]);
    expect(over.outcome?.net).toEqual([99, -57, -2, -40]);
    const r = engine.result(over);
    expect(r.humanNetUnits).toBe(99);
    expect(r.flags.closeFinish).toBe(true); // Player 2 only paid 2
    expect(r.flags.tags).toContain('opponent-dropped');
    expect(r.summary).toBe(
      'You declared a valid hand after 1 turn and won 99 points (Player 1 57, Player 2 2 and Player 3 40 for dropping).',
    );
  });

  it('a losing learner in a bigger game only pays their own points', () => {
    const s = buildState({
      hands: [CLOSE, LOOSE, ALMOST],
      wildCard: WILD,
      turn: 2,
      stockTop: ['QH'],
    });
    const r = engine.result(apply(s, STOCK, declare('8C')));
    expect(r.humanNetUnits).toBe(-2);
    expect(r.flags.closeFinish).toBe(true);
    expect(r.scores).toEqual([2, 57, 0]);
  });
});

describe('dropping', () => {
  it('a first drop costs 20 and, with two players, ends the game', () => {
    const s = buildState({ hands: [LOOSE, VALID], wildCard: WILD });
    expect(engine.describeMove(s, 0, DROP)).toBe(
      'You drop out (a first drop) and pay 20 points. Only Player 1 is left, so Player 1 wins 20 points.',
    );
    const over = engine.applyMove(s, DROP);
    expect(over.outcome).toMatchObject({
      kind: 'drop',
      winners: [1],
      points: [20, 0],
      net: [-20, 20],
    });
    const r = engine.result(over);
    expect(r.humanOutcome).toBe('loss');
    expect(r.humanNetUnits).toBe(-FIRST_DROP_POINTS);
    expect(r.flags.folded).toBe(true);
    expect(r.flags.tags).toEqual(expect.arrayContaining(['drop', 'first-drop']));
    expect(r.summary).toBe('You dropped out (a first drop, 20 points), so Player 1 won.');
    expect(engine.coach(over, 0).situation).toBe(r.summary);
  });

  it('a drop after you have drawn once is a middle drop and costs 40', () => {
    const s = buildState({
      hands: [LOOSE, VALID],
      wildCard: WILD,
      turn: 1,
      hasDrawn: [true, true],
    });
    const over = engine.applyMove(s, DROP);
    expect(over.outcome?.points).toEqual([0, 40]);
    const r = engine.result(over);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(MIDDLE_DROP_POINTS);
    expect(r.summary).toBe('Everyone else dropped out, so you won 40 points.');
    expect(r.flags.tags).toContain('opponent-dropped');
    expect(r.flags.bigPot).toBe(true);
    expect(engine.describeMove(s, 1, DROP)).toBe(
      'Player 1 drops out (a middle drop) and pays 40 points. Only you are left, so you win 40 points.',
    );
  });

  it('with three or more players the game goes on; the last player left collects every drop', () => {
    const s = buildState({ hands: [LOOSE, VALID, CLOSE], wildCard: WILD });
    const a = engine.applyMove(s, DROP); // learner first drop
    expect(a.outcome).toBeNull();
    expect(a.turn).toBe(1);
    expect(engine.legalMoves(a, 0)).toEqual([]);
    const b = apply(a, STOCK, discard(a.stock[a.stock.length - 1] as CardCode)); // Player 1 plays
    expect(b.turn).toBe(2);
    const c = engine.applyMove(b, DROP); // Player 2 has not drawn: first drop
    expect(c.outcome).toMatchObject({
      kind: 'drop',
      winners: [1],
      points: [20, 0, 20],
      net: [-20, 40, -20],
    });
    const r = engine.result(c);
    expect(r.humanNetUnits).toBe(-20);
    expect(r.summary).toBe(
      'You dropped out (a first drop, 20 points), and Player 1 was the last player left.',
    );
  });

  it('a learner who dropped still loses only the drop when someone declares later', () => {
    const s = buildState({
      hands: [LOOSE, CLOSE, ALMOST],
      wildCard: WILD,
      turn: 2,
      stockTop: ['QH'],
      drops: ['middle', null, null],
      hasDrawn: [true, true, true],
    });
    const r = engine.result(apply(s, STOCK, declare('8C')));
    expect(r.humanNetUnits).toBe(-40);
    expect(r.flags.folded).toBe(true);
    expect(r.flags.closeFinish).toBe(false);
    expect(r.summary).toBe(
      'You dropped out (a middle drop, 40 points), and later Player 2 declared and won.',
    );
  });
});

describe('the 200-turn cap', () => {
  const capped = (hands: CardCode[][]) =>
    buildState({ hands, wildCard: WILD, stockTop: ['3H'], maxTurns: 1 });

  it('ends the game and the lowest deadwood wins what the others hold', () => {
    const over = apply(capped([CLOSE, LOOSE]), STOCK, discard('3H'));
    expect(over.outcome).toMatchObject({
      kind: 'turn-cap',
      winners: [0],
      points: [2, 57],
      net: [57, -57],
    });
    const r = engine.result(over);
    expect(r.humanOutcome).toBe('win');
    expect(r.summary).toBe(
      'After 1 turn nobody had declared, so every hand was scored by deadwood: yours was the lowest (2 points), so you won 57 points.',
    );
    expect(r.flags.tags).toContain('turn-cap');
  });

  it('a two-player tie is a push', () => {
    const twin = cards('3H 4H 5H 9S TS JS KS KH KC QS QD QC 2D');
    expect(deadwoodOf(twin, '7')).toBe(2);
    const over = apply(capped([CLOSE, twin]), STOCK, discard('3H'));
    expect(over.outcome?.winners).toEqual([0, 1]);
    const r = engine.result(over);
    expect(r.humanOutcome).toBe('push');
    expect(r.humanNetUnits).toBe(0);
    expect(r.flags.closeFinish).toBe(true);
    expect(r.summary).toMatch(
      /you tied for the lowest \(2 points\) with Player 1, so nobody won anything\.$/,
    );
  });

  it('tied winners share what the losers pay', () => {
    const twin = cards('3H 4H 5H 9S TS JS KS KH KC QS QD QC 2D');
    const over = apply(capped([CLOSE, twin, LOOSE]), STOCK, discard('3H'));
    expect(over.outcome?.net).toEqual([28.5, 28.5, -57]);
    expect(engine.result(over).humanOutcome).toBe('win');
    expect(
      engine.describeMove(apply(capped([CLOSE, twin, LOOSE]), STOCK), 0, discard('3H')),
    ).toMatch(
      /That was turn 1, so every hand is scored by deadwood: you and Player 1 tie with the lowest \(2 points\) — Player 2 pays 57 points\./,
    );
  });

  it('a learner with more deadwood pays their own points', () => {
    const r = engine.result(apply(capped([LOOSE, CLOSE]), STOCK, discard('3H')));
    expect(r.humanNetUnits).toBe(-57);
    expect(r.summary).toMatch(
      /Player 1 had the lowest \(2 points\), so you paid your 57 points\.$/,
    );
  });
});

// ---------------------------------------------------------------- flags

describe('result flags', () => {
  it('perfect: a declaration on one of your first three turns…', () => {
    const r = engine.result(apply(readyToWin(LOOSE, { turnsTaken: [2, 2] }), STOCK, declare('8C')));
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toContain('quick-declare');
  });

  it('…or one that needs no joker at all', () => {
    const late = apply(readyToWin(LOOSE, { turnsTaken: [9, 9] }), STOCK, declare('8C'));
    const r = engine.result(late);
    expect(r.flags.perfect).toBe(true);
    expect(r.flags.tags).toEqual(expect.arrayContaining(['no-jokers']));
    expect(r.flags.tags).not.toContain('quick-declare');
    // The same finish with a joker standing in is not perfect.
    const withJoker = cards('4S 5S 6S 9H TH 7D KS KD KC 2H 2C 2D 8C'); // 7♦ plays J♥
    const s = buildState({
      hands: [withJoker, LOOSE],
      wildCard: WILD,
      stockTop: ['QH'],
      turnsTaken: [9, 9],
    });
    expect(engine.result(apply(s, STOCK, declare('8C'))).flags.perfect).toBe(false);
  });

  it('comeback: a win after holding 60+ points of loose cards', () => {
    const s = { ...readyToWin(LOOSE, { turnsTaken: [5, 5] }), peakDeadwood: [64, 30] };
    expect(engine.result(apply(s, STOCK, declare('8C'))).flags.comeback).toBe(true);
    const calm = { ...s, peakDeadwood: [59, 30] };
    expect(engine.result(apply(calm, STOCK, declare('8C'))).flags.comeback).toBe(false);
  });

  it('peak deadwood is tracked from the deal and after every discard', () => {
    const s = buildState({ hands: [NO_PURE, LOOSE], wildCard: WILD, stockTop: ['2D'] });
    expect(s.peakDeadwood[0]).toBe(60); // 9♠9♥9♣ and K♠K♥K♣ group; 60 points stay loose
    const better = buildState({ hands: [CLOSE, LOOSE], wildCard: WILD, stockTop: ['KH'] });
    expect(better.peakDeadwood[0]).toBe(2);
    expect(apply(better, STOCK, discard('2S')).peakDeadwood[0]).toBe(10);
  });

  it('closeFinish: the loser paid 10 points or fewer', () => {
    expect(engine.result(apply(readyToWin(CLOSE), STOCK, declare('8C'))).flags.closeFinish).toBe(
      true,
    );
    expect(engine.result(apply(readyToWin(LOOSE), STOCK, declare('8C'))).flags.closeFinish).toBe(
      false,
    );
  });

  it('luckyLastCard: declaring with the card just drawn blind from the closed stock', () => {
    const lucky = engine.result(apply(readyToWin(), STOCK, declare('8C')));
    expect(lucky.flags.luckyLastCard).toBe(true);
    expect(lucky.flags.tags).toContain('stock-finish');
    // The same card taken from the open pile is not luck.
    const open = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, discard: ['QH'] });
    expect(engine.result(apply(open, OPEN, declare('8C'))).flags.luckyLastCard).toBe(false);
    // Drawing a card and throwing that same card to declare is not luck either.
    const ready = buildState({ hands: [VALID, LOOSE], wildCard: WILD, stockTop: ['5H'] });
    expect(engine.result(apply(ready, STOCK, declare('5H'))).flags.luckyLastCard).toBe(false);
  });

  it('bigPot: 40 points or more either way', () => {
    expect(engine.result(apply(readyToWin(LOOSE), STOCK, declare('8C'))).flags.bigPot).toBe(true);
    expect(engine.result(apply(readyToWin(CLOSE), STOCK, declare('8C'))).flags.bigPot).toBe(false);
  });

  it('tags a reshuffled game and an Aces-wild game', () => {
    const s = { ...readyToWin(), reshuffles: 1 };
    expect(engine.result(apply(s, STOCK, declare('8C'))).flags.tags).toContain('reshuffled');
    const aces = buildState({ hands: [ALMOST, LOOSE], wildCard: 'X1', stockTop: ['QH'] });
    expect(aces.wildRank).toBe('A');
    expect(engine.result(apply(aces, STOCK, declare('8C'))).flags.tags).toContain('aces-wild');
  });

  it('result() before the end throws', () => {
    expect(() => engine.result(readyToWin())).toThrow(/before the game is over/);
  });
});

// --------------------------------------------------------- descriptions

describe('describeMove', () => {
  it('reveals the learner’s own stock draw but never a bot’s', () => {
    const s = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, stockTop: ['7H'] });
    expect(engine.describeMove(s, 0, STOCK)).toBe(
      'You draw the Seven of Hearts (a wild joker) from the closed stock.',
    );
    const bot = buildState({ hands: [LOOSE, ALMOST], wildCard: WILD, turn: 1, stockTop: ['7H'] });
    const text = engine.describeMove(bot, 1, STOCK);
    expect(text).toBe('Player 1 draws a card from the closed stock.');
    expect(text).not.toMatch(/Seven/);
  });

  it('describes open-pile pickups, discards, declarations and drops', () => {
    const s = buildState({
      hands: [ALMOST, LOOSE],
      wildCard: WILD,
      discard: ['X2'],
      stockTop: ['QH'],
    });
    expect(engine.describeMove(s, 0, OPEN)).toBe('You pick up a printed joker from the open pile.');
    const t = engine.applyMove(s, STOCK);
    expect(engine.describeMove(t, 0, discard('2C'))).toBe('You discard the Two of Clubs.');
    expect(engine.describeMove(t, 0, declare('8C'))).toBe(
      'You declare! You throw the Eight of Clubs and show a valid hand. You win — Player 1 pays 57 points.',
    );
    const bot = buildState({ hands: [LOOSE, ALMOST], wildCard: WILD, turn: 1, discard: ['QH'] });
    expect(engine.describeMove(bot, 1, OPEN)).toBe(
      'Player 1 picks up the Queen of Hearts from the open pile.',
    );
    const botDeclare = engine.applyMove(bot, OPEN);
    expect(engine.describeMove(botDeclare, 1, declare('8C'))).toBe(
      'Player 1 declares! Player 1 throws the Eight of Clubs and shows a valid hand. Player 1 wins — you pay 57 points.',
    );
  });

  it('prefixes illegal moves with "Not allowed"', () => {
    const s = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD });
    expect(engine.describeMove(s, 0, discard('8C'))).toMatch(/^Not allowed: Draw first!/);
  });
});

// ----------------------------------------------------------------- coach

describe('coach', () => {
  it('on your draw: explains the table and suggests a legal draw', () => {
    const s = buildState({ hands: [ALMOST, LOOSE], wildCard: WILD, discard: ['QH'] });
    const c = engine.coach(s, 0);
    expect(c.situation).toMatch(
      /^Your turn: draw one card from the closed stock or the open pile \(or drop out now for 20 points\)\./,
    );
    expect(c.situation).toMatch(/The wild-joker card is the 7♣, so every Seven is a joker/);
    expect(c.situation).toMatch(/You have a pure sequence \(4♠ 5♠ 6♠\)/);
    expect(c.suggestion).toEqual(OPEN);
    expect(c.why).toMatch(
      /Take the Q♥ from the open pile: with your 9♥, 10♥ and J♥ it makes a pure sequence\./,
    );
    const key = engine.moveKey(c.suggestion as IndianRummyMove);
    expect(engine.legalMoves(s, 0).map(engine.moveKey)).toContain(key);
  });

  it('after drawing a winning card: suggests declaring', () => {
    const s = engine.applyMove(readyToWin(), STOCK);
    const c = engine.coach(s, 0);
    expect(c.situation).toMatch(/your hand is complete — you can declare/);
    expect(c.situation).toMatch(/You just drew the Q♥ from the closed stock\./);
    expect(c.suggestion).toEqual(declare('8C'));
    expect(c.why).toMatch(/^Declare!/);
  });

  it('suggests a sensible discard and says why', () => {
    const hand = cards('4S 5S 6S 9H TH JH KS KD KC 2H 2C QD 8C 3H');
    const s = buildState({ hands: [hand, LOOSE], wildCard: WILD, phase: 'discard' });
    const c = engine.coach(s, 0);
    expect(c.suggestion).toEqual(discard('QD'));
    expect(c.why).toMatch(
      /^Throw the Q♦: it doesn't fit with any of your groups or loose cards, and it's worth 10 points/,
    );
  });

  it('when it is someone else’s turn or you have dropped', () => {
    const s = buildState({ hands: [ALMOST, LOOSE, CLOSE], wildCard: WILD, turn: 2 });
    const c = engine.coach(s, 0);
    expect(c.situation).toMatch(/^It's Player 2's turn\./);
    expect(c.suggestion).toBeUndefined();
    // Coaching another seat while the learner is to play.
    expect(engine.coach({ ...s, turn: 0 }, 1).situation).toMatch(/^It's the learner's turn\./);
    const gone = { ...s, drops: ['first', null, null] as IndianRummyState['drops'] };
    expect(engine.coach(gone, 0).situation).toMatch(/^You've dropped out of this game/);
  });
});

// ------------------------------------------------------------ immutability

describe('purity', () => {
  it('never mutates a frozen input state', () => {
    const base = buildState({ hands: [ALMOST, LOOSE, CLOSE], wildCard: WILD, stockTop: ['QH'] });
    const lowStock = {
      ...base,
      stock: base.stock.slice(-1),
      discard: [...base.discard, ...base.stock.slice(0, -1)],
    };
    const cases: [IndianRummyState, IndianRummyMove][] = [
      [base, STOCK],
      [base, OPEN],
      [base, DROP],
      [engine.applyMove(base, STOCK), discard('2C')],
      [engine.applyMove(base, STOCK), declare('8C')],
      [engine.applyMove(lowStock, STOCK), discard('8C')],
    ];
    for (const [s, m] of cases) {
      const before = JSON.stringify(s);
      deepFreeze(s);
      engine.applyMove(s, m);
      engine.legalMoves(s, s.turn);
      engine.describeMove(s, s.turn, m);
      engine.coach(s, s.turn);
      engine.botMove(s, s.turn, 'normal', createRng(1));
      engine.botMove(s, s.turn, 'easy', createRng(1));
      expect(JSON.stringify(s)).toBe(before);
    }
  });

  it('the same seed and bot choices replay the same game', () => {
    const run = () => {
      let s = engine.setup({ players: 3 }, createRng('replay'));
      const rng = createRng('replay-bots');
      const log: string[] = [];
      while (!engine.isOver(s)) {
        const p = engine.currentPlayer(s) ?? 0;
        const m = engine.botMove(s, p, p === 1 ? 'easy' : 'normal', rng);
        log.push(engine.moveKey(m));
        s = engine.applyMove(s, m);
      }
      return { log, result: engine.result(s) };
    };
    expect(run()).toEqual(run());
  });

  it('exports the same engine as default and named', () => {
    expect(indianRummyEngine).toBe(engine);
    expect(engine.id).toBe('indian-rummy');
  });
});
