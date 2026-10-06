'use client';
/**
 * The middle of the War table: both players' cards for the latest battle, side by side.
 *
 *   ┌ Battle 12 ─────────── [ WAR! ] ──────────────┐
 *   │   You              (VS)       Bugle Bhaskar  │
 *   │   7♥ ▒▒▒ A♥                    7♣ ▒▒▒ J♣     │  opening card, 3 face down, deciding card
 *   │          You win the war! You take all 10.   │
 *   └──────────────────────────────────────────────┘
 *
 * A new battle plays out step by step (see `revealTimeline`): the opening cards fly from
 * the piles and turn over, every war raises the banner and fans three cards face down, and
 * the result lands last. When the next battle starts, the old cards sweep off towards the
 * winner's pile. Face-down cards are drawn with CardBack and carry no card code, so they
 * never reach the DOM. Reduced motion: everything simply appears.
 */
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useState,
  type Ref,
  type RefObject,
} from 'react';
import { CardBack, PlayingCard, rowLayout } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { t } from '@/games/war/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type Pair, type WarBattle, type WarSeat } from '../engine';
import {
  bannerText,
  finalStep,
  laneSlots,
  laneText,
  outcomeWords,
  revealTimeline,
  tiesShown,
  type BattleSlot,
  type RevealStep,
} from './view';

/** One battle card's width: big on desktop, still comfortable at 320 px. */
export const BATTLE_CARD_W = 'clamp(50px, 15.5vw, 92px)';
/** Seconds a card takes to fly from a pile to the battle. */
const TRAVEL = 0.42;
const GLIDE = [0.22, 1, 0.36, 1] as const;
/** Seconds between face-down cards fanning out in a war. */
const DOWN_STAGGER = 0.09;

export interface BattleAreaProps {
  /** The latest battle, or null before the first flip. */
  battle: WarBattle | null;
  /** Battles up to this number were already on the table: show them without a replay. */
  settled: number;
  botName: string;
  /** The two piles (index = seat), where flying cards start. */
  piles: Pair<RefObject<HTMLDivElement | null>>;
  /** Called once a battle's reveal has finished. */
  onRevealed: (battleNumber: number) => void;
}

export function BattleArea({ battle, settled, botName, piles, onRevealed }: BattleAreaProps) {
  const reduced = useReducedMotionPref();
  const content = battle ? (
    <BattleView
      key={battle.number}
      battle={battle}
      animate={battle.number > settled && !reduced}
      botName={botName}
      piles={piles}
      onRevealed={onRevealed}
    />
  ) : (
    <ReadyView key="ready" botName={botName} />
  );
  return (
    <div
      role="group"
      aria-label={t('war.zone.battle')}
      data-testid="war-battle"
      data-number={battle?.number ?? 0}
      className="border-gold-300/25 relative rounded-3xl border bg-[radial-gradient(ellipse_at_center,rgb(26_112_77/0.55),rgb(3_17_11/0.55)_75%)] px-2 pt-2 pb-2.5 shadow-[inset_0_0_0_1px_rgb(245_215_122/0.08),inset_0_18px_40px_-24px_rgb(0_0_0/0.9)] sm:px-4 sm:pt-3 sm:pb-3.5"
    >
      {/* Brass rail with marquee bulbs along the top of the battle box. */}
      <span
        aria-hidden="true"
        className="marquee-bulbs pointer-events-none absolute inset-x-6 top-0 h-1.5 opacity-50"
      />
      {reduced ? content : <AnimatePresence mode="popLayout">{content}</AnimatePresence>}
    </div>
  );
}

/* ------------------------------------------------------------------ ready */

/*
 * The ready view and a battle share one skeleton (header row, two lanes around the VS
 * medallion, outcome slot), so the first Flip never makes the table — and the Flip button
 * under the learner's thumb — jump.
 */
const VIEW_CLASS = 'flex flex-col gap-1.5';
const HEADER_CLASS = 'flex min-h-8 items-center justify-between gap-2';
const LANES_CLASS = 'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 sm:gap-3';
const LANE_CLASS =
  'flex min-w-0 flex-col items-center gap-1 rounded-2xl px-1 pt-1 pb-1.5 transition-[background-color,box-shadow,opacity] duration-300';
