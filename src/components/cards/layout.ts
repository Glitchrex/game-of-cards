/**
 * CSS-only responsive card rows. A row is a size container whose width is
 * min(100%, natural width); each card after the first gets a negative (or
 * positive) inline margin computed from `100cqw`, so N cards always fit the
 * available width — no measuring, no layout shift, SSR friendly.
 */
import { type CSSProperties } from 'react';
import { type CardCode } from '@/games/core/cards';
import { t } from '@/lib/i18n';

export interface RowLayout {
  container: CSSProperties;
  /** Width the row takes when nothing has to overlap (CSS length). */
  natural: string;
  /** Inline-start margin for the card at `index`. */
  margin: (index: number) => string | undefined;
}

/**
 * @param n          number of cards
 * @param cardWidth  CSS length of one card
 * @param gap        preferred spacing between cards (negative = overlap), CSS length
 * @param minVisible smallest visible fraction of a covered card (0–1)
 * @param spill      extra inline room on each side, as a fraction of the card width
 *                   (rotated fan cards swing outwards)
 */
export function rowLayout(
  n: number,
  cardWidth: string,
  gap: string,
  minVisible = 0.2,
  spill = 0,
): RowLayout {
  const pad = spill > 0 ? `calc(${spill} * ${cardWidth})` : '0px';
  const natural =
    n > 0 ? `calc(${n} * ${cardWidth} + ${Math.max(n - 1, 0)} * ${gap} + 2 * ${pad})` : cardWidth;
  const container: CSSProperties = {
    containerType: 'inline-size',
    width: `min(100%, ${natural})`,
    minWidth: 0,
    paddingInline: spill > 0 ? pad : undefined,
  };
  if (n <= 1) return { container, natural, margin: () => undefined };
  // 100cqw is the container's content box, i.e. the width left after the padding.
  const fit = `calc((100cqw - ${n} * ${cardWidth}) / ${n - 1})`;
  const maxOverlap = `calc(${-(1 - minVisible)} * ${cardWidth})`;
  const value = `max(${maxOverlap}, min(${gap}, ${fit}))`;
  return { container, natural, margin: (i) => (i === 0 ? undefined : value) };
}

/** Fan geometry for card `i` of `n`: rotation (deg) and vertical drop (% of card height). */
export function fanPose(i: number, n: number): { rotate: number; y: string } {
  if (n <= 1) return { rotate: 0, y: '0%' };
  const mid = (n - 1) / 2;
  const step = Math.min(6, 44 / (n - 1));
  const off = i - mid;
  const norm = mid === 0 ? 0 : Math.abs(off) / mid;
  return { rotate: off * step, y: `${Math.round(norm * norm * 9 * 10) / 10}%` };
}

/** How far (in card widths) the outermost fanned card swings past its slot. */
export function fanSpill(n: number): number {
  if (n <= 1) return 0;
  const maxDeg = ((n - 1) / 2) * Math.min(6, 44 / (n - 1));
  const a = (maxDeg * Math.PI) / 180;
  return Math.round((1.4 * Math.sin(a) - 0.5 * (1 - Math.cos(a))) * 100) / 100;
}

/** Stable React keys for cards, unique even with duplicate codes (two-deck games). */
export function cardKeys(cards: readonly CardCode[]): string[] {
  const seen = new Map<string, number>();
  return cards.map((c) => {
    const n = seen.get(c) ?? 0;
    seen.set(c, n + 1);
    return `${c}~${n}`;
  });
}

/** "1 card" / "7 cards". */
export function cardCountText(count: number): string {
  return count === 1 ? t('primer.cards.cardCountOne') : t('primer.cards.cardCount', { count });
}
