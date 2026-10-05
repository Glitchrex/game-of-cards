'use client';
import { memo, useId, useState, type CSSProperties, type Ref } from 'react';
import { motion } from 'motion/react';
import { type CardCode, cardName } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { useSettings } from '@/store/settings';
import { BACK_BACKGROUND, CardBackArt, CardFaceArt, FACE_BACKGROUND } from './CardArt';
import { CARD_RADIUS, CARD_WIDTHS, type CardSize } from './sizes';
import { useIsClient } from '@/components/ui/hooks';

export interface PlayingCardProps {
  code: CardCode;
  faceDown?: boolean;
  size?: CardSize;
  /** Gold glow, e.g. a legal move in coach mode. */
  highlighted?: boolean;
  /** Stronger, pulsing glow for the coach's pick. */
  suggested?: boolean;
  /** Raised. When defined on a clickable card, it is exposed as aria-pressed. */
  selected?: boolean;
  dimmed?: boolean;
  /** Override the four-colour deck setting. */
  fourColor?: boolean;
  /** Makes the card a real <button>. */
  onClick?: () => void;
  /** Clickable cards stay focusable but ignore clicks (aria-disabled). */
  disabled?: boolean;
  className?: string;
  style?: CSSProperties;
  /** Shared-layout id for motion (animates the card between containers). */
  layoutId?: string;
  'data-testid'?: string;
  /** Override the accessible name (default: "Queen of Hearts" / "Face-down card"). */
  ariaLabel?: string;
  /** Extra state text exposed as the accessible description. */
  ariaDescription?: string;
  /** Hide from assistive tech (when a parent already describes the cards). */
  decorative?: boolean;
  /** Roving-tabindex support for hands. */
  tabIndex?: number;
  /** Lift slightly (e.g. the focused card in a hand). */
  lifted?: boolean;
  /** Seconds to wait before a flip animation starts. */
  flipDelay?: number;
  ref?: Ref<HTMLElement>;
}

/**
 * One playing card: original SVG art on an ivory, paper-textured face, or the
 * velvet GoC back. Flips in 3D when `faceDown` changes (instant under reduced
 * motion). Only the sides that have been shown are mounted, so a face-down card
 * never puts its face (or a later code's face) in the DOM.
 */
