/**
 * Andar Bahar — pure rules engine (docs/RULES_DECISIONS.md → Andar Bahar,
 * docs/engine-notes/andar-bahar.md).
 *
 * Two seats: the learner (seat 0) bets, the dealer (seat 1) deals.
 *
 *  1. Setup: one shuffled 52-card deck (no printed jokers). The dealer turns the top card
 *     face up in the middle: the **joker**. The other 51 cards are the face-down stock.
 *  2. Phase 'bet': the learner — who has already seen the joker — bets one unit on
 *     **Andar** (inside) or **Bahar** (outside): { type: 'bet', side }.
 *  3. Phase 'deal': the dealer's only legal move is { type: 'deal' }, which turns the next
 *     stock card face up on the next side. Cards alternate, **starting with Andar**:
 *     Andar, Bahar, Andar, … One move per card, so the UI can animate them one at a time.
 *  4. The first card with the joker's **rank** (any suit) ends the deal; the side it landed
 *     on wins. A complete deck always holds three such cards, so the deal ends by card 49.
 *  5. Payout: a winning Andar bet pays 0.9 to 1 (+0.9 units), a winning Bahar bet 1 to 1
 *     (+1); a losing bet loses its unit (−1). There are no pushes. `maxLossUnits` is 1.
 *     No optional extra commitments exist, so `config.affordableUnits` has no effect, and
 *     the side bets on how many cards are dealt are omitted (Variants).
 *
 * Hidden information: the stock order is in the state, as the contract requires; the UI must
 * keep it face down. The learner's bot and coach only use the joker, the face-up cards and
 * how many cards are still face down — never the stock order.
 */
import { cardName, makeDeck, type CardCode } from '@/games/core/cards';
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
  aRank,
  bestSide,
  cardsWord,
  DEALER,
  DECK_SIZE,
  expectedNetBeforeDeal,
  isSide,
  LEARNER,
  LONG_DEAL_CARDS_BEFORE_MATCH,
  MATCHING_CARDS,
  MAX_DEAL_LENGTH,
  PAYOUT,
  percent,
  QUICK_FINISH_MAX_CARDS,
  rankName,
  rankPlural,
  sameRank,
  SEATS,
  seatName,
  SIDE_NAMES,
  sideForCard,
  sideLabel,
  SIDES,
  STOCK_SIZE,
  verbFor,
  winChances,
  type Side,
} from './rules';

export {
  aRank,
  bestSide,
  choose,
  DEALER,
  DECK_SIZE,
  expectedNet,
  expectedNetBeforeDeal,
  FIRST_SIDE,
  firstMatchDistribution,
  isSide,
  LEARNER,
  LONG_DEAL_CARDS_BEFORE_MATCH,
  MATCHING_CARDS,
  MAX_DEAL_LENGTH,
  MAX_LOSS_UNITS,
  nextSideWinChance,
  otherSide,
  PAYOUT,
  percent,
  QUICK_FINISH_MAX_CARDS,
  rankName,
  sameRank,
  SEATS,
  seatName,
  SIDE_MEANINGS,
  SIDE_NAMES,
  sideForCard,
  sideLabel,
  SIDES,
  STOCK_SIZE,
  winChances,
  type Side,
} from './rules';

// ---------------------------------------------------------------------------
// 1. Types
// ---------------------------------------------------------------------------

/**
 * 'bet'  — the learner is choosing a side (the joker is already face up).
 * 'deal' — the dealer is dealing, one forced move per card.
 * 'over' — a card matched the joker; call result().
 */
export type AndarBaharPhase = 'bet' | 'deal' | 'over';

export interface AndarBaharState {
  /** The face-up middle card. Any card of the same rank (any suit) is a match. */
  joker: CardCode;
  /** Face-down undealt cards; stock[0] is dealt next. HIDDEN from the learner. */
  stock: CardCode[];
  /** Cards dealt face up to Andar (inside), in the order they landed. */
  andar: CardCode[];
  /** Cards dealt face up to Bahar (outside), in the order they landed. */
  bahar: CardCode[];
  /** The learner's side, or null until the bet is placed. */
  bet: Side | null;
  phase: AndarBaharPhase;
  /** The side the matching card landed on; null until the deal is over. */
  winner: Side | null;
}

export type AndarBaharMove = { type: 'bet'; side: Side } | { type: 'deal' };
export type AndarBaharMoveType = AndarBaharMove['type'];

/** Longest possible game in moves: the bet plus every deal up to card 49. */
export const MAX_GAME_MOVES = 1 + MAX_DEAL_LENGTH;

