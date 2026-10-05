'use client';
/**
 * Landing-hero deck animation: a 12-card deck fans into an arc, riffle-shuffles
 * (two halves interleaving), then deals a royal flush of Hearts into a showcase
 * arc where the cards flip face-up, and finally floats gently.
 *
 * Performance: 12 card elements, transforms/opacity only, starts shortly after
 * mount inside a fixed aspect-ratio box (no layout shift). Reduced motion shows
 * the finished arc as a static fan. Decorative (aria-hidden) with a visually
 * hidden description.
 */
import { useEffect, useState, type CSSProperties } from 'react';
import { useAnimate, type AnimationSequence } from 'motion/react';
import { type CardCode } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { BACK_BACKGROUND, CardBackArt, CardFaceArt, FACE_BACKGROUND } from './CardArt';
import { CARD_RADIUS } from './sizes';
import { useIsClient } from '@/components/ui/hooks';

const COUNT = 12;
/** Card width as a share of the container width. */
const CARD_W = 19;
type Bezier = [number, number, number, number];
const GLIDE: Bezier = [0.22, 1, 0.36, 1];
const SNAP: Bezier = [0.2, 0.9, 0.25, 1.05];

/** Riffle landing order: left and right halves alternate. */
const RIFFLE = [0, 6, 1, 7, 2, 8, 3, 9, 4, 10, 5, 11] as const;
/** After the riffle the top five are dealt, top first, into slots 0..4. */
const DEAL_ORDER = [11, 5, 10, 4, 9] as const;
const HERO: Record<number, CardCode> = { 11: 'TH', 5: 'JH', 10: 'QH', 4: 'KH', 9: 'AH' };

interface Pose {
  x: string;
  y: string;
  rotate: number;
  scale?: number;
}

const pct = (n: number) => `${Math.round(n * 100) / 100}%`;

function stackPose(i: number): Pose {
  return { x: pct(((i % 3) - 1) * 0.6), y: pct(-i * 0.7), rotate: (i % 2 ? 1 : -1) * 0.8 };
}

function fanOutPose(i: number): Pose {
  const deg = -42 + (i * 84) / (COUNT - 1);
  const a = (deg * Math.PI) / 180;
  const r = 1.5; // arc radius in card heights
  return {
    x: pct(r * Math.sin(a) * 1.4 * 100),
    y: pct(r * (1 - Math.cos(a)) * 100 - 10),
    rotate: deg,
  };
}

function halfPose(i: number): Pose {
  const left = i < COUNT / 2;
  const k = left ? i : i - COUNT / 2;
  return { x: left ? '-62%' : '62%', y: pct(-k * 0.7 - 6), rotate: left ? -6 : 6 };
}

function riffledPose(k: number): Pose {
  return { x: pct(((k % 3) - 1) * 0.8), y: pct(-k * 0.7), rotate: k % 2 ? 0.9 : -0.7 };
}

function slotPose(j: number): Pose {
  const off = j - 2;
  return { x: pct(off * 84), y: pct(-36 + off * off * 3.5), rotate: off * 7 };
}

function deckPose(k: number): Pose {
  return { x: pct(((k % 3) - 1) * 0.5), y: pct(46 - k * 0.7), rotate: 0, scale: 0.9 };
}

/** Final layout (also the static reduced-motion fan). */
function finalPose(i: number): { pose: Pose; z: number } {
  const slot = (DEAL_ORDER as readonly number[]).indexOf(i);
  if (slot >= 0) return { pose: slotPose(slot), z: 20 + slot };
  const k = (RIFFLE as readonly number[]).indexOf(i);
  return { pose: deckPose(k), z: k };
}

const toTransform = (p: Pose) =>
  `translateX(${p.x}) translateY(${p.y}) rotate(${p.rotate}deg) scale(${p.scale ?? 1})`;

export interface DeckShowcaseProps {
  className?: string;
  /** Delay before the sequence starts, in ms (default 250). */
  startDelayMs?: number;
}

