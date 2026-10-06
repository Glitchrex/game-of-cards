/**
 * Go Fish — pure rules engine (docs/RULES_DECISIONS.md → Go Fish).
 *
 * Seats 0…n−1 (2–5, default 3) play clockwise (seat i → seat i+1); seat 0 is the learner
 * in play mode and asks first by default (it sits on the dealer's left).
 *
 *  1. Setup: one 52-card deck, 7 cards each with 2–3 players, 5 each with 4–5, dealt one at
 *     a time starting with the first player. The rest is spread face down as the pond
 *     (`stock`, next card first). Any four of a kind dealt to a player is laid down as a
 *     book straight away.
 *  2. The only move is `{ type: 'ask', target, rank }`: ask one other player who still has
 *     cards for a rank you already hold. Everything that follows happens inside applyMove
 *     and is recorded, in order, in `state.log`:
 *       - the target holds that rank → they hand over ALL of those cards and you go again;
 *       - otherwise "Go Fish!": you draw the top card of the pond (if any). If it is the
 *         rank you asked for (you "fish your wish") you show it and go again; otherwise the
 *         turn passes to the next seat. With an empty pond the turn simply passes.
 *  3. Four cards of a rank are laid down as a book the moment you hold them (after a catch
 *     or a draw — and after the deal).
 *  4. Whenever a hand becomes empty while the pond has cards, that player draws one card
 *     straight away (the target who handed over their last card first, then the asker, who
 *     then carries on with their turn). With an empty pond a player without cards is out:
 *     the turn passes and they are skipped for the rest of the game.
 *  5. The game ends the moment all 13 books are made. Most books wins; tied seats share.
 *
 * Because an empty hand is refilled at once while the pond lasts, the player to act always
 * has cards and always has someone to ask, so `legalMoves` is never empty mid-game.
 *
 * Betting (winner takes the pot): every seat antes 1 unit; a sole winner gets +(n−1),
 * k tied winners get (n−k)/k each, everyone else −1 (everyone tied = push).
 * There are no optional extra commitments, so `config.affordableUnits` is not used.
 */
import { cardName, makeDeck, rankOf, type CardCode, type Rank } from '@/games/core/cards';
import { shuffle, type Rng } from '@/games/core/rng';
import {
  assertLegal,
  type CoachAdvice,
  type Difficulty,
  type GameConfig,
  type GameEngine,
  type GameResult,
  type MoveCheck,
  type PlayerId,
  type ResultFlags,
} from '@/games/core/types';
import {
  BOOK_SIZE,
  booksLabel,
  countRank,
  handSizeFor,
  heldRanksWords,
  isRank,
  joinWords,
  MAX_PLAYERS,
  MIN_PLAYERS,
  mostBooks,
  payoutUnits,
  perfectBooksFor,
  pronoun,
  rankCountWords,
  rankPlural,
  ranksHeld,
  seatLabel,
  seatObject,
  seatPossessive,
  sortByRank,
  TOTAL_BOOKS,
  verbFor,
} from './rules';
import { easyMove, normalDecision, seatView, situationWords } from './strategy';

export {
  BOOK_SIZE,
  DEFAULT_PLAYERS,
  handSizeFor,
  MAX_LOSS_UNITS,
  MAX_PLAYERS,
  maxWinUnits,
  MIN_PLAYERS,
  mostBooks,
  payoutUnits,
  perfectBooksFor,
  TOTAL_BOOKS,
} from './rules';

export type GoFishPhase = 'play' | 'over';

/**
 * How a book was completed: in the deal, with cards caught from another player, with a
 * Go Fish draw of the rank that was asked for ("fished my wish"), or with a Go Fish draw
 * of a different rank.
 */
export type GoFishBookSource = 'deal' | 'catch' | 'wish' | 'fish';

export interface GoFishBook {
  rank: Rank;
  via: GoFishBookSource;
}

