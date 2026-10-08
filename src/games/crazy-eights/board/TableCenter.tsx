'use client';
/**
 * The middle of the Crazy Eights table: the face-down stock (a real button — press it, or
 * D, to draw) and the face-up discard pile with its top card large. Under the pile a
 * "Match ♦ or K · 8 wild" line says what may be played next; after an Eight a big badge
 * announces the named suit ("Suit is now ♥ Hearts").
 */
import { motion, useAnimate } from 'motion/react';
import { useId, useLayoutEffect, useState, type RefObject } from 'react';
import { cardCountText, Pile, PlayingCard, SuitIcon } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import {
  cardName,
  RANK_LABELS,
  rankOf,
  SUIT_NAMES,
  type CardCode,
  type Suit,
} from '@/games/core/cards';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/crazy-eights/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { isEight } from '../engine';
import { DEAL_SECONDS, GLIDE, LEARNER } from './shared';

const TOP_W = 'clamp(70px, 21vw, 112px)';

/* ---------------------------------------------------------------- the stock */

export function StockButton({
  count,
  busy,
  glow,
  suggested,
  describedBy,
  pressed,
  onDraw,
  ref,
}: {
  count: number;
  busy: boolean;
  glow: boolean;
  suggested: boolean;
  /** Ids of the shared "busy" / "coach's pick" descriptions. */
  describedBy?: string;
  pressed: boolean;
  onDraw: () => void;
  ref: RefObject<HTMLButtonElement | null>;
}) {
  const reduced = useReducedMotionPref();
  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        ref={ref}
        type="button"
        data-testid="c8-draw"
        data-count={count}
        data-highlighted={glow || undefined}
        data-suggested={suggested || undefined}
        data-pressed={pressed || undefined}
        aria-label={
          count > 0
            ? t('crazyEights.stock.label', { count })
            : `${t('crazyEights.actions.draw')}: ${t('crazyEights.stock.empty')}`
        }
        aria-keyshortcuts="D"
        aria-disabled={busy || undefined}
        aria-describedby={describedBy}
        onClick={onDraw}
        className={cn(
          'group/stock relative flex flex-col items-center gap-1 rounded-2xl p-1.5 transition-transform duration-150 select-none',
          busy
            ? 'cursor-not-allowed'
            : 'cursor-pointer hover:-translate-y-0.5 active:translate-y-px',
          pressed && 'translate-y-px',
        )}
      >
        {suggested ? (
          <motion.span
            aria-hidden="true"
            data-testid="c8-draw-pick"
            className="pointer-events-none absolute -inset-1 rounded-[1.1rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
            animate={reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.04, 1] }}
            transition={
              reduced ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        ) : glow ? (
          <span
            aria-hidden="true"
            className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[1rem]"
          />
        ) : null}
        <span aria-hidden="true" className="relative inline-flex -rotate-3">
          <Pile count={count} label={t('crazyEights.stock.caption')} size="md" showCount={false} />
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'inline-flex min-h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-extrabold tracking-wide uppercase',
            busy
              ? 'border-gold-300/25 bg-felt-950/50 text-gold-200/70'
              : 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))]',
          )}
        >
          {t('crazyEights.stock.caption')}
          <kbd className="hidden font-sans text-[0.625rem] opacity-70 pointer-fine:inline">D</kbd>
        </span>
        {suggested ? (
          <span
            aria-hidden="true"
            className="bg-gold-200 text-ink absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
          >
            <SparkleIcon size={9} />
            {t('crazyEights.actions.pick')}
          </span>
        ) : null}
      </button>
      <span aria-hidden="true" className="text-mist tabular text-[0.6875rem] font-semibold">
        {count > 0 ? t('crazyEights.stock.left', { n: count }) : t('crazyEights.stock.none')}
      </span>
    </div>
  );
}

/* ---------------------------------------------------------- the discard pile */

/** Small, fixed tilts for the cards showing under the top card. */
const UNDER_TILT = [-9, 7, -4];

export function DiscardPile({
  discard,
  activeSuit,
  label,
  playedBy,
  freshFrom,
  dealt,
  sourceFor,
  ref,
}: {
  discard: readonly CardCode[];
  activeSuit: Suit;
  /** Accessible name: count, top card and what may be played next. */
  label: string;
  /** Seat that played the top card (null = the starter). */
  playedBy: PlayerId | null;
  /** Discard length when the table mounted: only cards added after that fly in. */
  freshFrom: number;
  /** The table mounted at the deal, so the starter is turned up after the cards go round. */
  dealt: boolean;
  sourceFor: (seat: PlayerId | null) => HTMLElement | null;
  ref: RefObject<HTMLDivElement | null>;
}) {
  const top = discard[discard.length - 1];
  const under = discard.slice(Math.max(0, discard.length - 4), -1);
  const index = discard.length - 1;
  return (
    <div
      ref={ref}
      role="img"
      aria-label={label}
      data-testid="c8-discard"
      data-top={top}
      data-suit={activeSuit}
      data-count={discard.length}
      className="relative grid place-items-center"
      style={{ width: TOP_W, aspectRatio: '5 / 7' }}
    >
      {under.map((code, i) => (
        <span
          key={`${discard.length - under.length - 1 + i}-${code}`}
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            transform: `rotate(${UNDER_TILT[(discard.length - under.length - 1 + i) % 3] ?? 0}deg)`,
          }}
        >
          <PlayingCard code={code} decorative style={{ width: TOP_W }} />
        </span>
      ))}
      {top ? (
        <TopCard
          key={`${index}-${top}`}
          code={top}
          from={index >= freshFrom ? playedBy : dealt && index === 0 ? 'stock' : null}
          sourceFor={sourceFor}
        />
      ) : null}
    </div>
  );
}

