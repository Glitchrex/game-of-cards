'use client';
import { motion, useAnimate } from 'motion/react';
import { useLayoutEffect, useState, type RefObject } from 'react';
import { PlayingCard } from '@/components/cards';
import { type CardCode } from '@/games/core/cards';
import { useReducedMotionPref } from '@/lib/motion';

/** Seconds a card takes to fly from the deck to its place. */
const TRAVEL = 0.44;
/** Seconds into the flight when a face-up card turns over. */
const FLIP_AT = 0.12;
const GLIDE = [0.22, 1, 0.36, 1] as const;

/**
 * The code given to PlayingCard for a face-down card. A face-down PlayingCard never mounts
 * its face, so this placeholder (and the real hidden card) never reaches the DOM.
 */
const FACE_DOWN_PLACEHOLDER: CardCode = 'AS';

export interface TableCardProps {
  /** null = face down (a hidden card: blind, an opponent's or a packed hand). */
  code: CardCode | null;
  width: string;
  /** Seconds to wait before flying in from the deck — read once, when the card mounts. */
  delay: number;
  deckRef: RefObject<HTMLElement | null>;
  /** Packed: the card slides away towards the middle and dims. */
  packed?: boolean;
  /** Lit up as part of the winning hand. */
  winning?: boolean;
  /** Seconds before a flip (seeing your cards, the showdown) starts. */
  flipDelay?: number;
  /** Fan angle in degrees (the learner's hand is held as a small fan). */
  rotate?: number;
  marginInlineStart?: string;
  zIndex?: number;
}

/**
 * One card on the felt. It flies from the deck when the deal starts (measured, so it works
 * at any screen size), turns over where it lies when it is seen or shown, and slides away
 * when its hand is packed. Reduced motion: cards simply appear, flip and dim instantly.
 */
export function TableCard({
  code,
  width,
  delay,
  deckRef,
  packed = false,
  winning = false,
  flipDelay = 0,
  rotate = 0,
  marginInlineStart,
  zIndex,
}: TableCardProps) {
  const reduced = useReducedMotionPref();
  // Decided once, when the card lands on the table.
  const [flying] = useState(() => !reduced);
  const [startDelay] = useState(delay);
  const [landed, setLanded] = useState(() => !flying);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useLayoutEffect(() => {
    if (!flying) return;
    const el = scope.current;
    const deck = deckRef.current;
    let x = 0;
    let y = -90;
    if (el && deck) {
      const a = el.getBoundingClientRect();
      const b = deck.getBoundingClientRect();
      if (a.width > 0 && b.width > 0) {
        x = b.left + b.width / 2 - (a.left + a.width / 2);
        y = b.top + b.height / 2 - (a.top + a.height / 2);
      }
    }
    const controls = animate(
      el,
      { x: [x, 0], y: [y, 0], rotate: [-18, 0], scale: [0.55, 1], opacity: [0, 1] },
      {
        delay: startDelay,
        duration: TRAVEL,
        ease: GLIDE,
        opacity: { delay: startDelay, duration: 0.1 },
      },
    );
    const timer = window.setTimeout(() => setLanded(true), (startDelay + FLIP_AT) * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(timer);
    };
  }, [flying, startDelay, deckRef, animate, scope]);

  const faceDown = code === null || !landed;
  return (
    <motion.div
      className="relative shrink-0"
      style={{ marginInlineStart, zIndex }}
      initial={false}
      animate={
        packed
          ? { y: '-18%', rotate: rotate * 0.4 + 8, scale: 0.86, opacity: 0.38 }
          : { y: '0%', rotate, scale: 1, opacity: 1 }
      }
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 26 }}
      data-winning={winning || undefined}
    >
      <div ref={scope} style={flying ? { opacity: 0 } : undefined}>
        <PlayingCard
          code={code ?? FACE_DOWN_PLACEHOLDER}
          faceDown={faceDown}
          decorative
          highlighted={winning}
          flipDelay={flipDelay}
          style={{ width }}
        />
      </div>
    </motion.div>
  );
}
