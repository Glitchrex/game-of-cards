'use client';
/**
 * Card entrances on the Klondike felt: a card flies in from the stock (measured, so it works
 * at any width) and turns face up as it lands, or turns over where it lies. The decision is
 * made once, when the card mounts; under reduced motion cards simply appear.
 */
import { useAnimate } from 'motion/react';
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { useReducedMotionPref } from '@/lib/motion';

const GLIDE = [0.22, 1, 0.36, 1] as const;
/** Seconds a card takes to fly from the stock to its place. */
export const TRAVEL = 0.42;
/** Seconds into the flight when a face-up card turns over. */
const FLIP_AT = 0.16;

export interface FlyInOptions {
  /** Fly from this element (the stock). */
  from: RefObject<HTMLElement | null>;
  /** Fly in at all (decided at mount). */
  enabled: boolean;
  /** Seconds before the flight starts. */
  delay?: number;
}

/**
 * Spread `scope` on the element that should fly (not the one that carries layout/drag).
 * `landed` turns true when a face-up card should show its face.
 */
export function useFlyIn<T extends HTMLElement>({ from, enabled, delay = 0 }: FlyInOptions) {
  const reduced = useReducedMotionPref();
  const [flying] = useState(() => enabled && !reduced);
  const [landed, setLanded] = useState(() => !flying);
  const [scope, animate] = useAnimate<T>();

  useLayoutEffect(() => {
    if (!flying) return;
    const el = scope.current;
    const origin = from.current;
    let x = -80;
    let y = -140;
    if (el && origin) {
      const a = el.getBoundingClientRect();
      const b = origin.getBoundingClientRect();
      if (a.width > 0 && b.width > 0) {
        x = b.left + b.width / 2 - (a.left + a.width / 2);
        y = b.top + b.height / 2 - (a.top + a.height / 2);
      }
    }
    const controls = animate(
      el,
      { x: [x, 0], y: [y, 0], rotate: [-10, 0], scale: [0.85, 1], opacity: [0, 1] },
      { delay, duration: TRAVEL, ease: GLIDE, opacity: { delay, duration: 0.1 } },
    );
    const timer = window.setTimeout(() => setLanded(true), (delay + FLIP_AT) * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(timer);
    };
  }, [flying, delay, from, animate, scope]);

  return { scope, flying, landed };
}

/**
 * A card that was face down a moment ago turns over in place: it mounts face down and
 * flips on the next frame (PlayingCard animates the turn). Reduced motion: face up at once.
 */
export function useFlipIn(enabled: boolean): boolean {
  const reduced = useReducedMotionPref();
  const [down, setDown] = useState(() => enabled && !reduced);
  useEffect(() => {
    if (!down) return;
    const id = window.setTimeout(() => setDown(false), 30);
    return () => window.clearTimeout(id);
  }, [down]);
  return down;
}