/** One face-up card and the side it landed on. */
export interface DealtCard {
  card: CardCode;
  side: Side;
  /** 1-based position in the deal (card 1 is the first card after the joker). */
  number: number;
}

// ---------------------------------------------------------------------------
// 2. Queries (pure reads of the state, exported for the UI and tests)
// ---------------------------------------------------------------------------

/** How many cards have been dealt face up (the joker is not counted). */
export function cardsDealt(state: AndarBaharState): number {
  return state.andar.length + state.bahar.length;
}

/** The side that gets the next card. */
export function nextSide(state: AndarBaharState): Side {
  return sideForCard(cardsDealt(state));
}

/** Every dealt card in deal order: Andar's 1st, Bahar's 1st, Andar's 2nd, … */
export function dealtInOrder(state: AndarBaharState): DealtCard[] {
  const out: DealtCard[] = [];
  const n = cardsDealt(state);
  for (let i = 0; i < n; i++) {
    const side = sideForCard(i);
    const card = (side === 'andar' ? state.andar : state.bahar)[Math.floor(i / 2)];
    if (card === undefined) throw new Error('Andar Bahar: the dealt cards are out of order.');
    out.push({ card, side, number: i + 1 });
  }
  return out;
}

/** The most recently dealt card, or null before the first deal. */
export function lastDealt(state: AndarBaharState): DealtCard | null {
  return dealtInOrder(state).at(-1) ?? null;
}

/** The card that matched the joker (the last card dealt), or null while the deal goes on. */
export function matchingCard(state: AndarBaharState): CardCode | null {
  return state.phase === 'over' ? (lastDealt(state)?.card ?? null) : null;
}

/** True when `card` has the joker's rank. */
export function matchesJoker(state: AndarBaharState, card: CardCode): boolean {
  return sameRank(card, state.joker);
}

// ---------------------------------------------------------------------------
// 3. Legality — friendly reasons; each returns null when the move is allowed.
// ---------------------------------------------------------------------------

const MOVE_TYPES: readonly AndarBaharMoveType[] = ['bet', 'deal'];

function isMoveType(value: unknown): value is AndarBaharMoveType {
  return (MOVE_TYPES as readonly unknown[]).includes(value);
}

function moveTypeOf(move: unknown): unknown {
  return typeof move === 'object' && move !== null ? (move as { type?: unknown }).type : undefined;
}

function overReason(state: AndarBaharState): string {
  const match = matchingCard(state);
  const winner = state.winner;
  if (match === null || winner === null)
    return 'This deal is over. Start a new game to play again.';
  return (
    `This deal is over — the ${cardName(match)} matched the joker on ${SIDE_NAMES[winner]}. ` +
    'Start a new game to play again.'
  );
}

function betProblem(state: AndarBaharState, player: PlayerId, side: unknown): string | null {
  // Most fundamental first: the dealer never bets, and nobody bets once the dealing starts —
  // whatever side they named. Only then does a missing or unknown side matter.
  if (player === DEALER) {
    return 'The dealer never bets — the dealer only deals the cards. Only you pick a side.';
  }
  if (state.phase === 'deal') {
    const placed = state.bet;
    if (placed === null || !isSide(side) || placed === side) {
      return (
        `${placed === null ? 'Your bet is' : `Your bet on ${SIDE_NAMES[placed]} is`} already ` +
        `placed and the dealing has started — now just watch for ${aRank(state.joker)}.`
      );
    }
    return (
      `Bets are locked once the dealing starts, so you can’t switch from ` +
      `${SIDE_NAMES[placed]} to ${SIDE_NAMES[side]} now. Watch for ${aRank(state.joker)}!`
    );
  }
  if (!isSide(side)) {
    return 'Pick a side to bet on: Andar (inside) or Bahar (outside).';
  }
  return null;
}

function dealProblem(state: AndarBaharState, player: PlayerId): string | null {
  if (player === LEARNER) {
    return state.phase === 'bet'
      ? 'You don’t deal the cards — the dealer does, and only after you’ve placed your bet. ' +
          'Pick Andar or Bahar first.'
      : `The dealer deals every card for you, one at a time — just watch where the next ` +
          `${rankName(state.joker)} lands.`;
  }
  if (state.phase === 'bet') {
    return 'The dealer waits for your bet: no card is dealt until you’ve picked Andar or Bahar.';
  }
  return null;
}