const LANE_NAME_CLASS =
  'flex max-w-full items-center gap-1 text-[0.6875rem] font-bold tracking-[0.1em] uppercase';
const OUTCOME_CLASS = 'flex min-h-[2.75rem] flex-col items-center justify-center text-center';
/** Room for one card-height row, whatever the lane holds. */
const ROW_MIN_HEIGHT = `calc(${BATTLE_CARD_W} * 1.4 + 6px)`;

/** `ref` lets AnimatePresence (popLayout) lift the leaving view out of the layout. */
function ReadyView({ botName, ref }: { botName: string; ref?: Ref<HTMLDivElement> }) {
  return (
    <motion.div
      ref={ref}
      data-testid="war-ready"
      exit={{ opacity: 0, transition: { duration: 0.2 } }}
      className={VIEW_CLASS}
    >
      <div className={cn(HEADER_CLASS, 'justify-center')}>
        <p className="text-gold-100 font-display text-base font-bold tracking-wide">
          {t('war.ready.title')}
        </p>
      </div>
      <div aria-hidden="true" className={LANES_CLASS}>
        <ReadyLane name={t('war.lane.you')} />
        <VsMedallion />
        <ReadyLane name={botName} />
      </div>
      <div className={OUTCOME_CLASS}>
        <p className="text-mist max-w-[22rem] text-xs leading-snug text-balance sm:text-sm">
          {t('war.ready.hint')}
        </p>
      </div>
    </motion.div>
  );
}

function ReadyLane({ name }: { name: string }) {
  return (
    <div className={LANE_CLASS}>
      <p className={LANE_NAME_CLASS}>
        <span className="text-mist truncate">{name}</span>
      </p>
      <div className="flex items-end justify-center" style={{ minHeight: ROW_MIN_HEIGHT }}>
        <EmptySpot />
      </div>
    </div>
  );
}

function EmptySpot() {
  return (
    <span
      className="border-gold-300/40 bg-felt-950/30 block rounded-[8%/5.714%] border-2 border-dashed"
      style={{ width: BATTLE_CARD_W, aspectRatio: '5 / 7' }}
    />
  );
}

function VsMedallion() {
  return (
    <span
      aria-hidden="true"
      className="border-gold-300/70 bg-felt-950/85 font-display relative z-10 inline-flex size-9 shrink-0 items-center justify-center rounded-full border-2 text-[0.6875rem] font-extrabold tracking-[0.06em] shadow-[0_0_0_3px_rgb(3_17_11/0.6),0_0_18px_-2px_rgb(245_215_122/0.55)] sm:size-11 sm:text-sm"
    >
      <span className="text-foil">VS</span>
    </span>
  );
}

/* ----------------------------------------------------------------- battle */

