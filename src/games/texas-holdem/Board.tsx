'use client';
/**
 * The Texas Hold'em table (built on the Blackjack reference Board, see
 * src/games/blackjack/README.md).
 *
 *   ┌──────────────────────────────────────────────┐
 *   │  [Moti 98]      [Lakshmi 100]    [Bunty 96]  │  opponents (clockwise from your left):
 *   │   ▒▒ ▒▒  D        ▒▒ ▒▒  SB        ▒▒ ▒▒ BB  │  stack, hole cards (face down), D/SB/BB,
 *   │    (●2)            (●1)             (●2)     │  last action and bet chips in front
 *   │   ╭──────────── Pot 12 ─────────────╮        │
 *   │   │   K♣  8♠  Q♠  [turn] [river]     │        │  the oval: pot (+ side pots) and the
 *   │   ╰──────────── The flop ───────────╯        │  five community-card slots
 *   │   [You 94]  A♠ K♠   Your best hand: Pair …   │  learner: cards, stack, best-hand helper
 *   │  [Fold] [Check] [Call 4] [All-in 94]         │  action bar (F / K / C / A)
 *   │  Raise to ━━━━━●━━━━━ 12  [Min ½ ¾ Pot Max] [Raise to 12] (R)
 *   └──────────────────────────────────────────────┘
 *
 * - Only what the learner may see is rendered: opponents' hole cards are face-down
 *   PlayingCards with a placeholder code until they are shown at the showdown (a face-down
 *   PlayingCard never mounts its face); the deck and burn cards are drawn as card backs.
 * - Any move can be attempted: unavailable actions look secondary but still call `onMove`,
 *   so the controller explains why. Only `busy` stops input, and buttons keep focus.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import { motion } from 'motion/react';
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { CardBack, rowLayout } from '@/components/cards';
import { joinNames } from '@/components/play/personas';
import { Seat } from '@/components/play/Seat';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { type CardCode } from '@/games/core/cards';
import { type BotPersona, type BoardProps } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t, type TKey } from '@/games/texas-holdem/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import {
  ACTION_KEYS,
  ActionBar,
  type ActionId,
  type ActionState,
  type QuickSize,
} from './board/ActionBar';
import { BetChips, Chip, ChipStack, PositionDiscs } from './board/Chips';
import { RankingsSheet } from './board/Rankings';
import { TableCard } from './board/TableCard';
import {
  bestHand,
  boardDealDelay,
  cardList,
  holeDealDelay,
  lastAction,
  positionMarks,
  potAmount,
  potViews,
  revealedSeats,
  roundKey,
  sizedKeyAmount,
  sizedMove,
  sizing as sizingFor,
  winningCards,
} from './board/view';
import {
  evaluateHand,
  isAllIn,
  texasHoldemEngine as engine,
  type TexasHoldemMove,
  type TexasHoldemState,
} from './engine';
import { HOLDEM_CAST } from './personas';

export type TexasHoldemBoardProps = BoardProps<TexasHoldemState, TexasHoldemMove>;

/* ------------------------------------------------------------------ constants */

const OPP_CARD_W = 'clamp(28px, 8.4vw, 44px)';
const BOARD_CARD_W = 'clamp(40px, 11.6vw, 68px)';
const MY_CARD_W = 'clamp(58px, 17vw, 88px)';
const SLOT_KEYS: readonly TKey[] = [
  'texasHoldem.slot.flop',
  'texasHoldem.slot.flop',
  'texasHoldem.slot.flop',
  'texasHoldem.slot.turn',
  'texasHoldem.slot.river',
];

const SHORTCUTS: Readonly<Record<string, ActionId>> = Object.fromEntries(
  (Object.entries(ACTION_KEYS) as [ActionId, string][]).map(([id, key]) => [key.toLowerCase(), id]),
);

function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

function personaFor(personas: readonly BotPersona[], seat: PlayerId): BotPersona {
  return personas[seat] ?? HOLDEM_CAST[seat - 1] ?? HOLDEM_CAST[0]!;
}

/* ---------------------------------------------------------------- the board */

/**
 * Texas Hold'em's Board. The table remounts for every new deal (so the opening deal
 * animates again when the practice hand restarts), keyed by what the learner can see.
 */
export function TexasHoldemBoard(props: TexasHoldemBoardProps) {
  return <HoldemTable key={roundKey(props.state)} {...props} />;
}

