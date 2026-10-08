/**
 * War — pure battle mechanics and wording helpers (docs/RULES_DECISIONS.md → War).
 *
 * Everything here is a pure function of its arguments. The engine (engine.ts) wraps it in
 * the GameEngine contract; the tests use it to build and check specific positions.
 */
import { cardName, RANK_NAMES, rankNumberAceHigh, rankOf, type CardCode } from '@/games/core/cards';
import type { PlayerId } from '@/games/core/types';

/** War is played heads-up: the learner (seat 0) against one bot (seat 1). */
export const SEATS = 2;
export const DECK_SIZE = 52;
/** Cards each player starts with. */
export const HALF_DECK = DECK_SIZE / SEATS;
/** Beginner length cap: the game stops after this many battles (docs/RULES_DECISIONS.md). */
export const DEFAULT_MAX_BATTLES = 60;
/** Upper bound accepted for options.maxBattles (keeps every game finite and quick). */
export const MAX_BATTLES_LIMIT = 1000;
/** Cards laid face down in a war before the face-up card. */
export const WAR_FACE_DOWN = 3;
/** The learner "came back" if they won after holding this many cards or fewer. */
export const COMEBACK_THRESHOLD = 16;
/** A finish at the battle cap is "close" when the piles differ by at most this many cards. */
export const CLOSE_FINISH_MARGIN = 4;
/** Betting: win +1, lose −1, push 0. */
export const MAX_LOSS_UNITS = 1;

export type WarSeat = 0 | 1;
export const WAR_SEATS: readonly WarSeat[] = [0, 1];

/** Something indexed by seat: [learner, bot]. */
export type Pair<T> = [T, T];

/** One flip of the battle: the opening flip, or one war (face-down cards, then a face-up card). */
export interface WarRound {
  /**
   * Cards each seat laid face down before turning its face-up card, in the order they were
   * laid. Empty for the opening flip; 3 in a normal war; fewer when a player ran short.
   * HIDDEN information — never name these cards to the learner.
   */
  down: Pair<CardCode[]>;
  /** The card each seat turned face up (public). */
  up: Pair<CardCode>;
}

/**
 * How a battle was settled: a higher face-up card, one player having no card left when a
 * war needed one (they lose the battle — and the game), or both players running out of
 * cards in the same war (nobody wins; each takes their own cards back).
 */
export type WarDecider = 'higher-card' | 'out-of-cards' | 'both-out';

/** The complete, pure result of fighting one battle (including any chain of wars). */
export interface BattleOutcome {
  /** rounds[0] is the opening flip; every later round is a war. */
  rounds: WarRound[];
  /** Seat that took the cards; null only when both ran out in the same war. */
  winner: WarSeat | null;
  decidedBy: WarDecider;
  /** Seats that had no card left when a war needed one. */
  ranOut: WarSeat[];
  /** Every card each seat put into the middle, in the order it was played. */
  played: Pair<CardCode[]>;
  /**
   * The cards the winner put under their pile, in order: the winner's own cards first,
   * then the loser's, each in play order. Empty when nobody won.
   */
  won: CardCode[];
  /** Both piles after the battle (top = index 0). */
  piles: Pair<CardCode[]>;
  /** How many wars (ties) happened in this battle. */
  wars: number;
}

/** Card strength in War: 2 lowest … King, then Ace highest. Suits never matter. */
export function cardValue(code: CardCode): number {
  return rankNumberAceHigh(code);
}

/** Do two cards tie (same rank, any suit)? */
export function sameRank(a: CardCode, b: CardCode): boolean {
  return cardValue(a) === cardValue(b);
}

export function otherSeat(seat: WarSeat): WarSeat {
  return seat === 0 ? 1 : 0;
}

/** How many cards a player lays face down in a war when they hold `cards` cards (≥ 1). */
export function faceDownCount(cards: number): number {
  return Math.max(0, Math.min(WAR_FACE_DOWN, cards - 1));
}

