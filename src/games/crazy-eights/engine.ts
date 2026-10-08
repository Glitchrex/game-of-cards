/**
 * Crazy Eights — pure rules engine (docs/RULES_DECISIONS.md → Crazy Eights).
 *
 * Seats 0…n−1 (2–4, default 3) play clockwise (seat i → seat i+1); seat 0 is the learner
 * in play mode and plays first by default (it sits on the dealer's left).
 *
 *  1. Setup: one 52-card deck, 7 cards each with 2 players, 5 each with 3–4. The next card
 *     is turned up as the starter of the discard pile; if it is an Eight it is buried at a
 *     random spot in the bottom half of the stock and the next card is turned instead
 *     (state.buried lists the buried Eights — everyone saw them).
 *  2. A turn: play one card that matches the active suit (the top card's suit, or the suit
 *     named with an Eight) or the top card's rank. Eights are wild — play one any time and
 *     name the next suit ({ type: 'play', card, suit }). You may draw one card instead
 *     ({ type: 'draw' }, allowed whenever there is something to draw); after drawing you
 *     keep the turn and may play, or draw again. If nothing is playable you must draw,
 *     one card at a time, until you can play. If the stock is empty and you cannot play,
 *     you pass ({ type: 'pass' }).
 *  3. The first player to empty their hand wins at once.
 *  4. Blocked game: when the stock is empty and nobody at the table can play, the game ends
 *     immediately (it is exactly what a full round of passes would show). The lowest
 *     penalty total in hand wins (Eight 50, K/Q/J/10 10, Ace 1, others their number);
 *     tied seats share the win.
 *  5. House rule, off by default (options.reshuffle): when someone wants to draw from an
 *     empty stock, the discard pile except its top card is shuffled (with state.rngState)
 *     into a new stock — at most MAX_RESHUFFLES times per game, so every game terminates.
 *
 * Betting (winner takes the pot): every loser pays 1 unit; a sole winner gets +(n−1),
 * k tied winners (blocked game) share it, (n−k)/k each; everyone tied = push (0).
 */
import {
  cardName,
  cardShort,
  isCardCode,
  makeDeck,
  sortHand,
  suitOf,
  SUIT_NAMES,
  SUITS,
  type CardCode,
  type Suit,
} from '@/games/core/cards';
import { rngFromState, shuffle, type Rng } from '@/games/core/rng';
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
  canPlay,
  cardsLabel,
  checkPlayCard,
  handPoints,
  handSizeFor,
  isEight,
  isSuit,
  joinWords,
  listSeats,
  lowestSeats,
  MAX_PLAYERS,
  MAX_RESHUFFLES,
  MIN_PLAYERS,
  payoutUnits,
  playableCards,
  pointsLabel,
  seatLabel,
  seatObject,
  seatPossessive,
  shortList,
  verbFor,
  type Pile,
} from './rules';
import { easyMove, normalDecision, playContextOf, seatView, situationWords } from './strategy';

export {
  canPlay,
  cardPoints,
  handPoints,
  handSizeFor,
  isEight,
  MAX_LOSS_UNITS,
  MAX_PLAYERS,
  MAX_RESHUFFLES,
  MIN_PLAYERS,
  DEFAULT_PLAYERS,
  EIGHT_POINTS,
  payoutUnits,
  playableCards,
} from './rules';

export type CrazyEightsPhase = 'play' | 'over';
/** How the game ended: someone emptied their hand, or nobody could play (blocked). */
export type CrazyEightsEndReason = 'out' | 'blocked';

/** One entry of the move history (oldest first). */
export type CrazyEightsEvent =
  /** `suit` = the suit to follow after this play (the named suit for an Eight). */
  | { type: 'play'; seat: PlayerId; card: CardCode; suit: Suit }
  /**
   * `card` is the drawn card — HIDDEN information (only the drawer may see it);
   * `facing` is the suit that was needed at the time (public).
   */
  | { type: 'draw'; seat: PlayerId; card: CardCode; facing: Suit; reshuffled: boolean }
  | { type: 'pass'; seat: PlayerId };

