/**
 * War — pure rules engine (docs/RULES_DECISIONS.md → War, docs/engine-notes/war.md).
 *
 * Two seats: the learner (seat 0) against one bot (seat 1). Nobody makes a real decision in
 * War, so the engine keeps the UI as simple as possible:
 *
 *  - currentPlayer is ALWAYS seat 0 while the game runs. The only move is { type: 'flip' }:
 *    both players turn their top card at once and the whole battle is fought in that one
 *    move — including any chain of wars. The bot never moves on its own. (In simulations
 *    the learner's seat is driven by botMove, which always flips.)
 *  - state.lastBattle keeps every card that was turned (rounds[0] = the opening flip, later
 *    rounds = wars) so the board can animate the battle step by step.
 *
 * Rules:
 *  1. Setup: one shuffled 52-card deck dealt alternately (learner first), 26 cards each,
 *     face down. Pile top = index 0.
 *  2. A battle: both flip their top card; the higher rank wins (2 lowest … King, Ace
 *     highest; suits never matter). The winner puts both cards under their pile.
 *  3. A tie is a war: each lays 3 cards face down and turns 1 face up; the higher face-up
 *     card takes everything. Ties repeat the war. A player with fewer than 4 cards lays all
 *     but their last card face down and turns the last one up. A player with no card left
 *     when a war needs one loses the battle (and with it the game, since the other player
 *     then holds all 52 cards). If BOTH run out in the same war nobody can go on: each takes
 *     back the cards they played and the game is a push.
 *  4. Won cards go to the bottom of the winner's pile in a fixed order: the winner's own
 *     cards first, then the loser's, each in the order they were played.
 *  5. The game ends when one player has all 52 cards, or after `maxBattles` battles
 *     (default 60 — the beginner length cap), when whoever holds more cards wins; equal
 *     piles are a push. A chain of wars counts as one battle.
 *
 * Betting: win +1 unit, lose −1, push 0 (`maxLossUnits` 1). There are no optional extra
 * commitments, so `config.affordableUnits` does not affect War.
 */
import { cardName, makeDeck, type CardCode } from '@/games/core/cards';
import { shuffle, type Rng } from '@/games/core/rng';
import {
  assertLegal,
  type CoachAdvice,
  type GameConfig,
  type GameEngine,
  type GameResult,
  type MoveCheck,
  type PlayerId,
  type ResultFlags,
} from '@/games/core/types';
import {
  cardsLabel,
  CLOSE_FINISH_MARGIN,
  COMEBACK_THRESHOLD,
  DECK_SIZE,
  DEFAULT_MAX_BATTLES,
  HALF_DECK,
  MAX_BATTLES_LIMIT,
  otherSeat,
  rankWord,
  resolveBattle,
  sameRank,
  seatLabel,
  seatObject,
  seatPossessive,
  seatPossessiveCap,
  SEATS,
  theCard,
  verbFor,
  WAR_FACE_DOWN,
  type BattleOutcome,
  type Pair,
  type WarDecider,
  type WarRound,
  type WarSeat,
} from './rules';

export {
  cardValue,
  CLOSE_FINISH_MARGIN,
  COMEBACK_THRESHOLD,
  DECK_SIZE,
  DEFAULT_MAX_BATTLES,
  faceDownCount,
  HALF_DECK,
  MAX_BATTLES_LIMIT,
  MAX_LOSS_UNITS,
  resolveBattle,
  sameRank,
  SEATS,
  WAR_FACE_DOWN,
} from './rules';
export type { BattleOutcome, Pair, WarDecider, WarRound, WarSeat } from './rules';

export type WarPhase = 'play' | 'over';
/**
 * How the game ended: someone collected all 52 cards, the battle cap was reached, or both
 * players ran out of cards in the same war.
 */
export type WarEndReason = 'all-cards' | 'battle-cap' | 'both-out';

