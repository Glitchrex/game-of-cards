import { describe, expect, it } from 'vitest';
import { cardName, makeDeck, removeCard, type CardCode } from '@/games/core/cards';
import { createRng, shuffle } from '@/games/core/rng';
import { deepFreeze } from '@/games/core/simulate';
import { IllegalMoveError, type Difficulty, type GameConfig } from '@/games/core/types';
import engine, {
  baccaratEngine,
  bankerRuleWhy,
  cardsDealt,
  DEALER,
  dealtInOrder,
  lastCardTurnedIt,
  lastDealt,
  LEARNER,
  MAX_GAME_MOVES,
  naturalOnTable,
  nextHand,
  PRACTICE_SEED,
  playerThirdValue,
  settle,
  setupWithShoe,
  totals,
  totalsHistory,
  type BaccaratMove,
  type BaccaratState,
  type BetOn,
  type Hand,
} from './engine';

// ------------------------------------------------------------------ helpers

const CONFIG: GameConfig = { players: 2 };
const DEAL: BaccaratMove = { type: 'deal' };
const bet = (on: BetOn): BaccaratMove => ({ type: 'bet', on });
const BET_PLAYER = bet('player');
const BET_BANKER = bet('banker');
const BET_TIE = bet('tie');
const CANDIDATES: BaccaratMove[] = [BET_PLAYER, BET_BANKER, BET_TIE, DEAL];

/** A complete `decks`-deck shoe whose first cards are `first` (deal order P, B, P, B, …). */
function shoeWith(first: CardCode[], decks = 8): CardCode[] {
  let rest = makeDeck({ copies: decks });
  for (const c of first) rest = removeCard(rest, c);
  return [...first, ...rest];
}

/** A coup in the 'bet' phase with a stacked shoe. */
function table(first: CardCode[], decks = 8): BaccaratState {
  const config: GameConfig = decks === 8 ? CONFIG : { players: 2, options: { decks } };
  return setupWithShoe(config, shoeWith(first, decks));
}

function dealOut(state: BaccaratState): BaccaratState {
  let s = state;
  while (!engine.isOver(s)) s = engine.applyMove(s, DEAL);
  return s;
}

/** Play a stacked coup to the end with the learner betting `on`. */
function coup(first: CardCode[], on: BetOn = 'banker'): BaccaratState {
  return dealOut(engine.applyMove(table(first), bet(on)));
}

const keys = (moves: BaccaratMove[]) => moves.map((m) => engine.moveKey(m));

function seededGame(seed: number, difficulty: Difficulty = 'normal', decks = 8): BaccaratState[] {
  const config: GameConfig = { players: 2, options: { decks } };
  const states: BaccaratState[] = [];
  let s = engine.setup(config, createRng(seed));
  const rng = createRng(`bots-${seed}`);
  states.push(s);
  while (!engine.isOver(s)) {
    const p = engine.currentPlayer(s)!;
    s = engine.applyMove(s, engine.botMove(s, p, difficulty, rng));
    states.push(s);
  }
  return states;
}

// Stacked coups (cards in deal order: P1, B1, P2, B2, then third cards).
/** Player natural 9 (9 + K) against Banker 7: no draws, Player wins 9–7. */
const PLAYER_NATURAL_9: CardCode[] = ['9H', '5S', 'KC', '2D'];
/** Banker natural 8 (4 + 4) against Player 5: no draws, Banker wins 8–5. */
const BANKER_NATURAL_8: CardCode[] = ['3C', '4D', '2C', '4H'];
/** Natural 8 against natural 8: a tie. */
const NATURAL_TIE_8: CardCode[] = ['8S', '5C', 'QD', '3H'];
/** Natural 9 against natural 9: a tie. */
const NATURAL_TIE_9: CardCode[] = ['9S', '4C', 'KD', '5H'];
/** Player natural 9 beats Banker natural 8. */
const NINE_BEATS_EIGHT: CardCode[] = ['4S', '6C', '5D', '2H'];
/** Player natural 8 against Banker 0: even Banker's 0 may not draw. */
const PLAYER_NATURAL_8: CardCode[] = ['8C', 'KH', 'KD', 'QD'];
/** Player stands on 6, Banker stands on 7: Banker wins 7–6. */
const BOTH_STAND: CardCode[] = ['6C', '7D', 'KC', 'QD'];
/** Player stands on 6, Banker stands on 6: tie at 6. */
const STAND_TIE: CardCode[] = ['6C', '6D', 'KC', 'QD'];
/** Player stands on 7; Banker on 5 draws (Player stood) a 4 → 9 and wins 9–7. */
const BANKER_DRAWS_AFTER_STAND: CardCode[] = ['3S', '2H', '4S', '3H', '4C'];
/** Player 5 draws a 4 → 9; Banker stands on 7. Player wins 9–7. */
const PLAYER_DRAWS_TO_WIN: CardCode[] = ['2C', '3D', '3C', '4D', '4H'];
/** Player 3 draws an 8 → 1; Banker on 3 stands against an 8. Banker wins 3–1. */
const BANKER_3_VS_EIGHT: CardCode[] = ['AS', '3C', '2S', 'KH', '8H'];
/** Player 3 draws a 9 → 2; Banker on 3 draws (a 5 → 8). Banker wins 8–2. */
const BANKER_3_VS_NINE: CardCode[] = ['AS', '3C', '2S', 'KH', '9H', '5D'];
/** Player 5 draws a 4 → 9; Banker on 4 draws a King → 4. Player wins 9–4 (5 already beat 4). */
const PLAYER_WINS_ANYWAY: CardCode[] = ['3C', 'AC', '2C', '3D', '4D', 'KH'];
/** Player stands on 6; Banker on 4 draws a 2 → 6: the last card makes a tie. */
const LAST_CARD_TIE: CardCode[] = ['6C', '2H', 'KC', '2D', '2S'];
/** Player 5 draws a 6 → 1; Banker on 6 draws against a 6 (a 3 → 9). Banker wins 9–1. */
const BANKER_6_VS_SIX: CardCode[] = ['AC', '6H', '4C', 'KH', '6D', '3S'];
/** Player 5 draws a 5 → 0; Banker on 6 stands against a 5. Banker wins 6–0. */
const BANKER_6_VS_FIVE: CardCode[] = ['AC', '6H', '4C', 'KH', '5D'];
/** Player 5 draws an Ace → 6; Banker on 4 stands against a 1. Player wins 6–4. */
const BANKER_4_VS_ONE: CardCode[] = ['2C', '4H', '3C', 'KH', 'AD'];
/** Player 5 draws a 4 → 9; Banker on 5 draws against a 4 (a King → 5). Player wins 9–5. */
const BANKER_5_VS_FOUR: CardCode[] = ['2C', '5H', '3C', 'KH', '4D', 'KS'];
/** Player 0 draws an 8; Banker on 0 always draws (a 9). Banker wins 9–8. */
const BANKER_0_DRAWS: CardCode[] = ['TC', 'JH', 'QC', 'KH', '8D', '9S'];

