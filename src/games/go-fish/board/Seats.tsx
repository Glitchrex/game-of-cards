'use client';
/**
 * The places at the Go Fish table: a bot's seat (its avatar, name and card count are one
 * big button — press it to choose who to ask), the books every seat has laid down, and a
 * fan of card backs that shows only HOW MANY cards a bot holds, never which.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useId } from 'react';
import { CardBack, cardCountText, PlayingCard, rowLayout } from '@/components/cards';
import { BotAvatar } from '@/components/play/BotAvatar';
import { ThinkingDots } from '@/components/play/ThinkingDots';
import { cn } from '@/components/ui/cn';
import { SparkleIcon, TrophyIcon } from '@/components/ui/icons';
import { type CardCode, type Rank } from '@/games/core/cards';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/go-fish/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type GoFishBook } from '../engine';
import { booksText, rankList } from './shared';
import { type Roving } from './useRoving';

const SUITS_SHOWN = ['S', 'H', 'C', 'D'] as const;

/** A book: the four cards of one rank, fanned face up (books are public). */
export function BookStack({
  rank,
  width,
  layoutId,
  fresh,
}: {
  rank: Rank;
  width: string;
  /** Shared-layout id: the learner's rank group flies here when it becomes a book. */
  layoutId?: string;
  /** Laid down after this table mounted: pop it in. */
  fresh: boolean;
}) {
  const reduced = useReducedMotionPref();
  const row = rowLayout(4, width, `calc(-0.72 * ${width})`, 0.2);
  return (
    <motion.span
      layoutId={reduced ? undefined : layoutId}
      data-testid={`gofish-book-${rank}`}
      data-rank={rank}
      initial={fresh && !reduced && !layoutId ? { opacity: 0, y: -26, scale: 1.5 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 22 }}
      className="relative inline-flex shrink-0 items-end"
      style={row.container}
    >
      {SUITS_SHOWN.map((suit, i) => (
        <span
          key={suit}
          className="relative inline-flex shrink-0"
          style={{
            marginInlineStart: row.margin(i),
            zIndex: i,
            transform: `rotate(${(i - 1.5) * 4}deg)`,
          }}
        >
          <PlayingCard code={`${rank}${suit}` as CardCode} decorative style={{ width }} />
        </span>
      ))}
    </motion.span>
  );
}

/** Every book a seat has made, in the order they were made. */
export function BookRow({
  seat,
  name,
  books,
  width,
  freshFrom,
  layoutPrefix,
  emptyText,
  you = false,
  className,
}: {
  seat: PlayerId;
  name: string;
  books: readonly GoFishBook[];
  width: string;
  /** Books at or after this index were laid down while the table was on screen. */
  freshFrom: number;
  /** The learner's books share layout ids with their rank groups. */
  layoutPrefix?: string;
  emptyText?: string;
  you?: boolean;
  className?: string;
}) {
  const ranks = books.map((b) => b.rank);
  const label = you
    ? ranks.length > 0
      ? t('goFish.zone.yourBooks', { ranks: rankList(ranks) })
      : t('goFish.zone.yourBooksNone')
    : ranks.length > 0
      ? t('goFish.zone.books', { name, ranks: rankList(ranks) })
      : t('goFish.zone.booksNone', { name });
  return (
    <div
      role="img"
      aria-label={label}
      data-testid={`gofish-books-${seat}`}
      data-count={books.length}
      className={cn('flex min-h-6 flex-wrap items-end justify-center gap-x-1.5 gap-y-1', className)}
    >
      {books.map((b, i) => (
        <BookStack
          key={b.rank}
          rank={b.rank}
          width={width}
          fresh={i >= freshFrom}
          layoutId={layoutPrefix ? `${layoutPrefix}-rank-${b.rank}` : undefined}
        />
      ))}
      {books.length === 0 && emptyText ? (
        <span aria-hidden="true" className="text-mist text-[0.6875rem] leading-tight italic">
          {emptyText}
        </span>
      ) : null}
    </div>
  );
}

