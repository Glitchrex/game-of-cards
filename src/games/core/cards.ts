/**
 * Card primitives shared by every engine and the UI.
 * A card is a compact string code: rank + suit, e.g. "AS" (Ace of Spades),
 * "TD" (Ten of Diamonds), "7H", "QC". Jokers are "X1" and "X2".
 */
export const SUITS = ['S', 'H', 'D', 'C'] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'] as const;
export type Rank = (typeof RANKS)[number];

export type JokerCode = 'X1' | 'X2';
export type StandardCard = `${Rank}${Suit}`;
export type CardCode = StandardCard | JokerCode;

export const SUIT_NAMES: Record<Suit, string> = {
  S: 'Spades',
  H: 'Hearts',
  D: 'Diamonds',
  C: 'Clubs',
};
export const SUIT_SINGULAR: Record<Suit, string> = {
  S: 'Spade',
  H: 'Heart',
  D: 'Diamond',
  C: 'Club',
};
export const SUIT_SYMBOLS: Record<Suit, string> = { S: '♠', H: '♥', D: '♦', C: '♣' };
export const RANK_NAMES: Record<Rank, string> = {
  A: 'Ace',
  '2': 'Two',
  '3': 'Three',
  '4': 'Four',
  '5': 'Five',
  '6': 'Six',
  '7': 'Seven',
  '8': 'Eight',
  '9': 'Nine',
  T: 'Ten',
  J: 'Jack',
  Q: 'Queen',
  K: 'King',
};
/** Short label as printed on a card corner ("10" instead of "T"). */
export const RANK_LABELS: Record<Rank, string> = {
  A: 'A',
  '2': '2',
  '3': '3',
  '4': '4',
  '5': '5',
  '6': '6',
  '7': '7',
  '8': '8',
  '9': '9',
  T: '10',
  J: 'J',
  Q: 'Q',
  K: 'K',
};

const RANK_SET = new Set<string>(RANKS);
const SUIT_SET = new Set<string>(SUITS);

export function isJoker(code: string): code is JokerCode {
  return code === 'X1' || code === 'X2';
}

export function isCardCode(code: string): code is CardCode {
  if (isJoker(code)) return true;
  return code.length === 2 && RANK_SET.has(code[0] ?? '') && SUIT_SET.has(code[1] ?? '');
}

export function rankOf(code: CardCode): Rank {
  if (isJoker(code)) throw new Error(`Joker ${code} has no rank`);
  return code[0] as Rank;
}

export function suitOf(code: CardCode): Suit {
  if (isJoker(code)) throw new Error(`Joker ${code} has no suit`);
  return code[1] as Suit;
}

export function isRed(code: CardCode): boolean {
  if (isJoker(code)) return code === 'X1';
  const s = suitOf(code);
  return s === 'H' || s === 'D';
}

/** Rank index with Ace low: A=1, 2..10, J=11, Q=12, K=13. */
export function rankNumber(code: CardCode): number {
  return RANKS.indexOf(rankOf(code)) + 1;
}

/** Rank index with Ace high: 2..10, J=11, Q=12, K=13, A=14. */
export function rankNumberAceHigh(code: CardCode): number {
  const n = rankNumber(code);
  return n === 1 ? 14 : n;
}

export function card(rank: Rank, suit: Suit): StandardCard {
  return `${rank}${suit}`;
}

/** "Queen of Hearts", "Joker". */
export function cardName(code: CardCode): string {
  if (isJoker(code)) return 'Joker';
  return `${RANK_NAMES[rankOf(code)]} of ${SUIT_NAMES[suitOf(code)]}`;
}

/** "Q♥", "10♠", "🃏". */
export function cardShort(code: CardCode): string {
  if (isJoker(code)) return 'Joker';
  return `${RANK_LABELS[rankOf(code)]}${SUIT_SYMBOLS[suitOf(code)]}`;
}

export interface DeckOptions {
  /** Ranks to include (default: all 13). */
  ranks?: readonly Rank[];
  /** Number of copies of the deck (default 1). */
  copies?: number;
  /** Jokers per copy (0–2, default 0). */
  jokers?: 0 | 1 | 2;
}

/** Build an ordered deck (shuffle it with `shuffle` from rng.ts). */
export function makeDeck(options: DeckOptions = {}): CardCode[] {
  const ranks = options.ranks ?? RANKS;
  const copies = options.copies ?? 1;
  const jokers = options.jokers ?? 0;
  const deck: CardCode[] = [];
  for (let c = 0; c < copies; c++) {
    for (const s of SUITS) for (const r of ranks) deck.push(card(r, s));
    if (jokers >= 1) deck.push('X1');
    if (jokers >= 2) deck.push('X2');
  }
  return deck;
}

/** Remove the first occurrence of `code` from `cards`, returning a new array. Throws if absent. */
export function removeCard(cards: readonly CardCode[], code: CardCode): CardCode[] {
  const i = cards.indexOf(code);
  if (i < 0) throw new Error(`Card ${code} not found`);
  return [...cards.slice(0, i), ...cards.slice(i + 1)];
}

/** Sort for display: by suit (S, H, C, D alternating colours) then rank. */
export function sortHand(
  cards: readonly CardCode[],
  opts: { aceHigh?: boolean; suitOrder?: readonly Suit[] } = {},
): CardCode[] {
  const suitOrder = opts.suitOrder ?? (['S', 'H', 'C', 'D'] as const);
  const rv = opts.aceHigh === false ? rankNumber : rankNumberAceHigh;
  return cards.slice().sort((a, b) => {
    if (isJoker(a) || isJoker(b)) return Number(isJoker(a)) - Number(isJoker(b));
    const sd = suitOrder.indexOf(suitOf(a)) - suitOrder.indexOf(suitOf(b));
    return sd !== 0 ? sd : rv(a) - rv(b);
  });
}