function checkMove(state: AndarBaharState, player: PlayerId, move: AndarBaharMove): MoveCheck {
  const no = (reason: string): MoveCheck => ({ ok: false, reason });
  const type = moveTypeOf(move);
  if (!isMoveType(type)) {
    return no(
      'That isn’t an Andar Bahar move. You bet on Andar (inside) or Bahar (outside), and the ' +
        'dealer deals the cards.',
    );
  }
  if (player !== LEARNER && player !== DEALER) {
    return no(`There’s no Player ${player} at this table — it’s just you and the dealer.`);
  }
  if (state.phase === 'over') return no(overReason(state));
  const problem =
    type === 'bet'
      ? betProblem(state, player, (move as { side?: unknown }).side)
      : dealProblem(state, player);
  return problem === null ? { ok: true } : no(problem);
}

function currentPlayer(state: AndarBaharState): PlayerId | null {
  if (state.phase === 'bet') return LEARNER;
  if (state.phase === 'deal') return DEALER;
  return null;
}

function legalMoves(state: AndarBaharState, player: PlayerId): AndarBaharMove[] {
  if (currentPlayer(state) !== player) return [];
  if (player === DEALER) return [{ type: 'deal' }];
  return SIDES.map((side) => ({ type: 'bet', side }));
}

// ---------------------------------------------------------------------------
// 4. Transitions (pure: always build new objects/arrays)
// ---------------------------------------------------------------------------

function deal(state: AndarBaharState): AndarBaharState {
  const card = state.stock[0];
  // Unreachable from setup(): a complete deck always holds a match by card 49.
  if (card === undefined) throw new Error('Andar Bahar: the stock is empty but nothing matched.');
  const side = nextSide(state);
  const matched = matchesJoker(state, card);
  return {
    ...state,
    stock: state.stock.slice(1),
    andar: side === 'andar' ? [...state.andar, card] : state.andar,
    bahar: side === 'bahar' ? [...state.bahar, card] : state.bahar,
    phase: matched ? 'over' : 'deal',
    winner: matched ? side : null,
  };
}

function applyMove(state: AndarBaharState, move: AndarBaharMove): AndarBaharState {
  assertLegal(andarBaharEngine, state, move);
  if (move.type === 'bet') return { ...state, bet: move.side, phase: 'deal' };
  return deal(state);
}

function validateConfig(config: GameConfig): void {
  if (config.players !== SEATS) {
    throw new RangeError(
      `Andar Bahar is one learner betting against the dealer, so it needs exactly ${SEATS} ` +
        `seats (got ${config.players}).`,
    );
  }
}

/**
 * Start a game from a deck in a known order: deck[0] is turned up as the joker and the
 * rest are dealt in order (deck[1] to Andar, deck[2] to Bahar, …). `setup` uses it with a
 * shuffled deck; tests and curated practice hands can pass a stacked one. The deck must be
 * exactly one complete 52-card deck without printed jokers.
 */
export function setupWithDeck(config: GameConfig, deck: readonly CardCode[]): AndarBaharState {
  validateConfig(config);
  const expected = new Set<CardCode>(makeDeck());
  const complete =
    deck.length === DECK_SIZE &&
    new Set(deck).size === DECK_SIZE &&
    deck.every((c) => expected.has(c));
  if (!complete) {
    throw new RangeError('Andar Bahar: the deck must be exactly one complete 52-card deck.');
  }
  const [joker, ...stock] = deck as readonly [CardCode, ...CardCode[]];
  return { joker, stock, andar: [], bahar: [], bet: null, phase: 'bet', winner: null };
}

/** A fresh game: shuffle one deck and turn up the joker. */
function setup(config: GameConfig, rng: Rng): AndarBaharState {
  validateConfig(config);
  return setupWithDeck(config, shuffle(makeDeck(), rng));
}

// ---------------------------------------------------------------------------
// 5. Settlement and result flags (all re-derivable from the final state)
// ---------------------------------------------------------------------------

export interface AndarBaharSettlement {
  bet: Side;
  winner: Side;
  won: boolean;
  /** Stake units: +0.9 (Andar win), +1 (Bahar win) or −1 (loss). */
  net: number;
  /** The card that matched the joker. */
  matchingCard: CardCode;
  /** 1-based position of the matching card in the deal = total cards dealt. */
  matchNumber: number;
}