/** Everything the board needs to show (and animate) the most recent battle. */
export interface WarBattle {
  /** 1-based battle number. */
  number: number;
  /** rounds[0] = the opening flip; every later round is a war. Face-down cards are hidden. */
  rounds: WarRound[];
  /** Seat that took the cards; null only when both ran out in the same war. */
  winner: WarSeat | null;
  decidedBy: WarDecider;
  /** Seats that had no card left when a war needed one. */
  ranOut: WarSeat[];
  /** Cards that went under the winner's pile, in order (winner's first, then the loser's). */
  won: CardCode[];
  /** Number of wars (ties) in this battle. */
  wars: number;
  /** Pile sizes after the battle. */
  counts: Pair<number>;
}

/** Compact record of one finished battle (oldest first) — used for flags and the summary. */
export interface WarBattleRecord {
  winner: WarSeat | null;
  /** Number of wars (ties) in the battle. */
  wars: number;
  /** Cards that were in the middle. */
  cards: number;
  /** Pile sizes after the battle. */
  counts: Pair<number>;
}

export interface WarState {
  /** Each seat's face-down pile; index 0 is the top card (the next one flipped). Hidden. */
  piles: Pair<CardCode[]>;
  /** Battles fought so far. */
  battles: number;
  /** The game stops after this many battles (options.maxBattles, default 60). */
  maxBattles: number;
  /** The most recent battle, or null before the first flip. */
  lastBattle: WarBattle | null;
  history: WarBattleRecord[];
  phase: WarPhase;
  /** Game winner once over; null while playing or when the game is a push. */
  winner: WarSeat | null;
  endReason: WarEndReason | null;
}

/** The only move in War: flip the top card (both players flip together). */
export type WarMove = { type: 'flip' };

/** Game-specific options (config.options). */
export interface WarOptions {
  /** Battles before the game stops and the bigger pile wins (1–1000, default 60). */
  maxBattles?: number;
}

const FLIP: WarMove = { type: 'flip' };

function readConfig(config: GameConfig): { maxBattles: number } {
  if (config.players !== SEATS) {
    throw new RangeError(
      `War is played by exactly ${SEATS} players — you against one opponent (got ${String(config.players)}).`,
    );
  }
  const maxBattles = config.options?.maxBattles ?? DEFAULT_MAX_BATTLES;
  if (
    typeof maxBattles !== 'number' ||
    !Number.isInteger(maxBattles) ||
    maxBattles < 1 ||
    maxBattles > MAX_BATTLES_LIMIT
  ) {
    throw new RangeError(
      `War: options.maxBattles must be a whole number from 1 to ${MAX_BATTLES_LIMIT}.`,
    );
  }
  return { maxBattles };
}

function counts(piles: Pair<readonly CardCode[]>): Pair<number> {
  return [piles[0].length, piles[1].length];
}

function isMoveShape(move: unknown): move is WarMove {
  return typeof move === 'object' && move !== null && (move as { type?: unknown }).type === 'flip';
}

/** Seat ahead on cards, or null when the piles are equal. */
function leader(c: Pair<number>): WarSeat | null {
  return c[0] === c[1] ? null : c[0] > c[1] ? 0 : 1;
}

// ------------------------------------------------------------------ legality

function overReason(state: WarState): string {
  const c = counts(state.piles);
  if (state.endReason === 'all-cards') {
    const w = state.winner ?? 0;
    return `The game is over — ${seatObject(w)} won all ${DECK_SIZE} cards.`;
  }
  if (state.endReason === 'both-out') {
    return 'The game is over — you both ran out of cards in the same war, so it ended in a tie.';
  }
  const fought =
    state.maxBattles === 1
      ? 'the only battle has been fought'
      : `all ${state.maxBattles} battles have been fought`;
  return `The game is over — ${fought} (you finished with ${cardsLabel(c[0])}, Player 1 with ${cardsLabel(c[1])}).`;
}

function checkMoveFor(state: WarState, player: PlayerId, move: unknown): MoveCheck {
  if (state.phase === 'over') return { ok: false, reason: overReason(state) };
  if (!Number.isInteger(player) || player < 0 || player >= SEATS) {
    return { ok: false, reason: 'War has just two players: you and Player 1.' };
  }
  if (player !== 0) {
    return {
      ok: false,
      reason: `${seatLabel(player)} never flips alone — in this game one Flip turns over both players' top cards together, and it's always your turn to press it.`,
    };
  }
  if (!isMoveShape(move)) {
    return {
      ok: false,
      reason:
        "That isn't a War move. In War nobody chooses a card — the only thing you can do is flip the top card of your pile.",
    };
  }
  return { ok: true };
}

