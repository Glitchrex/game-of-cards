'use client';
/**
 * The Teen Patti table (built on the Blackjack reference Board, see
 * src/games/blackjack/README.md).
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  [Chacha  In 3]            [Bindiya  In 5] D │  opponents, clockwise from your left:
 *   │   ▒▒ ▒▒ ▒▒  BLIND           ▒▒ ▒▒ ▒▒  SEEN   │  three face-down cards, blind/seen/packed,
 *   │   Blind chaal 2              Raised 4        │  what they did last, boots put in
 *   │  ╭──────────── POT 12 boots ─────────────╮   │  the pot (chip stack), the stake and the
 *   │  │ [deck]  Stake 2 · Blind 2 · Seen 4    │   │  blind / seen prices, the 64-boot pot
 *   │  │ ▓▓▓▓░░░░░░░░ Pot limit 64             │   │  limit meter, "Which hand wins?"
 *   │  ╰───────────────────────────────────────╯   │
 *   │   [You  In 3]  ▒▒ ▒▒ ▒▒   Playing blind      │  learner: cards face down until seen,
 *   │   [ 👁 See cards — free, then you bet ]      │  then face up with the hand's name
 *   │ [Chaal·2] [Raise·4] [Show·2] [Pack]          │  action bar (S / C / R / W / P, ←/→)
 *   └──────────────────────────────────────────────┘
 *
 * - Only what the learner may see is rendered: every hidden card is a face-down
 *   PlayingCard with a placeholder code (a face-down PlayingCard never mounts its face).
 *   Opponents' cards turn over only at a show / pot-limit showdown; packed hands never do.
 * - Any move can be attempted: unavailable actions look secondary but still call `onMove`,
 *   so the controller explains why. Only `busy` stops input, and buttons keep focus.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import { AnimatePresence, motion } from 'motion/react';
import {
  useEffect,
  useEffectEvent,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from 'react';
import { CardBack, rowLayout } from '@/components/cards';
import { Seat } from '@/components/play/Seat';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { type BotPersona, type BoardProps } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t, type TKey } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import {
  ACTION_KEYS,
  ActionBar,
  ActionButton,
  onActionArrows,
  type ActionState,
} from './board/ActionBar';
import { ChipStack } from './board/Chips';
import { RankingsSheet } from './board/Rankings';
import { TableCard } from './board/TableCard';
import {
  bootsText,
  cardList,
  dealDelay,
  handName,
  lastAction,
  lastBetIndex,
  prices as pricesFor,
  revealedSeats,
  sameDeal,
  structuralHint,
  type BetType,
} from './board/view';
import {
  rankHand,
  type HandCategory,
  type TeenPattiMove,
  type TeenPattiMoveType,
  type TeenPattiState,
} from './engine';
import { TEENPATTI_CAST } from './personas';

export type TeenPattiBoardProps = BoardProps<TeenPattiState, TeenPattiMove>;

/* ------------------------------------------------------------------ constants */

/** Opponents' cards: room to grow at a 3-seat table, so a showdown stays readable. */
const OPP_CARD_W = 'clamp(30px, 8.6vw, 46px)';
const OPP_CARD_W_ROOMY = 'clamp(32px, 9.6vw, 62px)';
const MY_CARD_W = 'clamp(62px, 18vw, 92px)';
const MY_FAN = [-7, 0, 7];

const SHORTCUTS: Readonly<Record<string, TeenPattiMoveType>> = Object.fromEntries(
  (Object.entries(ACTION_KEYS) as [TeenPattiMoveType, string][]).map(([type, key]) => [
    key.toLowerCase(),
    type,
  ]),
);

function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

function personaFor(personas: readonly BotPersona[], seat: PlayerId): BotPersona {
  return personas[seat] ?? TEENPATTI_CAST[seat - 1] ?? TEENPATTI_CAST[0]!;
}

type SeatStatus = 'blind' | 'seen' | 'packed';

function seatStatus(state: TeenPattiState, seat: PlayerId): SeatStatus {
  return state.packed[seat] ? 'packed' : state.seen[seat] ? 'seen' : 'blind';
}

/* ---------------------------------------------------------------- the board */

