'use client';
/**
 * The middle of the Hearts table: four slots laid out like the seats (you at the bottom,
 * the player on your left on the left…). Each card flies in from the seat that played it.
 * When the fourth card lands the winning card glows, and after a beat the whole trick
 * sweeps off towards the player who won it. Reduced motion: cards simply appear, and the
 * finished trick stays put until the next card is played.
 */
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { PlayingCard } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { cardName } from '@/games/core/cards';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/hearts/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type HeartsPlay } from '../engine';
import { SEATS } from '../rules';
import { positionOf, TOWARDS, type SeatPosition, type TrickView } from './shared';

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
  const nameOf = (seat: PlayerId) => personas[seat]?.name ?? `Player ${seat}`;

  useEffect(() => {
    if (!view.complete || reduced) return;
    const id = window.setTimeout(() => setSweptAt(trickCount), TRICK_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [view.complete, reduced, trickCount]);

  const swept = view.complete && sweptAt === trickCount;
  const bySeat = new Map<PlayerId, HeartsPlay>(view.plays.map((p) => [p.seat, p]));
  const playsText = view.plays
    .map((p, i) =>
      i === 0
        ? t('hearts.zone.led', { name: nameOf(p.seat), card: cardName(p.card) })
        : t('hearts.zone.play', { name: nameOf(p.seat), card: cardName(p.card) }),
    )
    .join(', ');
  const label = view.complete
    ? t('hearts.zone.lastTrick', { name: nameOf(view.winner ?? 0), plays: playsText })
    : view.plays.length > 0
      ? t('hearts.zone.trick', { n: view.number, plays: playsText })
      : view.number === 1
        ? t('hearts.zone.trickFirst', { name: nameOf(view.leader) })
        : t('hearts.zone.trickEmpty', { n: view.number, name: nameOf(view.leader) });

  const caption = captionFor(view, human, nameOf);
  const winnerPos = view.winner !== null ? positionOf(view.winner) : null;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        role="group"
        aria-label={label}
        data-testid="hearts-trick"
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
          return (
            <div
              key={seat}
              data-testid={`hearts-trick-slot-${seat}`}
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
                  swept={swept}
                  sweepTo={winnerPos}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      {/* Who leads / who took the trick: below the cards, so it never covers them. */}
      <p aria-hidden="true" className="flex min-h-6 items-center justify-center text-center">
        {caption ? (
          <motion.span
            key={caption}
            data-testid="hearts-trick-caption"
            initial={reduced ? false : { opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reduced ? 0 : 0.22 }}
            className={cn(
              'rounded-full px-2.5 py-0.5 text-xs leading-tight font-extrabold tracking-wide whitespace-nowrap',
              view.complete
                ? view.points > 0
                  ? 'bg-velvet-600/90 text-cream'
                  : 'bg-gold-300 text-ink'
                : 'text-gold-200',
            )}
          >
            {caption}
          </motion.span>
        ) : null}
      </p>
    </div>
  );
}

function captionFor(
  view: TrickView,
  human: PlayerId,
  nameOf: (seat: PlayerId) => string,
): string | null {
  if (view.complete && view.winner !== null) {
    const points = view.points;
    if (view.winner === human) {
      return points > 0 ? t('hearts.table.youTakePoints', { points }) : t('hearts.table.youTake');
    }
    const name = nameOf(view.winner);
    return points > 0
      ? t('hearts.table.takesPoints', { name, points })
      : t('hearts.table.takes', { name });
  }
  if (view.plays.length > 0) return null;
  const first = view.number === 1;
  if (view.leader === human)
    return first ? t('hearts.table.youLeadTwo') : t('hearts.table.youLead');
  const name = nameOf(view.leader);
  return first ? t('hearts.table.leadsTwo', { name }) : t('hearts.table.leads', { name });
}

/** One card in the trick: flies in from its seat, glows if it won, sweeps to the winner. */
function TrickCard({
  play,
  winning,
  swept,
  sweepTo,
}: {
  play: HeartsPlay;
  winning: boolean;
  swept: boolean;
  sweepTo: SeatPosition | null;
}) {
  const reduced = useReducedMotionPref();
  const from = TOWARDS[positionOf(play.seat)];
  const to = sweepTo ? TOWARDS[sweepTo] : null;
  return (
    <motion.div
      className="relative"
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
          data-testid="hearts-trick-winner"
          className="bg-gold-300 text-ink absolute -top-2 left-1/2 z-10 -translate-x-1/2 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
        >
          {t('hearts.table.winner')}
        </span>
      ) : null}
    </motion.div>
  );
}