export interface CrazyEightsState {
  players: number;
  /** Cards held by each seat (kept sorted for display). */
  hands: CardCode[][];
  /** Face-down stock; stock[0] is the next card drawn. Hidden. */
  stock: CardCode[];
  /** Face-up discard pile, oldest first; the last card is the top. */
  discard: CardCode[];
  /** The card turned up to start the discard pile. */
  starter: CardCode;
  /** Eights that were turned up at the start and buried back in the stock (public). */
  buried: CardCode[];
  /** The suit the next card must match: the top card's suit, or the suit named for an Eight. */
  activeSuit: Suit;
  /** Seat whose decision it is (meaningless once the game is over). */
  turn: PlayerId;
  phase: CrazyEightsPhase;
  /** Winning seat(s) once the game is over (several only in a tied blocked game). */
  winners: PlayerId[];
  endReason: CrazyEightsEndReason | null;
  log: CrazyEightsEvent[];
  /** Cards drawn by each seat during the game. */
  draws: number[];
  /** Cards the current player has drawn on this turn so far. */
  drawnThisTurn: number;
  /** Largest (learner's cards − fewest cards held by an opponent) seen so far. */
  maxBehind: number;
  /** House rule: refill an empty stock from the discard pile (options.reshuffle). */
  reshuffle: boolean;
  /** Reshuffles done so far (≤ MAX_RESHUFFLES). */
  reshuffles: number;
  /** RNG state for reshuffles (rngFromState). */
  rngState: number;
}

export type CrazyEightsMove =
  { type: 'play'; card: CardCode; suit?: Suit } | { type: 'draw' } | { type: 'pass' };

/** Game-specific options (config.options). */
export interface CrazyEightsOptions {
  /** House rule: shuffle the discard pile into a new stock when the stock runs out. Default false. */
  reshuffle?: boolean;
  /** Seat that plays first (default 0 — the learner, on the dealer's left). */
  firstPlayer?: number;
}

interface ParsedConfig {
  players: number;
  reshuffle: boolean;
  firstPlayer: PlayerId;
}

function readConfig(config: GameConfig): ParsedConfig {
  const players = config.players;
  if (!Number.isInteger(players) || players < MIN_PLAYERS || players > MAX_PLAYERS) {
    throw new RangeError(
      `Crazy Eights is played by ${MIN_PLAYERS}–${MAX_PLAYERS} players (got ${String(players)}).`,
    );
  }
  const opts = config.options ?? {};
  const reshuffle = opts.reshuffle ?? false;
  if (typeof reshuffle !== 'boolean') {
    throw new RangeError('Crazy Eights: options.reshuffle must be true or false.');
  }
  const firstPlayer = opts.firstPlayer ?? 0;
  if (
    typeof firstPlayer !== 'number' ||
    !Number.isInteger(firstPlayer) ||
    firstPlayer < 0 ||
    firstPlayer >= players
  ) {
    throw new RangeError(
      `Crazy Eights: options.firstPlayer must be a seat from 0 to ${players - 1}.`,
    );
  }
  return { players, reshuffle, firstPlayer };
}

const sortCards = (cards: readonly CardCode[]) => sortHand(cards, { aceHigh: false });

/**
 * Put each buried Eight at a random spot in the bottom half of the finished stock (index
 * ≥ length / 2, so never in the top half or the exact middle); the other cards keep their order.
 */
function buryInBottomHalf(
  stock: readonly CardCode[],
  eights: readonly CardCode[],
  rng: Rng,
): CardCode[] {
  const length = stock.length + eights.length;
  const free: number[] = [];
  for (let i = Math.ceil(length / 2); i < length; i++) free.push(i);
  const at = new Map<number, CardCode>();
  for (const eight of eights) {
    const [slot] = free.splice(rng.int(free.length), 1);
    if (slot !== undefined) at.set(slot, eight);
  }
  const out: CardCode[] = [];
  let next = 0;
  for (let i = 0; i < length; i++) {
    const card = at.get(i) ?? stock[next++];
    if (card !== undefined) out.push(card);
  }
  return out;
}

function topCard(state: CrazyEightsState): CardCode {
  const top = state.discard[state.discard.length - 1];
  if (top === undefined) throw new Error('Crazy Eights: the discard pile is empty');
  return top;
}

function pileOf(state: CrazyEightsState): Pile {
  return { top: topCard(state), activeSuit: state.activeSuit };
}

function handOf(state: CrazyEightsState, seat: PlayerId): CardCode[] {
  return state.hands[seat] ?? [];
}

