'use client';
/**
 * The middle of the board, between the two lanes: the running count on the left, the joker
 * — big, glowing, turned up with a flourish — in the centre, and on the right an arrow to
 * the lane that gets the next card.
 */
import { motion } from 'motion/react';
import { PlayingCard } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { cardName, type CardCode } from '@/games/core/cards';
import { useReducedMotionPref } from '@/lib/motion';
import { rankName, type AndarBaharPhase, type Side } from '../engine';
import { abt } from './strings';

const JOKER_W = 'clamp(62px, 18vw, 100px)';

export interface JokerStripProps {
  joker: CardCode;
  phase: AndarBaharPhase;
  /** Cards dealt so far. */
  count: number;
  /** The lane that gets the next card (null once the deal is over). */
  next: Side | null;
}

export function JokerStrip({ joker, phase, count, next }: JokerStripProps) {
  const reduced = useReducedMotionPref();
  const rank = rankName(joker);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-6">
      <RunningCount phase={phase} count={count} />

      <div
        // Everything inside is decorative, so it is one labelled image (an empty group is
        // skipped by screen readers' browse mode).
        role="img"
        aria-label={abt('andarBahar.joker.label', { card: cardName(joker), rank })}
        data-testid="ab-joker"
        data-joker={joker}
        className="flex flex-col items-center gap-1"
      >
        <span
          aria-hidden="true"
          className="font-display text-foil text-sm leading-none font-extrabold tracking-[0.3em] uppercase sm:text-base"
        >
          {abt('andarBahar.joker.title')}
        </span>
        <div className="relative" style={{ perspective: 600 }}>
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-2 rounded-[14%] bg-[radial-gradient(closest-side,rgb(245_215_122/0.55),transparent)] blur-md"
            animate={
              reduced ? { opacity: 0.8 } : { opacity: [0.45, 0.95, 0.45], scale: [1, 1.06, 1] }
            }
            transition={
              reduced ? { duration: 0 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <motion.div
            className="relative rounded-[8%/5.7%] shadow-[0_0_0_2px_var(--color-gold-300),0_14px_30px_-12px_rgb(0_0_0/0.95)]"
            initial={reduced ? false : { rotateY: 100, scale: 0.7, opacity: 0 }}
            animate={{ rotateY: 0, scale: 1, opacity: 1 }}
            transition={
              reduced
                ? { duration: 0 }
                : { type: 'spring', stiffness: 180, damping: 18, delay: 0.1 }
            }
          >
            <PlayingCard code={joker} decorative style={{ width: JOKER_W }} />
          </motion.div>
        </div>
        <span
          aria-hidden="true"
          className="text-gold-100 text-center text-[0.6875rem] leading-tight font-semibold sm:text-xs"
        >
          {abt('andarBahar.joker.hunt', { rank })}
          <span className="text-mist block font-medium">{abt('andarBahar.joker.huntSuit')}</span>
        </span>
      </div>

      <NextArrow next={next} />
    </div>
  );
}

function RunningCount({ phase, count }: { phase: AndarBaharPhase; count: number }) {
  const reduced = useReducedMotionPref();
  const text =
    phase === 'bet'
      ? abt('andarBahar.count.waiting')
      : phase === 'over'
        ? abt('andarBahar.count.match', { n: count })
        : abt('andarBahar.count.card', { n: count });
  return (
    <div className="flex flex-col items-end text-right">
      <span className="text-mist text-[0.625rem] font-bold tracking-[0.16em] uppercase">
        {abt('andarBahar.count.label')}
      </span>
      <motion.span
        key={`${phase}-${count}`}
        data-testid="ab-count"
        data-count={count}
        initial={reduced ? false : { scale: 1.35, opacity: 0.4 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
        className={cn(
          'font-display tabular origin-right leading-tight font-extrabold',
          phase === 'over'
            ? 'text-gold-200 text-base sm:text-xl'
            : phase === 'bet'
              ? 'text-gold-100/80 text-base sm:text-lg'
              : 'text-gold-100 text-xl sm:text-2xl',
        )}
      >
        {text}
      </motion.span>
      <span className="sr-only">
        {count === 0
          ? abt('andarBahar.count.srNone')
          : abt('andarBahar.count.sr', {
              n:
                count === 1
                  ? abt('andarBahar.lane.countOne')
                  : abt('andarBahar.lane.countMany', { n: count }),
            })}
      </span>
    </div>
  );
}

function NextArrow({ next }: { next: Side | null }) {
  const reduced = useReducedMotionPref();
  return (
    <div
      className="flex min-h-14 flex-col items-start"
      data-testid="ab-next"
      data-side={next ?? undefined}
    >
      {next ? (
        <>
          <span className="text-mist text-[0.625rem] font-bold tracking-[0.16em] uppercase">
            {abt('andarBahar.next.label')}
          </span>
          <span className="text-gold-100 flex items-center gap-1 text-base font-extrabold sm:text-lg">
            <motion.svg
              key={next}
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              className="text-gold-300 size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={reduced ? false : { y: next === 'andar' ? 6 : -6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              style={{ rotate: next === 'andar' ? 0 : 180 }}
            >
              <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
            </motion.svg>
            {next === 'andar' ? abt('andarBahar.next.andar') : abt('andarBahar.next.bahar')}
          </span>
        </>
      ) : null}
    </div>
  );
}
