'use client';
import { memo, useId, type CSSProperties, type Ref } from 'react';
import { type CardCode, cardName } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { PlayingCard } from './PlayingCard';
import { useDropTargetState } from './drag';
import { cardCountText } from './layout';
import { CARD_RADIUS, CARD_WIDTHS, type CardSize } from './sizes';

export interface PileProps {
  /** Number of cards in the pile. */
  count: number;
  /** What the pile is / does, e.g. "Draw from stock" or "Discard pile". */
  label: string;
  /** Top card (needed when face-up). */
  topCard?: CardCode | null;
  /** Show the top card face-up (default: true when `topCard` is given). */
  faceUp?: boolean;
  /** Makes the pile a button, e.g. "Draw from stock, 23 cards". */
  onClick?: () => void;
  highlighted?: boolean;
  suggested?: boolean;
  /** Button stays focusable but ignores clicks. */
  disabled?: boolean;
  size?: CardSize;
  /** Show the count badge (default true). */
  showCount?: boolean;
  /** Also act as a drop target with this id (see DropZone / useCardDrag). */
  dropId?: string;
  fourColor?: boolean;
  className?: string;
  style?: CSSProperties;
  'data-testid'?: string;
  ref?: Ref<HTMLButtonElement | HTMLDivElement>;
}

/** Up to 4 offset layers suggest the pile's thickness. */
function depthLayers(count: number): number {
  if (count <= 1) return 0;
  if (count < 6) return 1;
  if (count < 16) return 2;
  if (count < 30) return 3;
  return 4;
}

/** A deck, stock or discard pile with a stack-depth illusion and a count badge. */
export const Pile = memo(function Pile({
  count,
  label,
  topCard = null,
  faceUp,
  onClick,
  highlighted = false,
  suggested = false,
  disabled = false,
  size = 'md',
  showCount = true,
  dropId,
  fourColor,
  className,
  style,
  'data-testid': testId,
  ref,
}: PileProps) {
  const drop = useDropTargetState(dropId);
  const descId = useId();
  const showFace = (faceUp ?? topCard !== null) && topCard !== null;
  const width = CARD_WIDTHS[size];
  const layers = depthLayers(count);

  const countText = cardCountText(count);
  const name =
    count === 0
      ? t('primer.cards.emptyPile', { label })
      : showFace && topCard
        ? t('primer.cards.pileTop', { label, count: countText, card: cardName(topCard) })
        : t('primer.cards.pileLabel', { label, count: countText });
  // The top card is decorative here, so the pile itself carries the coach states.
  const description = suggested
    ? t('primer.cards.suggested')
    : highlighted
      ? t('primer.cards.highlighted')
      : '';
  const describedBy = description ? descId : undefined;

  const body = (
    <>
      {count === 0 ? (
        <span
          aria-hidden="true"
          className="border-gold-300/45 bg-felt-950/25 absolute inset-0 block border-2 border-dashed"
          style={{ borderRadius: CARD_RADIUS }}
        >
          <span className="border-gold-300/25 absolute inset-[18%] block rounded-full border" />
        </span>
      ) : (
        <>
          {Array.from({ length: layers }, (_, i) => {
            const depth = layers - i;
            return (
              <span
                key={i}
                aria-hidden="true"
                className="shadow-card absolute inset-0 block border border-black/30"
                style={{
                  borderRadius: CARD_RADIUS,
                  transform: `translate(${depth * 1.6}px, ${depth * 1.6}px)`,
                  background: showFace
                    ? `linear-gradient(180deg, #efe6cf, #ddd0b0)`
                    : `linear-gradient(180deg, var(--color-velvet-700), #3f0a16)`,
                }}
              />
            );
          })}
          <span className="absolute inset-0 block">
            <PlayingCard
              code={topCard ?? 'AS'}
              faceDown={!showFace}
              size={size}
              fourColor={fourColor}
              highlighted={highlighted}
              suggested={suggested}
              decorative
              style={{ width }}
            />
          </span>
        </>
      )}
      {showCount && count > 0 && (
        <span
          aria-hidden="true"
          className="border-gold-600 bg-gold-300 text-ink tabular shadow-card absolute -right-2 -bottom-2 z-10 min-w-6 rounded-full border px-1.5 py-0.5 text-center text-xs leading-none font-bold"
        >
          {count}
        </span>
      )}
      {drop.isOver && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute -inset-1.5 z-20 block border-2 ${
            drop.isValid ? 'border-gold-300 shadow-glow' : 'border-velvet-400 border-dashed'
          }`}
          style={{ borderRadius: '12px' }}
        />
      )}
      {description && (
        <span id={descId} className="sr-only">
          {description}
        </span>
      )}
    </>
  );

  const boxStyle: CSSProperties = {
    width,
    aspectRatio: '5 / 7',
    borderRadius: CARD_RADIUS,
    ...style,
  };

  if (onClick) {
    return (
      <button
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        aria-label={name}
        aria-describedby={describedBy}
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : onClick}
        data-drop-id={dropId}
        data-testid={testId}
        className={`group relative inline-block shrink-0 transition-transform duration-150 ${
          disabled
            ? 'cursor-not-allowed'
            : 'cursor-pointer hover:-translate-y-0.5 active:translate-y-px'
        } ${className ?? ''}`}
        style={boxStyle}
      >
        {body}
      </button>
    );
  }
  return (
    <div
      ref={ref as Ref<HTMLDivElement>}
      role="img"
      aria-label={name}
      aria-describedby={describedBy}
      data-drop-id={dropId}
      data-testid={testId}
      className={`relative inline-block shrink-0 ${className ?? ''}`}
      style={boxStyle}
    >
      {body}
    </div>
  );
});