/** One entry of the move history (oldest first). */
export type GoFishEvent =
  /** `got` = how many cards the target handed over (0 = "Go Fish!"). Public. */
  | { type: 'ask'; seat: PlayerId; target: PlayerId; rank: Rank; got: number }
  /**
   * A Go Fish draw from the pond. `card` is HIDDEN information unless `wish` is true (the
   * drawn card is the asked rank, and it is shown to everyone).
   */
  | { type: 'fish'; seat: PlayerId; card: CardCode; wish: boolean }
  /** A player whose hand became empty drew one card from the pond. `card` is HIDDEN. */
  | { type: 'refill'; seat: PlayerId; card: CardCode }
  /** Four of a kind laid down face up. Public. */
  | { type: 'book'; seat: PlayerId; rank: Rank; via: GoFishBookSource }
  /** The player has no cards and the pond is empty: they sit out the rest of the game. */
  | { type: 'out'; seat: PlayerId };

export interface GoFishState {
  players: number;
  /** Cards held by each seat (kept grouped by rank for display). Hidden from other seats. */
  hands: CardCode[][];
  /** The face-down pond; stock[0] is the next card drawn. Hidden. */
  stock: CardCode[];
  /** Books laid down by each seat, in the order they were made. Public. */
  books: GoFishBook[][];
  /** Seat whose decision it is (meaningless once the game is over). */
  turn: PlayerId;
  phase: GoFishPhase;
  /** Seat(s) with the most books once the game is over. */
  winners: PlayerId[];
  log: GoFishEvent[];
  /** Largest (most books held by an opponent − the learner's books) seen so far. */
  maxBehind: number;
}

export type GoFishMove = { type: 'ask'; target: PlayerId; rank: Rank };

/** Game-specific options (config.options). */
export interface GoFishOptions {
  /** Seat that asks first (default 0 — the learner, on the dealer's left). */
  firstPlayer?: number;
}

interface ParsedConfig {
  players: number;
  firstPlayer: PlayerId;
}

function readConfig(config: GameConfig): ParsedConfig {
  const players = config.players;
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new RangeError(
      `Go Fish is played by ${MIN_PLAYERS}–${MAX_PLAYERS} players (got ${String(players)}).`,
    );
  }
  const firstPlayer = config.options?.firstPlayer ?? 0;
  if (
    typeof firstPlayer !== 'number' ||
    !Number.isInteger(firstPlayer) ||
    firstPlayer < 0 ||
    firstPlayer >= players
  ) {
    throw new RangeError(`Go Fish: options.firstPlayer must be a seat from 0 to ${players - 1}.`);
  }
  return { players, firstPlayer };
}

function handOf(state: GoFishState, seat: PlayerId): CardCode[] {
  return state.hands[seat] ?? [];
}

/** Total books laid down so far. */
export function booksMade(state: Pick<GoFishState, 'books'>): number {
  let n = 0;
  for (const b of state.books) n += b.length;
  return n;
}

/** Books per seat. */
export function bookCounts(state: Pick<GoFishState, 'books'>): number[] {
  return state.books.map((b) => b.length);
}

/** Who laid down the book of `rank`, or null if it is still in play. */
export function bookOwner(state: Pick<GoFishState, 'books'>, rank: Rank): PlayerId | null {
  const seat = state.books.findIndex((b) => b.some((x) => x.rank === rank));
  return seat < 0 ? null : seat;
}

/** Seats (other than `player`) that still hold cards, clockwise from `player`'s left. */
export function askableSeats(state: GoFishState, player: PlayerId): PlayerId[] {
  const out: PlayerId[] = [];
  for (let i = 1; i < state.players; i++) {
    const seat = (player + i) % state.players;
    if (handOf(state, seat).length > 0) out.push(seat);
  }
  return out;
}

function behind(books: readonly GoFishBook[][]): number {
  const mine = books[0]?.length ?? 0;
  const best = Math.max(...books.slice(1).map((b) => b.length));
  return best - mine;
}

