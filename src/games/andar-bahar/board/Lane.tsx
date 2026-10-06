'use client';
/**
 * One of the two long lanes printed on the felt — ANDAR (inside) above the joker, BAHAR
 * (outside) below it — with its payout, its card count, the learner's bet chip and the
 * dealt cards as an overlapping row that wraps onto a second line on narrow screens.
 *
 * The wrap is pure CSS: a grid of narrow fixed-width tracks (the visible step between two
 * cards); each card is wider than its track and overlaps the next one, so any number of
 * cards fits without measuring and without layout shift.
 */
import { motion } from 'motion/react';
import { type RefObject } from 'react';
import { joinNames } from '@/components/play/personas';
import { cn } from '@/components/ui/cn';
import { cardName } from '@/games/core/cards';
import { useReducedMotionPref } from '@/lib/motion';
import { type DealtCard, type Side } from '../engine';
import { abt } from './strings';
import { TableCard } from './TableCard';

/** Width of a dealt card: small enough for two rows of 25 at 375 px. */
export const LANE_CARD_W = 'clamp(34px, 10.2vw, 58px)';
const STEP = `calc(${LANE_CARD_W} * 0.44)`;
const CARD_H = `calc(${LANE_CARD_W} * 1.4)`;
/** A wrapped row starts 62% of a card height below the previous one. */
const ROW_H = `calc(${CARD_H} * 0.62)`;

export type LaneOutcome = 'win' | 'loss';

export interface LaneProps {
  side: Side;
  cards: readonly DealtCard[];
  /** The learner's bet is on this lane. */
  bet: boolean;
  /** The deal is over and the match landed here. */
  winner: boolean;
  /** The deal is over and the match landed on the other lane. */
  loser: boolean;
  /** The next card will land here. */
  next: boolean;
  /** Cards numbered above this were dealt while the table was on screen (they fly in). */
  openingCount: number;
  /** Position of the matching card in the deal, if it is in this lane. */
  matchNumber: number | null;
  /** Result of the learner's bet once the deal is over (only on the bet lane). */
  outcome: LaneOutcome | null;
  sourceRef: RefObject<HTMLElement | null>;
}

const NAME_KEY = { andar: 'andarBahar.lane.andar', bahar: 'andarBahar.lane.bahar' } as const;
const MEANING_KEY = {
  andar: 'andarBahar.lane.andarMeaning',
  bahar: 'andarBahar.lane.baharMeaning',
} as const;
const ODDS_KEY = {
  andar: 'andarBahar.lane.andarOdds',
  bahar: 'andarBahar.lane.baharOdds',
} as const;

/** "Pays 0.9 to 1" / "Pays 1 to 1". */
function paysText(side: Side): string {
  return abt('andarBahar.lane.pays', { odds: abt(ODDS_KEY[side]) });
}

export function laneLabel(side: Side, cards: readonly DealtCard[]): string {
  const vars = {
    side: abt(NAME_KEY[side]),
    meaning: abt(MEANING_KEY[side]).toLowerCase(),
    pays: abt(ODDS_KEY[side]),
  };
  if (cards.length === 0) return abt('andarBahar.lane.labelEmpty', vars);
  const count =
    cards.length === 1
      ? abt('andarBahar.lane.countOne')
      : abt('andarBahar.lane.countMany', { n: cards.length });
  return abt('andarBahar.lane.label', {
    ...vars,
    cards: `${count} — ${joinNames(cards.map((c) => cardName(c.card)))}`,
  });
}

