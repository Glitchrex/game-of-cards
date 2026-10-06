'use client';
import { AnimatePresence, motion } from 'motion/react';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type PositionMarks } from './view';

const CHIP_COLOURS = [
  ['#c22f47', '#9e2036'],
  ['#1b5fc1', '#174f9f'],
  ['#12793a', '#0e5f2e'],
  ['#17161b', '#2e2c35'],
] as const;

/** One casino chip (decorative SVG). */
export function Chip({ tone = 0, className }: { tone?: number; className?: string }) {
  const [outer, inner] = CHIP_COLOURS[tone % CHIP_COLOURS.length] ?? CHIP_COLOURS[0];
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className={cn('drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]', className)}
    >
      <circle cx={16} cy={16} r={15} fill={outer} />
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <rect
          key={k}
          x={14}
          y={1.2}
          width={4}
          height={5}
          rx={0.8}
          fill="#fbf6ea"
          transform={`rotate(${k * 60} 16 16)`}
        />
      ))}
      <circle cx={16} cy={16} r={9.5} fill={inner} />
      <circle cx={16} cy={16} r={9.5} fill="none" stroke="#f5d77a" strokeOpacity={0.8} />
    </svg>
  );
}

/** A little stack of chips: taller for bigger amounts (1–4 chips). */
export function ChipStack({ amount, className }: { amount: number; className?: string }) {
  const count = amount >= 40 ? 4 : amount >= 12 ? 3 : amount >= 4 ? 2 : 1;
  return (
    <span aria-hidden="true" className={cn('relative inline-flex size-5 shrink-0', className)}>
      {Array.from({ length: count }, (_, i) => (
        // Stacked upwards, a few pixels per chip.
        <span key={i} className="absolute inset-0" style={{ transform: `translateY(${-i * 3}px)` }}>
          <Chip tone={i} className="size-full" />
        </span>
      ))}
    </span>
  );
}

/**
 * The chips a seat has bet on this street, in front of it. They pop in when bet and slide
 * towards the pot when the betting round closes (`towards` = which way the pot is).
 */
export function BetChips({
  seat,
  amount,
  towards,
}: {
  seat: number;
  amount: number;
  towards: 'up' | 'down';
}) {
  const reduced = useReducedMotionPref();
  const label =
    amount === 1 ? t('texasHoldem.seat.betOne') : t('texasHoldem.seat.betLabel', { n: amount });
  return (
    <span className="inline-flex min-h-7 items-center justify-center">
      <AnimatePresence initial={false}>
        {amount > 0 ? (
          <motion.span
            key="bet"
            data-testid={`holdem-bet-${seat}`}
            data-bet={amount}
            initial={reduced ? false : { opacity: 0, scale: 0.6, y: towards === 'up' ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, scale: 0.5, y: towards === 'up' ? -28 : 28 }
            }
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 26 }}
            className="border-gold-300/40 bg-felt-950/75 text-gold-100 inline-flex items-center gap-1.5 rounded-full border py-0.5 ps-1 pe-2 text-xs font-extrabold shadow-[0_6px_12px_-8px_rgb(0_0_0/0.9)]"
          >
            <ChipStack amount={amount} className="size-4" />
            <span aria-hidden="true" className="tabular">
              {amount}
            </span>
            <span className="sr-only">{label}</span>
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  );
}

/** The dealer button (D) and the blind markers (SB / BB) next to a seat. */
export function PositionDiscs({
  marks,
  seat,
  className,
}: {
  marks: PositionMarks;
  seat: number;
  className?: string;
}) {
  const discs: { key: string; text: string; label: string; tone: string; testId?: string }[] = [];
  if (marks.dealer) {
    discs.push({
      key: 'd',
      text: t('texasHoldem.seat.dealer'),
      label: t('texasHoldem.seat.dealerLabel'),
      tone: 'bg-ivory text-ink border-gold-300 shadow-[0_2px_6px_rgb(0_0_0/0.6),inset_0_-2px_0_rgb(0_0_0/0.15)]',
      testId: 'holdem-dealer-button',
    });
  }
  if (marks.small) {
    discs.push({
      key: 'sb',
      text: t('texasHoldem.seat.small'),
      label: t('texasHoldem.seat.smallLabel'),
      tone: 'bg-felt-900 text-gold-200 border-gold-300/60',
    });
  }
  if (marks.big) {
    discs.push({
      key: 'bb',
      text: t('texasHoldem.seat.big'),
      label: t('texasHoldem.seat.bigLabel'),
      tone: 'bg-gold-300 text-ink border-gold-200',
    });
  }
  if (discs.length === 0) return null;
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      {discs.map((d) => (
        <span
          key={d.key}
          data-testid={d.testId}
          data-seat={d.testId ? seat : undefined}
          title={d.label}
          className={cn(
            'inline-flex size-6 items-center justify-center rounded-full border text-[0.625rem] leading-none font-extrabold',
            d.tone,
          )}
        >
          <span aria-hidden="true">{d.text}</span>
          <span className="sr-only">{d.label}</span>
        </span>
      ))}
    </span>
  );
}