// -------------------------------------------------------------------- setup

describe('setup', () => {
  it('shuffles a fresh 8-deck shoe and waits for the bet', () => {
    const s = engine.setup(CONFIG, createRng(1));
    expect(engine.id).toBe('baccarat');
    expect(baccaratEngine).toBe(engine);
    expect(s.decks).toBe(8);
    expect(s.shoe).toHaveLength(416);
    expect(s.shoe.slice().sort()).toEqual(makeDeck({ copies: 8 }).sort());
    expect(s.player).toEqual([]);
    expect(s.banker).toEqual([]);
    expect(s.bet).toBeNull();
    expect(s.winner).toBeNull();
    expect(s.phase).toBe('bet');
    expect(engine.currentPlayer(s)).toBe(LEARNER);
    expect(engine.isOver(s)).toBe(false);
    // Plain JSON data.
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('uses the rng to shuffle: the shoe is the seeded Fisher–Yates order', () => {
    const s = engine.setup(CONFIG, createRng('x'));
    expect(s.shoe).toEqual(shuffle(makeDeck({ copies: 8 }), createRng('x')));
  });

  it('is deterministic: the same seed gives the same coup, different seeds differ', () => {
    expect(engine.setup(CONFIG, createRng(42))).toEqual(engine.setup(CONFIG, createRng(42)));
    expect(seededGame(42, 'easy')).toEqual(seededGame(42, 'easy'));
    const firstCards = new Set(
      Array.from({ length: 30 }, (_, i) => engine.setup(CONFIG, createRng(i)).shoe.join()),
    );
    expect(firstCards.size).toBe(30);
  });

  it('options.decks picks the shoe size (1–8), default 8', () => {
    for (const decks of [1, 2, 6, 8]) {
      const s = engine.setup({ players: 2, options: { decks } }, createRng(3));
      expect(s.decks).toBe(decks);
      expect(s.shoe).toHaveLength(52 * decks);
    }
    expect(engine.setup({ players: 2, options: {} }, createRng(3)).decks).toBe(8);
    for (const decks of [0, 9, 2.5, '8', -1]) {
      expect(() => engine.setup({ players: 2, options: { decks } }, createRng(3))).toThrow(
        /options.decks must be a whole number from 1 to 8/,
      );
    }
  });

  it('needs exactly two seats: the learner and the dealer', () => {
    for (const players of [0, 1, 3, 6]) {
      expect(() => engine.setup({ players }, createRng(1))).toThrow(RangeError);
      expect(() => engine.setup({ players }, createRng(1))).toThrow(/exactly 2 seats/);
    }
  });

  it('ignores affordableUnits and unknown options (there are no extra bets)', () => {
    const base = engine.setup(CONFIG, createRng(9));
    expect(engine.setup({ players: 2, affordableUnits: 0 }, createRng(9))).toEqual(base);
    expect(engine.setup({ players: 2, options: { foo: 1 } }, createRng(9))).toEqual(base);
  });

  it('setupWithShoe keeps the shoe order: shoe[0] goes to Player, shoe[1] to Banker', () => {
    const shoe = shoeWith(PLAYER_DRAWS_TO_WIN);
    const s = setupWithShoe(CONFIG, shoe);
    expect(s.shoe).toEqual(shoe);
    expect(s.shoe).not.toBe(shoe);
    expect(nextHand(s)).toBe('player');
  });

  it('setupWithShoe rejects anything but complete decks of the configured size', () => {
    const shoe = makeDeck({ copies: 8 });
    expect(() => setupWithShoe(CONFIG, shoe.slice(1))).toThrow(RangeError);
    expect(() => setupWithShoe(CONFIG, [...shoe.slice(1), '2C'])).toThrow(/complete 52-card/);
    expect(() => setupWithShoe(CONFIG, [...shoe.slice(1), 'X1'])).toThrow(RangeError);
    expect(() => setupWithShoe(CONFIG, makeDeck({ copies: 6 }))).toThrow(RangeError);
    expect(() => setupWithShoe({ players: 2, options: { decks: 1 } }, makeDeck())).not.toThrow();
    expect(() => setupWithShoe({ players: 3 }, shoe)).toThrow(/exactly 2 seats/);
  });
});

// ---------------------------------------------------------- turns and moves

describe('turns and legal moves', () => {
  it('bet phase: only the learner acts, choosing Player, Banker or Tie', () => {
    const s = table(PLAYER_NATURAL_9);
    expect(keys(engine.legalMoves(s, LEARNER))).toEqual(['bet:player', 'bet:banker', 'bet:tie']);
    expect(engine.legalMoves(s, DEALER)).toEqual([]);
  });

  it('deal phase: the dealer has exactly one forced move, the learner none', () => {
    const s = engine.applyMove(table(PLAYER_NATURAL_9), BET_TIE);
    expect(s.phase).toBe('deal');
    expect(engine.currentPlayer(s)).toBe(DEALER);
    expect(engine.legalMoves(s, DEALER)).toEqual([DEAL]);
    expect(engine.legalMoves(s, LEARNER)).toEqual([]);
  });

  it('when the coup is over nobody can move and currentPlayer is null', () => {
    const s = coup(PLAYER_NATURAL_9);
    expect(engine.isOver(s)).toBe(true);
    expect(engine.currentPlayer(s)).toBeNull();
    expect(engine.legalMoves(s, LEARNER)).toEqual([]);
    expect(engine.legalMoves(s, DEALER)).toEqual([]);
  });

  it('seats that do not exist never get moves', () => {
    const s = table(PLAYER_NATURAL_9);
    expect(engine.legalMoves(s, 2)).toEqual([]);
    expect(engine.legalMoves(s, -1)).toEqual([]);
  });

  it('legalMoves and checkMove always agree, and currentPlayer is null iff over', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const s of seededGame(seed, seed % 2 ? 'easy' : 'normal')) {
        expect(engine.currentPlayer(s) === null).toBe(engine.isOver(s));
        for (const p of [LEARNER, DEALER, 2]) {
          const legal = new Set(keys(engine.legalMoves(s, p)));
          for (const m of CANDIDATES) {
            expect(engine.checkMove(s, p, m).ok, `${seed} p${p} ${engine.moveKey(m)}`).toBe(
              legal.has(engine.moveKey(m)),
            );
          }
        }
      }
    }
  });

  it('moveKey is stable and unique per distinct move', () => {
    expect(keys(CANDIDATES)).toEqual(['bet:player', 'bet:banker', 'bet:tie', 'deal']);
    expect(engine.moveKey({ type: 'bet', on: 'tie' })).toBe(engine.moveKey(BET_TIE));
    expect(new Set(keys(CANDIDATES)).size).toBe(4);
    const odd = { type: 'hit' } as unknown as BaccaratMove;
    expect(engine.moveKey(odd)).not.toBe('deal');
  });
});