/** Mutable working copy used while one move is resolved (never escapes applyMove). */
interface Draft {
  hands: CardCode[][];
  stock: CardCode[];
  books: GoFishBook[][];
  log: GoFishEvent[];
}

function draftOf(state: GoFishState): Draft {
  return {
    hands: state.hands.map((h) => h.slice()),
    stock: state.stock.slice(),
    books: state.books.map((b) => b.slice()),
    log: state.log.slice(),
  };
}

/** Lay down `rank` as a book for `seat` if they now hold all four. */
function layBookIfComplete(d: Draft, seat: PlayerId, rank: Rank, via: GoFishBookSource): void {
  const hand = d.hands[seat] ?? [];
  if (countRank(hand, rank) < BOOK_SIZE) return;
  d.hands[seat] = hand.filter((c) => rankOf(c) !== rank);
  d.books[seat] = [...(d.books[seat] ?? []), { rank, via }];
  d.log.push({ type: 'book', seat, rank, via });
}

/** An empty hand draws one card while the pond lasts; otherwise the player is out. */
function refillOrOut(d: Draft, seat: PlayerId): void {
  if ((d.hands[seat] ?? []).length > 0) return;
  const card = d.stock.shift();
  if (card === undefined) {
    d.log.push({ type: 'out', seat });
    return;
  }
  d.hands[seat] = [card];
  d.log.push({ type: 'refill', seat, card });
}

function nextSeatWithCards(d: Draft, from: PlayerId, players: number): PlayerId {
  for (let i = 1; i <= players; i++) {
    const seat = (from + i) % players;
    if ((d.hands[seat] ?? []).length > 0) return seat;
  }
  throw new Error('Go Fish: nobody holds any cards, but the game is not over');
}

function applyAsk(state: GoFishState, move: GoFishMove): GoFishState {
  const seat = state.turn;
  const { target, rank } = move;
  const d = draftOf(state);
  const targetHand = d.hands[target] ?? [];
  const given = targetHand.filter((c) => rankOf(c) === rank);
  let goAgain: boolean;
  if (given.length > 0) {
    d.hands[target] = targetHand.filter((c) => rankOf(c) !== rank);
    d.hands[seat] = sortByRank([...(d.hands[seat] ?? []), ...given]);
    d.log.push({ type: 'ask', seat, target, rank, got: given.length });
    layBookIfComplete(d, seat, rank, 'catch');
    goAgain = true;
  } else {
    d.log.push({ type: 'ask', seat, target, rank, got: 0 });
    const card = d.stock.shift();
    if (card === undefined) {
      goAgain = false;
    } else {
      const wish = rankOf(card) === rank;
      d.hands[seat] = sortByRank([...(d.hands[seat] ?? []), card]);
      d.log.push({ type: 'fish', seat, card, wish });
      layBookIfComplete(d, seat, rankOf(card), wish ? 'wish' : 'fish');
      goAgain = wish;
    }
  }
  const maxBehind = Math.max(state.maxBehind, behind(d.books));
  if (booksMade(d) === TOTAL_BOOKS) {
    return {
      ...state,
      ...d,
      phase: 'over',
      winners: mostBooks(d.books.map((b) => b.length)),
      maxBehind,
    };
  }
  // Empty hands draw while the pond lasts: the target (who emptied first), then the asker.
  refillOrOut(d, target);
  refillOrOut(d, seat);
  const keepsTurn = goAgain && (d.hands[seat] ?? []).length > 0;
  return {
    ...state,
    ...d,
    turn: keepsTurn ? seat : nextSeatWithCards(d, seat, state.players),
    maxBehind,
  };
}

function isAskShape(move: unknown): move is { type: 'ask'; target: unknown; rank: unknown } {
  return typeof move === 'object' && move !== null && (move as { type?: unknown }).type === 'ask';
}