// ------------------------------------------------------------------ transition

function applyFlip(state: WarState): WarState {
  const outcome = resolveBattle(state.piles);
  const battles = state.battles + 1;
  const after = counts(outcome.piles);
  const lastBattle: WarBattle = {
    number: battles,
    rounds: outcome.rounds,
    winner: outcome.winner,
    decidedBy: outcome.decidedBy,
    ranOut: outcome.ranOut,
    won: outcome.won,
    wars: outcome.wars,
    counts: after,
  };
  const record: WarBattleRecord = {
    winner: outcome.winner,
    wars: outcome.wars,
    cards: outcome.played[0].length + outcome.played[1].length,
    counts: [after[0], after[1]],
  };
  const next: WarState = {
    ...state,
    piles: outcome.piles,
    battles,
    lastBattle,
    history: [...state.history, record],
  };
  if (outcome.decidedBy === 'both-out') {
    return { ...next, phase: 'over', winner: null, endReason: 'both-out' };
  }
  if (after[0] === 0 || after[1] === 0) {
    return { ...next, phase: 'over', winner: after[0] > 0 ? 0 : 1, endReason: 'all-cards' };
  }
  if (battles >= state.maxBattles) {
    return { ...next, phase: 'over', winner: leader(after), endReason: 'battle-cap' };
  }
  return next;
}

// ------------------------------------------------------------------ result

/** Fewest cards the seat held at the end of any battle (26 if it never dropped). */
export function lowestCount(state: WarState, seat: WarSeat): number {
  return state.history.reduce((low, r) => Math.min(low, r.counts[seat]), HALF_DECK);
}

/** Battles that went to war and were won by `seat`. */
export function warsWonBy(state: WarState, seat: WarSeat): number {
  return state.history.filter((r) => r.wars > 0 && r.winner === seat).length;
}

/**
 * Did the final battle's war decide the game for the learner? True when the learner won
 * that war and, had Player 1 taken the cards in the middle instead, the learner would NOT
 * have been ahead on cards. (A war won from far ahead, or one the bot could not even fight
 * with its last few cards, was never in doubt — that is not a lucky last card.)
 */
export function lastWarDecided(state: WarState): boolean {
  const last = state.lastBattle;
  if (!last || last.wars === 0 || last.winner !== 0) return false;
  const middle = last.won.length;
  return last.counts[0] - middle <= last.counts[1] + middle;
}

function computeFlags(state: WarState, outcome: GameResult['humanOutcome']): ResultFlags {
  const won = outcome === 'win';
  const c = counts(state.piles);
  const warsWon = warsWonBy(state, 0);
  const tags: string[] = state.endReason ? [state.endReason] : [];
  if (warsWon > 0) tags.push('war-won', `war-won:${warsWon}`);
  if (state.history.some((r) => r.wars >= 2)) tags.push('double-war');
  return {
    comeback: won && lowestCount(state, 0) <= COMEBACK_THRESHOLD,
    closeFinish: state.endReason === 'battle-cap' && Math.abs(c[0] - c[1]) <= CLOSE_FINISH_MARGIN,
    luckyLastCard: won && lastWarDecided(state),
    bigPot: false,
    perfect: false,
    bust: false,
    folded: false,
    tags,
  };
}