function BattleView({
  battle,
  animate,
  botName,
  piles,
  onRevealed,
  ref,
}: {
  battle: WarBattle;
  animate: boolean;
  botName: string;
  piles: Pair<RefObject<HTMLDivElement | null>>;
  onRevealed: (battleNumber: number) => void;
  ref?: Ref<HTMLDivElement>;
}) {
  const reduced = useReducedMotionPref();
  // Decided once, when the battle lands on the table.
  const [play] = useState(animate);
  const timeline = useMemo(() => revealTimeline(battle), [battle]);
  const [step, setStep] = useState<RevealStep>(() =>
    play ? (timeline[0] ?? finalStep(battle)) : finalStep(battle),
  );
  const revealed = useEffectEvent(() => onRevealed(battle.number));

  useEffect(() => {
    if (!play) return;
    const ids = timeline.slice(1).map((s) =>
      window.setTimeout(() => {
        setStep(s);
        if (s.done) revealed();
      }, s.at),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [play, timeline]);

  const ties = tiesShown(battle, step.flipped);
  const words = outcomeWords(battle, botName);
  const toward = battle.winner === 0 ? 1 : battle.winner === 1 ? -1 : 0;

  return (
    <motion.div
      ref={ref}
      data-testid="war-battle-view"
      data-step={step.done ? 'done' : 'revealing'}
      exit={
        reduced
          ? { opacity: 0, transition: { duration: 0 } }
          : {
              y: toward * 150,
              opacity: 0,
              scale: 0.62,
              transition: { duration: 0.42, ease: GLIDE },
            }
      }
      className={VIEW_CLASS}
    >
      <div className={HEADER_CLASS}>
        <span className="text-gold-200 bg-felt-950/60 border-gold-300/30 tabular shrink-0 rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-bold tracking-[0.12em] whitespace-nowrap uppercase">
          {t('war.outcome.battle', { n: battle.number })}
        </span>
        {ties > 0 ? <WarBanner ties={ties} /> : null}
      </div>

      <div className={LANES_CLASS}>
        <Lane
          seat={0}
          battle={battle}
          step={step}
          name={t('war.lane.you')}
          origin={piles[0]}
          play={play}
        />
        <VsMedallion />
        <Lane seat={1} battle={battle} step={step} name={botName} origin={piles[1]} play={play} />
      </div>

      <div className={OUTCOME_CLASS}>
        {step.done ? (
          <motion.div
            data-testid="war-outcome"
            data-winner={battle.winner ?? 'none'}
            data-decided-by={battle.decidedBy}
            initial={play ? { opacity: 0, y: 8, scale: 0.94 } : false}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 24 }}
            className="flex flex-col items-center"
          >
            <p className="font-display text-foil text-base leading-tight font-extrabold tracking-wide text-balance min-[360px]:text-lg sm:text-xl">
              {words.title}
            </p>
            <p className="text-cream/90 text-xs font-semibold sm:text-sm">{words.detail}</p>
          </motion.div>
        ) : null}
      </div>
    </motion.div>
  );
}

/** The "WAR!" stamp: a velvet marquee sign that slams down when the cards tie. */
function WarBanner({ ties }: { ties: number }) {
  const reduced = useReducedMotionPref();
  return (
    <motion.span
      key={ties}
      data-testid="war-banner"
      data-wars={ties}
      initial={reduced ? false : { scale: 2.2, opacity: 0, rotate: -14 }}
      animate={{ scale: 1, opacity: 1, rotate: -4 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 15 }}
      className="border-gold-200 relative inline-flex items-center gap-1.5 rounded-md border-2 bg-[linear-gradient(180deg,var(--color-velvet-500),var(--color-velvet-700))] px-2 py-0.5 shadow-[0_0_0_2px_rgb(3_17_11/0.7),0_8px_22px_-6px_rgb(194_47_71/0.9)] min-[400px]:px-2.5"
    >
      <span className="sr-only">{t('war.banner.label')} </span>
      <span
        aria-hidden="true"
        className="marquee-bulbs absolute inset-x-1 top-0.5 h-1 opacity-70"
      />
      <span className="font-display text-gold-100 text-xs font-extrabold tracking-[0.1em] whitespace-nowrap uppercase min-[400px]:text-sm min-[400px]:tracking-[0.16em] sm:text-base">
        {bannerText(ties)}
      </span>
    </motion.span>
  );
}

function Lane({
  seat,
  battle,
  step,
  name,
  origin,
  play,
}: {
  seat: WarSeat;
  battle: WarBattle;
  step: RevealStep;
  name: string;
  origin: RefObject<HTMLDivElement | null>;
  play: boolean;
}) {
  const all = laneSlots(battle, seat);
  const slots = all.filter((s) => s.round < step.shown);
  const won = step.done && battle.winner === seat;
  const lost = step.done && battle.winner !== null && battle.winner !== seat;
  const label =
    seat === 0
      ? t('war.zone.yourCards', { cards: laneText(all) })
      : t('war.zone.botCards', { name, cards: laneText(all) });
  // Long war chains overlap more, so even a triple war fits a phone-width lane.
  const minVisible = Math.min(0.16, 0.7 / Math.max(slots.length, 1));
  const row = rowLayout(slots.length, BATTLE_CARD_W, `calc(-0.5 * ${BATTLE_CARD_W})`, minVisible);
  const lastUp = slots.findLastIndex((s) => s.kind === 'up');

  return (
    <div
      role="group"
      aria-label={label}
      data-testid={`war-lane-${seat}`}
      data-won={won || undefined}
      className={cn(
        LANE_CLASS,
        won && 'bg-gold-300/10 shadow-[inset_0_0_0_1px_rgb(245_215_122/0.55)]',
        lost && 'opacity-75',
      )}
    >
      <p aria-hidden="true" className={LANE_NAME_CLASS}>
        <span className={cn('truncate', won ? 'text-gold-200' : 'text-mist')}>{name}</span>
        {won ? (
          <span className="bg-gold-300 text-ink shrink-0 rounded-full px-1.5 py-px text-[0.5625rem] tracking-[0.08em]">
            {t('war.lane.wins')}
          </span>
        ) : null}
      </p>
      <div
        className="relative flex items-end justify-center"
        style={{ ...row.container, minHeight: ROW_MIN_HEIGHT }}
      >
        {slots.map((slot, i) => (
          <BattleCard
            key={slot.id}
            slot={slot}
            faceDown={slot.kind === 'down' || slot.round >= step.flipped}
            deciding={won && i === lastUp}
            delay={cardDelay(slot, seat, battle)}
            origin={origin}
            fly={play}
            marginInlineStart={row.margin(i)}
            zIndex={i}
          />
        ))}
      </div>
    </div>
  );
}