function overReason(state: GoFishState): string {
  const winners = state.winners;
  const who =
    winners.length === 1
      ? `${seatObject(winners[0] ?? 0)} won with the most books`
      : `${joinWords(winners.map(seatObject))} shared the win`;
  return `The game is over — all ${TOTAL_BOOKS} books have been made and ${who}.`;
}

function checkAsk(state: GoFishState, player: PlayerId, move: unknown): MoveCheck {
  if (state.phase === 'over') return { ok: false, reason: overReason(state) };
  if (!isAskShape(move)) {
    return {
      ok: false,
      reason:
        "That isn't a Go Fish move — on your turn, ask another player for a rank you already hold.",
    };
  }
  if (player !== state.turn) {
    return {
      ok: false,
      reason: `It's ${seatPossessive(state.turn)} turn, not ${player === 0 ? 'yours' : seatPossessive(player)} — wait until it comes round to ${seatObject(player)}.`,
    };
  }
  const hand = handOf(state, player);
  const { target, rank } = move;
  if (
    typeof target !== 'number' ||
    !Number.isInteger(target) ||
    target < 0 ||
    target >= state.players
  ) {
    return { ok: false, reason: 'Pick one of the other players at the table to ask.' };
  }
  if (target === player) {
    return {
      ok: false,
      reason: "You can't ask yourself! Pick one of the other players and ask them for a rank.",
    };
  }
  if (!isRank(rank)) {
    return {
      ok: false,
      reason: `Pick a rank to ask for — like ${heldRanksWords(hand, 2)} — from the cards in your hand.`,
    };
  }
  if (countRank(hand, rank) === 0) {
    const owner = bookOwner(state, rank);
    const yours = `Ask for a rank you hold instead, like your ${heldRanksWords(hand)}.`;
    if (owner !== null) {
      const whose = owner === player ? 'your own' : seatPossessive(owner);
      return {
        ok: false,
        reason: `All four ${rankPlural(rank)} are already in ${whose} book, so nobody has any left to give. ${yours}`,
      };
    }
    return {
      ok: false,
      reason: `You can only ask for a rank you already hold — you don't have any ${rankPlural(rank)}. ${yours}`,
    };
  }
  if (handOf(state, target).length === 0) {
    const others = askableSeats(state, player).map(seatObject);
    const hint = others.length > 0 ? ` Ask ${joinWords(others, 'or')} instead.` : '';
    return {
      ok: false,
      reason: `${seatLabel(target)} ${verbFor(target, 'have', 'has')} no cards left, so there's nothing to ask ${seatObject(target)} for.${hint}`,
    };
  }
  return { ok: true };
}

function legalMovesFor(state: GoFishState, player: PlayerId): GoFishMove[] {
  if (state.phase === 'over' || player !== state.turn) return [];
  const ranks = ranksHeld(handOf(state, player));
  const moves: GoFishMove[] = [];
  for (const target of askableSeats(state, player)) {
    for (const rank of ranks) moves.push({ type: 'ask', target, rank });
  }
  return moves;
}

// ------------------------------------------------------------------ result

function computeFlags(state: GoFishState, net: number): ResultFlags {
  const counts = bookCounts(state);
  const mine = counts[0] ?? 0;
  const bestRival = Math.max(...counts.slice(1));
  const won = net > 0;
  const myBooks = state.books[0] ?? [];
  const lastBook = myBooks[myBooks.length - 1];
  const finalBookWished = lastBook?.via === 'wish';
  // That last book decided the game if, without it, you would not have won outright.
  const decisive = mine - bestRival <= 1;
  const tags: string[] = [];
  if (won && state.winners.length > 1) tags.push('sharedWin');
  if (mine === 0) tags.push('noBooks');
  if (myBooks.some((b) => b.via === 'wish')) tags.push('fishedWish');
  if (finalBookWished) tags.push('luckyFinalBook');
  if (state.log.some((e) => e.type === 'out' && e.seat === 0)) tags.push('ranOutOfCards');
  return {
    comeback: won && state.maxBehind >= 3,
    closeFinish: Math.abs(mine - bestRival) === 1,
    luckyLastCard: won && finalBookWished && decisive,
    bigPot: Math.abs(net) >= 3,
    perfect: mine >= perfectBooksFor(state.players),
    bust: false,
    folded: false,
    tags,
  };
}

