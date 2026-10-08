/**
 * Klondike Solitaire — the pure rules core shared by the engine and the bot strategy.
 *
 * Variant (docs/RULES_DECISIONS.md): Draw-1, unlimited passes through the stock, 7 tableau
 * columns, 4 foundations built up by suit from the Ace, tableau built down in alternating
 * colours, only a King (or a run starting with a King) may fill an empty column, foundation
 * cards may come back down, the top face-down card of a column turns over automatically.
 *
 * Conventions:
 *  - Every pile array is ordered bottom → top: the LAST element is the top card.
 *  - Tableau columns are 0-based in moves/state (0–6); every player-facing text says 1–7.
 *  - A tableau source `index` points into `faceUp` where the moved run starts. A negative
 *    index means "a face-down card" (the UI may send it so the learner gets the "why").
 */
import {
  RANKS,
  SUITS,
  SUIT_NAMES,
  card as makeCard,
  cardName,
  isRed,
  rankNumber,
  suitOf,
  type StandardCard,
  type Suit,
} from '@/games/core/cards';
import { shuffle, type Rng } from '@/games/core/rng';

export const TABLEAU_PILES = 7;
export const CARDS_IN_DECK = 52;
export const CARDS_PER_SUIT = 13;
/** Vegas-style payout: each foundation card returns this many stake units. */
export const UNITS_PER_CARD = 5 / CARDS_IN_DECK;

export interface KlondikePile {
  /** Hidden cards, bottom → top. The top one turns over when the face-up run is cleared. */
  faceDown: StandardCard[];
  /** Visible run, bottom → top; always builds down in alternating colours. */
  faceUp: StandardCard[];
}

export type KlondikeSource =
  | { kind: 'waste' }
  | { kind: 'tableau'; pile: number; index: number }
  | { kind: 'foundation'; suit: Suit };

export type KlondikeTarget = { kind: 'tableau'; pile: number } | { kind: 'foundation' };

export type KlondikeMove =
  | { type: 'draw' }
  | { type: 'recycle' }
  | { type: 'move'; from: KlondikeSource; to: KlondikeTarget }
  | { type: 'resign' };

export type KlondikeCardMove = Extract<KlondikeMove, { type: 'move' }>;

/** The last card move (draws/recycles clear it). Used to avoid pointless back-and-forth. */
export interface KlondikeLastMove {
  card: StandardCard;
  from: 'waste' | 'tableau' | 'foundation';
  fromPile: number | null;
  to: 'tableau' | 'foundation';
  toPile: number | null;
}