/** Can the discard pile be turned into a new stock right now (house rule)? */
export function canReshuffle(state: CrazyEightsState): boolean {
  return (
    state.reshuffle &&
    state.stock.length === 0 &&
    state.discard.length > 1 &&
    state.reshuffles < MAX_RESHUFFLES
  );
}

/** Is there anything to draw (stock cards, or an allowed reshuffle)? */
export function canDraw(state: CrazyEightsState): boolean {
  return state.stock.length > 0 || canReshuffle(state);
}

/** Nothing to draw and no seat holds a playable card: the game is stuck. */
export function isBlocked(state: CrazyEightsState): boolean {
  if (canDraw(state)) return false;
  const pile = pileOf(state);
  return state.hands.every((h) => !h.some((c) => canPlay(c, pile)));
}

function behind(hands: readonly CardCode[][]): number {
  const mine = hands[0]?.length ?? 0;
  const fewest = Math.min(...hands.slice(1).map((h) => h.length));
  return mine - fewest;
}

/** Common bookkeeping after every move: comeback tracking and the end-of-game checks. */
function settle(state: CrazyEightsState, mover: PlayerId): CrazyEightsState {
  const maxBehind = Math.max(state.maxBehind, behind(state.hands));
  if (handOf(state, mover).length === 0) {
    return { ...state, maxBehind, phase: 'over', winners: [mover], endReason: 'out' };
  }
  if (isBlocked(state)) {
    const winners = lowestSeats(state.hands.map(handPoints));
    return { ...state, maxBehind, phase: 'over', winners, endReason: 'blocked' };
  }
  return { ...state, maxBehind };
}

function applyPlay(
  state: CrazyEightsState,
  card: CardCode,
  named: Suit | undefined,
): CrazyEightsState {
  const seat = state.turn;
  const activeSuit = isEight(card) && named ? named : suitOf(card);
  const next: CrazyEightsState = {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? h.filter((c) => c !== card) : h)),
    discard: [...state.discard, card],
    activeSuit,
    log: [...state.log, { type: 'play', seat, card, suit: activeSuit }],
    drawnThisTurn: 0,
    turn: (seat + 1) % state.players,
  };
  return settle(next, seat);
}

interface DrawOutcome {
  card: CardCode;
  stock: CardCode[];
  discard: CardCode[];
  reshuffled: boolean;
  rngState: number;
}

/** What drawing would do right now (refilling the stock first under the house rule). */
function drawOutcome(state: CrazyEightsState): DrawOutcome {
  let stock = state.stock;
  let discard = state.discard;
  let rngState = state.rngState;
  let reshuffled = false;
  if (stock.length === 0) {
    const top = topCard(state);
    const rng = rngFromState(rngState);
    stock = shuffle(discard.slice(0, -1), rng);
    discard = [top];
    rngState = rng.getState();
    reshuffled = true;
  }
  const card = stock[0];
  if (card === undefined) throw new Error('Crazy Eights: nothing to draw');
  return { card, stock: stock.slice(1), discard, reshuffled, rngState };
}

function applyDraw(state: CrazyEightsState): CrazyEightsState {
  const seat = state.turn;
  const d = drawOutcome(state);
  const next: CrazyEightsState = {
    ...state,
    hands: state.hands.map((h, i) => (i === seat ? sortCards([...h, d.card]) : h)),
    stock: d.stock,
    discard: d.discard,
    rngState: d.rngState,
    reshuffles: state.reshuffles + (d.reshuffled ? 1 : 0),
    log: [
      ...state.log,
      { type: 'draw', seat, card: d.card, facing: state.activeSuit, reshuffled: d.reshuffled },
    ],
    draws: state.draws.map((n, i) => (i === seat ? n + 1 : n)),
    drawnThisTurn: state.drawnThisTurn + 1,
  };
  return settle(next, seat);
}

function applyPass(state: CrazyEightsState): CrazyEightsState {
  const seat = state.turn;
  const next: CrazyEightsState = {
    ...state,
    log: [...state.log, { type: 'pass', seat }],
    drawnThisTurn: 0,
    turn: (seat + 1) % state.players,
  };
  return settle(next, seat);
}