function summarise(state: GoFishState): string {
  const counts = bookCounts(state);
  const mine = counts[0] ?? 0;
  const winners = state.winners;
  const best = Math.max(...counts);
  if (winners.length === state.players) {
    return `Everyone finished with ${booksLabel(best)}, so nobody wins or loses — it's a push.`;
  }
  if (winners.includes(0) && winners.length === 1) {
    const rivals = counts
      .map((n, seat) => ({ n, seat }))
      .filter((o) => o.seat !== 0)
      .map((o) => `${seatLabel(o.seat)} ${o.n}`);
    return `You collected ${booksLabel(mine)} — the most at the table (${joinWords(rivals)}) — and won the pot!`;
  }
  if (winners.includes(0)) {
    return `You tied with ${joinWords(winners.filter((w) => w !== 0).map(seatObject))} for the most books (${best} each), so you share the pot.`;
  }
  const who =
    winners.length === 1
      ? `${seatLabel(winners[0] ?? 1)} collected the most books (${best})`
      : `${joinWords(winners.map(seatObject))} tied for the most books (${best} each)`;
  return `${who}; you finished with ${booksLabel(mine)}.`;
}

function computeResult(state: GoFishState): GameResult {
  if (state.phase !== 'over') throw new Error('Go Fish: result() called before the game ended');
  const winners = state.winners.slice();
  const net = payoutUnits(0, winners, state.players);
  return {
    winners,
    humanOutcome: net > 0 ? 'win' : net < 0 ? 'loss' : 'push',
    humanNetUnits: net,
    scores: bookCounts(state),
    summary: summarise(state),
    flags: computeFlags(state, net),
  };
}

// ------------------------------------------------------------------ words

/**
 * Describe one event of a resolved ask without revealing secret cards: a bot's Go Fish
 * draw or refill stays face down (a "fished wish" is shown to everyone, so it is named).
 */
function eventWords(e: GoFishEvent): string {
  switch (e.type) {
    case 'ask':
      return e.got > 0
        ? `${seatLabel(e.target)} handed over ${rankCountWords(e.got, e.rank)}.`
        : 'Go Fish!';
    case 'fish': {
      const drew = `${seatLabel(e.seat)} drew`;
      if (e.wish) {
        return `${drew} the ${cardName(e.card)} — the very rank ${pronoun(e.seat)} asked for!`;
      }
      return e.seat === 0
        ? `${drew} the ${cardName(e.card)} from the pond.`
        : `${drew} a card from the pond.`;
    }
    case 'book': {
      const how = e.via === 'fish' ? ' thanks to the card from the pond' : '';
      return `${seatLabel(e.seat)} laid down a book of ${rankPlural(e.rank)}${how}!`;
    }
    case 'refill':
      return e.seat === 0
        ? `Your hand was empty, so you drew the ${cardName(e.card)} from the pond.`
        : `${seatPossessive(e.seat)} hand was empty, so ${pronoun(e.seat)} drew a card from the pond.`;
    case 'out':
      return `${seatLabel(e.seat)} ${verbFor(e.seat, 'have', 'has')} no cards left and the pond is empty, so ${pronoun(e.seat)} are out for the rest of the game.`;
  }
}

