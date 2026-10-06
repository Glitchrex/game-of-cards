'use client';
import { useAnimate } from 'motion/react';
import { useLayoutEffect, useState, type RefObject } from 'react';
import { PlayingCard } from '@/components/cards';
import { type CardCode } from '@/games/core/cards';
import { useReducedMotionPref } from '@/lib/motion';

/** Seconds a card takes to fly from the deck to its place. */
const TRAVEL = 0.42;
/** Seconds into the flight when a face-up card turns over. */
const FLIP_AT = 0.12;
const GLIDE = [0.22, 1, 0.36, 1] as const;

/**
 * The code given to PlayingCard for a face-down card. A face-down PlayingCard never mounts
 * its face, so this placeholder (and the real hidden card) never reaches the DOM.
 */
const FACE_DOWN_PLACEHOLDER: CardCode = 'AS';

export interface TableCardProps {
  /** null = face down (an opponent's hidden hole card). */
  code: CardCode | null;
  width: string;
  /** Fly in from the deck when it first appears (false: it is simply there). */
  fresh: boolean;
  /** Seconds to wait before flying — read once, when the card lands on the table. */
  delay: number;
  deckRef: RefObject<HTMLElement | null>;
  /** Lit up as one of the winning five cards. */
  winning?: boolean;
  /** Greyed out (a folded hand, or a board card that is not part of the winning hand). */
  dimmed?: boolean;
  /** Seconds before a showdown flip starts. */
  flipDelay?: number;
  marginInlineStart?: string;
  zIndex?: number;
  'data-testid'?: string;
}

/**
 * One card on the felt. A freshly dealt card flies from the deck (measured, so it works at
 * any screen size) and turns face up mid-flight; a hidden hole card flips where it lies at
 * the showdown. Reduced motion: cards simply appear.
 */
export function TableCard({
  code,
  width,
  fresh,
  delay,
  deckRef,
  winning = false,
  dimmed = false,
  flipDelay = 0,
  marginInlineStart,
  zIndex,
  'data-testid': testId,
}: TableCardProps) {
  const reduced = useReducedMotionPref();
  // Decided once, when the card lands on the table.
  const [flying] = useState(() => fresh && !reduced);
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
      { x: [x, 0], y: [y, 0], rotate: [-14, 0], scale: [0.6, 1], opacity: [0, 1] },
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
    <div
      className="relative shrink-0"
      style={{ marginInlineStart, zIndex }}
      data-testid={testId}
      data-winning={winning || undefined}
    >
      <div ref={scope} style={flying ? { opacity: 0 } : undefined}>
        <PlayingCard
          code={code ?? FACE_DOWN_PLACEHOLDER}
          faceDown={faceDown}
          decorative
          highlighted={winning}
          dimmed={dimmed}
          flipDelay={flipDelay}
          style={{ width }}
        />
      </div>
    </div>
  );
}