/** Seconds to wait before a card that has just appeared starts flying. */
function cardDelay(slot: BattleSlot, seat: WarSeat, battle: WarBattle): number {
  const seatOffset = seat === 1 ? 0.06 : 0;
  if (slot.round === 0) return seatOffset;
  if (slot.kind === 'down') {
    const i = Number(slot.id.split('-')[1] ?? 0);
    return seatOffset + i * DOWN_STAGGER;
  }
  const downs = battle.rounds[slot.round]?.down[seat].length ?? 0;
  return seatOffset + downs * DOWN_STAGGER + 0.05;
}

/** A deterministic little tilt for the face-down cards, so a war looks like a real fan. */
const DOWN_TILT = [-7, 4, -3];

function BattleCard({
  slot,
  faceDown,
  deciding,
  delay,
  origin,
  fly,
  marginInlineStart,
  zIndex,
}: {
  slot: BattleSlot;
  faceDown: boolean;
  deciding: boolean;
  delay: number;
  origin: RefObject<HTMLDivElement | null>;
  fly: boolean;
  marginInlineStart?: string;
  zIndex: number;
}) {
  // Decided once, when the card lands on the table.
  const [flying] = useState(fly);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useLayoutEffect(() => {
    if (!flying) return;
    const el = scope.current;
    const from = origin.current;
    let x = 40;
    let y = -90;
    if (el && from) {
      const a = el.getBoundingClientRect();
      const b = from.getBoundingClientRect();
      if (a.width > 0 && b.width > 0) {
        x = b.left + b.width / 2 - (a.left + a.width / 2);
        y = b.top + b.height / 2 - (a.top + a.height / 2);
      }
    }
    const controls = animate(
      el,
      { x: [x, 0], y: [y, 0], rotate: [x > 0 ? 14 : -14, 0], scale: [0.7, 1], opacity: [0, 1] },
      { delay, duration: TRAVEL, ease: GLIDE, opacity: { delay, duration: 0.1 } },
    );
    return () => controls.stop();
  }, [flying, delay, origin, animate, scope]);

  const down = slot.kind === 'down';
  const tilt = down ? (DOWN_TILT[Number(slot.id.split('-')[1] ?? 0) % DOWN_TILT.length] ?? 0) : 0;

  return (
    <div
      className="relative shrink-0"
      style={{
        marginInlineStart,
        zIndex,
        transform: down ? `translateY(5%) rotate(${tilt}deg)` : undefined,
      }}
    >
      <div ref={scope} style={flying ? { opacity: 0 } : undefined}>
        {down ? (
          <span data-war-down="" className="flex">
            <CardBack style={{ width: BATTLE_CARD_W }} />
          </span>
        ) : (
          <PlayingCard
            code={slot.code}
            faceDown={faceDown}
            decorative
            style={{ width: BATTLE_CARD_W }}
          />
        )}
      </div>
      {deciding ? (
        <span
          aria-hidden="true"
          data-testid="war-deciding"
          className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[9%/6.4%]"
        />
      ) : null}
    </div>
  );
}