function describe(state: GoFishState, player: PlayerId, move: GoFishMove): string {
  const { target, rank } = move as { target?: unknown; rank?: unknown };
  const whom =
    typeof target === 'number' && target >= 0 && target < state.players
      ? seatObject(target)
      : 'another player';
  const askText = `${seatLabel(player)} asked ${whom} for ${isRank(rank) ? rankPlural(rank) : 'a rank'}.`;
  if (!checkAsk(state, player, move).ok) return askText;
  const after = goFishEngine.applyMove(state, move);
  const events = after.log.slice(state.log.length);
  const parts = [askText, ...events.map(eventWords)];
  const first = events[0];
  if (first?.type === 'ask' && first.got === 0 && !events.some((e) => e.type === 'fish')) {
    parts.push('The pond is empty, so there is nothing to draw.');
  }
  if (after.phase === 'over') {
    parts.push('That was the last book — the game is over!');
  } else if (after.turn === player) {
    parts.push(`${seatLabel(player)} ${verbFor(player, 'go', 'goes')} again.`);
  } else {
    parts.push(`Now it's ${seatPossessive(after.turn)} turn.`);
  }
  return parts.join(' ');
}

/** Button label for an ask, e.g. "Ask Player 2 for Sevens" (for GameModule.moveLabel). */
export function askLabel(move: GoFishMove): string {
  return `Ask ${seatObject(move.target)} for ${rankPlural(move.rank)}`;
}

function coachFor(state: GoFishState, player: PlayerId): CoachAdvice {
  if (state.phase === 'over') return { situation: computeResult(state).summary };
  const view = seatView(state, player);
  const situation = situationWords(view, state.turn);
  if (state.turn !== player) return { situation };
  const d = normalDecision(view);
  return { situation, suggestion: d.move, why: d.why };
}

export const goFishEngine: GameEngine<GoFishState, GoFishMove> = {
  id: 'go-fish',

  setup(config: GameConfig, rng: Rng): GoFishState {
    const { players, firstPlayer } = readConfig(config);
    const deck = shuffle(makeDeck(), rng);
    const size = handSizeFor(players);
    // Deal one card at a time, starting with the first player (on the dealer's left).
    const dealt: CardCode[][] = Array.from({ length: players }, () => []);
    for (let i = 0; i < size * players; i++) {
      dealt[(firstPlayer + i) % players]?.push(deck[i] as CardCode);
    }
    const d: Draft = {
      hands: dealt.map(sortByRank),
      stock: deck.slice(size * players),
      books: dealt.map(() => []),
      log: [],
    };
    // Any four of a kind in the deal is laid down at once (a 5- or 7-card hand can hold
    // at most one, and never becomes empty).
    for (let seat = 0; seat < players; seat++) {
      for (const rank of ranksHeld(d.hands[seat] ?? [])) layBookIfComplete(d, seat, rank, 'deal');
    }
    return {
      players,
      ...d,
      turn: firstPlayer,
      phase: 'play',
      winners: [],
      maxBehind: Math.max(0, behind(d.books)),
    };
  },

  currentPlayer(state) {
    return state.phase === 'over' ? null : state.turn;
  },

  legalMoves(state, player) {
    return legalMovesFor(state, player);
  },

  checkMove(state, player, move) {
    return checkAsk(state, player, move);
  },

  applyMove(state, move) {
    assertLegal(goFishEngine, state, move);
    return applyAsk(state, move);
  },

  isOver(state) {
    return state.phase === 'over';
  },

  result(state) {
    return computeResult(state);
  },

  botMove(state, player, difficulty: Difficulty, rng) {
    if (state.phase === 'over' || player !== state.turn) {
      throw new Error(`Go Fish: botMove called for seat ${player}, but it is not their turn`);
    }
    const view = seatView(state, player);
    return difficulty === 'easy' ? easyMove(view, rng) : normalDecision(view).move;
  },

  describeMove(state, player, move) {
    return describe(state, player, move);
  },

  coach(state, player) {
    return coachFor(state, player);
  },

  moveKey(move) {
    return `ask:${move.target}:${move.rank}`;
  },
};

export default goFishEngine;