function HoldemTable({
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
}: TexasHoldemBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  // Board cards already on the table when this deal mounted do not fly in again.
  const [openingBoard] = useState(() => state.board.length);
  const revealed = revealedSeats(state, over);
  const winners = winningCards(state, over);
  const seats = Array.from({ length: state.players }, (_, i) => i);
  const opponents = seats.filter((s) => s !== human);

  /* ---- bet sizing: the slider value belongs to one decision (it resets after every move) */
  const sizing = sizingFor(state, human);
  const decision = String(state.log.length);
  const [pick, setPick] = useState<{ decision: string; value: number } | null>(null);
  // "What would a pro do?" picked a bet size: move the slider there so Bet / Raise pulses.
  const [seenSuggestion, setSeenSuggestion] = useState<string | null>(suggestedKey);
  if (seenSuggestion !== suggestedKey) {
    setSeenSuggestion(suggestedKey);
    const n = sizedKeyAmount(suggestedKey, sizing.kind);
    if (n !== null) setPick({ decision, value: n });
  }
  const clamp = (n: number) => Math.min(sizing.max, Math.max(sizing.min, Math.round(n)));
  const amount = clamp(pick && pick.decision === decision ? pick.value : sizing.min);
  const setAmount = (n: number) => setPick({ decision, value: clamp(n) });

  const moveFor = (id: ActionId): TexasHoldemMove => {
    switch (id) {
      case 'fold':
        return { type: 'fold' };
      case 'check':
        return { type: 'check' };
      case 'call':
        return { type: 'call' };
      case 'all-in':
        return { type: 'all-in' };
      case 'raise':
        return sizedMove(sizing.kind, amount);
    }
  };
  const yourTurn = legalMoves.length > 0;
  const sizedHighlight = [...highlight].some((k) => k.startsWith(`${sizing.kind}:`));
  const actionState = (id: ActionId): ActionState => {
    const move = moveFor(id);
    const key = engine.moveKey(move);
    return {
      legal: yourTurn && engine.checkMove(state, human, move).ok,
      glow: coachMode && (id === 'raise' ? sizedHighlight : highlight.has(key)),
      suggested: suggestedKey !== null && suggestedKey === key,
    };
  };
  const actions: Record<ActionId, ActionState> = {
    fold: actionState('fold'),
    check: actionState('check'),
    call: actionState('call'),
    raise: actionState('raise'),
    'all-in': actionState('all-in'),
  };
  const quick: QuickSize[] = sizing.options.map((o) => {
    const key = engine.moveKey(sizedMove(sizing.kind, o.amount));
    return {
      id: o.id,
      amount: o.amount,
      glow: coachMode && !busy && o.id !== 'max' && highlight.has(key),
      suggested: !busy && suggestedKey === key,
    };
  });

  /* ---- pressing */
  const [flash, setFlash] = useState<ActionId | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 180);
    return () => window.clearTimeout(id);
  }, [flash]);

  const press = (id: ActionId) => {
    if (busy) return;
    onMove(moveFor(id));
  };

  // F / K / C / R / A anywhere on the page — except while typing or inside another dialog.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const id = SHORTCUTS[e.key.toLowerCase()];
    if (!id) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && isTypingTarget(target)) return;
    const dialog = target?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    e.preventDefault();
    if (busy) return;
    setFlash(id);
    onMove(moveFor(id));
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const toAct = state.toAct;
  const busyReason = over
    ? t('texasHoldem.actions.over')
    : state.folded[human]
      ? t('texasHoldem.actions.waitFolded')
      : isAllIn(state, human)
        ? t('texasHoldem.actions.waitAllIn')
        : t('texasHoldem.actions.wait', {
            name: toAct === null ? '' : personaFor(personas, toAct).name,
          });

  // Showdown flips go seat by seat, clockwise from the learner's left.
  const flipOrder = opponents.filter((s) => revealed.has(s));

  return (
    <div
      ref={rootRef}
      data-testid="holdem-table"
      data-street={state.outcome ? 'over' : state.street}
      data-players={state.players}
      className="relative flex flex-col gap-3 sm:gap-4"
    >
      {/* Opponents, clockwise from the learner's left, along the far rail. */}
      <div
        role="group"
        aria-label={t('texasHoldem.zone.opponents')}
        className={cn(
          'grid items-stretch gap-1.5 sm:gap-3',
          opponents.length >= 3
            ? 'grid-cols-3'
            : opponents.length === 2
              ? 'grid-cols-2'
              : 'mx-auto w-full max-w-[14rem] grid-cols-1',
          opponents.length === 4 && 'sm:grid-cols-4',
          opponents.length === 5 && 'sm:grid-cols-5',
        )}
      >
        {opponents.map((seat, i) => (
          <OpponentSeat
            key={seat}
            seat={seat}
            arc={arcOffset(i, opponents.length)}
            state={state}
            persona={personaFor(personas, seat)}
            active={toAct === seat && !over}
            thinking={thinking === seat}
            revealed={revealed.has(seat)}
            flipDelay={Math.max(0, flipOrder.indexOf(seat)) * 0.3}
            winners={winners}
            over={over}
            deckRef={deckRef}
          />
        ))}
      </div>

      <Centre
        state={state}
        over={over}
        winners={winners}
        openingBoard={openingBoard}
        deckRef={deckRef}
        personas={personas}
        human={human}
      />

      <LearnerSeat
        state={state}
        human={human}
        active={toAct === human && !over}
        over={over}
        winners={winners}
        deckRef={deckRef}
      />

      <ActionBar
        actions={actions}
        toCall={sizing.bet.toCall}
        stack={state.stacks[human] ?? 0}
        sizing={sizing}
        amount={amount}
        onAmount={setAmount}
        quick={quick}
        busy={busy}
        busyReason={busyReason}
        flash={flash}
        onPress={press}
      />
    </div>
  );
}

