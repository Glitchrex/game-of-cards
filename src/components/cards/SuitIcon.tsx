'use client';
import { memo } from 'react';
import { type Suit } from '@/games/core/cards';
import { useSettings } from '@/store/settings';
import { SUIT_PATHS, suitColorClass } from './suits';

export interface SuitIconProps {
  suit: Suit;
  /** Pixel size of the square icon (default 20). */
  size?: number;
  className?: string;
  /** Override the four-colour deck setting. */
  fourColor?: boolean;
  /**
   * Accessible name. When omitted the icon is decorative (aria-hidden), which is
   * right whenever the suit name is already in nearby text.
   */
  title?: string;
}

/** A single suit symbol in its suit colour. */
export const SuitIcon = memo(function SuitIcon({
  suit,
  size = 20,
  className,
  fourColor,
  title,
}: SuitIconProps) {
  const settingFourColor = useSettings((s) => s.fourColor);
  const four = fourColor ?? settingFourColor;
  const colour = suitColorClass(suit, four);
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={`inline-block shrink-0 ${colour} ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <path d={SUIT_PATHS[suit]} fill="currentColor" />
    </svg>
  );
});
