'use client';
/**
 * The middle of the Spades table: four slots laid out like the seats (you at the bottom,
 * your partner at the top, the opponents left and right). Each card flies in from the seat
 * that played it; a Spade played on another suit gets a small "Trump" tag. When the fourth
 * card lands the winning card glows, and after a beat the whole trick sweeps off towards
 * the player who won it. Reduced motion: cards simply appear, and the finished trick stays
 * put until the next card is played.
 */
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { PlayingCard } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { cardName } from '@/games/core/cards';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type SpadesPlay } from '../engine';
import { isSpade, SEATS } from '../rules';
import { positionOf, seatName, TOWARDS, type SeatPosition, type TrickView } from './shared';

/** How long a finished trick stays in the middle (with the winner glowing) before it sweeps. */
export const TRICK_HOLD_MS = 1000;

const TRICK_W = 'clamp(46px, 12.5vw, 72px)';
const GLIDE = [0.22, 1, 0.36, 1] as const;

const SLOT_CLASS: Record<SeatPosition, string> = {
  top: 'col-start-2 row-start-1 translate-y-[18%]',
  left: 'col-start-1 row-start-2 translate-x-[12%]',
  right: 'col-start-3 row-start-2 -translate-x-[12%]',
  bottom: 'col-start-2 row-start-3 -translate-y-[18%]',
};

export function TrickArea({
  view,
  trickCount,
  personas,
  human,
}: {
  view: TrickView;
  /** Completed tricks so far (keys the sweep, so each finished trick sweeps once). */
  trickCount: number;
  personas: readonly BotPersona[];
  human: PlayerId;
}) {
  const reduced = useReducedMotionPref();
  const [sweptAt, setSweptAt] = useState(-1);
  const nameOf = (seat: PlayerId) => seatName(personas, seat);

  useEffect(() => {
    if (!view.complete || reduced) return;
    const id = window.setTimeout(() => setSweptAt(trickCount), TRICK_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [view.complete, reduced, trickCount]);

  const swept = view.complete && sweptAt === trickCount;
  const bySeat = new Map<PlayerId, SpadesPlay>(view.plays.map((p) => [p.seat, p]));
  const led = view.plays[0]?.card;
  const playsText = view.plays
    .map((p, i) =>
      i === 0
        ? t('spades.zone.led', { name: nameOf(p.seat), card: cardName(p.card) })
        : t('spades.zone.play', { name: nameOf(p.seat), card: cardName(p.card) }),
    )
    .join(', ');
  const label = view.complete
    ? t('spades.zone.lastTrick', { name: nameOf(view.winner ?? 0), plays: playsText })
    : view.plays.length > 0
      ? t('spades.zone.trick', { n: view.number, plays: playsText })
      : t('spades.zone.trickEmpty', { n: view.number, name: nameOf(view.leader) });

  const caption =
    view.complete && view.winner !== null
      ? view.winner === human
        ? t('spades.table.youTake')
        : t('spades.table.takes', { name: nameOf(view.winner) })
      : view.plays.length === 0
        ? view.leader === human
          ? t('spades.table.youLead')
          : t('spades.table.leads', { name: nameOf(view.leader) })
        : null;
  const winnerPos = view.winner !== null ? positionOf(view.winner) : null;

  return (
    <div
      role="group"
      aria-label={label}
      data-testid="spades-trick"
      data-count={view.plays.length}
      data-number={view.number}
      data-state={
        swept ? 'swept' : view.complete ? 'complete' : view.plays.length > 0 ? 'playing' : 'empty'
      }
      data-winner={view.winner ?? undefined}
      className="relative mx-auto grid w-fit grid-cols-[repeat(3,auto)] grid-rows-[repeat(3,auto)] place-items-center"
    >
      {/* The printed ring on the felt the trick is played into. */}
      <span
        aria-hidden="true"
        className="border-gold-300/25 pointer-events-none absolute inset-[8%] rounded-[50%] border border-dashed"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[22%] rounded-full bg-[radial-gradient(circle,rgb(245_215_122/0.12),transparent_70%)]"
      />
      {Array.from({ length: SEATS }, (_, seat) => {
        const pos = positionOf(seat);
        const play = bySeat.get(seat);
        const winning = view.complete && view.winner === seat;
        const trumped =
          play !== undefined && led !== undefined && isSpade(play.card) && !isSpade(led);
        return (
          <div
            key={seat}
            data-testid={`spades-trick-slot-${seat}`}
            data-seat={seat}
            data-winner={winning || undefined}
            className={cn('relative z-[1] flex items-center justify-center', SLOT_CLASS[pos])}
            style={{ width: TRICK_W, aspectRatio: '5 / 7' }}
          >
            <span
              aria-hidden="true"
              className="border-gold-300/20 absolute inset-[6%] rounded-[8%/5.7%] border"
            />
            {play ? (
              <TrickCard
                key={`${view.number}-${play.card}`}
                play={play}
                winning={winning}
                trumped={trumped}
                swept={swept}
                sweepTo={winnerPos}
              />
            ) : null}
          </div>
        );
      })}
      <div
        aria-hidden="true"
        className="z-[2] col-start-2 row-start-2 flex flex-col items-center justify-center gap-0.5 px-0.5 text-center"
        style={{ width: TRICK_W }}
      >
        {caption ? (
          <motion.span
            key={caption}
            data-testid="spades-trick-caption"
            initial={reduced ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[0.625rem] leading-tight font-extrabold tracking-wide sm:text-xs',
              view.complete ? 'bg-gold-300 text-ink' : 'text-gold-200',
            )}
          >
            {caption}
          </motion.span>
        ) : null}
      </div>
    </div>
  );
}

/** One card in the trick: flies in from its seat, glows if it won, sweeps to the winner. */
function TrickCard({
  play,
  winning,
  trumped,
  swept,
  sweepTo,
}: {
  play: SpadesPlay;
  winning: boolean;
  trumped: boolean;
  swept: boolean;
  sweepTo: SeatPosition | null;
}) {
  const reduced = useReducedMotionPref();
  const from = TOWARDS[positionOf(play.seat)];
  const to = sweepTo ? TOWARDS[sweepTo] : null;
  return (
    <motion.div
      className="relative"
      data-trumped={trumped || undefined}
      initial={
        reduced ? false : { opacity: 0, x: from.x, y: from.y, rotate: from.rotate, scale: 0.8 }
      }
      animate={
        swept && to
          ? { opacity: 0, x: to.x, y: to.y, rotate: to.rotate, scale: 0.55 }
          : { opacity: 1, x: '0%', y: '0%', rotate: 0, scale: winning ? 1.06 : 1 }
      }
      transition={
        reduced
          ? { duration: 0 }
          : swept
            ? { duration: 0.5, ease: GLIDE }
            : {
                duration: 0.42,
                ease: GLIDE,
                scale: { type: 'spring', stiffness: 420, damping: 18 },
              }
      }
    >
      <PlayingCard code={play.card} decorative highlighted={winning} style={{ width: TRICK_W }} />
      {winning ? (
        <span
          aria-hidden="true"
          data-testid="spades-trick-winner"
          className="bg-gold-300 text-ink absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
        >
          {t('spades.table.winner')}
        </span>
      ) : trumped ? (
        <span
          aria-hidden="true"
          data-testid="spades-trick-trump"
          className="bg-ink text-cream border-gold-300/60 absolute -bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full border px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
        >
          ♠ {t('spades.table.trump')}
        </span>
      ) : null}
    </motion.div>
  );
}