function isMoveShape(move: unknown): move is CrazyEightsMove {
  if (typeof move !== 'object' || move === null) return false;
  const m = move as { type?: unknown; card?: unknown };
  if (m.type === 'play') return typeof m.card === 'string';
  return m.type === 'draw' || m.type === 'pass';
}

function overReason(state: CrazyEightsState): string {
  if (state.endReason === 'blocked') {
    return 'The game is over — it was blocked: the stock ran out and nobody could play.';
  }
  const w = state.winners[0] ?? 0;
  return `The game is over — ${seatObject(w)} already emptied ${w === 0 ? 'your' : 'their'} hand.`;
}

function checkMoveFor(state: CrazyEightsState, player: PlayerId, move: unknown): MoveCheck {
  if (state.phase === 'over') return { ok: false, reason: overReason(state) };
  if (!isMoveShape(move)) {
    return {
      ok: false,
      reason: "That isn't a Crazy Eights move — play a card, draw from the stock, or pass.",
    };
  }
  if (player !== state.turn) {
    return {
      ok: false,
      reason: `It's ${seatPossessive(state.turn)} turn, not ${player === 0 ? 'yours' : seatPossessive(player)}.`,
    };
  }
  const hand = handOf(state, player);
  const drawable = canDraw(state);
  const playable = playableCards(hand, pileOf(state));
  if (move.type === 'play') {
    if (!isCardCode(move.card) || move.card === 'X1' || move.card === 'X2') {
      return { ok: false, reason: "That isn't a real card — play one from your hand." };
    }
    return checkPlayCard(hand, playContextOf(state, drawable), move.card, move.suit);
  }
  if (move.type === 'draw') {
    if (drawable) return { ok: true };
    const why =
      state.reshuffle && state.reshuffles >= MAX_RESHUFFLES && state.discard.length > 1
        ? `The stock is empty and the discard pile has already been reshuffled ${MAX_RESHUFFLES} times, so there's nothing left to draw.`
        : "The stock is empty, so there's nothing left to draw.";
    return {
      ok: false,
      reason:
        playable.length > 0
          ? `${why} But you can play ${shortList(playable, 'or')}!`
          : `${why} Nothing in your hand matches, so pass this turn.`,
    };
  }
  // pass
  if (playable.length > 0) {
    const first = playable.find((c) => !isEight(c)) ?? (playable[0] as CardCode);
    const what = isEight(first)
      ? `your ${cardShort(first)} is wild, so you can play it`
      : `your ${cardShort(first)} matches, so play it`;
    return {
      ok: false,
      reason: `You can only pass when nothing in your hand can be played — ${what}.`,
    };
  }
  if (state.stock.length > 0) {
    return {
      ok: false,
      reason:
        "You can't pass while the stock still has cards — when you can't play, draw a card instead.",
    };
  }
  if (drawable) {
    return {
      ok: false,
      reason:
        'The stock is empty, but the discard pile can be shuffled into a new stock — draw a card instead of passing.',
    };
  }
  return { ok: true };
}

function legalMovesFor(state: CrazyEightsState, player: PlayerId): CrazyEightsMove[] {
  if (state.phase === 'over' || player !== state.turn) return [];
  const moves: CrazyEightsMove[] = [];
  for (const card of playableCards(handOf(state, player), pileOf(state))) {
    if (isEight(card)) for (const suit of SUITS) moves.push({ type: 'play', card, suit });
    else moves.push({ type: 'play', card });
  }
  if (canDraw(state)) moves.push({ type: 'draw' });
  if (moves.length === 0) moves.push({ type: 'pass' });
  return moves;
}

// ------------------------------------------------------------------ result

