'use client';
/**
 * The Crazy Eights table — built on the Blackjack reference Board (../blackjack/README.md).
 *
 *   ┌──────────────────────────────────────────┐
 *   │  [Jugnu ▒▒▒▒▒ 5]      [Matinee ▒▒▒ 2!]   │  bot seats: card BACKS + count chips
 *   │      [▒ stock]    [ K♦ ]  Match ♦ or K   │  draw (D) · discard pile · what's next
 *   │          ‿ EIGHTS ARE WILD ‿             │  (after an Eight: "Suit is now ♥ Hearts")
 *   │   [Name the next suit: ♠ ♥ ♦ ♣]          │  suit chooser (only while playing an 8)
 *   │        2♠ K♠ 8♥ 7♣ Q♦                    │  your hand (←/→, Enter plays)
 *   │                [ Pass ]                  │  P — only when stuck
 *   └──────────────────────────────────────────┘
 *
 * Rules of the road (same as every Board):
 * - Render ONLY what the learner may see: bots' hands are CardBacks (only the count is
 *   real) until the game is over; the stock is backs; a bot's drawn card never appears.
 * - Let the learner ATTEMPT any move: any card, Draw and Pass all call `onMove`, and the
 *   controller explains illegal ones. An Eight first opens the suit chooser, because the
 *   engine needs the named suit. Only `busy` stops input — and even then focus stays put.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import { useCallback, useEffect, useEffectEvent, useId, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Hand, PlayingCard } from '@/components/cards';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { cardName, cardShort, type CardCode, type Suit } from '@/games/core/cards';
import { type BotPersona, type BoardProps } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/crazy-eights/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { isEight, type CrazyEightsMove, type CrazyEightsState } from './engine';
import { DrawFlight } from './board/DrawFlight';
import { OpponentSeat } from './board/OpponentSeat';
import {
  cardGlows,
  cardList,
  cardSuggested,
  countText,
  dealKey,
  isTypingTarget,
  keyOf,
  needText,
  playMove,
  topPlayedBy,
} from './board/shared';
import { SuitChooser } from './board/SuitChooser';
import { discardLabel, DiscardPile, NeedLine, StockButton } from './board/TableCenter';
import { CRAZY_EIGHTS_BOTS } from './personas';

export type CrazyEightsBoardProps = BoardProps<CrazyEightsState, CrazyEightsMove>;

const DRAW_KEY = keyOf({ type: 'draw' });
const PASS_KEY = keyOf({ type: 'pass' });

/** Suit keys while the suit chooser is open. */
const SUIT_KEYS: Readonly<Record<string, Suit>> = { s: 'S', h: 'H', d: 'D', c: 'C' };

/**
 * Crazy Eights' Board. Remounts the table for every new deal (so the deal animates again
 * when the practice hand restarts), keyed by the starter and the learner's dealt hand.
 */
export function CrazyEightsBoard(props: CrazyEightsBoardProps) {
  return <CrazyEightsTable key={dealKey(props.state)} {...props} />;
}