// ------------------------------------------------------------ friendly whys

describe('checkMove explains every illegal move', () => {
  const betting = table(PLAYER_NATURAL_9);
  const dealing = engine.applyMove(betting, BET_BANKER);
  const over = coup(PLAYER_NATURAL_9);

  const reason = (s: BaccaratState, p: number, m: unknown) => {
    const check = engine.checkMove(s, p, m as BaccaratMove);
    expect(check.ok).toBe(false);
    return check.reason ?? '';
  };

  it('legal moves pass', () => {
    expect(engine.checkMove(betting, LEARNER, BET_TIE)).toEqual({ ok: true });
    expect(engine.checkMove(dealing, DEALER, DEAL)).toEqual({ ok: true });
  });

  it('a move that is not a Baccarat move', () => {
    for (const m of [{ type: 'hit' }, {}, null, 'deal', { on: 'player' }, { type: 'draw' }]) {
      expect(reason(betting, LEARNER, m)).toBe(
        'That isn’t a Baccarat move. You bet on Player, Banker or Tie, and the dealer deals the cards.',
      );
    }
  });

  it('a seat that is not at the table', () => {
    expect(reason(betting, 3, BET_PLAYER)).toBe(
      'There’s no Player 3 at this table — it’s just you and the dealer.',
    );
  });

  it('a bet on something that does not exist', () => {
    for (const m of [{ type: 'bet', on: 'dealer' }, { type: 'bet' }, { type: 'bet', on: 7 }]) {
      expect(reason(betting, LEARNER, m)).toBe('Pick a bet: Player, Banker or Tie.');
    }
  });

  it('the dealer trying to bet', () => {
    const why = 'The dealer never bets — the dealer only deals the cards. Only you place a bet.';
    expect(reason(betting, DEALER, BET_BANKER)).toBe(why);
    expect(reason(dealing, DEALER, BET_PLAYER)).toBe(why);
  });

  it('betting again on the same bet once the dealing has started', () => {
    expect(reason(dealing, LEARNER, BET_BANKER)).toBe(
      'Your bet on Banker is already down and the dealer is dealing — now just watch the cards.',
    );
  });

  it('switching bets once the dealing has started', () => {
    expect(reason(dealing, LEARNER, BET_TIE)).toBe(
      'Bets are locked once the dealing starts, so you can’t switch from Banker to Tie now. Just watch the cards!',
    );
    // Still locked after cards are out.
    const later = engine.applyMove(engine.applyMove(dealing, DEAL), DEAL);
    expect(reason(later, LEARNER, BET_PLAYER)).toMatch(/can’t switch from Banker to Player/);
  });

  it('the learner trying to deal (or draw a third card), before and after betting', () => {
    expect(reason(betting, LEARNER, DEAL)).toBe(
      'You don’t deal the cards — the dealer does, and only after you’ve placed your bet. Pick Player, Banker or Tie first.',
    );
    expect(reason(dealing, LEARNER, DEAL)).toBe(
      'The dealer deals every card for you, and whether a hand gets a third card is decided by fixed rules — nobody chooses. Just watch!',
    );
  });

  it('the dealer trying to deal before the bet', () => {
    expect(reason(betting, DEALER, DEAL)).toBe(
      'The dealer waits for your bet: no card is dealt until you’ve picked Player, Banker or Tie.',
    );
  });

  it('any move once the coup is over names the result', () => {
    for (const [p, m] of [
      [LEARNER, BET_PLAYER],
      [LEARNER, DEAL],
      [DEALER, DEAL],
    ] as const) {
      expect(reason(over, p, m)).toBe(
        'This coup is over — Player wins, 9 to 7. Start a new game to play again.',
      );
    }
    expect(reason(coup(STAND_TIE), LEARNER, BET_TIE)).toBe(
      'This coup is over — it’s a tie at 6. Start a new game to play again.',
    );
  });

  it('applyMove throws IllegalMoveError (with the reason) for illegal moves', () => {
    expect(() => engine.applyMove(betting, DEAL)).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(betting, DEAL)).toThrow(/You don’t deal the cards/);
    // applyMove acts for the current player — the dealer, who never bets.
    expect(() => engine.applyMove(dealing, BET_PLAYER)).toThrow(/dealer never bets/);
    expect(() =>
      engine.applyMove(betting, { type: 'bet', on: 'up' } as unknown as BaccaratMove),
    ).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(over, DEAL)).toThrow(IllegalMoveError);
    expect(() => engine.applyMove(over, DEAL)).toThrow(/already over/);
  });
});