function computeFlags(
  state: CrazyEightsState,
  winners: readonly PlayerId[],
  net: number,
): ResultFlags {
  const humanWon = net > 0;
  const out = state.endReason === 'out';
  const last = state.log[state.log.length - 1];
  const eightFinish = out && winners[0] === 0 && last?.type === 'play' && isEight(last.card);
  const totals = state.hands.map(handPoints);
  const myTotal = totals[0] ?? 0;
  let closeFinish: boolean;
  if (out) {
    // The runner-up had 1 card left: an opponent when you won, you when you lost.
    closeFinish = humanWon
      ? state.hands.some((h, seat) => seat !== 0 && h.length === 1)
      : handOf(state, 0).length === 1;
  } else if (winners.includes(0)) {
    const rivals = totals.filter((_, seat) => !winners.includes(seat));
    closeFinish = winners.length > 1 || rivals.length === 0 || Math.min(...rivals) - myTotal <= 3;
  } else {
    closeFinish = myTotal - Math.min(...totals) <= 3;
  }
  const tags: string[] = [out ? 'wentOut' : 'blocked'];
  if (eightFinish) tags.push('eightFinish');
  if ((state.draws[0] ?? 0) === 0) tags.push('neverDrew');
  if (!humanWon && handOf(state, 0).some((c) => isEight(c))) tags.push('caughtWithEight');
  if (state.reshuffles > 0) tags.push('reshuffled');
  if (humanWon && winners.length > 1) tags.push('sharedWin');
  return {
    comeback: humanWon && state.maxBehind >= 3,
    closeFinish,
    luckyLastCard: humanWon && eightFinish,
    bigPot: Math.abs(net) >= 3,
    perfect: humanWon && (state.draws[0] ?? 0) === 0,
    bust: false,
    folded: false,
    tags,
  };
}

function summarise(state: CrazyEightsState, winners: readonly PlayerId[]): string {
  const counts = state.hands.map((h) => h.length);
  const totals = state.hands.map(handPoints);
  if (state.endReason === 'out') {
    const w = winners[0] ?? 0;
    if (w === 0) {
      const rest = counts
        .map((n, seat) => ({ n, seat }))
        .filter((o) => o.seat !== 0)
        .map((o) => `${seatLabel(o.seat)} with ${cardsLabel(o.n)}`);
      return `You emptied your hand first and won the pot, leaving ${joinWords(rest)}.`;
    }
    return `${seatLabel(w)} emptied their hand first and won the pot; you were left with ${cardsLabel(counts[0] ?? 0)}.`;
  }
  const best = Math.min(...totals);
  if (winners.length === state.players) {
    return `The game was blocked and everyone tied on ${pointsLabel(best)}, so nobody wins or loses — it's a push.`;
  }
  if (winners.includes(0) && winners.length === 1) {
    return `The game was blocked with an empty stock, and your ${pointsLabel(best)} were the lowest total at the table, so you win the pot.`;
  }
  if (winners.includes(0)) {
    return `The game was blocked and you tied with ${listSeats(winners.filter((w) => w !== 0))} for the lowest total (${pointsLabel(best)}), so you share the pot.`;
  }
  const who = listSeats(winners);
  return `The game was blocked: ${who} had the lowest total (${pointsLabel(best)}) and you had ${pointsLabel(totals[0] ?? 0)}.`;
}

function computeResult(state: CrazyEightsState): GameResult {
  if (state.phase !== 'over')
    throw new Error('Crazy Eights: result() called before the game ended');
  const winners = state.winners.slice();
  const net = payoutUnits(0, winners, state.players);
  const humanOutcome = net > 0 ? 'win' : net < 0 ? 'loss' : 'push';
  return {
    winners,
    humanOutcome,
    humanNetUnits: net,
    scores: state.hands.map(handPoints),
    summary: summarise(state, winners),
    flags: computeFlags(state, winners, net),
  };
}

// ------------------------------------------------------------------ words

function describe(state: CrazyEightsState, player: PlayerId, move: CrazyEightsMove): string {
  const who = seatLabel(player);
  const legal =
    state.phase !== 'over' && player === state.turn && checkMoveFor(state, player, move).ok;
  const after = legal ? crazyEightsEngine.applyMove(state, move) : null;
  let text: string;
  if (move.type === 'play') {
    const name = isCardCode(move.card) ? cardName(move.card) : String(move.card);
    if (after?.endReason === 'out') {
      return `${who} played the ${name} — ${player === 0 ? 'your' : 'their'} last card! ${who} ${verbFor(player, 'win', 'wins')}.`;
    }
    if (isCardCode(move.card) && isEight(move.card)) {
      text = isSuit(move.suit)
        ? `${who} played the ${name} and named ${SUIT_NAMES[move.suit]}.`
        : `${who} played the ${name}.`;
    } else if (after && isCardCode(move.card) && suitOf(move.card) !== state.activeSuit) {
      text = `${who} played the ${name}, switching the suit to ${SUIT_NAMES[suitOf(move.card)]}.`;
    } else {
      text = `${who} played the ${name}.`;
    }
    if (after && handOf(after, player).length === 1) {
      text += ` ${who} ${verbFor(player, 'have', 'has')} just one card left!`;
    }
  } else if (move.type === 'draw') {
    const d = legal ? drawOutcome(state) : null;
    const prefix = d?.reshuffled
      ? 'The stock was empty, so the discard pile was shuffled into a new stock. '
      : '';
    text =
      player === 0 && d
        ? `${prefix}You drew the ${cardName(d.card)}.`
        : `${prefix}${who} drew a card.`;
    if (after && after.stock.length === 0) text += ' That was the last card in the stock.';
  } else {
    text = `${who} couldn't play and passed.`;
  }
  if (after?.endReason === 'blocked') {
    text +=
      ' Nobody can play and there is nothing left to draw, so the game is blocked — the lowest points total in hand wins.';
  }
  return text;
}

