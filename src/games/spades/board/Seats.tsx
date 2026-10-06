'use client';
/**
 * The places at the Spades table: a compact bot seat (avatar, name, Partner/Opponent tag,
 * bid badge, tricks won and a fan of face-down cards that shows only how many they hold),
 * and the bid badge and tricks counter used for every seat, the learner's included.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useId } from 'react';
import { CardBack, cardCountText, rowLayout } from '@/components/cards';
import { BotAvatar } from '@/components/play/BotAvatar';
import { ThinkingDots } from '@/components/play/ThinkingDots';
import { cn } from '@/components/ui/cn';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { NIL } from '../rules';
import { bidWords, tricksWords } from './shared';

/** "Bid 3" / "Nil" / "Bid —": a seat's public bid, popping in when it is made. */
export function BidBadge({
  seat,
  name,
  bid,
  tricks,
  className,
}: {
  seat: PlayerId;
  name: string;
  bid: number | null;
  /** Tricks this seat has won (to show a Nil breaking). */
  tricks: number;
  className?: string;
}) {
  const reduced = useReducedMotionPref();
  const nil = bid === NIL;
  const nilBroken = nil && tricks > 0;
  return (
    <motion.span
      key={bid === null ? 'none' : `bid-${bid}`}
      data-testid={`spades-bid-badge-${seat}`}
      data-bid={bid ?? undefined}
      data-nil={nil || undefined}
      data-nil-broken={nilBroken || undefined}
      initial={reduced || bid === null ? false : { scale: 1.7, rotate: -10, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 15 }}
      className={cn(
        'inline-flex min-h-6 items-center rounded-full border px-2 text-[0.6875rem] font-extrabold tracking-wide whitespace-nowrap shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)]',
        bid === null
          ? 'border-gold-300/25 bg-felt-950/60 text-mist'
          : nil
            ? nilBroken
              ? 'border-velvet-300/70 bg-velvet-700 text-cream line-through decoration-2'
              : 'border-cream/70 bg-ink text-cream'
            : 'border-gold-200/80 text-ink bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))]',
        className,
      )}
    >
      <span className="sr-only">
        {bid === null
          ? t('spades.seat.noBid', { name })
          : t('spades.seat.bidLabel', { name, bid: bidWords(bid) })}
      </span>
      <span aria-hidden="true">
        {bid === null
          ? t('spades.bid.none')
          : nil
            ? t('spades.bid.nilBadge')
            : t('spades.bid.badge', { n: bid })}
      </span>
    </motion.span>
  );
}

/** "Won 2": tricks a seat has taken, bumping when it grows. */
export function TricksCount({
  seat,
  name,
  tricks,
}: {
  seat: PlayerId;
  name: string;
  tricks: number;
}) {
  const reduced = useReducedMotionPref();
  return (
    <span
      data-testid={`spades-tricks-${seat}`}
      data-tricks={tricks}
      className="border-gold-300/35 bg-felt-950/75 text-gold-100 inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[0.6875rem] font-bold whitespace-nowrap"
    >
      <span className="sr-only">
        {t('spades.seat.tricksLabel', { name, tricks: tricksWords(tricks) })}
      </span>
      <motion.span
        aria-hidden="true"
        key={tricks}
        className="tabular"
        initial={reduced || tricks === 0 ? false : { scale: 1.7, color: '#f5d77a' }}
        animate={{ scale: 1, color: '#f4ecd8' }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
      >
        {t('spades.bid.won', { n: tricks })}
      </motion.span>
    </span>
  );
}

/** A small fan of card backs: how many cards a seat holds, never which. */
export function BackFan({ name, count }: { name: string; count: number }) {
  const reduced = useReducedMotionPref();
  // Shrinks on narrow phones so three seats always fit side by side (320 px included).
  const width = 'clamp(12px, 4.6vw, 26px)';
  const row = rowLayout(count, width, `calc(-0.62 * ${width})`, 0.2);
  return (
    <div
      role="img"
      aria-label={t('spades.zone.count', { name, count: cardCountText(count) })}
      data-testid="spades-backs"
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
            initial={reduced ? false : { opacity: 0, y: 40, rotate: -10 }}
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
 * One bot's seat: avatar, name, Partner/Opponent tag, a status line with room reserved for
 * the thinking dots (so the table never jumps), bid and tricks, and the face-down fan.
 */
export function OpponentSeat({
  seat,
  persona,
  partner,
  active,
  thinking,
  thinkingLabel,
  bid,
  tricks,
  count,
  className,
}: {
  seat: PlayerId;
  persona: BotPersona;
  partner: boolean;
  active: boolean;
  thinking: boolean;
  thinkingLabel: string;
  bid: number | null;
  tricks: number;
  count: number;
  className?: string;
}) {
  const reduced = useReducedMotionPref();
  const nameId = useId();
  const status = thinking ? thinkingLabel : active ? t('play.seat.active') : null;
  const role = partner ? t('spades.seat.partner') : t('spades.seat.opponent');
  return (
    <div
      role="group"
      aria-labelledby={nameId}
      data-testid={`spades-seat-${seat}`}
      data-active={active || undefined}
      data-thinking={thinking || undefined}
      data-partner={partner || undefined}
      className={cn(
        'relative flex min-w-0 flex-col items-center gap-1 rounded-2xl border px-1 pt-2 pb-1.5 text-center transition-[border-color,background-color,box-shadow] duration-200 sm:px-2',
        active
          ? 'border-gold-300/80 bg-felt-950/45 shadow-[0_0_0_1px_rgb(245_215_122/0.35),0_0_26px_-4px_rgb(245_215_122/0.55)]'
          : partner
            ? 'border-gold-300/40 bg-[linear-gradient(180deg,rgb(245_215_122/0.10),rgb(6_20_14/0.30))]'
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
      <span
        data-testid={`spades-role-${seat}`}
        className={cn(
          'absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.12em] whitespace-nowrap uppercase shadow',
          partner ? 'bg-gold-300 text-ink' : 'bg-felt-950 text-mist border-gold-300/25 border',
        )}
      >
        {role}
      </span>
      <BotAvatar persona={persona} size="sm" thinking={thinking} showDots={false} decorative />
      <p
        id={nameId}
        className="text-gold-100 w-full text-xs leading-tight font-bold break-words sm:text-sm"
      >
        {persona.name}
        <span className="sr-only">, {role}</span>
      </p>
      <p className="text-mist hidden w-full truncate text-[0.6875rem] leading-snug md:block">
        {persona.tagline}
      </p>
      <p className="text-gold-300 flex min-h-4 items-center justify-center gap-1 text-[0.6875rem] leading-none font-semibold">
        {status ? <span>{status}</span> : null}
        {thinking ? <ThinkingDots size="sm" /> : null}
      </p>
      <span className="flex flex-wrap items-center justify-center gap-1">
        <BidBadge seat={seat} name={persona.name} bid={bid} tricks={tricks} />
        <TricksCount seat={seat} name={persona.name} tricks={tricks} />
      </span>
      <BackFan name={persona.name} count={count} />
    </div>
  );
}