// ----------------------------------------------------------------- dealing

describe('placing the bet and dealing', () => {
  it('the bet records the choice and starts the deal without dealing a card', () => {
    const s = engine.applyMove(table(PLAYER_NATURAL_9), BET_TIE);
    expect(s.bet).toBe('tie');
    expect(s.phase).toBe('deal');
    expect(cardsDealt(s)).toBe(0);
    expect(s.shoe).toHaveLength(416);
  });

  it('deals one card per move from the top of the shoe: P, B, P, B, then third cards', () => {
    let s = engine.applyMove(table(BANKER_3_VS_NINE), BET_BANKER);
    const order: Hand[] = [];
    for (let i = 0; i < 6; i++) {
      const top = s.shoe[0];
      order.push(nextHand(s)!);
      s = engine.applyMove(s, DEAL);
      expect(lastDealt(s)?.card).toBe(top);
      expect(s.shoe).toHaveLength(416 - i - 1);
    }
    expect(order).toEqual(['player', 'banker', 'player', 'banker', 'player', 'banker']);
    expect(s.player).toEqual(['AS', '2S', '9H']);
    expect(s.banker).toEqual(['3C', 'KH', '5D']);
    expect(dealtInOrder(s)).toEqual([
      { card: 'AS', hand: 'player', number: 1, third: false },
      { card: '3C', hand: 'banker', number: 2, third: false },
      { card: '2S', hand: 'player', number: 3, third: false },
      { card: 'KH', hand: 'banker', number: 4, third: false },
      { card: '9H', hand: 'player', number: 5, third: true },
      { card: '5D', hand: 'banker', number: 6, third: true },
    ]);
    expect(s.phase).toBe('over');
    expect(nextHand(s)).toBeNull();
    expect(playerThirdValue(s)).toBe(9);
  });

  it('the first four cards are always dealt, even when the first two make a natural', () => {
    let s = engine.applyMove(table(PLAYER_NATURAL_9), BET_PLAYER);
    s = engine.applyMove(engine.applyMove(engine.applyMove(s, DEAL), DEAL), DEAL);
    expect(s.player).toEqual(['9H', 'KC']);
    expect(s.phase).toBe('deal');
    expect(nextHand(s)).toBe('banker');
    s = engine.applyMove(s, DEAL);
    expect(s.banker).toEqual(['5S', '2D']);
    expect(s.phase).toBe('over');
  });

  it('a natural 8 or 9 on either side stops the deal: nobody draws', () => {
    for (const first of [
      PLAYER_NATURAL_9,
      BANKER_NATURAL_8,
      NATURAL_TIE_8,
      NATURAL_TIE_9,
      NINE_BEATS_EIGHT,
      PLAYER_NATURAL_8,
    ]) {
      const s = coup(first);
      expect(naturalOnTable(s), first.join()).toBe(true);
      expect(s.player).toHaveLength(2);
      expect(s.banker).toHaveLength(2);
    }
    // Banker on 0 does not draw against a Player natural 8.
    const s = coup(PLAYER_NATURAL_8);
    expect(totals(s)).toEqual({ player: 8, banker: 0 });
    expect(s.winner).toBe('player');
  });

  it('Player stands on 6 or 7; Banker then draws on 0–5 and stands on 6–7', () => {
    const stand = coup(BOTH_STAND);
    expect([stand.player.length, stand.banker.length]).toEqual([2, 2]);
    expect(stand.winner).toBe('banker');
    const tie = coup(STAND_TIE);
    expect([tie.player.length, tie.banker.length]).toEqual([2, 2]);
    expect(tie.winner).toBe('tie');
    const draws = coup(BANKER_DRAWS_AFTER_STAND);
    expect(draws.player).toEqual(['3S', '4S']);
    expect(draws.banker).toEqual(['2H', '3H', '4C']);
    expect(totals(draws)).toEqual({ player: 7, banker: 9 });
    expect(draws.winner).toBe('banker');
  });

  it('Player draws on 0–5; Banker on 7 stands', () => {
    const s = coup(PLAYER_DRAWS_TO_WIN);
    expect(s.player).toEqual(['2C', '3C', '4H']);
    expect(s.banker).toEqual(['3D', '4D']);
    expect(totals(s)).toEqual({ player: 9, banker: 7 });
    expect(s.winner).toBe('player');
  });

  it('after a Player third card, Banker follows the tableau', () => {
    const cases: [CardCode[], number, number, number][] = [
      // [coup, banker cards, player total, banker total]
      [BANKER_3_VS_EIGHT, 2, 1, 3], // Banker 3 stands against an 8
      [BANKER_3_VS_NINE, 3, 2, 8], // Banker 3 draws against a 9
      [BANKER_6_VS_SIX, 3, 1, 9], // Banker 6 draws against a 6
      [BANKER_6_VS_FIVE, 2, 0, 6], // Banker 6 stands against a 5
      [BANKER_4_VS_ONE, 2, 6, 4], // Banker 4 stands against a 1
      [BANKER_5_VS_FOUR, 3, 9, 5], // Banker 5 draws against a 4
      [BANKER_0_DRAWS, 3, 8, 9], // Banker 0 always draws
      [PLAYER_WINS_ANYWAY, 3, 9, 4], // Banker 4 draws against a 4
    ];
    for (const [first, bankerCards, p, b] of cases) {
      const s = coup(first);
      expect(s.player, first.join()).toHaveLength(3);
      expect(s.banker, first.join()).toHaveLength(bankerCards);
      expect(totals(s), first.join()).toEqual({ player: p, banker: b });
    }
  });

  it('works with a 1-deck shoe too', () => {
    const s = dealOut(engine.applyMove(table(BANKER_3_VS_NINE, 1), BET_PLAYER));
    expect(s.decks).toBe(1);
    expect(s.shoe).toHaveLength(46);
    expect(totals(s)).toEqual({ player: 2, banker: 8 });
  });

  it('totalsHistory records the hands after four cards and after each third card', () => {
    expect(totalsHistory(table(BANKER_3_VS_NINE))).toEqual([]);
    expect(totalsHistory(coup(BANKER_3_VS_NINE))).toEqual([
      { player: 3, banker: 3 },
      { player: 2, banker: 3 },
      { player: 2, banker: 8 },
    ]);
    expect(totalsHistory(coup(BANKER_DRAWS_AFTER_STAND))).toEqual([
      { player: 7, banker: 5 },
      { player: 7, banker: 9 },
    ]);
    expect(totalsHistory(coup(PLAYER_NATURAL_9))).toEqual([{ player: 9, banker: 7 }]);
  });

  it('a game is never longer than the bet plus six cards', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(seededGame(seed, 'easy').length - 1).toBeLessThanOrEqual(MAX_GAME_MOVES);
    }
  });

  it('applyMove never mutates its input (deep-frozen states)', () => {
    let s = deepFreeze(table(BANKER_3_VS_NINE));
    const snapshots: string[] = [];
    const frozen: BaccaratState[] = [];
    for (const m of [BET_TIE, DEAL, DEAL, DEAL, DEAL, DEAL, DEAL]) {
      snapshots.push(JSON.stringify(s));
      frozen.push(s);
      s = deepFreeze(engine.applyMove(s, m));
    }
    frozen.forEach((f, i) => expect(JSON.stringify(f)).toBe(snapshots[i]));
    expect(engine.isOver(s)).toBe(true);
    // Reading a frozen final state is fine too.
    expect(() => engine.result(s)).not.toThrow();
    expect(() => engine.coach(s, LEARNER)).not.toThrow();
  });
});