/**
 * Fight one battle from the given piles (top = index 0). Both piles must hold at least one
 * card. Pure: the inputs are not modified.
 *
 *  1. Both players flip their top card. The higher card wins.
 *  2. A tie is a war: each player lays 3 cards face down and turns 1 face up; a player with
 *     fewer than 4 cards lays all but their last card face down and turns the last one up.
 *     Wars repeat while the face-up cards keep tying.
 *  3. A player with no card left when a war needs one loses the battle. If both are out at
 *     the same moment nobody wins and each takes back exactly the cards they played.
 *  4. The winner puts every card from the middle under their pile: their own cards first,
 *     then the loser's, each in the order they were played.
 */
export function resolveBattle(
  piles: readonly [readonly CardCode[], readonly CardCode[]],
): BattleOutcome {
  const rest: Pair<CardCode[]> = [piles[0].slice(), piles[1].slice()];
  if (rest[0].length === 0 || rest[1].length === 0) {
    throw new Error('War: both players need at least one card to fight a battle');
  }
  const played: Pair<CardCode[]> = [[], []];
  const rounds: WarRound[] = [];
  const turnUp = (seat: WarSeat, faceDown: number): { down: CardCode[]; up: CardCode } => {
    const down = rest[seat].splice(0, faceDown);
    const up = rest[seat].shift();
    if (up === undefined) throw new Error('War: a player has no card to turn face up');
    played[seat].push(...down, up);
    return { down, up };
  };
  const flip = (faceDown: (seat: WarSeat) => number) => {
    const a = turnUp(0, faceDown(0));
    const b = turnUp(1, faceDown(1));
    const round: WarRound = { down: [a.down, b.down], up: [a.up, b.up] };
    rounds.push(round);
    return round;
  };

  let wars = 0;
  const collect = (winner: WarSeat, decidedBy: WarDecider, ranOut: WarSeat[]): BattleOutcome => {
    const won = [...played[winner], ...played[otherSeat(winner)]];
    const after: Pair<CardCode[]> = [rest[0].slice(), rest[1].slice()];
    after[winner] = [...after[winner], ...won];
    return { rounds, winner, decidedBy, ranOut, played, won, piles: after, wars };
  };

  let round = flip(() => 0);
  while (sameRank(round.up[0], round.up[1])) {
    wars++;
    const ranOut = WAR_SEATS.filter((seat) => rest[seat].length === 0);
    if (ranOut.length === SEATS) {
      return {
        rounds,
        winner: null,
        decidedBy: 'both-out',
        ranOut,
        played,
        won: [],
        piles: [played[0].slice(), played[1].slice()],
        wars,
      };
    }
    const out = ranOut[0];
    if (out !== undefined) return collect(otherSeat(out), 'out-of-cards', ranOut);
    round = flip((seat) => faceDownCount(rest[seat].length));
  }
  return collect(cardValue(round.up[0]) > cardValue(round.up[1]) ? 0 : 1, 'higher-card', []);
}

// ------------------------------------------------------------------ words

/** "You" for the learner, "Player 1" for the bot (the UI swaps in the persona's name). */
export function seatLabel(seat: PlayerId): string {
  return seat === 0 ? 'You' : `Player ${seat}`;
}

/** Mid-sentence form: "you" / "Player 1". */
export function seatObject(seat: PlayerId): string {
  return seat === 0 ? 'you' : `Player ${seat}`;
}

/** "your" / "Player 1's". */
export function seatPossessive(seat: PlayerId): string {
  return seat === 0 ? 'your' : `Player ${seat}'s`;
}

/** "Your" / "Player 1's" (sentence start). */
export function seatPossessiveCap(seat: PlayerId): string {
  return seat === 0 ? 'Your' : `Player ${seat}'s`;
}

/** Pick the verb form for a seat: "you win" vs "Player 1 wins". */
export function verbFor(seat: PlayerId, you: string, them: string): string {
  return seat === 0 ? you : them;
}

/** "King", "Ace", "Ten". */
export function rankWord(code: CardCode): string {
  return RANK_NAMES[rankOf(code)];
}

/** "the Queen of Spades". */
export function theCard(code: CardCode): string {
  return `the ${cardName(code)}`;
}

/** "1 card", "26 cards". */
export function cardsLabel(n: number): string {
  return n === 1 ? '1 card' : `${n} cards`;
}