export const PlayingCard = memo(function PlayingCard({
  code,
  faceDown = false,
  size = 'md',
  highlighted = false,
  suggested = false,
  selected,
  dimmed = false,
  fourColor,
  onClick,
  disabled = false,
  className,
  style,
  layoutId,
  'data-testid': testId,
  ariaLabel,
  ariaDescription,
  decorative = false,
  tabIndex,
  lifted = false,
  flipDelay = 0,
  ref,
}: PlayingCardProps) {
  const reduced = useReducedMotionPref();
  const isClient = useIsClient();
  const settingFourColor = useSettings((s) => s.fourColor);
  const four = fourColor ?? settingFourColor;
  const descId = useId();
  const interactive = Boolean(onClick);
  const kind = interactive ? 'button' : 'span';

  // Mount each side lazily and keep it once shown, so a flip has both faces. The
  // face is only kept for the code that was actually shown: if a face-down card
  // gets a new code (e.g. a re-dealt slot), the new face never reaches the DOM.
  // `from` is the rotation the flipper starts at when it (re)mounts: switching
  // between <span> and <button> remounts it, and a flip that happens in the same
  // render (e.g. "peek, then pick a card") must still animate.
  const frontCode = faceDown ? null : code;
  const [view, setView] = useState(() => ({
    down: faceDown,
    kind,
    from: faceDown,
    front: frontCode,
    back: faceDown,
  }));
  const keptFront = frontCode ?? (view.front === code ? code : null);
  const keptBack = view.back || faceDown;
  if (
    view.down !== faceDown ||
    view.kind !== kind ||
    view.front !== keptFront ||
    view.back !== keptBack
  ) {
    setView({
      down: faceDown,
      kind,
      from: view.kind !== kind ? view.down : faceDown,
      front: keptFront,
      back: keptBack,
    });
  }

  const name = ariaLabel ?? (faceDown ? t('primer.cards.faceDown') : cardName(code));
  const states: string[] = [];
  if (suggested) states.push(t('primer.cards.suggested'));
  else if (highlighted) states.push(t('primer.cards.highlighted'));
  // Buttons expose selection through aria-pressed; plain cards need it spelled out.
  if (selected && !interactive) states.push(t('primer.cards.selected'));
  if (ariaDescription) states.push(ariaDescription);
  const description = states.join(', ');

  const lift = selected ? '-16%' : lifted ? '-9%' : '0%';
  const moveTransition = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.7 };
  const flipTransition = reduced
    ? { duration: 0 }
    : { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const, delay: flipDelay };

  const rootStyle: CSSProperties = {
    width: CARD_WIDTHS[size],
    aspectRatio: '5 / 7',
    borderRadius: CARD_RADIUS,
    ...style,
  };

  const visual = (
    <>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 block transition-transform duration-150 ease-out ${
          interactive && !disabled ? 'group-hover:-translate-y-[4%]' : ''
        }`}
        style={{ borderRadius: CARD_RADIUS, perspective: '900px' }}
      >
        <motion.span
          className="absolute inset-0 block transform-3d"
          initial={{ rotateY: view.from ? 180 : 0 }}
          animate={{ rotateY: faceDown ? 180 : 0 }}
          transition={flipTransition}
          style={{ borderRadius: CARD_RADIUS }}
        >
          {keptFront && (
            <span
              className="shadow-card absolute inset-0 block overflow-hidden backface-hidden"
              style={{ borderRadius: CARD_RADIUS, backgroundImage: FACE_BACKGROUND }}
            >
              <CardFaceArt code={keptFront} fourColor={four} compact={size === 'xs'} />
            </span>
          )}
          {keptBack && (
            <span
              className="shadow-card absolute inset-0 block overflow-hidden backface-hidden"
              style={{
                borderRadius: CARD_RADIUS,
                backgroundImage: BACK_BACKGROUND,
                transform: 'rotateY(180deg)',
              }}
            >
              <CardBackArt />
            </span>
          )}
        </motion.span>
        {dimmed && (
          <span
            className="bg-felt-950/45 absolute inset-0 block"
            style={{ borderRadius: CARD_RADIUS }}
          />
        )}
        {(highlighted || suggested || selected) && (
          <span
            className={`absolute -inset-px block ${
              suggested
                ? `shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)] ${
                    reduced && isClient ? '' : 'animate-pulse'
                  }`
                : highlighted
                  ? 'shadow-glow'
                  : 'shadow-[0_0_0_2px_var(--color-gold-300)]'
            }`}
            style={{ borderRadius: CARD_RADIUS }}
          />
        )}
      </span>
      {description && !decorative && (
        <span id={descId} className="sr-only">
          {description}
        </span>
      )}
    </>
  );

  const common = {
    layoutId,
    'data-testid': testId,
    'data-card': faceDown ? undefined : code,
    'data-face-down': faceDown || undefined,
    'data-highlighted': highlighted || undefined,
    'data-suggested': suggested || undefined,
    'data-dimmed': dimmed || undefined,
    initial: false as const,
    animate: { y: lift },
    transition: moveTransition,
    style: rootStyle,
  };
  const describedBy = description && !decorative ? descId : undefined;

  if (interactive) {
    return (
      <motion.button
        {...common}
        ref={ref as Ref<HTMLButtonElement>}
        type="button"
        tabIndex={tabIndex}
        aria-label={name}
        aria-describedby={describedBy}
        aria-pressed={selected === undefined ? undefined : selected}
        aria-disabled={disabled || undefined}
        onClick={disabled ? undefined : onClick}
        className={`group relative inline-block shrink-0 select-none ${
          disabled ? 'cursor-not-allowed' : 'cursor-pointer'
        } ${className ?? ''}`}
      >
        {visual}
      </motion.button>
    );
  }
  return (
    <motion.span
      {...common}
      ref={ref as Ref<HTMLSpanElement>}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-describedby={describedBy}
      aria-hidden={decorative || undefined}
      tabIndex={tabIndex}
      className={`relative inline-block shrink-0 select-none ${className ?? ''}`}
    >
      {visual}
    </motion.span>
  );
});

export interface CardBackProps {
  size?: CardSize;
  className?: string;
  style?: CSSProperties;
  /** Accessible name; omit for a decorative back. */
  ariaLabel?: string;
}

/** A standalone card back (velvet, gold art-deco sunburst, GoC monogram). */
export const CardBack = memo(function CardBack({
  size = 'md',
  className,
  style,
  ariaLabel,
}: CardBackProps) {
  return (
    <span
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      className={`shadow-card relative inline-block shrink-0 overflow-hidden ${className ?? ''}`}
      style={{
        width: CARD_WIDTHS[size],
        aspectRatio: '5 / 7',
        borderRadius: CARD_RADIUS,
        backgroundImage: BACK_BACKGROUND,
        ...style,
      }}
    >
      <CardBackArt />
    </span>
  );
});