export function Lane({
  side,
  cards,
  bet,
  winner,
  loser,
  next,
  openingCount,
  matchNumber,
  outcome,
  sourceRef,
}: LaneProps) {
  const reduced = useReducedMotionPref();
  const name = abt(NAME_KEY[side]);
  const extra = [
    bet ? abt('andarBahar.lane.yourBet', { side: name }) : null,
    winner ? abt('andarBahar.lane.winner', { side: name }) : null,
  ]
    .filter(Boolean)
    .join(' ');
  const label = extra ? `${laneLabel(side, cards)} ${extra}` : laneLabel(side, cards);

  return (
    <div
      role="group"
      aria-label={label}
      data-testid={`ab-lane-${side}`}
      data-count={cards.length}
      data-bet={bet || undefined}
      data-next={next || undefined}
      data-winner={winner || undefined}
      className={cn(
        'relative rounded-2xl border-2 px-2.5 pt-2 pb-2.5 transition-[border-color,box-shadow,opacity,background-color] duration-300 sm:px-4 sm:pt-2.5',
        winner
          ? 'border-gold-200 bg-felt-950/40 shadow-[0_0_0_1px_rgb(245_215_122/0.4),0_0_34px_-4px_rgb(245_215_122/0.7)]'
          : next
            ? 'border-gold-300/60 bg-felt-950/25'
            : 'border-gold-300/25 bg-felt-950/15',
        loser && 'opacity-60',
      )}
    >
      {/* Printed double rule, like a real Andar Bahar board. */}
      <span
        aria-hidden="true"
        className="border-gold-300/15 pointer-events-none absolute inset-1 rounded-xl border border-dashed"
      />
      {outcome ? <OutcomeStamp outcome={outcome} /> : null}
      <div className="relative flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-y-0.5 sm:flex-row sm:items-baseline sm:gap-x-2">
          <span
            aria-hidden="true"
            className="font-display text-foil text-xl leading-none font-extrabold tracking-[0.16em] uppercase sm:text-2xl"
          >
            {name}
          </span>
          <span
            aria-hidden="true"
            className="text-mist text-[0.625rem] font-semibold tracking-[0.12em] uppercase sm:text-[0.6875rem] sm:tracking-[0.14em]"
          >
            {abt(MEANING_KEY[side])} · {paysText(side)}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {next ? (
            <motion.span
              aria-hidden="true"
              initial={reduced ? false : { opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduced ? 0 : 0.2 }}
              className="bg-gold-300/15 text-gold-200 border-gold-300/40 hidden rounded-full border px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.1em] uppercase min-[400px]:inline-flex"
            >
              {abt('andarBahar.lane.next')}
            </motion.span>
          ) : null}
          {bet ? <BetChip side={side} outcome={outcome} /> : null}
          <span
            aria-hidden="true"
            data-testid={`ab-lane-${side}-count`}
            className="border-gold-300/40 bg-felt-950/70 text-gold-100 tabular inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-2 text-sm font-bold"
          >
            {abt('andarBahar.lane.count', { n: cards.length })}
          </span>
        </div>
      </div>

      <div
        className="relative mt-2 grid justify-start"
        style={{
          gridTemplateColumns: `repeat(auto-fill, ${STEP})`,
          gridAutoRows: ROW_H,
          paddingInlineEnd: `calc(${LANE_CARD_W} - ${STEP})`,
          paddingBottom: `calc(${CARD_H} - ${ROW_H})`,
          minHeight: CARD_H,
        }}
      >
        {cards.length === 0 ? (
          <span
            aria-hidden="true"
            className="border-gold-300/30 text-mist/80 absolute inset-y-0 left-0 flex items-center justify-center rounded-[8%/5.7%] border border-dashed px-1 text-center text-[0.5625rem] leading-tight font-semibold"
            style={{ width: LANE_CARD_W, height: CARD_H }}
          >
            {abt('andarBahar.lane.empty')}
          </span>
        ) : null}
        {cards.map((c, i) => (
          <TableCard
            key={c.number}
            code={c.card}
            width={LANE_CARD_W}
            fly={c.number > openingCount}
            sourceRef={sourceRef}
            match={matchNumber === c.number}
            zIndex={i + 1}
          />
        ))}
      </div>
    </div>
  );
}

/** The learner's one-stake chip, dropped onto the lane they bet on. */
function BetChip({ side, outcome }: { side: Side; outcome: LaneOutcome | null }) {
  const reduced = useReducedMotionPref();
  const spring = reduced
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 460, damping: 22 };
  return (
    <span
      className="relative inline-flex items-center"
      data-testid="ab-bet-chip"
      data-side={side}
      data-outcome={outcome ?? undefined}
    >
      <span className="sr-only">{abt('andarBahar.bet.chipSr', { side: abt(NAME_KEY[side]) })}</span>
      <span
        aria-hidden="true"
        className="border-gold-300/45 relative inline-flex size-8 items-center justify-center rounded-full border border-dashed"
      >
        <motion.span
          className="absolute inline-flex"
          initial={reduced ? false : { y: -28, opacity: 0, scale: 1.3 }}
          animate={
            outcome === 'loss'
              ? { y: reduced ? 0 : -18, opacity: reduced ? 0.35 : 0, scale: 0.8 }
              : { y: 0, opacity: 1, scale: 1 }
          }
          transition={outcome === 'loss' && !reduced ? { delay: 0.5, duration: 0.45 } : spring}
        >
          <Chip fill="#c22f47" inner="#9e2036" />
        </motion.span>
        {outcome === 'win' ? (
          <motion.span
            className="absolute inline-flex"
            initial={reduced ? false : { x: 30, y: -6, opacity: 0 }}
            animate={{ x: 5, y: -4, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { ...spring, delay: 0.45 }}
          >
            <Chip fill="#d6a42c" inner="#b4841a" />
          </motion.span>
        ) : null}
      </span>
    </span>
  );
}

function Chip({ fill, inner }: { fill: string; inner: string }) {
  return (
    <svg viewBox="0 0 32 32" className="size-6 drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]">
      <circle cx={16} cy={16} r={15} fill={fill} />
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

/** "You win" / "You lose", stamped on the lane the learner bet on. */
function OutcomeStamp({ outcome }: { outcome: LaneOutcome }) {
  const reduced = useReducedMotionPref();
  return (
    <motion.span
      data-testid="ab-outcome"
      data-outcome={outcome}
      initial={reduced ? false : { scale: 1.8, opacity: 0, rotate: -18 }}
      animate={{ scale: 1, opacity: 1, rotate: -6 }}
      transition={
        reduced ? { duration: 0 } : { delay: 0.55, type: 'spring', stiffness: 420, damping: 17 }
      }
      className={cn(
        'absolute -top-3 right-14 z-30 rounded-md border-2 px-1.5 py-0.5 text-[0.625rem] font-extrabold tracking-[0.12em] whitespace-nowrap uppercase shadow-[0_8px_18px_-8px_rgb(0_0_0/0.9)] sm:text-xs',
        outcome === 'win'
          ? 'border-gold-200 bg-gold-300 text-ink'
          : 'border-velvet-300/70 bg-velvet-600 text-cream',
      )}
    >
      <span className="sr-only">{abt('andarBahar.outcome.label')} </span>
      {outcome === 'win' ? abt('andarBahar.outcome.win') : abt('andarBahar.outcome.loss')}
    </motion.span>
  );
}