/**
 * The top card. A card just played flies in from the seat that played it (measured, so
 * it works at any width); a bot's card turns face up in flight. The starter is turned up
 * from the stock once the deal has gone round. Reduced motion: it simply appears.
 */
function TopCard({
  code,
  from,
  sourceFor,
}: {
  code: CardCode;
  /** Where the card comes from: a seat, the stock (the starter), or nowhere (no motion). */
  from: PlayerId | 'stock' | null;
  sourceFor: (seat: PlayerId | null) => HTMLElement | null;
}) {
  const reduced = useReducedMotionPref();
  const [flying] = useState(() => from !== null && !reduced);
  // Bot cards and the starter start face down; the learner's card is already face up.
  const [landed, setLanded] = useState(() => !flying || from === LEARNER);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useLayoutEffect(() => {
    if (!flying) return;
    const el = scope.current;
    const source = sourceFor(from === 'stock' ? null : from);
    let x = 0;
    let y = from === LEARNER ? 160 : -140;
    if (el && source) {
      const a = el.getBoundingClientRect();
      const b = source.getBoundingClientRect();
      if (a.width > 0 && b.width > 0) {
        x = b.left + b.width / 2 - (a.left + a.width / 2);
        y = b.top + b.height / 2 - (a.top + a.height / 2);
      }
    }
    const delay = from === 'stock' ? DEAL_SECONDS : 0;
    const controls = animate(
      el,
      {
        x: [x, 0],
        y: [y, 0],
        rotate: [from === LEARNER ? -10 : 16, 0],
        scale: [from === 'stock' ? 1 : 0.7, 1],
        opacity: [0, 1],
      },
      { delay, duration: 0.44, ease: GLIDE, opacity: { delay, duration: 0.1 } },
    );
    const timer = window.setTimeout(() => setLanded(true), (delay + 0.16) * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(timer);
    };
  }, [flying, from, sourceFor, animate, scope]);

  return (
    <div
      ref={scope}
      className="absolute inset-0 z-10"
      style={flying ? { opacity: 0 } : undefined}
      data-testid="c8-top-card"
    >
      <PlayingCard code={code} faceDown={!landed} decorative style={{ width: TOP_W }} />
    </div>
  );
}

/* --------------------------------------------------------- what comes next */

/**
 * "Match ♦ or K · 8 wild" — or, after an Eight, the big "Suit is now ♥ Hearts" badge.
 * Decorative: the discard pile's accessible name says the same in words.
 */
export function NeedLine({ top, activeSuit }: { top: CardCode; activeSuit: Suit }) {
  const reduced = useReducedMotionPref();
  const descId = useId();
  if (isEight(top)) {
    return (
      <motion.p
        key={`${top}-${activeSuit}`}
        data-testid="c8-suit-badge"
        data-suit={activeSuit}
        aria-describedby={descId}
        initial={reduced ? false : { scale: 0.4, opacity: 0, rotate: -6 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 15 }}
        className="border-gold-200 relative inline-flex items-center gap-2 rounded-2xl border-2 bg-[linear-gradient(180deg,#fff6d9,#f1e7cf)] py-1.5 pr-3.5 pl-2 shadow-[0_10px_26px_-10px_rgb(245_215_122/0.9)]"
      >
        <span className="bg-ivory grid size-9 place-items-center rounded-xl shadow-inner">
          <SuitIcon suit={activeSuit} size={26} />
        </span>
        <span className="flex flex-col leading-tight">
          <span className="text-ink/70 text-[0.625rem] font-bold tracking-[0.16em] uppercase">
            {t('crazyEights.discard.suitNow')}
          </span>
          <span className="font-display text-ink text-lg font-extrabold">
            {SUIT_NAMES[activeSuit]}
          </span>
        </span>
        <span id={descId} className="sr-only">
          {t('crazyEights.discard.suitLabel')} {SUIT_NAMES[activeSuit]}
        </span>
      </motion.p>
    );
  }
  return (
    <p
      aria-hidden="true"
      data-testid="c8-need"
      data-suit={activeSuit}
      data-rank={rankOf(top)}
      className="text-cream flex flex-wrap items-center justify-center gap-1.5 text-xs font-bold"
    >
      <span className="text-mist tracking-[0.12em] uppercase">
        {t('crazyEights.discard.match')}
      </span>
      <span className="bg-parchment inline-flex h-7 items-center gap-1 rounded-lg px-1.5 shadow">
        <SuitIcon suit={activeSuit} size={16} />
      </span>
      <span className="text-mist">{t('crazyEights.discard.or')}</span>
      <span className="bg-parchment text-ink inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-1.5 font-extrabold shadow">
        {RANK_LABELS[rankOf(top)]}
      </span>
      <span className="text-mist">·</span>
      <span className="border-gold-300/60 text-gold-200 inline-flex h-7 items-center rounded-lg border border-dashed px-1.5">
        8 {t('crazyEights.discard.wild')}
      </span>
    </p>
  );
}

export function discardLabel(discard: readonly CardCode[], need: string): string {
  const top = discard[discard.length - 1];
  return t('crazyEights.discard.label', {
    count: cardCountText(discard.length),
    card: top ? cardName(top) : '',
    need,
  });
}