/**
 * Teen Patti's Board. The table remounts for every new deal (so the opening deal animates
 * again when the practice hand restarts): moves keep the state's `hands` array, a new
 * setup makes a new one.
 */
export function TeenPattiBoard(props: TeenPattiBoardProps) {
  const [deal, setDeal] = useState({ state: props.state, n: 0 });
  if (!sameDeal(deal.state, props.state)) setDeal({ state: props.state, n: deal.n + 1 });
  return <TeenPattiTable key={deal.n} {...props} />;
}

function TeenPattiTable({
  state,
  human,
  legalMoves,
  onMove,
  busy,
  thinking,
  coachMode,
  highlight,
  suggestedKey,
  personas,
  over,
}: TeenPattiBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const ids = useId();
  const revealed = revealedSeats(state, human, over);
  const seats = Array.from({ length: state.players }, (_, i) => i);
  const opponents = seats.filter((s) => s !== human);
  const legal = new Set(legalMoves.map((m) => m.type));
  const turn = over ? null : state.turn;

  const actionState = (type: TeenPattiMoveType): ActionState => ({
    legal: legal.has(type),
    glow: coachMode && highlight.has(type),
    suggested: suggestedKey !== null && suggestedKey === type,
  });

  /* ---- pressing */
  const [flash, setFlash] = useState<TeenPattiMoveType | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 180);
    return () => window.clearTimeout(id);
  }, [flash]);

  const press = (type: TeenPattiMoveType) => {
    if (busy) return;
    onMove({ type });
  };

  // S / C / R / W / P anywhere on the page — except while typing or inside another dialog.
  const onShortcut = useEffectEvent((e: globalThis.KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const type = SHORTCUTS[e.key.toLowerCase()];
    if (!type) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && isTypingTarget(target)) return;
    const dialog = target?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    e.preventDefault();
    if (busy) return;
    setFlash(type);
    onMove({ type });
  });
  useEffect(() => {
    const listener = (e: globalThis.KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const onArrows = (e: KeyboardEvent<HTMLElement>) => onActionArrows(e, rootRef.current);

  /* ---- what the buttons say */
  const price = pricesFor(state, human);
  const hintFor = (type: BetType): ReactNode => {
    if (over)
      return type === 'pack' ? t('teenPatti.actions.packHint') : t('teenPatti.actions.overHint');
    const structural = structuralHint(state, type);
    if (structural) return t(structural);
    if (type === 'pack') return t('teenPatti.actions.packHint');
    if (price[type].capped) return t('teenPatti.actions.limitHint');
    if (type === 'raise') {
      return (
        <>
          <span aria-hidden="true">{t('teenPatti.actions.raiseHint', { n: state.stake * 2 })}</span>
          <span className="sr-only">
            {t('teenPatti.actions.raiseHintLabel', { n: state.stake * 2 })}
          </span>
        </>
      );
    }
    if (type === 'show') return t('teenPatti.actions.showHint');
    return t('teenPatti.actions.chaalHint');
  };
  const hints: Record<BetType, ReactNode> = {
    chaal: hintFor('chaal'),
    raise: hintFor('raise'),
    show: hintFor('show'),
    pack: hintFor('pack'),
  };
  const actions: Record<BetType, ActionState> = {
    chaal: actionState('chaal'),
    raise: actionState('raise'),
    show: actionState('show'),
    pack: actionState('pack'),
  };

  const describe = {
    busy: `${ids}-busy`,
    unavailable: `${ids}-unavailable`,
    suggested: `${ids}-suggested`,
  };
  const busyReason = over
    ? t('teenPatti.actions.over')
    : state.packed[human]
      ? t('teenPatti.actions.waitPacked')
      : turn === null || turn === human
        ? t('teenPatti.actions.busy')
        : t('teenPatti.actions.wait', { name: personaFor(personas, turn).name });

  const winners = new Set(over && state.outcome ? state.outcome.winners : []);
  // Showdown flips go seat by seat, clockwise from the learner's left.
  const flipOrder = opponents.filter((s) => revealed.has(s));

  return (
    <div
      ref={rootRef}
      data-testid="tp-board"
      data-players={state.players}
      data-turn={turn ?? undefined}
      data-over={over || undefined}
      onKeyDown={onArrows}
      className="relative flex flex-col gap-3 sm:gap-4"
    >
      {/* Opponents, clockwise from the learner's left, along the far rail. */}
      <div
        role="group"
        aria-label={t('teenPatti.zone.opponents')}
        className={cn(
          'grid items-stretch gap-1.5 sm:gap-3',
          opponents.length === 1
            ? 'mx-auto w-full max-w-[15rem] grid-cols-1'
            : opponents.length === 3
              ? 'grid-cols-3'
              : 'grid-cols-2',
          opponents.length === 4 && 'sm:grid-cols-4',
        )}
      >
        {opponents.map((seat, i) => (
          <OpponentSeat
            key={seat}
            seat={seat}
            arc={arcOffset(i, opponents.length)}
            state={state}
            persona={personaFor(personas, seat)}
            active={turn === seat}
            thinking={thinking === seat}
            revealed={revealed.has(seat)}
            winner={winners.has(seat)}
            flipDelay={Math.max(0, flipOrder.indexOf(seat)) * 0.3}
            cardWidth={opponents.length <= 2 ? OPP_CARD_W_ROOMY : OPP_CARD_W}
            deckRef={deckRef}
          />
        ))}
      </div>

      <Centre
        state={state}
        over={over}
        deckRef={deckRef}
        current={state.seen[human] ? rankHand(state.hands[human] ?? []).category : null}
      />

      <LearnerSeat
        state={state}
        human={human}
        persona={personas[human] ?? null}
        active={turn === human}
        revealed={revealed.has(human)}
        winner={winners.has(human)}
        deckRef={deckRef}
      >
        <ActionButton
          type="see"
          variant="wide"
          state={actionState('see')}
          busy={busy}
          describe={describe}
          label={
            state.seen[human]
              ? t('teenPatti.actions.seen')
              : revealed.has(human)
                ? t('teenPatti.actions.shown')
                : undefined
          }
          hint={
            state.seen[human]
              ? t('teenPatti.actions.seenHint')
              : revealed.has(human)
                ? t('teenPatti.actions.shownHint')
                : t('teenPatti.actions.seeHint')
          }
          flash={flash === 'see'}
          onPress={press}
        />
      </LearnerSeat>

      <ActionBar
        actions={actions}
        prices={price}
        hints={hints}
        busy={busy}
        describe={describe}
        flash={flash}
        onPress={press}
      />
      <span id={describe.busy} hidden>
        {busyReason}
      </span>
      <span id={describe.unavailable} hidden>
        {t('teenPatti.actions.unavailable')}
      </span>
      <span id={describe.suggested} hidden>
        {t('teenPatti.actions.suggested')}
      </span>
    </div>
  );
}

/** Outer seats sit a little lower, so the row curves around the table like a rail. */
function arcOffset(i: number, count: number): number {
  if (count < 3) return 0;
  const mid = (count - 1) / 2;
  const norm = Math.abs(i - mid) / mid;
  return Math.round(norm * norm * 14);
}

/* ------------------------------------------------------------------- pieces */

function StatusBadge({ state, seat }: { state: TeenPattiState; seat: PlayerId }) {
  const status = seatStatus(state, seat);
  const tone = status === 'packed' ? 'mist' : status === 'seen' ? 'gold' : 'outline';
  const label: Record<SeatStatus, TKey> = {
    blind: 'teenPatti.status.blindLabel',
    seen: 'teenPatti.status.seenLabel',
    packed: 'teenPatti.status.packedLabel',
  };
  return (
    <Badge tone={tone} size="sm" data-testid={`tp-status-${seat}`} data-status={status}>
      <span aria-hidden="true">{t(`teenPatti.status.${status}`)}</span>
      <span className="sr-only">{t(label[status])}</span>
    </Badge>
  );
}

function Contributed({ seat, boots }: { seat: PlayerId; boots: number }) {
  return (
    <span
      data-testid={`tp-contrib-${seat}`}
      data-boots={boots}
      className="inline-flex items-center gap-1"
    >
      <ChipStack amount={boots} className="size-3.5" />
      <span aria-hidden="true">{t('teenPatti.seat.in', { n: boots })}</span>
      <span className="sr-only">
        {boots === 1 ? t('teenPatti.seat.inOne') : t('teenPatti.seat.inLabel', { n: boots })}
      </span>
    </span>
  );
}

function DealerButton({ seat }: { seat: PlayerId }) {
  return (
    <span
      data-testid="tp-dealer-button"
      data-seat={seat}
      title={t('teenPatti.seat.dealerLabel')}
      className="bg-ivory text-ink border-gold-300 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-[0.625rem] leading-none font-extrabold shadow-[0_2px_6px_rgb(0_0_0/0.6),inset_0_-2px_0_rgb(0_0_0/0.15)]"
    >
      <span aria-hidden="true">{t('teenPatti.seat.dealer')}</span>
      <span className="sr-only">{t('teenPatti.seat.dealerLabel')}</span>
    </span>
  );
}

function WinnerBadge({ seat, boots }: { seat: PlayerId; boots: number }) {
  const reduced = useReducedMotionPref();
  return (
    <motion.span
      data-testid={`tp-winner-${seat}`}
      data-boots={boots}
      initial={reduced ? false : { scale: 0.4, opacity: 0, rotate: -12 }}
      animate={{ scale: 1, opacity: 1, rotate: -4 }}
      transition={
        reduced ? { duration: 0 } : { delay: 0.6, type: 'spring', stiffness: 420, damping: 16 }
      }
      className="inline-flex"
    >
      <Badge
        tone="gold"
        icon={<SparkleIcon size={12} />}
        className="shadow-[0_0_18px_rgb(245_215_122/0.6)]"
      >
        <span aria-hidden="true">{t('teenPatti.seat.wins', { n: boots })}</span>
        <span className="sr-only">{t('teenPatti.seat.winsLabel', { n: boots })}</span>
      </Badge>
    </motion.span>
  );
}

function LastAction({ state, seat }: { state: TeenPattiState; seat: PlayerId }) {
  const last = lastAction(state, seat);
  return (
    <span
      data-testid={`tp-last-${seat}`}
      className="text-gold-200 min-h-4 text-[0.6875rem] leading-tight font-semibold"
    >
      {last ? t(last.key, { n: last.n }) : null}
    </span>
  );
}

function HandCards({
  state,
  seat,
  revealed,
  winner,
  width,
  fan,
  flipDelay,
  label,
  deckRef,
}: {
  state: TeenPattiState;
  seat: PlayerId;
  revealed: boolean;
  winner: boolean;
  width: string;
  fan?: readonly number[];
  flipDelay: number;
  label: string;
  deckRef: RefObject<HTMLDivElement | null>;
}) {
  const hand = state.hands[seat] ?? [];
  const packed = state.packed[seat] === true;
  const row = rowLayout(hand.length, width, `calc(-0.28 * ${width})`, 0.45);
  // The cards themselves are decorative: the group's label lists what may be seen.
  return (
    <div
      role="group"
      aria-label={label}
      data-testid={`tp-cards-${seat}`}
      data-revealed={revealed || undefined}
      data-packed={packed || undefined}
      className="relative flex items-end justify-center"
      style={{ ...row.container, minHeight: `calc(${width} * 1.45)` }}
    >
      {hand.map((code, i) => (
        <TableCard
          key={`c${seat}-${i}`}
          code={revealed ? code : null}
          width={width}
          delay={dealDelay(state, seat, i)}
          deckRef={deckRef}
          packed={packed && !revealed}
          winning={winner && revealed}
          rotate={fan?.[i] ?? 0}
          flipDelay={flipDelay + i * 0.09}
          marginInlineStart={row.margin(i)}
          zIndex={i}
        />
      ))}
    </div>
  );
}

function OpponentSeat({
  seat,
  arc,
  state,
  persona,
  active,
  thinking,
  revealed,
  winner,
  flipDelay,
  cardWidth,
  deckRef,
}: {
  seat: PlayerId;
  arc: number;
  state: TeenPattiState;
  persona: BotPersona;
  active: boolean;
  thinking: boolean;
  revealed: boolean;
  winner: boolean;
  flipDelay: number;
  cardWidth: string;
  deckRef: RefObject<HTMLDivElement | null>;
}) {
  const hand = state.hands[seat] ?? [];
  const packed = state.packed[seat] === true;
  const name = revealed ? handName(hand) : null;
  const cards = revealed
    ? t('teenPatti.zone.withName', { cards: cardList(hand), hand: name ?? '' })
    : packed
      ? t('teenPatti.zone.packed')
      : t('teenPatti.zone.hidden');
  const won = winner ? (state.outcome?.payouts[seat] ?? 0) : 0;
  return (
    <div
      data-testid={`tp-seat-${seat}`}
      data-active={active || undefined}
      data-packed={packed || undefined}
      data-winner={winner || undefined}
      className={cn('flex min-w-0 transition-opacity duration-300', packed && 'opacity-70')}
      style={{ paddingTop: `${arc}px` }}
    >
      <Seat
        persona={persona}
        active={active}
        thinking={thinking}
        layout="column"
        showTagline={false}
        score={<Contributed seat={seat} boots={state.contributed[seat] ?? 0} />}
        className={cn(
          'w-full px-1.5 py-2 sm:px-2.5',
          winner &&
            'border-gold-200/90 shadow-[0_0_0_1px_rgb(245_215_122/0.5),0_0_30px_-4px_rgb(245_215_122/0.7)]',
        )}
        data-testid={`tp-persona-${seat}`}
      >
        <div className="flex flex-col items-center gap-1">
          <p className="text-mist hidden text-center text-[0.6875rem] leading-snug sm:block">
            {persona.tagline}
          </p>
          <div className="flex items-center justify-center gap-1">
            <HandCards
              state={state}
              seat={seat}
              revealed={revealed}
              winner={winner}
              width={cardWidth}
              flipDelay={flipDelay}
              label={t('teenPatti.zone.theirs', { name: persona.name, cards })}
              deckRef={deckRef}
            />
            {state.dealer === seat ? <DealerButton seat={seat} /> : null}
          </div>
          <div className="flex min-h-5 flex-wrap items-center justify-center gap-1">
            <StatusBadge state={state} seat={seat} />
          </div>
          {name ? (
            <p
              data-testid={`tp-hand-name-${seat}`}
              className="text-gold-100 text-center text-[0.6875rem] leading-tight font-bold"
            >
              <span className="sr-only">{t('teenPatti.hand.label')} </span>
              {name}
            </p>
          ) : (
            <LastAction state={state} seat={seat} />
          )}
          {won > 0 ? <WinnerBadge seat={seat} boots={won} /> : null}
          {/* Room for the "Thinking…" line, so the row never jumps when a turn passes. */}
          {active || thinking ? null : <span aria-hidden="true" className="block h-[1.125rem]" />}
        </div>
      </Seat>
    </div>
  );
}

function Deck({ ref }: { ref: RefObject<HTMLDivElement | null> }) {
  return (
    <div aria-hidden="true" className="flex shrink-0 flex-col items-center">
      <div
        ref={ref}
        className="relative"
        style={{ width: 'clamp(30px, 8vw, 42px)', aspectRatio: '5 / 7' }}
      >
        {[2, 1, 0].map((i) => (
          <span
            key={i}
            className="absolute inset-0 flex"
            style={{ transform: `translate(${-i * 2}px, ${-i * 2}px) rotate(-8deg)` }}
          >
            <CardBack size="xs" style={{ width: '100%' }} />
          </span>
        ))}
      </div>
    </div>
  );
}

const OUTCOME_KEY: Record<NonNullable<TeenPattiState['outcome']>['kind'], TKey> = {
  'last-standing': 'teenPatti.outcome.last-standing',
  show: 'teenPatti.outcome.show',
  'pot-limit': 'teenPatti.outcome.pot-limit',
};

/** The middle of the table: the pot, the stake and its prices, the pot-limit meter. */
function Centre({
  state,
  over,
  deckRef,
  current,
}: {
  state: TeenPattiState;
  over: boolean;
  deckRef: RefObject<HTMLDivElement | null>;
  /** The learner's hand category once seen (marked in the cheat sheet). */
  current: HandCategory | null;
}) {
  const reduced = useReducedMotionPref();
  const betIndex = lastBetIndex(state);
  const lastBet = betIndex >= 0 ? state.history[betIndex] : undefined;
  const atLimit = state.pot >= state.potLimit;
  const outcome = over ? state.outcome : null;
  return (
    <section
      aria-label={t('teenPatti.zone.centre')}
      data-testid="tp-centre"
      className="border-gold-300/30 relative mx-auto flex w-full max-w-[34rem] flex-col gap-2 rounded-[2rem] border bg-[radial-gradient(ellipse_at_center,rgb(255_255_255/0.06),transparent_70%)] px-3 py-2.5 shadow-[inset_0_0_0_1px_rgb(245_215_122/0.08),inset_0_10px_30px_-18px_rgb(0_0_0/0.8)] sm:px-5 sm:py-3"
    >
      <div className="flex items-center gap-3">
        <Deck ref={deckRef} />
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5">
          <motion.span
            aria-hidden="true"
            className="inline-flex"
            initial={false}
            animate={
              outcome ? { scale: 0.75, opacity: 0.55, y: 6 } : { scale: 1, opacity: 1, y: 0 }
            }
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 300, damping: 24 }}
          >
            <ChipStack amount={state.pot} max={6} className="size-8 sm:size-9" />
          </motion.span>
          <p
            data-testid="tp-pot"
            data-pot={state.pot}
            data-collected={outcome ? true : undefined}
            className="relative flex flex-col leading-none"
          >
            <span
              aria-hidden="true"
              className="text-gold-300 text-[0.625rem] font-bold tracking-[0.22em] uppercase"
            >
              {outcome ? t('teenPatti.pot.collected') : t('teenPatti.pot.label')}
            </span>
            <span className="sr-only">
              {outcome
                ? t('teenPatti.pot.collectedLabel', { n: state.pot })
                : t('teenPatti.pot.potLabel', { n: state.pot })}
            </span>
            <span aria-hidden="true" className="flex items-baseline gap-1">
              <motion.span
                key={state.pot}
                initial={reduced ? false : { scale: 1.35, color: '#fff6d9' }}
                animate={{ scale: 1, color: '#f5d77a' }}
                transition={reduced ? { duration: 0 } : { duration: 0.35 }}
                className="font-display tabular text-2xl font-bold sm:text-3xl"
              >
                {state.pot}
              </motion.span>
              <span className="text-gold-100 text-xs font-semibold">
                {state.pot === 1 ? t('teenPatti.pot.unitOne') : t('teenPatti.pot.unit')}
              </span>
            </span>
            <AnimatePresence>
              {lastBet && !reduced ? (
                <motion.span
                  key={betIndex}
                  aria-hidden="true"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [6, -4, -10, -18] }}
                  transition={{ duration: 1.2, times: [0, 0.2, 0.7, 1] }}
                  className="text-gold-100 pointer-events-none absolute -top-1 -right-7 text-sm font-extrabold"
                >
                  +{lastBet.amount}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
          <span
            data-testid="tp-stake"
            data-stake={state.stake}
            className="border-gold-300/45 bg-felt-950/80 text-gold-100 inline-flex min-h-7 items-center rounded-full border px-2.5 text-xs font-bold sm:text-sm"
          >
            <span aria-hidden="true">{t('teenPatti.pot.stake', { n: state.stake })}</span>
            <span className="sr-only">
              {state.stake === 1
                ? t('teenPatti.pot.stakeLabelOne')
                : t('teenPatti.pot.stakeLabel', { n: state.stake })}
            </span>
          </span>
          <span className="text-mist text-[0.625rem] leading-tight font-semibold sm:text-[0.6875rem]">
            {t('teenPatti.pot.prices', { blind: state.stake, seen: state.stake * 2 })}
          </span>
        </div>
      </div>
      <div
        data-testid="tp-pot-meter"
        data-at-limit={atLimit || undefined}
        className="flex flex-col gap-1"
      >
        <ProgressBar
          value={state.pot}
          max={state.potLimit}
          size="sm"
          tone={atLimit ? 'velvet' : 'gold'}
          label={t('teenPatti.pot.limitLabel')}
          valueText={t('teenPatti.pot.limitValue', { pot: state.pot, limit: state.potLimit })}
        />
        <p className="text-mist flex items-center justify-between gap-2 text-[0.625rem] font-semibold sm:text-[0.6875rem]">
          <span aria-hidden="true">{bootsText(state.pot)}</span>
          <span aria-hidden="true">{t('teenPatti.pot.limit', { n: state.potLimit })}</span>
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        {outcome ? (
          <Badge tone="gold" data-testid="tp-outcome" data-kind={outcome.kind}>
            {t(OUTCOME_KEY[outcome.kind])}
          </Badge>
        ) : atLimit ? (
          <Badge tone="velvet">{t('teenPatti.pot.limitReached')}</Badge>
        ) : null}
        <RankingsSheet current={current} />
      </div>
    </section>
  );
}

