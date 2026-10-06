'use client';
/**
 * One dealt card on the felt. A freshly dealt card flies from the face-down deck (measured,
 * so it works at any width), turns face up mid-flight and lands in its lane. The card that
 * matches the joker then pops up with a gold burst and a "Match!" stamp. Reduced motion:
 * cards simply appear, and the match is marked without movement.
 */
import { motion, useAnimate } from 'motion/react';
import { useLayoutEffect, useState, type RefObject } from 'react';
import { PlayingCard } from '@/components/cards';
import { type CardCode } from '@/games/core/cards';
import { useReducedMotionPref } from '@/lib/motion';
import { abt } from './strings';

/** Seconds a card takes to fly from the deck to its lane. */
export const TRAVEL = 0.38;
/** Seconds into the flight when the card turns face up. */
const FLIP_AT = 0.08;
const GLIDE = [0.22, 1, 0.36, 1] as const;

export interface TableCardProps {
  code: CardCode;
  /** CSS width of the card. */
  width: string;
  /** Fly in from `sourceRef` (a card dealt while this table is on screen). */
  fly: boolean;
  sourceRef: RefObject<HTMLElement | null>;
  /** This card matched the joker: pop, glow and stamp it. */
  match?: boolean;
  zIndex: number;
}

export function TableCard({ code, width, fly, sourceRef, match = false, zIndex }: TableCardProps) {
  const reduced = useReducedMotionPref();
  // Decided once, when the card lands on the table.
  const [flying] = useState(() => fly && !reduced);
  const [landed, setLanded] = useState(() => !flying);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useLayoutEffect(() => {
    if (!flying) return;
    const el = scope.current;
    const source = sourceRef.current;
    let x = 80;
    let y = -140;
    if (el && source) {
      const a = el.getBoundingClientRect();
      const b = source.getBoundingClientRect();
      if (a.width > 0 && b.width > 0) {
        x = b.left + b.width / 2 - (a.left + a.width / 2);
        y = b.top + b.height / 2 - (a.top + a.height / 2);
      }
    }
    const controls = animate(
      el,
      { x: [x, 0], y: [y, 0], rotate: [-14, 0], scale: [0.8, 1], opacity: [0, 1] },
      { duration: TRAVEL, ease: GLIDE, opacity: { duration: 0.1 } },
    );
    const timer = window.setTimeout(() => setLanded(true), FLIP_AT * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(timer);
    };
  }, [flying, sourceRef, animate, scope]);

  const popDelay = flying ? TRAVEL : 0;
  return (
    <div
      ref={scope}
      className="relative"
      style={{ width, zIndex, ...(flying ? { opacity: 0 } : null) }}
      data-match={match || undefined}
    >
      <motion.div
        className="relative"
        initial={false}
        animate={match && !reduced ? { scale: [1, 1.3, 1.14], y: [0, -8, -2] } : undefined}
        transition={{ delay: popDelay, duration: 0.5, ease: 'easeOut' }}
        // A small lift only: the lane header sits just above the first row.
        style={match && reduced ? { transform: 'translateY(-2px) scale(1.1)' } : undefined}
      >
        {match ? (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1.5 rounded-[12%] shadow-[0_0_0_3px_var(--color-gold-200),0_0_28px_8px_rgb(245_215_122/0.85)]"
            initial={reduced ? false : { opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { opacity: [0, 1, 0.65, 1] }}
            transition={
              reduced
                ? { duration: 0 }
                : { delay: popDelay, duration: 1.4, repeat: Infinity, repeatType: 'mirror' }
            }
          />
        ) : null}
        <PlayingCard code={code} faceDown={!landed} decorative style={{ width }} />
        {match ? (
          <motion.span
            data-testid="ab-match"
            // Stamped across the lower half of the card itself: a card is at most ~5 px
            // narrower than the stamp, which the lane's padding absorbs, so it never covers the
            // lane header (name, payout, count) or spills past the lane — even on card 1 or at
            // the end of a full row on a 320 px phone.
            className="bg-gold-300 text-ink border-gold-100 absolute bottom-[12%] left-1/2 z-10 -translate-x-1/2 rounded border-2 px-0.5 py-px text-[0.5625rem] leading-none font-extrabold tracking-[0.04em] whitespace-nowrap uppercase shadow-[0_6px_14px_-4px_rgb(0_0_0/0.9)] sm:rounded-md sm:px-1 sm:text-[0.6875rem] sm:tracking-[0.08em]"
            initial={reduced ? false : { scale: 0, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: -6 }}
            transition={
              reduced
                ? { duration: 0 }
                : { delay: popDelay + 0.1, type: 'spring', stiffness: 520, damping: 16 }
            }
          >
            <span className="sr-only">{abt('andarBahar.match.sr')} </span>
            <span aria-hidden="true">{abt('andarBahar.match.stamp')}</span>
          </motion.span>
        ) : null}
      </motion.div>
    </div>
  );
}