// ------------------------------------------------------------- settlement

describe('payouts for every outcome', () => {
  const cases: [string, CardCode[], BetOn, number, 'win' | 'loss' | 'push', number[]][] = [
    ['Player wins, Player bet', PLAYER_NATURAL_9, 'player', 1, 'win', [LEARNER]],
    ['Player wins, Banker bet', PLAYER_NATURAL_9, 'banker', -1, 'loss', [DEALER]],
    ['Player wins, Tie bet', PLAYER_NATURAL_9, 'tie', -1, 'loss', [DEALER]],
    ['Banker wins, Player bet', BANKER_NATURAL_8, 'player', -1, 'loss', [DEALER]],
    ['Banker wins, Banker bet', BANKER_NATURAL_8, 'banker', 0.95, 'win', [LEARNER]],
    ['Banker wins, Tie bet', BANKER_NATURAL_8, 'tie', -1, 'loss', [DEALER]],
    ['Tie, Player bet pushes', STAND_TIE, 'player', 0, 'push', []],
    ['Tie, Banker bet pushes', STAND_TIE, 'banker', 0, 'push', []],
    ['Tie, Tie bet', STAND_TIE, 'tie', 8, 'win', [LEARNER]],
  ];
  for (const [label, first, on, net, outcome, winners] of cases) {
    it(label, () => {
      const r = engine.result(coup(first, on));
      expect(r.humanNetUnits).toBe(net);
      expect(r.humanOutcome).toBe(outcome);
      expect(r.winners).toEqual(winners);
      expect(r.scores).toBeUndefined();
    });
  }

  it('settle reports the totals, naturals and net', () => {
    expect(settle(coup(BANKER_NATURAL_8, 'banker'))).toEqual({
      bet: 'banker',
      winner: 'banker',
      playerTotal: 5,
      bankerTotal: 8,
      playerNatural: false,
      bankerNatural: true,
      net: 0.95,
      outcome: 'win',
    });
  });

  it('result() and settle() refuse an unfinished coup', () => {
    const s = engine.applyMove(table(PLAYER_NATURAL_9), BET_PLAYER);
    expect(() => engine.result(s)).toThrow(/not over/);
    expect(() => settle(table(PLAYER_NATURAL_9))).toThrow(/not over/);
  });

  it('summaries say what happened in one plain sentence', () => {
    const summary = (first: CardCode[], on: BetOn) => engine.result(coup(first, on)).summary;
    expect(summary(PLAYER_NATURAL_9, 'player')).toBe(
      'Player won 9 to 7 with a natural, so your Player bet wins 1 to 1!',
    );
    expect(summary(PLAYER_NATURAL_9, 'banker')).toBe(
      'Player won 9 to 7 with a natural, so your Banker bet loses.',
    );
    expect(summary(BANKER_NATURAL_8, 'banker')).toBe(
      'Banker won 8 to 5 with a natural, so your Banker bet wins 0.95 to 1 (even money minus the 5% commission).',
    );
    expect(summary(BANKER_DRAWS_AFTER_STAND, 'tie')).toBe(
      'Banker won 9 to 7, so your Tie bet loses.',
    );
    expect(summary(STAND_TIE, 'player')).toBe(
      'Both hands finished on 6 — a tie — so your Player bet is a push and comes back to you.',
    );
    expect(summary(STAND_TIE, 'tie')).toBe(
      'Both hands finished on 6 — a tie, so your Tie bet wins 8 to 1!',
    );
    expect(summary(NATURAL_TIE_8, 'tie')).toBe(
      'Both hands finished on 8 with naturals — a tie, so your Tie bet wins 8 to 1!',
    );
  });
});

