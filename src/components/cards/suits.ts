/**
 * Original, hand-drawn suit silhouettes on a 100 × 100 grid (centre 50,50).
 * Every suit has a distinct outline so suits can be told apart without colour:
 * a spade with a flared stem, a two-lobed heart, a concave rhombus diamond and a
 * three-lobed club. All sub-paths share one winding direction so they can be
 * filled with the default non-zero rule.
 */
import { type CardCode, type Suit, isJoker, suitOf } from '@/games/core/cards';

export const SUIT_PATHS: Record<Suit, string> = {
  S: 'M50 5C57 19 94 38 94 62C94 76 84 85 72 85C63 85 56.5 80 53.5 73.5C54 82 58.5 89.5 67 95H33C41.5 89.5 46 82 46.5 73.5C43.5 80 37 85 28 85C16 85 6 76 6 62C6 38 43 19 50 5Z',
  H: 'M50 92C43 84.5 6 59 6 32C6 17 17 7 30 7C39.5 7 46.5 12.5 50 20.5C53.5 12.5 60.5 7 70 7C83 7 94 17 94 32C94 59 57 84.5 50 92Z',
  D: 'M50 4Q63 30 86 50Q63 70 50 96Q37 70 14 50Q37 30 50 4Z',
  C: 'M30 27a20 20 0 1 0 40 0a20 20 0 1 0-40 0ZM8 59a20 20 0 1 0 40 0a20 20 0 1 0-40 0ZM52 59a20 20 0 1 0 40 0a20 20 0 1 0-40 0ZM50 31L30 60H70ZM47.5 52C47 72 43 85 30 95H70C57 85 53 72 52.5 52Z',
};

/** Tailwind text-colour class for a suit (shapes use `fill="currentColor"`). */
export function suitColorClass(suit: Suit, fourColor: boolean): string {
  if (fourColor) {
    return {
      S: 'text-suit-black',
      H: 'text-suit-red',
      D: 'text-suit-blue',
      C: 'text-suit-green',
    }[suit];
  }
  return suit === 'H' || suit === 'D' ? 'text-suit-red' : 'text-suit-black';
}

/** Colour class for any card, including jokers (X1 red, X2 black). */
export function cardColorClass(code: CardCode, fourColor: boolean): string {
  if (isJoker(code)) return code === 'X1' ? 'text-suit-red' : 'text-suit-black';
  return suitColorClass(suitOf(code), fourColor);
}