export interface KlondikeState {
  /** Face-down draw pile; last element = next card drawn. */
  stock: StandardCard[];
  /** Face-up discard pile; last element = the playable card. */
  waste: StandardCard[];
  /** The 7 columns (index 0 = column 1). */
  tableau: KlondikePile[];
  /** One pile per suit, Ace first; last element = top. */
  foundations: Record<Suit, StandardCard[]>;
  /** Moves applied so far (draws, recycles and card moves; resign included). */
  moveCount: number;
  /** Times the waste was turned over into a new stock. */
  recycles: number;
  /** True once the learner pressed "I'm done". */
  resigned: boolean;
  /** Tableau cards turned face up so far (21 are face down at the start). */
  flips: number;
  /** The most recent tableau card that turned face up. */
  lastFlipped: StandardCard | null;
  /** The most recent card placed on a foundation. */
  lastHome: StandardCard | null;
  /** Highest number of foundation cards ever reached in this game. */
  bestHome: number;
  /**
   * moveCount right after the last *irreversible* progress: a face-down card turned over,
   * a stock/waste card left the waste, or the foundations reached a new high.
   */
  lastProgressAt: number;
  /** The last card move, or null after a draw / recycle / at the start. */
  last: KlondikeLastMove | null;
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export function topCard(cards: readonly StandardCard[]): StandardCard | undefined {
  return cards[cards.length - 1];
}

/** All 52 cards in a fixed order (Spades, Hearts, Diamonds, Clubs × A…K). */
export function fullDeck(): StandardCard[] {
  const out: StandardCard[] = [];
  for (const s of SUITS) for (const r of RANKS) out.push(makeCard(r, s));
  return out;
}

export function isSuit(v: unknown): v is Suit {
  return typeof v === 'string' && (SUITS as readonly string[]).includes(v);
}

export function isPileIndex(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < TABLEAU_PILES;
}

export function colourOf(c: StandardCard): 'red' | 'black' {
  return isRed(c) ? 'red' : 'black';
}

export function oppositeColour(c: StandardCard): 'red' | 'black' {
  return isRed(c) ? 'black' : 'red';
}

/** "Ace", "2" … "10", "Jack", "Queen", "King" — for rule sentences like "a red 7". */
export function rankWord(rank: number): string {
  switch (rank) {
    case 1:
      return 'Ace';
    case 11:
      return 'Jack';
    case 12:
      return 'Queen';
    case 13:
      return 'King';
    default:
      return String(rank);
  }
}

/** Plural of rankWord: "Aces", "4s", "Queens". */
export function rankWordPlural(rank: number): string {
  return `${rankWord(rank)}s`;
}

export function columnName(pile: number): string {
  return `column ${pile + 1}`;
}

export function foundationName(suit: Suit): string {
  return `${SUIT_NAMES[suit]} foundation`;
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Can `c` be placed on `onto` in the tableau (one lower, opposite colour)? */
export function canStack(c: StandardCard, onto: StandardCard): boolean {
  return isRed(c) !== isRed(onto) && rankNumber(onto) === rankNumber(c) + 1;
}

/** Is `cards` an unbroken run (each card one lower and the opposite colour of the one before)? */
export function isRun(cards: readonly StandardCard[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    const below = cards[i - 1];
    const c = cards[i];
    if (below === undefined || c === undefined || !canStack(c, below)) return false;
  }
  return cards.length > 0;
}

export function foundationCount(s: KlondikeState): number {
  let n = 0;
  for (const suit of SUITS) n += s.foundations[suit].length;
  return n;
}

export function faceDownCount(s: KlondikeState): number {
  let n = 0;
  for (const p of s.tableau) n += p.faceDown.length;
  return n;
}

export function isCleared(s: KlondikeState): boolean {
  return foundationCount(s) === CARDS_IN_DECK;
}

export function isFinished(s: KlondikeState): boolean {
  return s.resigned || isCleared(s);
}

/** Vegas-style net result in stake units: 5 × cardsHome ÷ 52 − 1. */
export function vegasNetUnits(cardsHome: number): number {
  return (5 * cardsHome) / CARDS_IN_DECK - 1;
}

/** Can `c` go onto its suit's foundation right now? */
export function canGoHome(s: KlondikeState, c: StandardCard): boolean {
  return s.foundations[suitOf(c)].length === rankNumber(c) - 1;
}

/**
 * A foundation move is "safe" when no card could ever want to sit on `c` in the tableau:
 * Aces and Twos always, otherwise when both opposite-colour foundations already hold the
 * rank below (so both cards that could be built on `c` are already home).
 */
export function isSafeHome(s: KlondikeState, c: StandardCard): boolean {
  const r = rankNumber(c);
  if (r <= 2) return true;
  const opp: readonly Suit[] = isRed(c) ? ['S', 'C'] : ['H', 'D'];
  return opp.every((suit) => s.foundations[suit].length >= r - 1);
}

export function isEmptyPile(p: KlondikePile): boolean {
  return p.faceDown.length === 0 && p.faceUp.length === 0;
}

/** Can `c` (as the base of a run) be placed on column `pile`? */
export function canPlaceOnPile(s: KlondikeState, pile: number, c: StandardCard): boolean {
  const p = s.tableau[pile];
  if (!p) return false;
  const t = topCard(p.faceUp);
  if (t === undefined) return p.faceDown.length === 0 && rankNumber(c) === CARDS_PER_SUIT;
  return canStack(c, t);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

/** Shuffle a fresh deck and deal the classic Klondike layout. */
export function dealKlondike(rng: Rng): KlondikeState {
  const deck = shuffle(fullDeck(), rng);
  const columns: StandardCard[][] = Array.from({ length: TABLEAU_PILES }, () => []);
  let pos = 0;
  // Deal row by row, left to right: column n ends up with n cards.
  for (let row = 0; row < TABLEAU_PILES; row++) {
    for (let p = row; p < TABLEAU_PILES; p++) {
      const c = deck[pos++];
      const col = columns[p];
      if (c === undefined || col === undefined) throw new Error('Deck ran out while dealing');
      col.push(c);
    }
  }
  const tableau: KlondikePile[] = columns.map((col) => ({
    faceDown: col.slice(0, -1),
    faceUp: col.slice(-1),
  }));
  return {
    stock: deck.slice(pos),
    waste: [],
    tableau,
    foundations: { S: [], H: [], D: [], C: [] },
    moveCount: 0,
    recycles: 0,
    resigned: false,
    flips: 0,
    lastFlipped: null,
    lastHome: null,
    bestHome: 0,
    lastProgressAt: 0,
    last: null,
  };
}

// ---------------------------------------------------------------------------
// Move shape + legality (single source of truth for legalMoves and checkMove)
// ---------------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Structural check: does `m` look like a KlondikeMove (ranges are checked later)? */
export function isMoveShape(m: unknown): m is KlondikeMove {
  if (!isObj(m)) return false;
  switch (m.type) {
    case 'draw':
    case 'recycle':
    case 'resign':
      return true;
    case 'move': {
      const { from, to } = m;
      if (!isObj(from) || !isObj(to)) return false;
      const fromOk =
        from.kind === 'waste' ||
        from.kind === 'foundation' ||
        (from.kind === 'tableau' &&
          typeof from.pile === 'number' &&
          typeof from.index === 'number');
      const toOk =
        to.kind === 'foundation' || (to.kind === 'tableau' && typeof to.pile === 'number');
      return fromOk && toOk;
    }
    default:
      return false;
  }
}

const ILLEGAL = '';

/**
 * null when `m` is legal in `s`; otherwise a beginner-friendly reason (when `explain`) or ''
 * (fast path used while enumerating legal moves). Does not check whose turn it is.
 */
export function moveProblem(s: KlondikeState, m: unknown, explain: boolean): string | null {
  const no = (why: () => string): string => (explain ? why() : ILLEGAL);
  if (isFinished(s)) {
    return no(() =>
      isCleared(s)
        ? 'You already cleared the board — all 52 cards are home! Deal a new game to play again.'
        : 'This game is over — deal a new game to keep playing.',
    );
  }
  if (!isMoveShape(m)) {
    return no(
      () =>
        'That isn\'t a Klondike move. You can draw from the stock, move a face-up card, turn the waste over when the stock is empty, or stop with "I\'m done".',
    );
  }
  switch (m.type) {
    case 'draw':
      if (s.stock.length > 0) return null;
      return no(() =>
        s.waste.length > 0
          ? 'The stock is empty. Turn the waste pile over to make a fresh stock, then keep drawing.'
          : 'There are no cards left to draw — the stock and the waste are both empty.',
      );
    case 'recycle':
      if (s.stock.length > 0) {
        return no(
          () =>
            `You can only turn the waste over once the stock is empty — there ${
              s.stock.length === 1 ? 'is still 1 card' : `are still ${s.stock.length} cards`
            } left to draw.`,
        );
      }
      if (s.waste.length === 0) {
        return no(() => 'The waste pile is empty, so there is nothing to turn over.');
      }
      return null;
    case 'resign':
      return null;
    case 'move':
      return cardMoveProblem(s, m, no);
  }
}

function noSuchColumn(pile: unknown): string {
  return typeof pile === 'number' && Number.isInteger(pile)
    ? `There is no column ${pile + 1} — the columns are numbered 1 to 7.`
    : 'Pick one of the 7 columns.';
}

/** The cards a card move would pick up, or a reason why there are none. */
function movingCards(
  s: KlondikeState,
  from: KlondikeSource,
  no: (why: () => string) => string,
): StandardCard[] | string {
  switch (from.kind) {
    case 'waste': {
      const w = topCard(s.waste);
      if (w === undefined) {
        return no(() =>
          s.stock.length > 0
            ? 'The waste pile is empty — draw a card from the stock first.'
            : 'The waste pile is empty, so there is no card there to move.',
        );
      }
      return [w];
    }
    case 'tableau': {
      if (!isPileIndex(from.pile)) return no(() => noSuchColumn(from.pile));
      const col = columnName(from.pile);
      const p = s.tableau[from.pile];
      if (!p) return no(() => noSuchColumn(from.pile));
      if (!Number.isInteger(from.index)) return no(() => `Pick a face-up card in ${col} to move.`);
      if (p.faceUp.length === 0) {
        return no(() =>
          p.faceDown.length === 0
            ? `Column ${from.pile + 1} is empty — there is no card there to move.`
            : `There is no face-up card in ${col} to move.`,
        );
      }
      if (from.index < 0) {
        return no(
          () =>
            'That card is face down. Only face-up cards can move — a face-down card turns over by itself once every card on top of it has moved away.',
        );
      }
      if (from.index >= p.faceUp.length)
        return no(() => `There is no card at that spot in ${col}.`);
      const run = p.faceUp.slice(from.index);
      if (!isRun(run)) {
        return no(
          () =>
            "Those cards aren't one unbroken run (each card one lower than the card it sits on, in the opposite colour), so they can't move together.",
        );
      }
      return run;
    }
    case 'foundation': {
      if (!isSuit(from.suit)) {
        return no(
          () =>
            'There is no foundation like that — there is one for each suit: Spades, Hearts, Diamonds and Clubs.',
        );
      }
      const f = topCard(s.foundations[from.suit]);
      if (f === undefined) {
        return no(
          () => `The ${foundationName(from.suit)} is empty — there is no card there to take back.`,
        );
      }
      return [f];
    }
  }
}

/**
 * What the foundation of `suit` needs next, as the end of a sentence starting "The Hearts
 * foundation …": "is still empty, so it needs the Ace of Hearts first".
 */
function foundationNeeds(s: KlondikeState, suit: Suit): string {
  const ft = topCard(s.foundations[suit]);
  if (ft === undefined) return `is still empty, so it needs the Ace of ${SUIT_NAMES[suit]} first`;
  const next = rankNumber(ft) + 1;
  return next > CARDS_PER_SUIT
    ? 'is already complete, up to the King'
    : `is up to the ${rankWord(rankNumber(ft))}, so the next card it needs is the ${rankWord(
        next,
      )} of ${SUIT_NAMES[suit]}`;
}

function cardMoveProblem(
  s: KlondikeState,
  m: KlondikeCardMove,
  no: (why: () => string) => string,
): string | null {
  const { from, to } = m;
  const moving = movingCards(s, from, no);
  if (typeof moving === 'string') return moving;
  const base = moving[0];
  const last = moving[moving.length - 1];
  if (base === undefined || last === undefined) return no(() => 'There is no card to move.');

  if (to.kind === 'foundation') {
    if (from.kind === 'foundation') {
      return no(() => `The ${cardName(base)} is already on its foundation.`);
    }
    if (moving.length > 1) {
      return no(() => {
        const col = columnName(from.kind === 'tableau' ? from.pile : 0);
        // Only claim the last card can go up when it really can.
        return canGoHome(s, last)
          ? `Foundations take one card at a time, so only the last card in ${col} — the ${cardName(last)} — can go up right now.`
          : `Foundations take one card at a time, and only the last card in ${col} (the ${cardName(
              last,
            )}) may go up — but not yet: the ${foundationName(suitOf(last))} ${foundationNeeds(
              s,
              suitOf(last),
            )}.`;
      });
    }
    const suit = suitOf(base);
    if (canGoHome(s, base)) return null;
    return no(
      () =>
        `Foundations are built up in one suit, ${
          s.foundations[suit].length === 0 ? 'starting with the Ace' : 'one card at a time'
        }. The ${foundationName(suit)} ${foundationNeeds(s, suit)}.`,
    );
  }

  // To a tableau column.
  if (!isPileIndex(to.pile)) return no(() => noSuchColumn(to.pile));
  const destCol = columnName(to.pile);
  if (from.kind === 'tableau' && from.pile === to.pile) {
    return no(
      () =>
        `${moving.length > 1 ? 'Those cards are' : 'That card is'} already in ${destCol}. Pick a different column to move ${moving.length > 1 ? 'them' : 'it'} to.`,
    );
  }
  const dest = s.tableau[to.pile];
  if (!dest) return no(() => noSuchColumn(to.pile));
  const t = topCard(dest.faceUp);
  const r = rankNumber(base);
  // An Ace outside the foundations can always go straight up (its foundation is empty).
  const aceHint = () =>
    r === 1 && from.kind !== 'foundation'
      ? ` Aces belong on the foundations — send the ${cardName(base)} straight up instead.`
      : '';
  if (t === undefined) {
    if (dest.faceDown.length > 0) {
      return no(() => `You can't build on a face-down card in ${destCol}.`);
    }
    if (r === CARDS_PER_SUIT) return null;
    return no(() =>
      moving.length > 1
        ? `Only a King — or a run that starts with a King — can go into an empty column. This run starts with the ${cardName(base)}.`
        : `Only a King can go into an empty column. The ${cardName(base)} can't start a new column.${aceHint()}`,
    );
  }
  if (canStack(base, t)) return null;
  if (r === CARDS_PER_SUIT) {
    return no(
      () =>
        `A King can only move into an empty column — no card is higher than a King, so it can't go on the ${cardName(t)}.`,
    );
  }
  const rule = `A ${colourOf(base)} ${rankWord(r)} must go on a ${oppositeColour(base)} ${rankWord(
    r + 1,
  )}`;
  if (rankNumber(t) === r + 1) {
    return no(
      () =>
        `${rule} — the ${cardName(t)} is ${colourOf(t)} too, and the colours must alternate.${aceHint()}`,
    );
  }
  return no(() => `${rule}, but the top card of ${destCol} is the ${cardName(t)}.${aceHint()}`);
}

export function isLegalMove(s: KlondikeState, m: unknown): boolean {
  return moveProblem(s, m, false) === null;
}

/** Smallest index k such that faceUp[k..] is an unbroken run (0 in normal play). */
function runStart(faceUp: readonly StandardCard[]): number {
  let k = faceUp.length - 1;
  while (k > 0) {
    const c = faceUp[k];
    const below = faceUp[k - 1];
    if (c === undefined || below === undefined || !canStack(c, below)) break;
    k--;
  }
  return Math.max(k, 0);
}

/**
 * Every legal move, in a fixed order: foundation moves, tableau → tableau, waste → tableau,
 * foundation → tableau, draw / recycle, resign. Empty when the game is over.
 * Generated directly for speed; `moveProblem` is the equivalent explaining checker (their
 * agreement is verified exhaustively in the tests).
 */
export function listLegalMoves(s: KlondikeState): KlondikeMove[] {
  if (isFinished(s)) return [];
  const out: KlondikeMove[] = [];
  const w = topCard(s.waste);
  if (w !== undefined && canGoHome(s, w)) {
    out.push({ type: 'move', from: { kind: 'waste' }, to: { kind: 'foundation' } });
  }
  s.tableau.forEach((p, i) => {
    const t = topCard(p.faceUp);
    if (t !== undefined && canGoHome(s, t)) {
      out.push({
        type: 'move',
        from: { kind: 'tableau', pile: i, index: p.faceUp.length - 1 },
        to: { kind: 'foundation' },
      });
    }
  });
  s.tableau.forEach((p, i) => {
    for (let k = runStart(p.faceUp); k < p.faceUp.length; k++) {
      const c = p.faceUp[k];
      if (c === undefined) continue;
      for (let j = 0; j < TABLEAU_PILES; j++) {
        if (j !== i && canPlaceOnPile(s, j, c)) {
          out.push({
            type: 'move',
            from: { kind: 'tableau', pile: i, index: k },
            to: { kind: 'tableau', pile: j },
          });
        }
      }
    }
  });
  if (w !== undefined) {
    for (let j = 0; j < TABLEAU_PILES; j++) {
      if (canPlaceOnPile(s, j, w)) {
        out.push({ type: 'move', from: { kind: 'waste' }, to: { kind: 'tableau', pile: j } });
      }
    }
  }
  for (const suit of SUITS) {
    const f = topCard(s.foundations[suit]);
    if (f === undefined) continue;
    for (let j = 0; j < TABLEAU_PILES; j++) {
      if (canPlaceOnPile(s, j, f)) {
        out.push({
          type: 'move',
          from: { kind: 'foundation', suit },
          to: { kind: 'tableau', pile: j },
        });
      }
    }
  }
  if (s.stock.length > 0) out.push({ type: 'draw' });
  else if (s.waste.length > 0) out.push({ type: 'recycle' });
  out.push({ type: 'resign' });
  return out;
}

/** The card a card move picks up first (the base of a run), if the source has one. */
export function movingBase(s: KlondikeState, m: KlondikeCardMove): StandardCard | undefined {
  switch (m.from.kind) {
    case 'waste':
      return topCard(s.waste);
    case 'tableau':
      return s.tableau[m.from.pile]?.faceUp[m.from.index];
    case 'foundation':
      return isSuit(m.from.suit) ? topCard(s.foundations[m.from.suit]) : undefined;
  }
}

/** Number of cards a card move picks up. */
export function movingLength(s: KlondikeState, m: KlondikeCardMove): number {
  if (m.from.kind !== 'tableau') return 1;
  const p = s.tableau[m.from.pile];
  return p ? Math.max(0, p.faceUp.length - m.from.index) : 0;
}

/** Would this card move turn over a face-down card in its source column? */
export function moveFlipsCard(s: KlondikeState, m: KlondikeCardMove): boolean {
  if (m.from.kind !== 'tableau') return false;
  const p = s.tableau[m.from.pile];
  return !!p && m.from.index === 0 && p.faceDown.length > 0;
}

// ---------------------------------------------------------------------------
// Transition (no legality check — the engine wraps it with assertLegal)
// ---------------------------------------------------------------------------

export function applyUnchecked(s: KlondikeState, m: KlondikeMove): KlondikeState {
  const moveCount = s.moveCount + 1;
  switch (m.type) {
    case 'draw': {
      const c = topCard(s.stock);
      if (c === undefined) throw new Error('Cannot draw from an empty stock');
      return { ...s, stock: s.stock.slice(0, -1), waste: [...s.waste, c], moveCount, last: null };
    }
    case 'recycle':
      // Turning the waste over puts its first-drawn card back on top of the new stock.
      return {
        ...s,
        stock: s.waste.slice().reverse(),
        waste: [],
        recycles: s.recycles + 1,
        moveCount,
        last: null,
      };
    case 'resign':
      return { ...s, resigned: true, moveCount, last: null };
    case 'move':
      return applyCardMove(s, m, moveCount);
  }
}

function applyCardMove(s: KlondikeState, m: KlondikeCardMove, moveCount: number): KlondikeState {
  let waste = s.waste;
  let foundations = s.foundations;
  const tableau = s.tableau.slice();
  let moving: StandardCard[];
  let progress = false;
  let flipped: StandardCard | null = null;
  let fromPile: number | null = null;

  switch (m.from.kind) {
    case 'waste': {
      const w = topCard(waste);
      if (w === undefined) throw new Error('Cannot move from an empty waste');
      moving = [w];
      waste = waste.slice(0, -1);
      progress = true; // a stock/waste card has left the stock cycle for good
      break;
    }
    case 'tableau': {
      const i = m.from.pile;
      const p = tableau[i];
      if (!p) throw new Error(`No column ${i}`);
      fromPile = i;
      moving = p.faceUp.slice(m.from.index);
      let faceUp = p.faceUp.slice(0, m.from.index);
      let faceDown = p.faceDown;
      if (faceUp.length === 0 && faceDown.length > 0) {
        const f = topCard(faceDown);
        if (f !== undefined) {
          flipped = f;
          faceDown = faceDown.slice(0, -1);
          faceUp = [f];
          progress = true;
        }
      }
      tableau[i] = { faceDown, faceUp };
      break;
    }
    case 'foundation': {
      const suit = m.from.suit;
      const f = topCard(foundations[suit]);
      if (f === undefined) throw new Error(`Empty ${suit} foundation`);
      moving = [f];
      foundations = { ...foundations, [suit]: foundations[suit].slice(0, -1) };
      break;
    }
  }

  const base = moving[0];
  if (base === undefined) throw new Error('Nothing to move');
  let lastHome = s.lastHome;
  let toPile: number | null = null;
  if (m.to.kind === 'foundation') {
    const suit = suitOf(base);
    foundations = { ...foundations, [suit]: [...foundations[suit], base] };
    lastHome = base;
  } else {
    const j = m.to.pile;
    const d = tableau[j];
    if (!d) throw new Error(`No column ${j}`);
    tableau[j] = { faceDown: d.faceDown, faceUp: [...d.faceUp, ...moving] };
    toPile = j;
  }

  const next: KlondikeState = {
    ...s,
    waste,
    tableau,
    foundations,
    moveCount,
    lastHome,
    flips: flipped ? s.flips + 1 : s.flips,
    lastFlipped: flipped ?? s.lastFlipped,
    last: { card: base, from: m.from.kind, fromPile, to: m.to.kind, toPile },
  };
  const home = foundationCount(next);
  if (home > s.bestHome) {
    next.bestHome = home;
    progress = true;
  }
  if (progress) next.lastProgressAt = moveCount;
  return next;
}

// ---------------------------------------------------------------------------
// UI helpers
// ---------------------------------------------------------------------------

/** Every foundation move available right now from the waste or a column top. */
export function homeMoves(s: KlondikeState): KlondikeCardMove[] {
  const out: KlondikeCardMove[] = [];
  const w = topCard(s.waste);
  if (w !== undefined && canGoHome(s, w)) {
    out.push({ type: 'move', from: { kind: 'waste' }, to: { kind: 'foundation' } });
  }
  s.tableau.forEach((p, i) => {
    const t = topCard(p.faceUp);
    if (t !== undefined && canGoHome(s, t)) {
      out.push({
        type: 'move',
        from: { kind: 'tableau', pile: i, index: p.faceUp.length - 1 },
        to: { kind: 'foundation' },
      });
    }
  });
  return out;
}

/** Foundation moves sorted lowest rank first (stable). */
export function homeMovesLowestFirst(s: KlondikeState): KlondikeCardMove[] {
  return homeMoves(s)
    .map((m, order) => ({ m, order, r: rankNumber(movingBase(s, m) ?? 'KS') }))
    .sort((a, b) => a.r - b.r || a.order - b.order)
    .map((x) => x.m);
}

/**
 * True when the game is certainly won: every tableau card is face up and the stock and
 * waste are used up. Then cards can simply go home lowest first.
 */
export function canAutoFinish(s: KlondikeState): boolean {
  return (
    !isFinished(s) &&
    s.stock.length === 0 &&
    s.waste.length === 0 &&
    s.tableau.every((p) => p.faceDown.length === 0)
  );
}

/**
 * Moves for the UI's "Auto-finish" / "Send cards home" button, to be applied in order (each
 * is legal after the previous ones). When `canAutoFinish` it is the complete sequence that
 * clears the board; otherwise it is the chain of *safe* foundation moves only (cards no
 * other card could ever need in the tableau).
 */
export function autoFoundationMoves(s: KlondikeState): KlondikeMove[] {
  const finishing = canAutoFinish(s);
  const out: KlondikeMove[] = [];
  let cur = s;
  while (!isFinished(cur)) {
    const next = homeMovesLowestFirst(cur).find((m) => {
      if (finishing) return true;
      const c = movingBase(cur, m);
      return c !== undefined && isSafeHome(cur, c);
    });
    if (!next) break;
    out.push(next);
    cur = applyUnchecked(cur, next);
  }
  return out;
}

/** A King run moving from a column with nothing under it into another empty column. */
export function isPointlessKingShuffle(s: KlondikeState, m: KlondikeMove): boolean {
  if (m.type !== 'move' || m.from.kind !== 'tableau' || m.to.kind !== 'tableau') return false;
  const p = s.tableau[m.from.pile];
  const d = s.tableau[m.to.pile];
  return !!p && !!d && m.from.index === 0 && p.faceDown.length === 0 && isEmptyPile(d);
}

/**
 * True when nothing can ever change again: the only legal actions are drawing, turning the
 * waste over (or pointless King shuffles) and no card in the stock or waste fits anywhere.
 * Rules-level check — it looks at the stock, so use it for UI hints, never for bot play.
 */
export function isStuck(s: KlondikeState): boolean {
  if (isFinished(s)) return false;
  for (const m of listLegalMoves(s)) {
    if (m.type === 'move' && !isPointlessKingShuffle(s, m)) return false;
  }
  const unseen = [...s.stock, ...s.waste];
  return !unseen.some((c) => canGoHome(s, c) || s.tableau.some((_, j) => canPlaceOnPile(s, j, c)));
}