describe('result flags come from what actually happened', () => {
  const flags = (first: CardCode[], on: BetOn) => engine.result(coup(first, on)).flags;

  it('tags: natural and tie', () => {
    expect(flags(PLAYER_NATURAL_9, 'banker').tags).toEqual(['natural']);
    expect(flags(NATURAL_TIE_8, 'banker').tags).toEqual(['natural', 'tie']);
    expect(flags(STAND_TIE, 'banker').tags).toEqual(['tie']);
    expect(flags(PLAYER_DRAWS_TO_WIN, 'banker').tags).toEqual([]);
  });

  it('perfect: winning with a natural 9 on your side', () => {
    expect(flags(PLAYER_NATURAL_9, 'player').perfect).toBe(true);
    expect(flags(NINE_BEATS_EIGHT, 'player').perfect).toBe(true);
    expect(flags(NATURAL_TIE_9, 'tie').perfect).toBe(true); // a 9–9 natural tie
    expect(flags(PLAYER_NATURAL_9, 'banker').perfect).toBe(false); // lost
    expect(flags(PLAYER_NATURAL_9, 'tie').perfect).toBe(false); // lost
    expect(flags(NATURAL_TIE_9, 'player').perfect).toBe(false); // push
    expect(flags(PLAYER_NATURAL_8, 'player').perfect).toBe(false); // natural 8, not 9
    expect(flags(NATURAL_TIE_8, 'tie').perfect).toBe(false);
    expect(flags(PLAYER_DRAWS_TO_WIN, 'player').perfect).toBe(false); // a three-card 9
  });

  it('luckyLastCard: the winning hand’s third card turned the result', () => {
    // Banker's 5 trailed Player's 7; its third card made 9.
    expect(flags(BANKER_DRAWS_AFTER_STAND, 'banker').luckyLastCard).toBe(true);
    // Player's 5 trailed Banker's 7; its third card made 9.
    expect(flags(PLAYER_DRAWS_TO_WIN, 'player').luckyLastCard).toBe(true);
    // Player's 5 already beat Banker's final 4: the third card didn't matter.
    expect(flags(PLAYER_WINS_ANYWAY, 'player').luckyLastCard).toBe(false);
    // Banker's two-card 0 against Player's final 8: Banker's 9 turned it.
    expect(flags(BANKER_0_DRAWS, 'banker').luckyLastCard).toBe(true);
    // The winner never drew.
    expect(flags(BANKER_3_VS_EIGHT, 'banker').luckyLastCard).toBe(false);
    expect(flags(PLAYER_NATURAL_9, 'player').luckyLastCard).toBe(false);
    // The last card turned 6–4 into a 6–6 tie.
    expect(flags(LAST_CARD_TIE, 'tie').luckyLastCard).toBe(true);
    // Ties without any draw.
    expect(flags(STAND_TIE, 'tie').luckyLastCard).toBe(false);
    expect(lastCardTurnedIt(table(PLAYER_NATURAL_9))).toBe(false);
  });

  it('comeback: your side was behind at some point and still won', () => {
    expect(flags(BANKER_DRAWS_AFTER_STAND, 'banker').comeback).toBe(true); // 5 vs 7 → 9
    expect(flags(PLAYER_DRAWS_TO_WIN, 'player').comeback).toBe(true); // 5 vs 7 → 9
    // Banker 3 vs Player 3, then Player drew to 2 (Banker ahead), Banker won: never behind.
    expect(flags(BANKER_3_VS_NINE, 'banker').comeback).toBe(false);
    expect(flags(PLAYER_WINS_ANYWAY, 'player').comeback).toBe(false); // always ahead
    expect(flags(PLAYER_NATURAL_9, 'player').comeback).toBe(false);
    expect(flags(BANKER_DRAWS_AFTER_STAND, 'player').comeback).toBe(false); // lost
    // Tie bet: the totals were different (6 vs 4) before the tie.
    expect(flags(LAST_CARD_TIE, 'tie').comeback).toBe(true);
    expect(flags(STAND_TIE, 'tie').comeback).toBe(false);
  });

  it('closeFinish: the totals differ by exactly 1', () => {
    expect(flags(BOTH_STAND, 'banker').closeFinish).toBe(true); // 7–6
    expect(flags(BOTH_STAND, 'player').closeFinish).toBe(true); // lost by one
    expect(flags(NINE_BEATS_EIGHT, 'player').closeFinish).toBe(true); // 9–8
    expect(flags(PLAYER_NATURAL_9, 'player').closeFinish).toBe(false); // 9–7
    expect(flags(STAND_TIE, 'tie').closeFinish).toBe(false);
  });

  it('bigPot only for the 8 to 1 Tie win; never bust or folded', () => {
    expect(flags(STAND_TIE, 'tie').bigPot).toBe(true);
    expect(flags(NATURAL_TIE_8, 'tie').bigPot).toBe(true);
    for (const [first, on] of [
      [STAND_TIE, 'banker'],
      [PLAYER_NATURAL_9, 'tie'],
      [PLAYER_NATURAL_9, 'player'],
      [BANKER_NATURAL_8, 'banker'],
    ] as const) {
      const f = flags(first, on);
      expect(f.bigPot).toBe(false);
      expect(f.bust).toBe(false);
      expect(f.folded).toBe(false);
    }
  });
});