/**
 * A two-card hole box sized to the cards themselves. (The row layout's `min(100%, …)` width
 * collapses to nothing inside a shrink-to-fit parent, which let the cards spill over the
 * position discs, bet chips and winner badge beside them.)
 */
function holeBox(natural: string, cardWidth: string) {
  return { width: natural, minWidth: natural, minHeight: `calc(${cardWidth} * 1.4)` };
}

/** Outer seats sit a little lower, so the row curves around the table like a rail. */
function arcOffset(i: number, count: number): number {
  if (count < 3) return 0;
  const mid = (count - 1) / 2;
  const norm = Math.abs(i - mid) / mid;
  return Math.round(norm * norm * 14);
}

/* ------------------------------------------------------------------- pieces */

function StackScore({ seat, stack }: { seat: PlayerId; stack: number }) {
  return (
    <span
      data-testid={`holdem-stack-${seat}`}
      data-stack={stack}
      className="inline-flex items-center gap-1"
    >
      <Chip className="size-3.5 shrink-0" />
      <span aria-hidden="true">{t('texasHoldem.seat.stack', { n: stack })}</span>
      <span className="sr-only">
        {stack === 1
          ? t('texasHoldem.seat.stackOne')
          : t('texasHoldem.seat.stackLabel', { n: stack })}
      </span>
    </span>
  );
}

function WinnerBadge({ seat, chips }: { seat: PlayerId; chips: number }) {
  const reduced = useReducedMotionPref();
  return (
    <motion.span
      data-testid={`holdem-winner-${seat}`}
      data-chips={chips}
      initial={reduced ? false : { scale: 0.4, opacity: 0, rotate: -12 }}
      animate={{ scale: 1, opacity: 1, rotate: -4 }}
      transition={
        reduced ? { duration: 0 } : { delay: 0.5, type: 'spring', stiffness: 420, damping: 16 }
      }
      className="inline-flex"
    >
      <Badge tone="gold" className="shadow-[0_0_18px_rgb(245_215_122/0.6)]">
        <span aria-hidden="true">{t('texasHoldem.seat.wins', { n: chips })}</span>
        <span className="sr-only">{t('texasHoldem.seat.winsLabel', { n: chips })}</span>
      </Badge>
    </motion.span>
  );
}