function summarise(state: WarState): string {
  const c = counts(state.piles);
  const n = state.battles;
  const inBattles = n === 1 ? 'in a single battle' : `in ${n} battles`;
  if (state.endReason === 'both-out') {
    return `You both ran out of cards in the same war after ${n === 1 ? '1 battle' : `${n} battles`}, so nobody could carry on — it's a tie and your stake comes back (a push).`;
  }
  if (state.endReason === 'all-cards') {
    const w = state.winner ?? 0;
    const ranOut = state.lastBattle?.decidedBy === 'out-of-cards';
    if (w === 0) {
      return ranOut
        ? `Player 1 ran out of cards in the middle of a war, so you won all ${DECK_SIZE} cards ${inBattles} — total victory!`
        : `You won all ${DECK_SIZE} cards ${inBattles} — total victory!`;
    }
    return ranOut
      ? `You ran out of cards in the middle of a war, so Player 1 took all ${DECK_SIZE} cards ${inBattles}.`
      : `Player 1 won all ${DECK_SIZE} cards ${inBattles}, so this game goes to them.`;
  }
  const after = `After ${n === 1 ? '1 battle' : `${n} battles`}`;
  if (c[0] === c[1]) {
    return `${after} you each held ${c[0]} cards — a perfect tie, so it's a push.`;
  }
  return c[0] > c[1]
    ? `${after} you held ${c[0]} cards to Player 1's ${c[1]}, so you win!`
    : `${after} Player 1 held ${c[1]} cards to your ${c[0]}, so Player 1 wins this one.`;
}

function computeResult(state: WarState): GameResult {
  if (state.phase !== 'over') throw new Error('War: result() called before the game ended');
  const humanOutcome = state.winner === 0 ? 'win' : state.winner === 1 ? 'loss' : 'push';
  return {
    winners: state.winner === null ? [] : [state.winner],
    humanOutcome,
    humanNetUnits: humanOutcome === 'win' ? 1 : humanOutcome === 'loss' ? -1 : 0,
    scores: counts(state.piles),
    summary: summarise(state),
    flags: computeFlags(state, humanOutcome),
  };
}

// ------------------------------------------------------------------ words

/** "both cards" / "all 10 cards". */
function allOf(total: number): string {
  return total === 2 ? 'both cards' : `all ${total} cards`;
}

/** How a seat placed its cards in a war round. */
function placement(seat: WarSeat, round: WarRound): string {
  const down = round.down[seat].length;
  const who = seatLabel(seat);
  if (down === WAR_FACE_DOWN)
    return `${who} laid ${WAR_FACE_DOWN} cards face down and flipped one more`;
  if (down === 0) return `${who} had just one card left and flipped it`;
  return `${who} had only ${down + 1} cards left, so ${verbFor(seat, 'you', 'they')} laid ${down} face down and flipped ${verbFor(seat, 'your', 'their')} last card`;
}

function warRoundWords(round: WarRound): string {
  const both = round.down[0].length === WAR_FACE_DOWN && round.down[1].length === WAR_FACE_DOWN;
  const placed = both
    ? `You each laid ${WAR_FACE_DOWN} cards face down and flipped one more`
    : `${placement(0, round)}, and ${placement(1, round)}`;
  return `${placed}: your ${cardName(round.up[0])} against Player 1's ${cardName(round.up[1])}`;
}

/** Full description of a battle (from the learner's seat). Never names face-down cards. */
export function describeBattle(outcome: BattleOutcome): string {
  const first = outcome.rounds[0];
  if (!first) return 'You flipped.';
  let text = `You flipped ${theCard(first.up[0])} and Player 1 flipped ${theCard(first.up[1])}`;
  outcome.rounds.forEach((round, i) => {
    if (i > 0) text += ` ${warRoundWords(round)}`;
    if (sameRank(round.up[0], round.up[1])) {
      text += i === 0 ? " — a tie, so it's War!" : " — another tie, so it's War again!";
    }
  });
  const total = outcome.played[0].length + outcome.played[1].length;
  const last = outcome.rounds[outcome.rounds.length - 1] ?? first;
  if (outcome.decidedBy === 'both-out') {
    return `${text} But neither of you has a card left to fight with, so you each take your own cards back.`;
  }
  const w = outcome.winner ?? 0;
  const takes = verbFor(w, 'take', 'takes');
  if (outcome.decidedBy === 'out-of-cards') {
    const loser = otherSeat(w);
    return `${text} But ${seatObject(loser)} ${verbFor(loser, 'have', 'has')} no cards left to fight the war, so ${seatObject(w)} ${takes} ${allOf(total)}.`;
  }
  const rank = rankWord(last.up[w]);
  if (outcome.wars === 0) {
    return `${text} — ${seatPossessive(w)} ${rank} is higher, so ${seatObject(w)} ${verbFor(w, 'win', 'wins')} both cards.`;
  }
  return `${text}. ${seatPossessiveCap(w)} ${rank} is higher, so ${seatObject(w)} ${verbFor(w, 'win', 'wins')} the war and ${takes} all ${total} cards.`;
}