function CrazyEightsTable({
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
}: CrazyEightsBoardProps) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const busyId = `${ids}-busy`;
  const pickId = `${ids}-pick`;
  const rootRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLButtonElement>(null);
  const discardRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const fans = useRef(new Map<PlayerId, HTMLDivElement>());
  // What was already on the table when it mounted: only later plays and draws animate.
  const [mounted] = useState(() => ({
    log: state.log.length,
    discard: state.discard.length,
    dealt: state.log.length === 0,
  }));
  const [chooser, setChooser] = useState<CardCode | null>(null);
  const [flash, setFlash] = useState<'draw' | 'pass' | null>(null);
  /** Where focus goes once the suit chooser closes. */
  const focusAfter = useRef<{ card: CardCode | null } | null>(null);

  const mine = state.hands[human] ?? [];
  // The chooser only stays open while the learner can still play that Eight.
  const eight = chooser !== null && !busy && mine.includes(chooser) ? chooser : null;
  const legal = new Set(legalMoves.map(keyOf));
  const yourTurn = !over && state.turn === human;
  const top = state.discard[state.discard.length - 1];
  const last = state.log[state.log.length - 1];
  const winners = over ? state.winners : [];
  const persona = (seat: PlayerId): BotPersona =>
    personas[seat] ?? CRAZY_EIGHTS_BOTS[seat - 1] ?? CRAZY_EIGHTS_BOTS[0]!;
  const opponents = Array.from({ length: state.players - 1 }, (_, i) => i + 1);

  const sourceFor = useCallback(
    (seat: PlayerId | null): HTMLElement | null =>
      seat === null
        ? stockRef.current
        : seat === human
          ? handRef.current
          : (fans.current.get(seat) ?? null),
    [human],
  );
  const getRoot = useCallback(() => rootRef.current, []);

  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 180);
    return () => window.clearTimeout(id);
  }, [flash]);

  // Once the chooser closes, put focus back in the hand (on the Eight after "Back", or
  // on the hand's tab stop after naming a suit), or on the table if the hand is empty.
  useEffect(() => {
    const want = focusAfter.current;
    if (eight !== null || want === null) return;
    focusAfter.current = null;
    const hand = handRef.current;
    const onEight = want.card
      ? hand?.querySelector<HTMLElement>(`[data-card="${want.card}"]`)
      : null;
    const stop = hand?.querySelector<HTMLElement>('[tabindex="0"]');
    (onEight ?? stop ?? rootRef.current)?.focus();
  }, [eight, mine.length]);

  // Playing the last card empties the hand: keep focus on the table (not <body>) until the
  // result appears, so keyboard and screen-reader users are not dropped to the page top.
  const handEmpty = mine.length === 0;
  useEffect(() => {
    if (!handEmpty) return;
    const active = document.activeElement;
    if (!active || active === document.body || handRef.current?.contains(active)) {
      rootRef.current?.focus();
    }
  }, [handEmpty]);

  const draw = () => {
    if (busy) return;
    setChooser(null);
    onMove({ type: 'draw' });
  };
  const pass = () => {
    if (busy) return;
    setChooser(null);
    onMove({ type: 'pass' });
  };
  const activate = (card: CardCode) => {
    if (busy) return;
    if (isEight(card)) {
      setChooser(card);
      return;
    }
    setChooser(null);
    onMove(playMove(card));
  };
  const pickSuit = (suit: Suit) => {
    if (eight === null || busy) return;
    focusAfter.current = { card: null };
    setChooser(null);
    onMove(playMove(eight, suit));
  };
  const cancelChooser = () => {
    focusAfter.current = { card: eight };
    setChooser(null);
  };

  // D draws and P passes anywhere on the page; while the suit chooser is open, S/H/D/C
  // name a suit. Skipped while typing, inside another dialog, or with modifier keys.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const key = e.key.toLowerCase();
    const target = e.target instanceof Element ? e.target : null;
    if (target && isTypingTarget(target)) return;
    const dialog = target?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    if (eight !== null) {
      if (key === 'escape') {
        e.preventDefault();
        cancelChooser();
        return;
      }
      const suit = SUIT_KEYS[key];
      if (!suit) return;
      e.preventDefault();
      pickSuit(suit);
      return;
    }
    if (key !== 'd' && key !== 'p') return;
    e.preventDefault();
    if (busy) return;
    setFlash(key === 'd' ? 'draw' : 'pass');
    if (key === 'd') draw();
    else pass();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const busyReason = over
    ? t('crazyEights.actions.over')
    : t('crazyEights.actions.wait', { name: persona(state.turn).name });
  const handLabel =
    mine.length > 0
      ? t('crazyEights.zone.you', { cards: cardList(mine) })
      : t('crazyEights.zone.youEmpty');
  const glowing = new Set(
    mine.flatMap((c, i) => (coachMode && !busy && cardGlows(c, highlight) ? [i] : [])),
  );
  const suggestedIndex = busy ? -1 : mine.findIndex((c) => cardSuggested(c, suggestedKey));
  const drawSuggested = !busy && suggestedKey === DRAW_KEY;
  // A bot's draw: a card back flies from the stock to its seat (never the card itself).
  const botDrew =
    !reduced && last?.type === 'draw' && last.seat !== human && state.log.length > mounted.log;
  const youDrew = last?.type === 'draw' && last.seat === human && !over ? last.card : null;

  return (
    <div
      ref={rootRef}
      tabIndex={-1}
      role="group"
      aria-label={t('crazyEights.zone.board')}
      data-testid="c8-board"
      data-phase={state.phase}
      data-turn={over ? undefined : state.turn}
      data-players={state.players}
      className="relative flex flex-col gap-3 outline-none sm:gap-4"
    >
      {/* Bot seats, clockwise from the learner's left */}
      <div
        className="grid items-stretch gap-1.5 sm:gap-3"
        style={{ gridTemplateColumns: `repeat(${opponents.length}, minmax(0, 1fr))` }}
      >
        {opponents.map((seat) => (
          <OpponentSeat
            key={seat}
            seat={seat}
            persona={persona(seat)}
            count={state.hands[seat]?.length ?? 0}
            revealed={over ? (state.hands[seat] ?? []) : null}
            active={!over && state.turn === seat}
            thinking={thinking === seat}
            winner={winners.includes(seat)}
            showPoints={over && state.endReason === 'blocked'}
            compact={opponents.length > 2}
            fanRef={(el) => {
              if (el) fans.current.set(seat, el);
              else fans.current.delete(seat);
            }}
          />
        ))}
      </div>

      {/* The middle: stock and discard pile */}
      <div
        role="group"
        aria-label={t('crazyEights.zone.table')}
        data-testid="c8-center"
        className="relative flex items-start justify-center gap-5 pt-1 sm:gap-10"
      >
        <div className="flex flex-col items-center gap-1">
          <StockButton
            ref={stockRef}
            count={state.stock.length}
            busy={busy}
            glow={coachMode && !busy && highlight.has(DRAW_KEY)}
            suggested={drawSuggested}
            describedBy={busy ? busyId : drawSuggested ? pickId : undefined}
            pressed={flash === 'draw'}
            onDraw={draw}
          />
          {last?.type === 'draw' && last.reshuffled ? (
            <Badge tone="gold" size="sm" data-testid="c8-reshuffled">
              {t('crazyEights.badge.reshuffled')}
            </Badge>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col items-center gap-2.5">
          <DiscardPile
            ref={discardRef}
            discard={state.discard}
            activeSuit={state.activeSuit}
            label={discardLabel(state.discard, needText(state))}
            playedBy={topPlayedBy(state)}
            freshFrom={mounted.discard}
            dealt={mounted.dealt}
            sourceFor={sourceFor}
          />
          {top ? <NeedLine top={top} activeSuit={state.activeSuit} /> : null}
        </div>
      </div>

      <FeltPrint />

      {/* The learner */}
      <div
        data-testid="c8-you"
        data-active={yourTurn || undefined}
        className={cn(
          'relative flex flex-col gap-2 rounded-2xl border px-1 pt-2 pb-1 transition-[border-color,box-shadow] duration-200 sm:px-3',
          yourTurn
            ? 'border-gold-300/70 shadow-[0_0_0_1px_rgb(245_215_122/0.25),0_0_26px_-8px_rgb(245_215_122/0.6)]'
            : 'border-gold-300/10',
        )}
      >
        <YouHeader
          count={mine.length}
          yourTurn={yourTurn}
          winner={winners.includes(human)}
          drawn={youDrew}
        />
        {eight !== null ? (
          <SuitChooser
            eight={eight}
            hand={mine}
            coachMode={coachMode}
            highlight={highlight}
            suggestedKey={suggestedKey}
            onPick={pickSuit}
            onCancel={cancelChooser}
          />
        ) : null}
        <div ref={handRef}>
          <Hand
            cards={mine}
            label={handLabel}
            onActivate={activate}
            disabled={busy}
            playable={
              coachMode && legalMoves.length > 0 ? (c) => cardGlows(c, highlight) : undefined
            }
            highlighted={glowing}
            suggested={suggestedIndex >= 0 ? suggestedIndex : null}
            selected={eight !== null ? new Set([mine.indexOf(eight)]) : undefined}
            dealFrom="top"
            data-testid="c8-hand"
          />
        </div>
      </div>

      <ActionRow
        canPass={legal.has(PASS_KEY)}
        busy={busy}
        busyId={busyId}
        pickId={pickId}
        glow={coachMode && !busy && highlight.has(PASS_KEY)}
        suggested={!busy && suggestedKey === PASS_KEY}
        pressed={flash === 'pass'}
        onPass={pass}
      />

      <span id={busyId} className="sr-only">
        {busyReason}
      </span>
      <span id={pickId} className="sr-only">
        {t('crazyEights.actions.suggested')}
      </span>

      {botDrew ? (
        <DrawFlight key={state.log.length} root={getRoot} sourceFor={sourceFor} seat={last.seat} />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- pieces */

/** "Your hand · 5 cards" with the "Last card!" banner and the card just drawn. */
function YouHeader({
  count,
  yourTurn,
  winner,
  drawn,
}: {
  count: number;
  yourTurn: boolean;
  winner: boolean;
  drawn: CardCode | null;
}) {
  const reduced = useReducedMotionPref();
  return (
    <div className="flex min-h-8 flex-wrap items-center justify-center gap-x-2 gap-y-1.5 px-1">
      <span className="text-gold-200 text-[0.6875rem] font-bold tracking-[0.16em] uppercase">
        {t('crazyEights.you.title')}
      </span>
      <span
        data-testid="c8-count-0"
        data-count={count}
        className="border-gold-300/30 bg-felt-950/70 text-mist rounded-full border px-2 py-0.5 text-[0.6875rem] font-extrabold tracking-wide uppercase"
      >
        {countText(count, winner)}
      </span>
      {count === 1 && !winner ? (
        <motion.span
          data-testid="c8-last-card"
          initial={reduced ? false : { scale: 1.8, rotate: -10, opacity: 0 }}
          animate={{ scale: 1, rotate: -3, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 14 }}
          className="border-gold-100 text-ink inline-flex items-center gap-1 rounded-full border-2 bg-[linear-gradient(180deg,var(--color-gold-100),var(--color-gold-400))] px-2.5 py-0.5 text-xs font-extrabold shadow-[0_8px_22px_-8px_rgb(245_215_122/0.95)]"
        >
          <SparkleIcon size={12} />
          {t('crazyEights.you.lastCard')}
        </motion.span>
      ) : null}
      {winner ? (
        <span
          data-testid="c8-you-won"
          className="border-gold-100 text-ink inline-flex items-center gap-1 rounded-full border-2 bg-[linear-gradient(180deg,var(--color-gold-100),var(--color-gold-400))] px-2.5 py-0.5 text-xs font-extrabold"
        >
          <SparkleIcon size={12} />
          {t('crazyEights.you.winner')}
        </span>
      ) : null}
      {drawn && yourTurn ? (
        <span
          data-testid="c8-drawn"
          data-card={drawn}
          className="border-gold-300/40 bg-felt-950/70 text-cream inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-0.5 text-xs font-bold"
        >
          <PlayingCard code={drawn} size="xs" decorative style={{ width: 18 }} />
          <span className="sr-only">
            {t('crazyEights.you.drewLabel', { card: cardName(drawn) })}
          </span>
          <span aria-hidden="true">
            {t('crazyEights.you.drew')} {cardShort(drawn)}
          </span>
        </span>
      ) : null}
    </div>
  );
}

/** Pass (P) plus the keyboard legend on pointer-fine devices. */
function ActionRow({
  canPass,
  busy,
  busyId,
  pickId,
  glow,
  suggested,
  pressed,
  onPass,
}: {
  canPass: boolean;
  busy: boolean;
  busyId: string;
  pickId: string;
  glow: boolean;
  suggested: boolean;
  pressed: boolean;
  onPass: () => void;
}) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const hintId = `${ids}-hint`;
  const unavailableId = `${ids}-unavailable`;
  const unavailable = !busy && !canPass;
  const describedBy = [
    hintId,
    busy ? busyId : unavailable ? unavailableId : null,
    suggested ? pickId : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div
      role="group"
      aria-label={t('crazyEights.actions.label')}
      className="mx-auto flex w-full max-w-[34rem] flex-col items-center gap-2"
    >
      <button
        type="button"
        data-testid="c8-pass"
        data-legal={canPass || undefined}
        data-highlighted={glow || undefined}
        data-suggested={suggested || undefined}
        data-pressed={pressed || undefined}
        aria-keyshortcuts="P"
        aria-disabled={busy || unavailable || undefined}
        aria-describedby={describedBy}
        onClick={onPass}
        className={cn(
          'ease-snap relative inline-flex min-h-12 min-w-[9rem] items-center justify-center gap-2 rounded-xl border px-5 text-base font-extrabold transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none',
          busy
            ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
            : canPass
              ? 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px'
              : 'border-gold-300/35 bg-felt-950/45 text-gold-200 hover:border-gold-300/70 active:translate-y-px',
          pressed && 'translate-y-px brightness-110',
        )}
      >
        {glow && !suggested ? (
          <span
            aria-hidden="true"
            className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
          />
        ) : null}
        {suggested ? (
          <motion.span
            aria-hidden="true"
            className="pointer-events-none absolute -inset-1 rounded-[0.95rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
            animate={reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.04, 1] }}
            transition={
              reduced ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
            }
          />
        ) : null}
        <span>{t('crazyEights.actions.pass')}</span>
        <span
          id={hintId}
          className={cn('text-xs font-semibold', canPass && !busy ? 'text-ink/70' : 'text-mist')}
        >
          {t('crazyEights.actions.passHint')}
        </span>
        <kbd
          aria-hidden="true"
          className={cn(
            'hidden size-5 items-center justify-center rounded border font-sans text-[0.625rem] font-bold pointer-fine:inline-flex',
            canPass && !busy ? 'border-ink/30 text-ink/70' : 'border-gold-300/40 text-gold-200/80',
          )}
        >
          P
        </kbd>
      </button>
      <span id={unavailableId} className="sr-only">
        {t('crazyEights.actions.unavailable')}
      </span>
      <p
        data-testid="c8-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('crazyEights.actions.keys')}:</span>
        <KeyHint k="←/→">{t('crazyEights.actions.keyCards')}</KeyHint>
        <KeyHint k="Enter">{t('crazyEights.actions.keyPlay')}</KeyHint>
        <KeyHint k="D">{t('crazyEights.actions.draw')}</KeyHint>
        <KeyHint k="P">{t('crazyEights.actions.pass')}</KeyHint>
      </p>
    </div>
  );
}

function KeyHint({ k, children }: { k: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
        {k}
      </kbd>
      {children}
    </span>
  );
}

/** "Eights are wild" and "Match the suit or the rank", printed along the felt's curve. */
function FeltPrint() {
  const raw = useId();
  const id = raw.replace(/[^A-Za-z0-9_-]/g, '');
  return (
    <div className="relative -my-1 flex justify-center">
      <p className="sr-only">{t('crazyEights.felt.rules')}</p>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 320 44"
        className="w-full max-w-[24rem] overflow-visible"
        data-testid="c8-felt-print"
      >
        <defs>
          <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff6d9" />
            <stop offset="55%" stopColor="#f5d77a" />
            <stop offset="100%" stopColor="#d6a42c" />
          </linearGradient>
          <path id={`${id}-outer`} d="M 30 8 Q 160 40 290 8" />
          <path id={`${id}-inner`} d="M 70 25 Q 160 50 250 25" />
        </defs>
        <text
          fill={`url(#${id}-foil)`}
          fontSize={15}
          fontWeight={800}
          letterSpacing={2.4}
          className="font-display uppercase"
        >
          <textPath href={`#${id}-outer`} startOffset="50%" textAnchor="middle">
            {t('crazyEights.felt.wild')}
          </textPath>
        </text>
        <text
          fill="#f4ecd8"
          fillOpacity={0.8}
          fontSize={11}
          fontWeight={600}
          letterSpacing={1}
          className="font-sans"
        >
          <textPath href={`#${id}-inner`} startOffset="50%" textAnchor="middle">
            {t('crazyEights.felt.match')}
          </textPath>
        </text>
      </svg>
    </div>
  );
}