function StatusLine({
  state,
  seat,
  over,
}: {
  state: TexasHoldemState;
  seat: PlayerId;
  over: boolean;
}) {
  if (state.folded[seat]) {
    return (
      <Badge tone="mist" size="sm" data-testid={`holdem-folded-${seat}`}>
        {t('texasHoldem.seat.folded')}
      </Badge>
    );
  }
  if (isAllIn(state, seat) && !over) {
    return (
      <Badge tone="velvet" size="sm" data-testid={`holdem-allin-${seat}`}>
        {t('texasHoldem.seat.allIn')}
      </Badge>
    );
  }
  const last = over ? null : lastAction(state, seat);
  if (!last) return null;
  return (
    <span
      data-testid={`holdem-last-${seat}`}
      className="text-gold-200 text-[0.6875rem] leading-tight font-semibold"
    >
      {t(last.key, { n: last.n })}
    </span>
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
  flipDelay,
  winners,
  over,
  deckRef,
}: {
  seat: PlayerId;
  arc: number;
  state: TexasHoldemState;
  persona: BotPersona;
  active: boolean;
  thinking: boolean;
  revealed: boolean;
  flipDelay: number;
  winners: ReadonlySet<CardCode>;
  over: boolean;
  deckRef: RefObject<HTMLDivElement | null>;
}) {
  const hole = state.hands[seat] ?? [];
  const folded = state.folded[seat] === true;
  const won = over ? (state.outcome?.payouts[seat] ?? 0) : 0;
  const label = t('texasHoldem.zone.theirs', {
    name: persona.name,
    cards: revealed
      ? cardList(hole)
      : folded
        ? t('texasHoldem.zone.mucked')
        : t('texasHoldem.zone.hidden'),
  });
  const handName = revealed ? evaluateHand([...hole, ...state.board]).name : null;
  const row = rowLayout(2, OPP_CARD_W, `calc(-0.3 * ${OPP_CARD_W})`, 0.5);
  return (
    <div
      data-testid={`holdem-seat-${seat}`}
      data-folded={folded || undefined}
      data-all-in={isAllIn(state, seat) || undefined}
      data-active={active || undefined}
      data-winner={won > 0 || undefined}
      className={cn(
        'flex min-w-0 transition-opacity duration-300',
        folded && !over && 'opacity-60',
      )}
      style={{ paddingTop: `${arc}px` }}
    >
      <Seat
        persona={persona}
        active={active}
        thinking={thinking}
        layout="column"
        showTagline={false}
        score={<StackScore seat={seat} stack={state.stacks[seat] ?? 0} />}
        className={cn(
          // Long names wrap onto a second line instead of spilling out of a narrow seat.
          'w-full px-1.5 py-2 sm:px-2.5 [&_p>span:first-child]:max-w-full [&_p>span:first-child]:leading-tight [&_p>span:first-child]:break-words [&_p>span:first-child]:whitespace-normal',
          won > 0 &&
            'border-gold-200/90 shadow-[0_0_0_1px_rgb(245_215_122/0.5),0_0_30px_-4px_rgb(245_215_122/0.7)]',
        )}
        data-testid={`holdem-persona-${seat}`}
      >
        <div className="flex flex-col items-center gap-1">
          <p className="text-mist hidden text-center text-[0.6875rem] leading-snug lg:block">
            {persona.tagline}
          </p>
          <div className="flex items-center justify-center gap-1">
            <div
              role="group"
              aria-label={label}
              data-testid={`holdem-hole-${seat}`}
              data-revealed={revealed || undefined}
              className="relative flex shrink-0 items-end justify-center"
              style={{ ...row.container, ...holeBox(row.natural, OPP_CARD_W) }}
            >
              {hole.map((code, i) => (
                <TableCard
                  key={`h${seat}-${i}`}
                  code={revealed ? code : null}
                  width={OPP_CARD_W}
                  fresh
                  delay={holeDealDelay(state, seat, i)}
                  deckRef={deckRef}
                  winning={revealed && winners.has(code)}
                  dimmed={folded}
                  flipDelay={flipDelay + i * 0.08}
                  marginInlineStart={row.margin(i)}
                  zIndex={i}
                />
              ))}
            </div>
            <PositionDiscs marks={positionMarks(state, seat)} seat={seat} className="flex-col" />
          </div>
          <div className="flex min-h-5 flex-wrap items-center justify-center gap-1">
            <StatusLine state={state} seat={seat} over={over} />
          </div>
          {handName ? (
            <p
              data-testid={`holdem-hand-name-${seat}`}
              className="text-gold-100 text-center text-[0.6875rem] leading-tight font-bold"
            >
              <span className="sr-only">{t('texasHoldem.hand.label')} </span>
              {handName}
            </p>
          ) : null}
          {won > 0 ? <WinnerBadge seat={seat} chips={won} /> : null}
          <BetChips seat={seat} amount={over ? 0 : (state.streetBets[seat] ?? 0)} towards="down" />
          {/* Room for the "Thinking…" line, so the row never jumps when a turn passes. */}
          {active || thinking ? null : <span aria-hidden="true" className="block h-[1.125rem]" />}
        </div>
      </Seat>
    </div>
  );
}

