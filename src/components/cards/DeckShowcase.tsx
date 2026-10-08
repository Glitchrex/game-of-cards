'use client';
/**
 * Landing-hero deck animation: a 12-card deck fans into an arc, riffle-shuffles
 * (two halves interleaving), then deals a royal flush of Hearts into a showcase
 * arc where the cards flip face-up, and finally floats gently.
 *
 * Performance: 12 card elements, compositor-driven transforms only, starts shortly after
 * mount inside a fixed aspect-ratio box (no layout shift). Reduced motion shows
 * the finished arc as a static fan. Decorative (aria-hidden) with a visually
 * hidden description. The timeline is played with the Web Animations API (one compositor
 * animation per card, no animation library), so it costs no main-thread work per frame.
 */
import { startTransition, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { type CardCode } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import {
  BACK_BACKGROUND,
  CardBackSymbol,
  CardBackUse,
  CardFaceArt,
  FACE_BACKGROUND,
} from './CardArt';
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

const cssEase = (b: Bezier) => `cubic-bezier(${b.join(', ')})`;

/** One tween of an element's transform on the timeline (times in seconds). */
interface Segment {
  at: number;
  duration: number;
  from: string;
  to: string;
  ease: Bezier;
}

/**
 * Turns an element's segments into Web Animations keyframes over a
 * `total`-second timeline: hold → tween → hold …, each tween with its own easing.
 */
function toKeyframes(segments: readonly Segment[], total: number): Keyframe[] {
  const sorted = [...segments].sort((a, b) => a.at - b.at);
  const frames: Keyframe[] = [];
  const first = sorted[0];
  if (!first) return frames;
  frames.push({ offset: 0, transform: first.from });
  sorted.forEach((seg, i) => {
    // A tween that would still be running when the next one starts is cut short so it
    // lands exactly then (like a timeline where the later tween takes over).
    const next = sorted[i + 1];
    const end = Math.min(seg.at + seg.duration, next ? next.at : total, total);
    frames.push({ offset: seg.at / total, transform: seg.from, easing: cssEase(seg.ease) });
    frames.push({ offset: end / total, transform: seg.to });
  });
  const last = sorted[sorted.length - 1];
  if (last) frames.push({ offset: 1, transform: last.to });
  return frames;
}

export interface DeckShowcaseProps {
  className?: string;
  /** Delay before the sequence starts, in ms (default 250). */
  startDelayMs?: number;
}

export function DeckShowcase({ className, startDelayMs = 250 }: DeckShowcaseProps) {
  const reduced = useReducedMotionPref();
  const scope = useRef<HTMLDivElement>(null);
  const backId = `deck-back-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const root = scope.current;
    if (!root) return;
    let cancelled = false;
    let running: Animation[] = [];
    const steps: number[] = [];
    const play = () => {
      const card = (i: number) => root.querySelector<HTMLElement>(`[data-sc="${i}"]`);
      const flipper = (i: number) =>
        root.querySelector<HTMLElement>(`[data-sc="${i}"] [data-flip]`);
      const tracks = new Map<HTMLElement, Segment[]>();
      const zSteps: [HTMLElement, number, number][] = [];
      const pose = (
        el: HTMLElement | null,
        from: Pose,
        to: Pose,
        at: number,
        duration: number,
        ease: Bezier,
      ) => {
        if (!el) return;
        const list = tracks.get(el) ?? [];
        list.push({ at, duration, from: toTransform(from), to: toTransform(to), ease });
        tracks.set(el, list);
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
        zSteps.push([el, k, at]);
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
        zSteps.push([el, 20 + slot, at]);
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
        if (!el) return;
        tracks.set(el, [
          {
            at: 2.45 + slot * 0.1,
            duration: 0.42,
            from: 'rotateY(180deg)',
            to: 'rotateY(0deg)',
            ease: GLIDE,
          },
        ]);
      });

      const all = [...tracks.values()].flat();
      const total = Math.max(...all.map((seg) => seg.at + seg.duration));
      const supported = typeof root.animate === 'function';
      // z-order changes are instant steps (cards slipping over one another).
      for (const [el, z, at] of zSteps) {
        if (supported)
          steps.push(window.setTimeout(() => (el.style.zIndex = String(z)), at * 1000));
        else el.style.zIndex = String(z);
      }
      const showFinished = () => {
        for (const [el, segments] of tracks) {
          const last = [...segments].sort((a, b) => a.at - b.at).at(-1);
          if (last) el.style.transform = last.to;
        }
        for (const [el, z] of zSteps) el.style.zIndex = String(z);
        setIdle(true);
      };
      if (!supported) {
        // No Web Animations (e.g. very old browsers): show the finished showcase.
        showFinished();
        return;
      }
      try {
        running = [...tracks].map(([el, segments]) =>
          el.animate(toKeyframes(segments, total), { duration: total * 1000, fill: 'forwards' }),
        );
      } catch {
        running.forEach((a) => a.cancel());
        running = [];
        showFinished();
        return;
      }
      void Promise.all(running.map((a) => a.finished)).then(
        () => {
          if (cancelled) return;
          // Keep the end poses as plain styles and release the animations.
          for (const a of running) {
            a.commitStyles();
            a.cancel();
          }
          running = [];
          setIdle(true);
        },
        () => {
          /* cancelled */
        },
      );
    };
    const timer = window.setTimeout(play, startDelayMs);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      steps.forEach((id) => window.clearTimeout(id));
      running.forEach((a) => a.cancel());
    };
  }, [reduced, startDelayMs]);

  // The static fan is only used after hydration so SSR markup always matches.
  const isClient = useIsClient();
  const settled = reduced && isClient;
  // The five faces start hidden (rotated away), so they mount after hydration — in a
  // transition, which React renders in small interruptible slices instead of one long task.
  const [showFaces, setShowFaces] = useState(false);
  useEffect(() => {
    startTransition(() => setShowFaces(true));
  }, []);
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
                  {hero && showFaces && (
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
                    <CardBackUse symbolId={backId} />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {/* One shared back artwork for all twelve cards (see CardBackSymbol). */}
      <CardBackSymbol id={backId} />
    </div>
  );
}