/** The payout. Only valid once the deal is over. */
export function settle(state: AndarBaharState): AndarBaharSettlement {
  const { bet, winner } = state;
  const match = matchingCard(state);
  if (state.phase !== 'over' || bet === null || winner === null || match === null) {
    throw new Error('Andar Bahar: the deal is not over yet.');
  }
  const won = bet === winner;
  return {
    bet,
    winner,
    won,
    net: won ? PAYOUT[bet] : -1,
    matchingCard: match,
    matchNumber: cardsDealt(state),
  };
}

function resultFlags(s: AndarBaharSettlement): ResultFlags {
  const firstCard = s.matchNumber === 1;
  const longDeal = s.matchNumber - 1 >= LONG_DEAL_CARDS_BEFORE_MATCH;
  const tags: string[] = [`${s.winner}-wins`];
  if (firstCard) tags.push('first-card-match');
  if (longDeal) tags.push('long-deal');
  return {
    comeback: false,
    closeFinish: s.matchNumber <= QUICK_FINISH_MAX_CARDS,
    luckyLastCard: firstCard || longDeal,
    bigPot: false,
    perfect: false,
    bust: false,
    folded: false,
    tags,
  };
}

function summarize(s: AndarBaharSettlement): string {
  const name = cardName(s.matchingCard);
  const side = SIDE_NAMES[s.winner];
  const lead =
    s.matchNumber === 1
      ? `The very first card, the ${name}, matched the joker on ${side}`
      : s.matchNumber - 1 >= LONG_DEAL_CARDS_BEFORE_MATCH
        ? `After a long wait, the ${name} matched the joker on ${side} as card ${s.matchNumber}`
        : `The ${name} matched the joker on ${side} as card ${s.matchNumber}`;
  if (!s.won) return `${lead}, so your ${SIDE_NAMES[s.bet]} bet loses.`;
  return s.winner === 'andar'
    ? `${lead} — your Andar bet wins 0.9 to 1!`
    : `${lead} — your Bahar bet wins 1 to 1!`;
}

function result(state: AndarBaharState): GameResult {
  const s = settle(state);
  return {
    winners: s.won ? [LEARNER] : [DEALER],
    humanOutcome: s.won ? 'win' : 'loss',
    humanNetUnits: s.net,
    summary: summarize(s),
    flags: resultFlags(s),
  };
}

// ---------------------------------------------------------------------------
// 6. Words: move log, coaching
// ---------------------------------------------------------------------------

function describeMove(state: AndarBaharState, player: PlayerId, move: AndarBaharMove): string {
  const type = moveTypeOf(move);
  if (!isMoveType(type)) return 'That isn’t an Andar Bahar move.';
  const who = seatName(player);
  if (!checkMove(state, player, move).ok) {
    return `${who} can’t ${type === 'bet' ? 'bet' : 'deal'} right now.`;
  }
  if (move.type === 'bet') {
    return `${who} ${verbFor(player, 'bet', 'bets')} on ${sideLabel(move.side)}.`;
  }
  // The dealt card is turned face up as it lands, so naming it reveals nothing hidden.
  const card = state.stock[0];
  const side = SIDE_NAMES[nextSide(state)];
  const number = cardsDealt(state) + 1;
  const deals = verbFor(player, 'deal', 'deals');
  if (card === undefined) return `${who} ${deals} card ${number} to ${side}.`;
  const base = `${who} ${deals} card ${number}, the ${cardName(card)}, to ${side}`;
  return matchesJoker(state, card)
    ? `${base} — it matches the joker, so ${side} wins!`
    : `${base}.`;
}

const PURE_CHANCE_WHY = (() => {
  const chances = winChances(0);
  const lossPer100 = (side: Side) => Math.round(-expectedNetBeforeDeal(side) * 100);
  return (
    'It’s pure chance — nothing you see can tell you where the matching card is hiding. ' +
    `Andar gets the first card, so it wins a little more often: about ${percent(chances.andar)} ` +
    `of deals against ${percent(chances.bahar)} for Bahar. That’s why Andar pays only 0.9 to 1 ` +
    '(bet 10, win 9) while Bahar pays 1 to 1. The payouts almost even it out: on average a ' +
    `bet loses about ${lossPer100('andar')} Jeet in every 100 on Andar and ` +
    `${lossPer100('bahar')} in every 100 on Bahar. Andar is a whisker kinder, which is why ` +
    'the hint points there, but neither side is a smart or skilful pick — choose the one you ' +
    'like and enjoy the suspense.'
  );
})();

const DEALER_WHY =
  'The dealer has no choices: cards always alternate Andar, Bahar, Andar, … until one ' +
  'matches the joker’s rank.';