function Deck({ ref }: { ref: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      aria-hidden="true"
      className="relative"
      style={{ width: 'clamp(26px, 7vw, 36px)', aspectRatio: '5 / 7' }}
    >
      <div ref={ref} className="absolute inset-0">
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

function Centre({
  state,
  over,
  winners,
  openingBoard,
  deckRef,
  personas,
  human,
}: {
  state: TexasHoldemState;
  over: boolean;
  winners: ReadonlySet<CardCode>;
  openingBoard: number;
  deckRef: RefObject<HTMLDivElement | null>;
  personas: readonly BotPersona[];
  human: PlayerId;
}) {
  const reduced = useReducedMotionPref();
  const total = potAmount(state, over);
  const pots = potViews(state, over);
  const board = state.board;
  const showdown = over && state.outcome?.kind === 'showdown';
  const streetText = over
    ? showdown
      ? t('texasHoldem.street.showdown')
      : t('texasHoldem.street.over')
    : t(`texasHoldem.street.${state.street}`);
  const communityLabel =
    board.length > 0
      ? `${t('texasHoldem.zone.community', { cards: cardList(board) })}${
          winners.size > 0 ? ` ${t('texasHoldem.hand.winning')}` : ''
        }`
      : t('texasHoldem.zone.communityEmpty');
  const name = (seat: PlayerId) =>
    seat === human ? t('play.seat.you') : personaFor(personas, seat).name;
  const row = rowLayout(5, BOARD_CARD_W, 'clamp(3px, 1vw, 8px)', 0.6);

  return (
    <div
      role="group"
      aria-label={t('texasHoldem.zone.centre')}
      data-testid="holdem-centre"
      className="border-gold-300/35 relative mx-auto flex w-full max-w-[36rem] flex-col items-center gap-2 rounded-[999px] border bg-[radial-gradient(80%_70%_at_50%_45%,rgb(26_112_77/0.5),rgb(3_17_11/0.35))] px-5 py-3 shadow-[inset_0_0_0_6px_rgb(3_17_11/0.25),inset_0_0_40px_rgb(0_0_0/0.45),0_0_0_1px_rgb(245_215_122/0.08)] sm:px-10 sm:py-4"
    >
      <div className="flex items-center justify-center gap-3">
        <Deck ref={deckRef} />
        <p
          data-testid="holdem-pot"
          data-total={total}
          className="border-gold-300/50 bg-felt-950/80 text-gold-100 inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 shadow-[0_8px_18px_-10px_rgb(0_0_0/0.9)]"
        >
          <ChipStack amount={total} className="size-5" />
          <span
            className="text-mist text-xs font-bold tracking-[0.14em] uppercase"
            aria-hidden="true"
          >
            {t('texasHoldem.pot.label')}
          </span>
          <motion.span
            key={total}
            aria-hidden="true"
            initial={reduced ? false : { scale: 1.35, color: '#fff6d9' }}
            animate={{ scale: 1, color: '#fbe8a6' }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 18 }}
            className="font-display tabular text-lg leading-none font-bold"
          >
            {total}
          </motion.span>
          <span className="sr-only">{t('texasHoldem.pot.total', { n: total })}</span>
        </p>
      </div>

      <div
        role="group"
        aria-label={communityLabel}
        data-testid="holdem-community"
        data-count={board.length}
        className="relative flex w-full items-center justify-center"
      >
        <div
          className="relative flex items-end justify-center"
          style={{ ...row.container, minHeight: `calc(${BOARD_CARD_W} * 1.4)` }}
        >
          {Array.from({ length: 5 }, (_, i) => {
            const code = board[i];
            return code ? (
              <TableCard
                key={`b${i}`}
                code={code}
                width={BOARD_CARD_W}
                fresh={i >= openingBoard}
                delay={boardDealDelay(state, i)}
                deckRef={deckRef}
                winning={winners.has(code)}
                dimmed={winners.size > 0 && !winners.has(code)}
                marginInlineStart={row.margin(i)}
                zIndex={i}
                data-testid={`holdem-community-${i}`}
              />
            ) : (
              <span
                key={`b${i}`}
                aria-hidden="true"
                className="border-gold-300/30 text-gold-300/60 relative flex shrink-0 items-center justify-center rounded-[8%/5.7%] border border-dashed text-[0.5625rem] font-bold tracking-[0.12em] uppercase"
                style={{
                  width: BOARD_CARD_W,
                  aspectRatio: '5 / 7',
                  marginInlineStart: row.margin(i),
                }}
              >
                {t(SLOT_KEYS[i] ?? 'texasHoldem.slot.river')}
              </span>
            );
          })}
        </div>
      </div>

      <p
        data-testid="holdem-street"
        className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.2em] uppercase"
      >
        {streetText}
      </p>

      {pots.length > 0 ? (
        <ul
          className="flex flex-wrap items-center justify-center gap-1.5"
          data-testid="holdem-pots"
        >
          {pots.map((p, i) => (
            <li
              key={p.label}
              data-testid={`holdem-pot-${i}`}
              data-amount={p.amount}
              className="border-gold-300/30 bg-felt-950/70 text-cream rounded-full border px-2.5 py-0.5 text-[0.6875rem] font-semibold"
            >
              <span className="text-gold-200 font-bold">{p.label}</span>{' '}
              {p.amount === 1
                ? t('texasHoldem.pot.amountOne')
                : t('texasHoldem.pot.amount', { n: p.amount })}
              {p.winners.length > 0 ? (
                <>
                  {' '}
                  {t(p.winners.length > 1 ? 'texasHoldem.pot.splitBy' : 'texasHoldem.pot.wonBy', {
                    names: joinNames(p.winners.map(name)),
                  })}
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function LearnerSeat({
  state,
  human,
  active,
  over,
  winners,
  deckRef,
}: {
  state: TexasHoldemState;
  human: PlayerId;
  active: boolean;
  over: boolean;
  winners: ReadonlySet<CardCode>;
  deckRef: RefObject<HTMLDivElement | null>;
}) {
  const hole = state.hands[human] ?? [];
  const folded = state.folded[human] === true;
  const best = bestHand(hole, state.board);
  const won = over ? (state.outcome?.payouts[human] ?? 0) : 0;
  const atShowdown =
    over && state.outcome?.kind === 'showdown' && state.outcome.showdown.includes(human);
  const row = rowLayout(2, MY_CARD_W, `calc(-0.18 * ${MY_CARD_W})`, 0.6);
  return (
    <div
      data-testid={`holdem-seat-${human}`}
      data-folded={folded || undefined}
      data-all-in={isAllIn(state, human) || undefined}
      data-active={active || undefined}
      data-winner={won > 0 || undefined}
    >
      <Seat
        active={active}
        thinking={false}
        score={<StackScore seat={human} stack={state.stacks[human] ?? 0} />}
        className={cn(
          'mx-auto w-full max-w-[36rem]',
          won > 0 &&
            'border-gold-200/90 shadow-[0_0_0_1px_rgb(245_215_122/0.5),0_0_30px_-4px_rgb(245_215_122/0.7)]',
        )}
        data-testid={`holdem-persona-${human}`}
      >
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-between">
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label={t('texasHoldem.zone.yours', { cards: cardList(hole) })}
              data-testid={`holdem-hole-${human}`}
              className="relative flex shrink-0 items-end"
              style={{ ...row.container, ...holeBox(row.natural, MY_CARD_W) }}
            >
              {hole.map((code, i) => (
                <TableCard
                  key={`h${human}-${i}`}
                  code={code}
                  width={MY_CARD_W}
                  fresh
                  delay={holeDealDelay(state, human, i)}
                  deckRef={deckRef}
                  winning={winners.has(code)}
                  dimmed={folded}
                  marginInlineStart={row.margin(i)}
                  zIndex={i}
                />
              ))}
            </div>
            <div className="flex flex-col items-start gap-1.5">
              <PositionDiscs marks={positionMarks(state, human)} seat={human} />
              <StatusLine state={state} seat={human} over={over} />
              <BetChips
                seat={human}
                amount={over ? 0 : (state.streetBets[human] ?? 0)}
                towards="up"
              />
            </div>
          </div>
          <div className="flex min-w-0 flex-col items-center gap-2 sm:items-end">
            {best ? (
              <p
                data-testid="holdem-best-hand"
                data-category={best.category ?? undefined}
                className="border-gold-300/35 bg-felt-950/60 text-cream max-w-full rounded-xl border px-3 py-1.5 text-center text-sm leading-snug sm:text-right"
              >
                <span className="text-gold-300 block text-[0.625rem] font-bold tracking-[0.16em] uppercase">
                  {folded
                    ? t('texasHoldem.best.folded')
                    : best.category
                      ? t('texasHoldem.best.made')
                      : t('texasHoldem.best.preflop')}
                </span>{' '}
                <span
                  className="text-gold-100 font-bold"
                  data-testid={atShowdown ? `holdem-hand-name-${human}` : undefined}
                >
                  {best.text}
                </span>
              </p>
            ) : null}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {won > 0 ? <WinnerBadge seat={human} chips={won} /> : null}
              <RankingsSheet />
            </div>
          </div>
        </div>
      </Seat>
    </div>
  );
}