function endWords(state: WarState): string {
  if (state.endReason === 'all-cards') {
    return state.winner === 0
      ? ` You now have all ${DECK_SIZE} cards — you win the game!`
      : ` Player 1 now has all ${DECK_SIZE} cards and wins the game.`;
  }
  if (state.endReason === 'both-out') return ' The game ends in a tie.';
  if (state.endReason === 'battle-cap') {
    const c = counts(state.piles);
    const verdict =
      state.winner === 0
        ? 'so you win!'
        : state.winner === 1
          ? 'so Player 1 wins.'
          : "so it's a tie — a push.";
    return ` That was battle ${state.battles}, the last one: you have ${c[0]} cards and Player 1 has ${c[1]}, ${verdict}`;
  }
  return '';
}

function describe(state: WarState, player: PlayerId, move: WarMove): string {
  const check = checkMoveFor(state, player, move);
  if (!check.ok) return check.reason ?? `${seatLabel(player)} can't flip right now.`;
  const next = applyFlip(state);
  return describeBattle(resolveBattle(state.piles)) + endWords(next);
}

/** One short clause about the most recent battle, for the coach. */
function lastBattleWords(b: WarBattle): string {
  const last = b.rounds[b.rounds.length - 1];
  if (!last) return '';
  const total = b.won.length;
  if (b.decidedBy === 'both-out') return 'Last battle: you both ran out of cards in the same war.';
  const w = b.winner ?? 0;
  const l = otherSeat(w);
  if (b.decidedBy === 'out-of-cards') {
    return `Last battle: a war, and ${seatObject(l)} had no cards left to fight it, so ${seatObject(w)} took ${allOf(total)}.`;
  }
  const beat = `${seatPossessive(w)} ${rankWord(last.up[w])} beat ${seatPossessive(l)} ${rankWord(last.up[l])}`;
  if (b.wars === 0) return `Last battle: ${beat}.`;
  const war = b.wars === 1 ? 'a war' : b.wars === 2 ? 'a double war' : `${b.wars} wars in a row`;
  return `Last battle: ${war}! In the end ${beat}, so ${seatObject(w)} took all ${total} cards.`;
}

const WHY_BASE =
  "War is pure luck — nobody chooses which card comes up, so there's no wrong move: just flip! The higher card wins (2 is lowest, Ace is highest, suits don't matter).";
const WHY_WAR = `If the two cards tie, it's a war: each of you lays ${WAR_FACE_DOWN} cards face down and flips one more, and the higher of those takes everything in the middle.`;

/** Did every war round in this battle have the full 3 face-down cards on both sides? */
function fullWars(b: WarBattle): boolean {
  return b.rounds
    .slice(1)
    .every((r) => r.down[0].length === WAR_FACE_DOWN && r.down[1].length === WAR_FACE_DOWN);
}

/** The coach's "why" after a battle that went to war (always won with a higher card mid-game). */
function lastWarWhy(b: WarBattle): string {
  const laid = fullWars(b)
    ? `laid ${WAR_FACE_DOWN} cards face down and flipped one more`
    : `laid cards face down (fewer than ${WAR_FACE_DOWN} if you were running short) and flipped one more`;
  if (b.wars === 1) {
    return `That last battle was a war: the first cards tied, so you each ${laid} — and the higher new card took every card in the middle.`;
  }
  const what = b.wars === 2 ? 'a double war' : `${b.wars} wars in a row`;
  const times = b.wars === 2 ? 'twice' : `${b.wars} times`;
  return `That last battle was ${what}: the cards kept tying, so you each ${laid}, ${times} over — and the higher card in the last war took every card in the middle.`;
}