// ------------------------------------------------------------------ words

describe('describeMove', () => {
  it('announces bets with their payout', () => {
    const s = table(PLAYER_NATURAL_9);
    expect(engine.describeMove(s, LEARNER, BET_PLAYER)).toBe(
      'You bet on Player, which pays 1 to 1.',
    );
    expect(engine.describeMove(s, LEARNER, BET_BANKER)).toBe(
      'You bet on Banker, which pays 0.95 to 1.',
    );
    expect(engine.describeMove(s, LEARNER, BET_TIE)).toBe('You bet on Tie, which pays 8 to 1.');
  });

  it('announces each dealt card, the running total and the result', () => {
    let s = engine.applyMove(table(PLAYER_DRAWS_TO_WIN), BET_PLAYER);
    const lines: string[] = [];
    while (!engine.isOver(s)) {
      lines.push(engine.describeMove(s, DEALER, DEAL));
      s = engine.applyMove(s, DEAL);
    }
    expect(lines).toEqual([
      'Player 1 deals the Two of Clubs to Player.',
      'Player 1 deals the Three of Diamonds to Banker.',
      'Player 1 deals the Three of Clubs to Player — Player has 5.',
      'Player 1 deals the Four of Diamonds to Banker — Banker has 7.',
      'Player 1 deals Player a third card, the Four of Hearts — Player has 9. Player wins, 9 to 7.',
    ]);
  });

  it('names naturals and ties', () => {
    let s = engine.applyMove(table(NATURAL_TIE_8), BET_TIE);
    s = engine.applyMove(engine.applyMove(s, DEAL), DEAL);
    expect(engine.describeMove(s, DEALER, DEAL)).toBe(
      'Player 1 deals the Queen of Diamonds to Player — Player has a natural 8.',
    );
    s = engine.applyMove(s, DEAL);
    expect(engine.describeMove(s, DEALER, DEAL)).toBe(
      'Player 1 deals the Three of Hearts to Banker — Banker has a natural 8. It’s a tie at 8.',
    );
  });

  it('never reveals face-down cards: only the card being turned up is named', () => {
    const s = engine.applyMove(table(['2C', '3D', '7H', '8S']), BET_PLAYER);
    expect(engine.describeMove(table(['2C']), LEARNER, BET_PLAYER)).not.toMatch(/of /);
    const text = engine.describeMove(s, DEALER, DEAL);
    expect(text).toContain(cardName('2C'));
    for (const hidden of ['3D', '7H', '8S'] as const) {
      expect(text).not.toContain(cardName(hidden));
    }
  });

  it('describes illegal or malformed moves without throwing', () => {
    const s = table(PLAYER_NATURAL_9);
    expect(engine.describeMove(s, DEALER, DEAL)).toBe('Player 1 can’t deal right now.');
    expect(engine.describeMove(s, DEALER, BET_TIE)).toBe('Player 1 can’t bet right now.');
    expect(engine.describeMove(s, LEARNER, { type: 'hit' } as unknown as BaccaratMove)).toBe(
      'That isn’t a Baccarat move.',
    );
  });
});

describe('coach', () => {
  it('before the bet: explains the game and suggests Banker with the house edges', () => {
    const s = table(PLAYER_NATURAL_9);
    const advice = engine.coach(s, LEARNER);
    expect(advice.suggestion).toEqual(BET_BANKER);
    expect(engine.checkMove(s, LEARNER, advice.suggestion as BaccaratMove).ok).toBe(true);
    expect(advice.situation).toMatch(/closer to 9/);
    expect(advice.situation).toMatch(/automatically/);
    for (const figure of ['45.86%', '44.62%', '9.52%', '1.06%', '1.24%', '14.4%']) {
      expect(advice.why).toContain(figure);
    }
    expect(advice.why).toMatch(/5% commission/);
    expect(advice.why).toMatch(/the drawing is automatic/);
  });

  it('quotes the exact figures for the shoe in play', () => {
    const advice = engine.coach(table(PLAYER_NATURAL_9, 1), LEARNER);
    // One deck: Banker edge 1.01%, Player 1.29%, Tie 15.7%.
    for (const figure of ['1.01%', '1.29%', '15.7%', '45.96%']) {
      expect(advice.why).toContain(figure);
    }
  });

  it('the dealer waits during the bet', () => {
    const advice = engine.coach(table(PLAYER_NATURAL_9), DEALER);
    expect(advice.situation).toBe('The dealer waits for your bet before dealing any cards.');
    expect(advice.suggestion).toBeUndefined();
  });

  it('during the deal: describes the hands and the rule for the next card', () => {
    let s = engine.applyMove(table(BANKER_5_VS_FOUR), BET_PLAYER);
    const dealer = engine.coach(s, DEALER);
    expect(dealer.suggestion).toEqual(DEAL);
    expect(dealer.situation).toBe(
      'You bet on Player. No cards are dealt yet. The next card goes to Player.',
    );
    expect(dealer.why).toMatch(/Player, Banker, Player, Banker/);
    s = engine.applyMove(engine.applyMove(engine.applyMove(s, DEAL), DEAL), DEAL);
    const learner = engine.coach(s, LEARNER);
    expect(learner.suggestion).toBeUndefined();
    expect(learner.situation).toBe(
      'You bet on Player. Player has 5 from two cards, and Banker has one card, worth 5. ' +
        'The next card goes to Banker. There’s nothing for you to decide — the dealer deals by fixed rules.',
    );
    s = engine.applyMove(s, DEAL);
    expect(engine.coach(s, LEARNER).why).toBe(
      'Nobody has a natural (8 or 9), so the drawing rules apply. Player has 5, and Player always draws a third card on 0–5.',
    );
    expect(engine.coach(s, DEALER).situation).toMatch(/Next, Player gets a third card\.$/);
    s = engine.applyMove(s, DEAL);
    expect(engine.coach(s, DEALER).why).toBe(bankerRuleWhy(5, 4));
    expect(engine.coach(s, DEALER).situation).toBe(
      'You bet on Player. Player has 9 from three cards, and Banker has 5 from two cards. Next, Banker gets a third card.',
    );
  });

  it('after the coup: the summary', () => {
    const s = coup(PLAYER_NATURAL_9, 'player');
    expect(engine.coach(s, LEARNER)).toEqual({ situation: engine.result(s).summary });
  });

  it('a seat that does not exist', () => {
    expect(engine.coach(table(PLAYER_NATURAL_9), 4).situation).toMatch(/no Player 4/);
  });

  it('the suggestion is legal whenever it is the seat’s turn', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const s of seededGame(seed, 'easy')) {
        const p = engine.currentPlayer(s);
        if (p === null) continue;
        const advice = engine.coach(s, p);
        expect(advice.suggestion).toBeDefined();
        expect(engine.checkMove(s, p, advice.suggestion as BaccaratMove).ok).toBe(true);
      }
    }
  });

  it('"Player N" only ever names a seat (the UI swaps it for a persona name)', () => {
    for (let seed = 1; seed <= 80; seed++) {
      const states = seededGame(seed, 'easy');
      for (const s of states) {
        for (const p of [LEARNER, DEALER]) {
          const a = engine.coach(s, p);
          expect(`${a.situation} ${a.why ?? ''}`).not.toMatch(/Player \d/);
          for (const m of engine.legalMoves(s, p)) {
            const text = engine.describeMove(s, p, m);
            expect(text.replace(/^Player 1 /, '')).not.toMatch(/Player \d/);
          }
        }
      }
      expect(engine.result(states.at(-1)!).summary).not.toMatch(/Player \d/);
    }
  });
});