/** A small fan of card backs: how many cards a seat holds, never which. */
export function BackFan({ count }: { count: number }) {
  const reduced = useReducedMotionPref();
  const width = 'clamp(16px, 4.4vw, 24px)';
  const row = rowLayout(count, width, `calc(-0.6 * ${width})`, 0.18);
  return (
    <div
      aria-hidden="true"
      data-testid="gofish-backs"
      data-count={count}
      className="relative mx-auto flex items-end justify-center"
      style={{ ...row.container, minHeight: `calc(${width} * 1.4)` }}
    >
      <AnimatePresence initial={!reduced}>
        {Array.from({ length: count }, (_, i) => (
          <motion.span
            key={i}
            className="relative inline-flex shrink-0"
            style={{ marginInlineStart: row.margin(i), zIndex: i }}
            initial={reduced ? false : { opacity: 0, y: 34, rotate: 12 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 20 }}
            transition={
              reduced ? { duration: 0 } : { delay: Math.min(i * 0.05, 0.5), duration: 0.3 }
            }
          >
            <CardBack size="xs" style={{ width }} />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

export interface OpponentSeatProps {
  seat: PlayerId;
  persona: BotPersona;
  count: number;
  books: readonly GoFishBook[];
  booksFreshFrom: number;
  /** It is this seat's turn. */
  active: boolean;
  thinking: boolean;
  /** Chosen as the player to ask. */
  picked: boolean;
  /** Coach mode: a legal target. */
  glow: boolean;
  /** The coach's pick. */
  suggested: boolean;
  winner: boolean;
  busy: boolean;
  roving: Roving;
  /** sr-only descriptions (busy reason, coach's pick). */
  busyId: string;
  suggestedId: string;
  onPick: (seat: PlayerId) => void;
}

/**
 * One bot's seat. The top of it is a real button (`gofish-target-<seat>`, aria-pressed):
 * pick who to ask. A seat without cards stays pressable — the coach explains why you can't
 * ask them.
 */
export function OpponentSeat({
  seat,
  persona,
  count,
  books,
  booksFreshFrom,
  active,
  thinking,
  picked,
  glow,
  suggested,
  winner,
  busy,
  roving,
  busyId,
  suggestedId,
  onPick,
}: OpponentSeatProps) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const nameId = `${ids}-name`;
  const unavailableId = `${ids}-out`;
  const out = count === 0;
  // "Out of cards" is already on the button's count line, so it isn't repeated here.
  const status = thinking ? t('play.seat.thinking') : active ? t('play.seat.active') : null;
  const describedBy = [
    busy ? busyId : out ? unavailableId : null,
    suggested && !busy ? suggestedId : null,
  ]
    .filter(Boolean)
    .join(' ');
  const key = String(seat);

  return (
    <div
      role="group"
      aria-labelledby={nameId}
      data-testid={`gofish-seat-${seat}`}
      data-active={active || undefined}
      data-thinking={thinking || undefined}
      data-winner={winner || undefined}
      className={cn(
        'relative flex min-w-0 flex-col items-stretch gap-1 rounded-2xl border p-1.5 transition-[border-color,background-color,box-shadow] duration-200',
        active
          ? 'border-gold-300/80 bg-felt-950/45 shadow-[0_0_0_1px_rgb(245_215_122/0.35),0_0_26px_-4px_rgb(245_215_122/0.55)]'
          : 'border-gold-300/15 bg-felt-950/25',
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
      {winner ? (
        <span className="bg-gold-300 text-ink absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 rounded-full px-2 py-px text-[0.625rem] font-extrabold tracking-[0.12em] uppercase shadow">
          <TrophyIcon size={11} aria-hidden="true" />
          {t('goFish.seat.winner')}
        </span>
      ) : null}

      <button
        ref={roving.refFor(key)}
        type="button"
        data-roving-key={key}
        tabIndex={roving.tabIndexFor(key)}
        data-testid={`gofish-target-${seat}`}
        data-highlighted={glow || undefined}
        data-suggested={suggested || undefined}
        aria-pressed={picked}
        aria-label={t('goFish.seat.ask', { name: persona.name })}
        aria-describedby={describedBy || undefined}
        aria-disabled={busy || out || undefined}
        onClick={() => onPick(seat)}
        className={cn(
          'group/seat ease-snap relative flex min-h-14 w-full min-w-0 items-center gap-2 rounded-xl border px-2 py-1.5 text-start transition-[transform,background-color,border-color,box-shadow,opacity] duration-150 select-none active:translate-y-px',
          picked
            ? 'border-gold-200 bg-[linear-gradient(180deg,rgb(245_215_122/0.32),rgb(214_164_44/0.18))] shadow-[inset_0_0_0_1px_rgb(251_232_166/0.6),0_8px_20px_-10px_rgb(245_215_122/0.9)]'
            : 'border-gold-300/30 bg-felt-950/35 hover:border-gold-300/70 hover:bg-felt-950/55',
          out && !picked && 'opacity-70',
          busy && 'cursor-not-allowed',
        )}
      >
        {glow && !suggested ? (
          <span
            aria-hidden="true"
            className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
          />
        ) : null}
        {suggested ? <SuggestedRing testId={`gofish-target-${seat}-ring`} /> : null}
        <BotAvatar persona={persona} size="sm" thinking={thinking} showDots={false} decorative />
        <span className="flex min-w-0 flex-1 flex-col">
          <span
            id={nameId}
            className="text-gold-100 text-[0.8125rem] leading-tight font-bold break-words sm:text-sm"
          >
            {persona.name}
          </span>
          <span
            className="text-mist tabular text-[0.6875rem] leading-tight font-semibold"
            data-testid={`gofish-count-${seat}`}
            data-count={count}
          >
            <span className="whitespace-nowrap">
              {out ? t('goFish.seat.out') : cardCountText(count)}
            </span>
            <span aria-hidden="true"> · </span>
            <span className="whitespace-nowrap">{booksText(books.length)}</span>
          </span>
        </span>
        {picked ? (
          <span
            aria-hidden="true"
            className="bg-gold-300 text-ink absolute -top-2 -right-1.5 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] uppercase shadow"
          >
            {t('goFish.seat.picked')}
          </span>
        ) : null}
      </button>

      <p className="text-gold-300 flex min-h-4 items-center justify-center gap-1 text-[0.6875rem] leading-none font-semibold">
        {status ? (
          <span>{status}</span>
        ) : (
          <span className="text-mist hidden truncate md:inline">{persona.tagline}</span>
        )}
        {thinking ? <ThinkingDots size="sm" /> : null}
      </p>
      <div
        role="img"
        aria-label={
          out
            ? t('goFish.zone.out', { name: persona.name })
            : t('goFish.zone.backs', { name: persona.name, count: cardCountText(count) })
        }
      >
        <BackFan count={count} />
      </div>
      <BookRow
        seat={seat}
        name={persona.name}
        books={books}
        width="clamp(19px, 5.2vw, 27px)"
        freshFrom={booksFreshFrom}
      />
      <span id={unavailableId} className="sr-only">
        {t('goFish.seat.unavailable', { name: persona.name })}
      </span>
    </div>
  );
}

/** The pulsing gold ring + "Pro pick" tag on the coach's suggestion. */
export function SuggestedRing({ testId }: { testId?: string }) {
  const reduced = useReducedMotionPref();
  return (
    <>
      <motion.span
        aria-hidden="true"
        data-testid={testId}
        className="pointer-events-none absolute -inset-1 rounded-[0.95rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
        animate={reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.03, 1] }}
        transition={
          reduced ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      <span
        aria-hidden="true"
        className="bg-gold-200 text-ink absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
      >
        <SparkleIcon size={9} />
        {t('goFish.ask.pick')}
      </span>
    </>
  );
}