/** Encouragement for a learner who is low on cards (≤ 10), true to what a war could bring. */
function lowOnCardsWhy(c: Pair<number>): string {
  // A full war needs 5 cards each: the tied card, 3 face down and 1 face up.
  const fullWar = WAR_FACE_DOWN + 2;
  if (c[0] >= fullWar && c[1] >= fullWar) {
    return `You're low on cards, but don't give up — win a single war and you take all ${2 * fullWar} cards in the middle at once.`;
  }
  return "You're low on cards, but don't give up — even your last card can win a battle, and a lucky war brings a whole bunch of cards back.";
}

function coachFor(state: WarState, player: PlayerId): CoachAdvice {
  if (state.phase === 'over') return { situation: computeResult(state).summary };
  const c = counts(state.piles);
  const next = state.battles + 1;
  const left = state.maxBattles - state.battles;
  const parts: string[] = [];
  if (state.battles === 0) {
    const dealt =
      c[0] === c[1]
        ? `you and Player 1 have ${c[0]} cards each`
        : `you have ${cardsLabel(c[0])} and Player 1 has ${cardsLabel(c[1])}`;
    parts.push(
      `The cards are dealt: ${dealt}, face down. Flip to start battle 1 of ${state.maxBattles} — you each turn over your top card and the higher one wins both.`,
    );
  } else {
    parts.push(
      `Battle ${next} of ${state.maxBattles} is next. You have ${cardsLabel(c[0])} and Player 1 has ${cardsLabel(c[1])}.`,
    );
    if (state.lastBattle) parts.push(lastBattleWords(state.lastBattle));
  }
  if (left <= 5) {
    parts.push(
      left === 1
        ? `This is the last battle — after it, whoever holds more cards wins.`
        : `Only ${left} battles left — after battle ${state.maxBattles}, whoever holds more cards wins.`,
    );
  }
  const situation = parts.join(' ');
  if (player !== 0) {
    return {
      situation: `${situation} ${seatLabel(player)} never acts alone: each Flip turns over both players' cards.`,
    };
  }
  let why = `${WHY_BASE} ${WHY_WAR}`;
  if (state.lastBattle && state.lastBattle.wars > 0) {
    why = `${WHY_BASE} ${lastWarWhy(state.lastBattle)}`;
  } else if (state.battles > 0 && c[0] <= 10) {
    why = `${WHY_BASE} ${lowOnCardsWhy(c)}`;
  } else if (state.battles > 0 && c[0] >= DECK_SIZE - 10) {
    why = `${WHY_BASE} You're well ahead, but Aces and wars can still turn things around, so keep flipping!`;
  }
  return { situation, suggestion: { ...FLIP }, why };
}

// ------------------------------------------------------------------ engine

export const warEngine: GameEngine<WarState, WarMove> = {
  id: 'war',

  setup(config: GameConfig, rng: Rng): WarState {
    const { maxBattles } = readConfig(config);
    const deck = shuffle(makeDeck(), rng);
    // Dealt one at a time, alternately, starting with the learner.
    const piles: Pair<CardCode[]> = [
      deck.filter((_, i) => i % SEATS === 0),
      deck.filter((_, i) => i % SEATS === 1),
    ];
    return {
      piles,
      battles: 0,
      maxBattles,
      lastBattle: null,
      history: [],
      phase: 'play',
      winner: null,
      endReason: null,
    };
  },

  currentPlayer(state) {
    return state.phase === 'over' ? null : 0;
  },

  legalMoves(state, player) {
    return state.phase === 'over' || player !== 0 ? [] : [{ ...FLIP }];
  },

  checkMove(state, player, move) {
    return checkMoveFor(state, player, move);
  },

  applyMove(state, move) {
    assertLegal(warEngine, state, move);
    return applyFlip(state);
  },

  isOver(state) {
    return state.phase === 'over';
  },

  result(state) {
    return computeResult(state);
  },

  botMove(state, player) {
    // Difficulty is irrelevant: War has no decisions, the only move is to flip.
    const check = checkMoveFor(state, player, FLIP);
    if (!check.ok) throw new Error(`War: botMove called for seat ${player}: ${check.reason}`);
    return { ...FLIP };
  },

  describeMove(state, player, move) {
    return describe(state, player, move);
  },

  coach(state, player) {
    return coachFor(state, player);
  },

  moveKey(move) {
    return move.type;
  },
};

export default warEngine;