// ------------------------------------------------------------------- bots

describe('bots', () => {
  it('normal bets Banker (the smallest house edge) for every shoe size', () => {
    for (const decks of [1, 4, 8]) {
      const s = engine.setup({ players: 2, options: { decks } }, createRng(decks));
      expect(engine.botMove(s, LEARNER, 'normal', createRng(1))).toEqual(BET_BANKER);
    }
  });

  it('easy bets at random, and every pick is legal', () => {
    const s = table(PLAYER_NATURAL_9);
    const rng = createRng('easy');
    const seen = new Map<string, number>();
    for (let i = 0; i < 300; i++) {
      const m = engine.botMove(s, LEARNER, 'easy', rng);
      expect(engine.checkMove(s, LEARNER, m).ok).toBe(true);
      seen.set(engine.moveKey(m), (seen.get(engine.moveKey(m)) ?? 0) + 1);
    }
    expect([...seen.keys()].sort()).toEqual(['bet:banker', 'bet:player', 'bet:tie']);
    for (const n of seen.values()) expect(n).toBeGreaterThan(60);
  });

  it('the dealer always deals, at either difficulty, in every deal position', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const s of seededGame(seed)) {
        if (engine.currentPlayer(s) !== DEALER) continue;
        for (const d of ['easy', 'normal'] as const) {
          expect(engine.botMove(s, DEALER, d, createRng(seed))).toEqual(DEAL);
        }
      }
    }
  });

  it('bots never peek at the shoe: the same public state gives the same choice', () => {
    const a = engine.setup(CONFIG, createRng('a'));
    const b = engine.setup(CONFIG, createRng('b'));
    expect(a.shoe).not.toEqual(b.shoe);
    for (const d of ['easy', 'normal'] as const) {
      for (let i = 0; i < 20; i++) {
        expect(engine.botMove(a, LEARNER, d, createRng(i))).toEqual(
          engine.botMove(b, LEARNER, d, createRng(i)),
        );
      }
    }
  });

  it('refuses to move for a seat that has no move', () => {
    const s = engine.applyMove(table(PLAYER_NATURAL_9), BET_PLAYER);
    expect(() => engine.botMove(s, LEARNER, 'normal', createRng(1))).toThrow(/no move now/);
    expect(() => engine.botMove(coup(PLAYER_NATURAL_9), DEALER, 'easy', createRng(1))).toThrow(
      /no move now/,
    );
  });
});

// --------------------------------------------------------------- practice

describe('the curated practice coup', () => {
  it('PRACTICE_SEED shows Player drawing and Banker using the tableau, and Banker wins', () => {
    let s = engine.setup(CONFIG, createRng(PRACTICE_SEED));
    const tip = engine.coach(s, LEARNER).suggestion as BaccaratMove;
    expect(tip).toEqual(BET_BANKER);
    s = dealOut(engine.applyMove(s, tip));
    expect(naturalOnTable(s)).toBe(false);
    expect(s.player).toHaveLength(3);
    expect(s.banker).toHaveLength(3);
    const [first] = totalsHistory(s);
    // Banker's two-card total is in the 3–6 band where the Player's third card matters.
    expect(first!.banker).toBeGreaterThanOrEqual(3);
    expect(first!.banker).toBeLessThanOrEqual(6);
    expect(totals(s)).toEqual({ player: 5, banker: 9 });
    const r = engine.result(s);
    expect(r.humanOutcome).toBe('win');
    expect(r.humanNetUnits).toBe(0.95);
  });
});