function dealSituation(state: AndarBaharState): string {
  const n = cardsDealt(state);
  const next = nextSide(state);
  const so = n === 0 ? 'No cards are dealt yet' : `${cardsWord(n)} dealt so far, and no match yet`;
  return (
    `The joker is the ${cardName(state.joker)}. ${so}. The next card goes to ` +
    `${SIDE_NAMES[next]}.`
  );
}

/**
 * The learner's view while the cards are being dealt: live odds from public facts only (how
 * many cards are still face down). Once only the three matches are left face down, the next
 * card is certain to match, so the coach says so instead of quoting "about 100%".
 */
function dealAdvice(state: AndarBaharState): CoachAdvice {
  const { bet } = state;
  const n = cardsDealt(state);
  const next = SIDE_NAMES[nextSide(state)];
  const rank = rankName(state.joker);
  const plural = rankPlural(state.joker);
  const intro = `${bet === null ? '' : `You bet on ${SIDE_NAMES[bet]}. `}${dealSituation(state)}`;
  if (STOCK_SIZE - n === MATCHING_CARDS) {
    return {
      situation:
        `${intro} Only the three ${plural} are still face down, so the next card is sure to ` +
        `match — ${next} will win this deal.`,
      why:
        `There’s nothing to decide now — every card left is ${aRank(state.joker)}, so the very ` +
        'next card ends the deal.',
    };
  }
  const odds =
    bet === null
      ? ''
      : ` Right now ${SIDE_NAMES[bet]} has about a ${percent(winChances(n)[bet])} chance of ` +
        `getting the next ${rank}.`;
  return {
    situation: `${intro}${odds}`,
    why:
      `There’s nothing to decide now — the dealer deals until one of the three remaining ` +
      `${plural} turns up. Every card is pure luck.`,
  };
}

function coach(state: AndarBaharState, player: PlayerId): CoachAdvice {
  if (state.phase === 'over') return { situation: result(state).summary };
  if (player !== LEARNER && player !== DEALER) {
    return {
      situation: `There’s no Player ${player} at this table — it’s just you and the dealer.`,
    };
  }
  if (player === DEALER) {
    if (state.phase === 'bet') {
      return { situation: 'The dealer waits for your bet before dealing any cards.' };
    }
    return { situation: dealSituation(state), suggestion: { type: 'deal' }, why: DEALER_WHY };
  }
  const joker = cardName(state.joker);
  if (state.phase === 'bet') {
    const suggestion: AndarBaharMove = { type: 'bet', side: bestSide() };
    return {
      situation:
        `The joker is the ${joker}. The dealer will deal cards one at a time to Andar ` +
        `(inside) and Bahar (outside), starting with Andar, until another ` +
        `${rankName(state.joker)} turns up — any suit counts. Bet on the side you think it ` +
        'will land on: Andar or Bahar.',
      suggestion,
      why: PURE_CHANCE_WHY,
    };
  }
  return dealAdvice(state);
}

function botMove(
  state: AndarBaharState,
  player: PlayerId,
  difficulty: Difficulty,
  rng: Rng,
): AndarBaharMove {
  const forced = legalMoves(state, player);
  if (forced.length === 0) {
    throw new Error(`Andar Bahar: botMove called for ${seatName(player)}, who has no move now.`);
  }
  if (player === DEALER) return { type: 'deal' };
  // Normal: the side with the smaller average loss (Andar). Easy: either side at random.
  // Both only use public facts — never the face-down stock.
  return { type: 'bet', side: difficulty === 'easy' ? rng.pick(SIDES) : bestSide() };
}

/**
 * `bet:andar`, `bet:bahar` or `deal`. Anything malformed gets its own `invalid:` key, so it
 * can never be mistaken for (or highlighted as) the dealer's legal deal.
 */
function moveKey(move: AndarBaharMove): string {
  const type = moveTypeOf(move);
  if (type === 'bet') return `bet:${String((move as { side?: unknown }).side)}`;
  if (type === 'deal') return 'deal';
  return `invalid:${JSON.stringify(move) ?? String(move)}`;
}

// ---------------------------------------------------------------------------
// 7. The engine
// ---------------------------------------------------------------------------

export const andarBaharEngine: GameEngine<AndarBaharState, AndarBaharMove> = {
  id: 'andar-bahar',
  setup,
  currentPlayer,
  legalMoves,
  checkMove,
  applyMove,
  isOver: (state) => state.phase === 'over',
  result,
  botMove,
  describeMove,
  coach,
  moveKey,
};

export default andarBaharEngine;