function coachFor(state: CrazyEightsState, player: PlayerId): CoachAdvice {
  if (state.phase === 'over') return { situation: computeResult(state).summary };
  const view = seatView(state, player, canDraw(state));
  const situation = situationWords(view, state.turn);
  if (state.turn !== player) return { situation };
  const d = normalDecision(view);
  return { situation, suggestion: d.move, why: d.why };
}

export const crazyEightsEngine: GameEngine<CrazyEightsState, CrazyEightsMove> = {
  id: 'crazy-eights',

  setup(config: GameConfig, rng: Rng): CrazyEightsState {
    const { players, reshuffle, firstPlayer } = readConfig(config);
    const deck = shuffle(makeDeck(), rng);
    const size = handSizeFor(players);
    // Deal one card at a time, starting with the first player (on the dealer's left).
    const dealt: CardCode[][] = Array.from({ length: players }, () => []);
    for (let i = 0; i < size * players; i++) {
      dealt[(firstPlayer + i) % players]?.push(deck[i] as CardCode);
    }
    const rest = deck.slice(size * players);
    // Turn up the starter: every Eight turned up on the way is buried and the next card is
    // turned instead, so the starter is the first non-Eight left after the deal.
    const first = rest.findIndex((c) => !isEight(c));
    const starter = rest[first];
    if (first < 0 || starter === undefined) throw new Error('Crazy Eights: bad deal');
    const buried = rest.slice(0, first);
    const stock = buryInBottomHalf(rest.slice(first + 1), buried, rng);
    return {
      players,
      hands: dealt.map(sortCards),
      stock,
      discard: [starter],
      starter,
      buried,
      activeSuit: suitOf(starter),
      turn: firstPlayer,
      phase: 'play',
      winners: [],
      endReason: null,
      log: [],
      draws: dealt.map(() => 0),
      drawnThisTurn: 0,
      maxBehind: 0,
      reshuffle,
      reshuffles: 0,
      rngState: rng.getState(),
    };
  },

  currentPlayer(state) {
    return state.phase === 'over' ? null : state.turn;
  },

  legalMoves(state, player) {
    return legalMovesFor(state, player);
  },

  checkMove(state, player, move) {
    return checkMoveFor(state, player, move);
  },

  applyMove(state, move) {
    assertLegal(crazyEightsEngine, state, move);
    if (move.type === 'play') return applyPlay(state, move.card, move.suit);
    if (move.type === 'draw') return applyDraw(state);
    return applyPass(state);
  },

  isOver(state) {
    return state.phase === 'over';
  },

  result(state) {
    return computeResult(state);
  },

  botMove(state, player, difficulty: Difficulty, rng) {
    if (state.phase === 'over' || player !== state.turn) {
      throw new Error(`Crazy Eights: botMove called for seat ${player}, but it is not their turn`);
    }
    const view = seatView(state, player, canDraw(state));
    return difficulty === 'easy' ? easyMove(view, rng) : normalDecision(view).move;
  },

  describeMove(state, player, move) {
    return describe(state, player, move);
  },

  coach(state, player) {
    return coachFor(state, player);
  },

  moveKey(move) {
    if (move.type === 'play')
      return move.suit ? `play:${move.card}:${move.suit}` : `play:${move.card}`;
    return move.type;
  },
};

export default crazyEightsEngine;
