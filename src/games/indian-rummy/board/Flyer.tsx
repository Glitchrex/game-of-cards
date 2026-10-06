'use client';
/**
 * A card (or chip) that arrives by flying in from another element on the table — the stock,
 * the open pile, a player's seat. The source is measured when the card mounts, so the flight
 * works at any screen size. `children` receives `landed`, so a card can stay face down in
 * flight and turn over as it lands. Reduced motion: it simply appears, already landed.
 */
import { useAnimate } from 'motion/react';
import { useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from 'react';
import { useReducedMotionPref } from '@/lib/motion';

/** Seconds a card takes to cross the table. */
export const TRAVEL = 0.46;
/** Seconds into the flight when a face-down card turns face up. */
export const FLIP_AT = 0.22;
const GLIDE = [0.22, 1, 0.36, 1] as const;

export interface FlyerProps {
  /** Where the card comes from; null = it is simply there (no flight). */
  from: RefObject<HTMLElement | null> | null;
  /** Seconds to wait before taking off (deal stagger). */
  delay?: number;
  /** Called once the card has landed (or straight away when it does not fly). */
  onLanded?: () => void;
  className?: string;
  children: (landed: boolean) => ReactNode;
}

export function Flyer({ from, delay = 0, onLanded, className, children }: FlyerProps) {
  const reduced = useReducedMotionPref();
  // Decided once, when the card lands on the table.
  const [flying] = useState(() => from !== null && !reduced);
  const [landed, setLanded] = useState(() => !flying);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  // A card that doesn't fly has landed before the first paint.
  useLayoutEffect(() => {
    if (!flying) onLanded?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying]);

  // Measured after commit, once every element on the table (the stock included) is in place;
  // the card stays invisible (opacity 0) until it takes off.
  useEffect(() => {
    if (!flying) return;
    const el = scope.current;
    const source = from?.current ?? null;
    let x = 0;
    let y = -90;
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
      { delay, duration: TRAVEL, ease: GLIDE, opacity: { delay, duration: 0.1 } },
    );
    const flip = window.setTimeout(() => setLanded(true), (delay + FLIP_AT) * 1000);
    const done = window.setTimeout(() => onLanded?.(), (delay + TRAVEL) * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(flip);
      window.clearTimeout(done);
    };
    // Measured once per mount: the card's flight is fixed when it lands on the table.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flying]);

  return (
    <div ref={scope} className={className} style={flying ? { opacity: 0 } : undefined}>
      {children(landed)}
    </div>
  );
}