export function DeckShowcase({ className, startDelayMs = 250 }: DeckShowcaseProps) {
  const reduced = useReducedMotionPref();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const root = scope.current;
    if (!root) return;
    let controls: ReturnType<typeof animate> | null = null;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const card = (i: number) => root.querySelector<HTMLElement>(`[data-sc="${i}"]`);
      const flipper = (i: number) =>
        root.querySelector<HTMLElement>(`[data-sc="${i}"] [data-flip]`);
      const seq: AnimationSequence = [];
      const pose = (
        el: HTMLElement | null,
        from: Pose,
        to: Pose,
        at: number,
        duration: number,
        ease: Bezier,
      ) => {
        if (!el) return;
        seq.push([
          el,
          {
            x: [from.x, to.x],
            y: [from.y, to.y],
            rotate: [from.rotate, to.rotate],
            scale: [from.scale ?? 1, to.scale ?? 1],
          },
          { at, duration, ease },
        ]);
      };
      // 1. Fan out into an arc.
      for (let i = 0; i < COUNT; i++)
        pose(card(i), stackPose(i), fanOutPose(i), i * 0.02, 0.7, GLIDE);
      // 2. Split into two halves.
      for (let i = 0; i < COUNT; i++) pose(card(i), fanOutPose(i), halfPose(i), 0.95, 0.36, GLIDE);
      // 3. Riffle: halves interleave, one card at a time.
      RIFFLE.forEach((i, k) => {
        const el = card(i);
        if (!el) return;
        const at = 1.36 + k * 0.045;
        seq.push([el, { zIndex: k }, { at, duration: 0.01 }]);
        pose(el, halfPose(i), riffledPose(k), at, 0.2, SNAP);
      });
      // 4. Deal the royal flush into the showcase arc; the rest of the deck settles below.
      RIFFLE.forEach((i, k) => {
        if (i in HERO) return;
        pose(card(i), riffledPose(k), deckPose(k), 2.0, 0.5, GLIDE);
      });
      DEAL_ORDER.forEach((i, slot) => {
        const el = card(i);
        if (!el) return;
        const at = 2.0 + slot * 0.12;
        seq.push([el, { zIndex: 20 + slot }, { at, duration: 0.01 }]);
        pose(
          el,
          riffledPose(RIFFLE.indexOf(i as (typeof RIFFLE)[number])),
          slotPose(slot),
          at,
          0.5,
          GLIDE,
        );
      });
      // 5. Flip them face-up, left to right.
      DEAL_ORDER.forEach((i, slot) => {
        const el = flipper(i);
        if (el)
          seq.push([
            el,
            { rotateY: [180, 0] },
            { at: 2.45 + slot * 0.1, duration: 0.42, ease: GLIDE },
          ]);
      });
      controls = animate(seq);
      void controls.then(() => {
        if (!cancelled) setIdle(true);
      });
    }, startDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      controls?.stop();
    };
  }, [reduced, animate, scope, startDelayMs]);

  // The static fan is only used after hydration so SSR markup always matches.
  const isClient = useIsClient();
  const settled = reduced && isClient;
  return (
    <div className={`relative ${className ?? ''}`}>
      <p className="sr-only">{t('primer.cards.showcase')}</p>
      <div
        ref={scope}
        aria-hidden="true"
        className="relative w-full select-none"
        style={{ aspectRatio: '16 / 9' }}
      >
        <div
          className={`pointer-events-none absolute inset-[8%_14%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(245_215_122/0.28),transparent)] transition-opacity duration-1000 ${
            idle || settled ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <div className={`absolute inset-0 ${idle && !reduced ? 'animate-float' : ''}`}>
          {Array.from({ length: COUNT }, (_, i) => {
            const hero = HERO[i];
            const fin = finalPose(i);
            const start = stackPose(i);
            const style: CSSProperties = {
              left: '50%',
              top: '50%',
              width: `${CARD_W}%`,
              marginLeft: `${-CARD_W / 2}%`,
              marginTop: `${(-CARD_W * 1.4) / 2}%`,
              zIndex: settled ? fin.z : i,
              transform: toTransform(settled ? fin.pose : start),
              perspective: '800px',
            };
            return (
              <div key={i} data-sc={i} className="absolute" style={style}>
                <div
                  data-flip=""
                  className="relative aspect-[5/7] w-full transform-3d"
                  style={{ transform: hero && settled ? 'rotateY(0deg)' : 'rotateY(180deg)' }}
                >
                  {hero && (
                    <span
                      className="shadow-lift absolute inset-0 block overflow-hidden backface-hidden"
                      style={{ borderRadius: CARD_RADIUS, backgroundImage: FACE_BACKGROUND }}
                    >
                      <CardFaceArt code={hero} fourColor={false} />
                    </span>
                  )}
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
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
