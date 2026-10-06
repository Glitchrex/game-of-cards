'use client';
/**
 * The places at the Hearts table: a compact opponent seat (avatar, name, the points they
 * have taken, a fan of face-down cards showing only how many they hold) and the points
 * pill used for every seat, the learner's included.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { CardBack, cardCountText, rowLayout } from '@/components/cards';
import { BotAvatar } from '@/components/play/BotAvatar';
import { ThinkingDots } from '@/components/play/ThinkingDots';
import { cn } from '@/components/ui/cn';
import { HeartIcon } from '@/components/ui/icons';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/hearts/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { pointsText, type Captured } from './shared';

/** ♥ count and a Q♠ token: what a seat has captured so far (public information). */
export function PointsPill({
  seat,
  name,
  captured,
  className,
}: {
  seat: PlayerId;
  name: string;
  captured: Captured;
  className?: string;
}) {
  const reduced = useReducedMotionPref();
  return (
    <span
      data-testid={`hearts-points-${seat}`}
      data-points={captured.points}
      data-queen={captured.queen || undefined}
      className={cn(
        'border-gold-300/40 bg-felt-950/75 text-gold-100 inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2 text-xs font-bold whitespace-nowrap shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)]',
        captured.points > 0 && 'border-velvet-300/60',
        className,
      )}
    >
      <span className="sr-only">
        {t('hearts.points.label', { name, points: pointsText(captured.points) })}
        {captured.queen ? `, ${t('hearts.points.queen')}` : ''}
      </span>
      <span aria-hidden="true" className="inline-flex items-center gap-0.5">
        <HeartIcon size={12} className="text-velvet-300" />
        <motion.span
          key={captured.hearts}
          className="tabular"
          initial={reduced ? false : { scale: 1.6, color: '#f5d77a' }}
          animate={{ scale: 1, color: '#f4ecd8' }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
        >
          {captured.hearts}
        </motion.span>
      </span>
      {captured.queen ? (
        <motion.span
          aria-hidden="true"
          initial={reduced ? false : { scale: 0, rotate: -40 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 16 }}
          className="bg-parchment text-ink inline-flex h-4 items-center rounded-[3px] px-1 text-[0.625rem] leading-none font-extrabold shadow"
        >
          {t('hearts.points.queenShort')}
        </motion.span>
      ) : null}
    </span>
  );
}

/** A small fan of card backs: how many cards a seat holds, never which. */
export function BackFan({ name, count }: { name: string; count: number }) {
  const reduced = useReducedMotionPref();
  const width = 'clamp(17px, 4.6vw, 26px)';
  const row = rowLayout(count, width, `calc(-0.62 * ${width})`, 0.2);
  return (
    <div
      role="img"
      aria-label={t('hearts.zone.count', { name, count: cardCountText(count) })}
      data-testid="hearts-backs"
      data-count={count}
      className="relative mx-auto flex items-end justify-center"
      style={{ ...row.container, minHeight: `calc(${width} * 1.4)` }}
    >
      <AnimatePresence initial={!reduced}>
        {Array.from({ length: count }, (_, i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="relative inline-flex shrink-0"
            style={{ marginInlineStart: row.margin(i), zIndex: i }}
            initial={reduced ? false : { opacity: 0, y: -14, rotate: -10 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 12 }}
            transition={
              reduced ? { duration: 0 } : { delay: Math.min(i * 0.045, 0.6), duration: 0.28 }
            }
          >
            <CardBack size="xs" style={{ width }} />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

/**
 * One bot's seat: avatar, name, a status line with room reserved for the thinking dots
 * (so the table never jumps), the points pill and the face-down fan.
 */
export function OpponentSeat({
  seat,
  persona,
  active,
  thinking,
  thinkingLabel,
  captured,
  count,
  note,
  className,
}: {
  seat: PlayerId;
  persona: BotPersona;
  active: boolean;
  thinking: boolean;
  thinkingLabel: string;
  captured: Captured;
  count: number;
  /** A short extra line ("Passed"). */
  note?: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotionPref();
  const nameId = useId();
  const status = thinking ? thinkingLabel : active ? t('play.seat.active') : null;
  return (
    <div
      role="group"
      aria-labelledby={nameId}
      data-testid={`hearts-seat-${seat}`}
      data-active={active || undefined}
      data-thinking={thinking || undefined}
      className={cn(
        'relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border px-1 pt-2 pb-1.5 text-center transition-[border-color,background-color,box-shadow] duration-200 sm:px-2',
        active
          ? 'border-gold-300/80 bg-felt-950/45 shadow-[0_0_0_1px_rgb(245_215_122/0.35),0_0_26px_-4px_rgb(245_215_122/0.55)]'
          : 'border-gold-300/15 bg-felt-950/25',
        className,
      )}
    >
      {active && !reduced ? (
        <motion.span
          aria-hidden="true"
          className="border-gold-200/70 pointer-events-none absolute -inset-px rounded-2xl border"
          animate={{ opacity: [0.25, 0.9, 0.25] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
      <BotAvatar persona={persona} size="sm" thinking={thinking} showDots={false} decorative />
      <p
        id={nameId}
        className="text-gold-100 w-full text-xs leading-tight font-bold break-words sm:text-sm"
      >
        {persona.name}
      </p>
      <p className="text-mist hidden w-full text-[0.6875rem] leading-snug md:line-clamp-2">
        {persona.tagline}
      </p>
      <p className="text-gold-300 flex min-h-4 items-center justify-center gap-1 text-[0.6875rem] leading-none font-semibold">
        {status ? <span>{status}</span> : note ? <span className="text-mist">{note}</span> : null}
        {thinking ? <ThinkingDots size="sm" /> : null}
      </p>
      <PointsPill seat={seat} name={persona.name} captured={captured} />
      <BackFan name={persona.name} count={count} />
    </div>
  );
}
