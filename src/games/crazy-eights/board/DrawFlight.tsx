'use client';
/**
 * A card BACK flying from the stock to the bot that just drew it (measured, so it works at
 * any width). It is only ever a back: what a bot draws is hidden information. Mount it with
 * a fresh `key` per draw; it fades out where it lands. Reduced motion: not rendered.
 */
import { useAnimate } from 'motion/react';
import { useLayoutEffect } from 'react';
import { CardBack } from '@/components/cards';
import { type PlayerId } from '@/games/core/types';
import { GLIDE } from './shared';

const W = 'clamp(30px, 8vw, 44px)';

export function DrawFlight({
  root,
  sourceFor,
  seat,
}: {
  root: () => HTMLElement | null;
  /** The element for a seat's cards; `null` = the stock. */
  sourceFor: (seat: PlayerId | null) => HTMLElement | null;
  /** The seat that drew. */
  seat: PlayerId;
}) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  useLayoutEffect(() => {
    const el = scope.current;
    const box = root()?.getBoundingClientRect();
    const a = sourceFor(null)?.getBoundingClientRect();
    const b = sourceFor(seat)?.getBoundingClientRect();
    if (!el || !box || !a || !b || a.width === 0 || b.width === 0) return;
    const half = el.getBoundingClientRect();
    const sx = a.left + a.width / 2 - box.left - half.width / 2;
    const sy = a.top + a.height / 2 - box.top - half.height / 2;
    const tx = b.left + b.width / 2 - box.left - half.width / 2;
    const ty = b.top + b.height / 2 - box.top - half.height / 2;
    const controls = animate(
      el,
      { x: [sx, tx], y: [sy, ty], rotate: [-8, 10], scale: [1, 0.7], opacity: [1, 1, 0] },
      { duration: 0.38, ease: GLIDE, opacity: { duration: 0.38, times: [0, 0.75, 1] } },
    );
    return () => controls.stop();
  }, [scope, animate, root, sourceFor, seat]);
  return (
    <div
      ref={scope}
      aria-hidden="true"
      data-testid="c8-draw-flight"
      className="pointer-events-none absolute top-0 left-0 z-40"
      style={{ opacity: 0 }}
    >
      <CardBack size="xs" style={{ width: W }} />
    </div>
  );
}