function LearnerSeat({
  state,
  human,
  persona,
  active,
  revealed,
  winner,
  deckRef,
  children,
}: {
  state: TeenPattiState;
  human: PlayerId;
  persona: BotPersona | null;
  active: boolean;
  revealed: boolean;
  winner: boolean;
  deckRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const hand = state.hands[human] ?? [];
  const packed = state.packed[human] === true;
  const name = revealed ? handName(hand) : null;
  const label = revealed
    ? packed
      ? t('teenPatti.zone.yoursPacked', {
          cards: t('teenPatti.zone.withName', { cards: cardList(hand), hand: name ?? '' }),
        })
      : t('teenPatti.zone.yours', {
          cards: t('teenPatti.zone.withName', { cards: cardList(hand), hand: name ?? '' }),
        })
    : packed
      ? t('teenPatti.zone.yoursPacked', { cards: t('teenPatti.zone.hidden') })
      : t('teenPatti.zone.yoursBlind');
  const won = winner ? (state.outcome?.payouts[human] ?? 0) : 0;
  return (
    <div
      data-testid={`tp-seat-${human}`}
      data-active={active || undefined}
      data-packed={packed || undefined}
      data-winner={winner || undefined}
      className="mx-auto w-full max-w-[34rem]"
    >
      <Seat
        persona={persona}
        active={active}
        thinking={false}
        score={<Contributed seat={human} boots={state.contributed[human] ?? 0} />}
        className={cn(
          'w-full',
          winner &&
            'border-gold-200/90 shadow-[0_0_0_1px_rgb(245_215_122/0.5),0_0_30px_-4px_rgb(245_215_122/0.7)]',
        )}
        data-testid={`tp-persona-${human}`}
      >
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-center gap-3 sm:gap-5">
            <HandCards
              state={state}
              seat={human}
              revealed={revealed}
              winner={winner}
              width={MY_CARD_W}
              fan={MY_FAN}
              flipDelay={0}
              label={label}
              deckRef={deckRef}
            />
            <div className="flex min-w-0 shrink flex-col items-start gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge state={state} seat={human} />
                {state.dealer === human ? <DealerButton seat={human} /> : null}
              </div>
              <p
                data-testid={`tp-hand-name-${human}`}
                data-category={name ? rankHand(hand).category : undefined}
                className={cn(
                  'inline-flex min-h-8 max-w-[11rem] items-center rounded-2xl border px-3 py-1 text-sm leading-tight font-bold shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)]',
                  name
                    ? 'border-gold-300/60 bg-felt-950/80 text-gold-100'
                    : 'border-gold-300/25 bg-felt-950/50 text-mist',
                )}
              >
                {name ? (
                  <>
                    <span className="sr-only">{t('teenPatti.hand.yours')} </span>
                    {name}
                  </>
                ) : packed ? (
                  t('teenPatti.hand.packed')
                ) : (
                  t('teenPatti.hand.blind')
                )}
              </p>
              {won > 0 ? <WinnerBadge seat={human} boots={won} /> : null}
            </div>
          </div>
          {state.seen[human] || state.outcome ? null : (
            <p className="text-mist text-center text-xs leading-snug">
              {t('teenPatti.hand.blindHint')}
            </p>
          )}
          {children}
        </div>
      </Seat>
    </div>
  );
}
