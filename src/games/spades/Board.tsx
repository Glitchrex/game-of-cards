'use client';
/**
 * The Spades table. Same shape as the Blackjack reference Board (see
 * src/games/blackjack/README.md) and laid out like Hearts:
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [Left: opp.]   [Across: PARTNER]  [Right: opp.] │  mobile: the three bots in a row
 *   │                    ┌──┐                       │  desktop: left / across / right
 *   │              ┌──┐  │Q♦│  ┌──┐                 │  around the trick
 *   │              │J♦│      │3♠│ ← trumped         │
 *   │                    ┌──┐                       │  four slots, one per seat
 *   │                    │K♦│                       │
 *   │   Trick 4 / 13                                │
 *   │   [Us 2/6 · Need 4] [Them 1/4] [♠ not broken] │  spades-team-us / -them, spades-broken
 *   │ You  Bid 3  Won 1                   Your turn │
 *   │  [ your cards — one tab stop, ← → Enter ]     │  spades-hand
 *   │  [ Nil 1 2 3 4 5 6 / 7 … 13 ]  [ Bid 3 ]      │  spades-bid-<n>, spades-bid-submit
 *   └──────────────────────────────────────────────┘
 *
 * - Only what the learner may see is rendered: the bots' hands are card backs (a count).
 *   Bids, tricks won and played cards are public.
 * - The learner may ATTEMPT anything: any card can be pressed (in bidding too, and the
 *   illegal ones are dimmed) and the controller explains why it isn't allowed.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Hand } from '@/components/cards';
import { announce } from '@/components/layout/LiveAnnouncer';
import { cn } from '@/components/ui/cn';
import { type CardCode } from '@/games/core/cards';
import { type BoardProps } from '@/games/core/module';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { spadesEngine, type SpadesMove, type SpadesState } from './engine';
import { MAX_BID, partnerOf } from './rules';
import { BidPicker } from './board/BidPicker';
import { ScoreSheet } from './board/ScoreSheet';
import { BidBadge, OpponentSeat, TricksCount } from './board/Seats';
import { dealtToLearner, isTypingTarget, seatName, teamTally, trickView } from './board/shared';
import { TeamPanels } from './board/TeamPanels';
import { TrickArea } from './board/TrickArea';

export type SpadesBoardProps = BoardProps<SpadesState, SpadesMove>;

/** Grid placement of each bot seat: a row of three on phones, around the trick on desktop. */
const SEAT_CLASS: Record<number, string> = {
  1: 'col-start-1 row-start-1 sm:row-start-2 sm:self-center',
  2: 'col-start-2 row-start-1 sm:mx-auto sm:w-full sm:max-w-[12rem]',
  3: 'col-start-3 row-start-1 sm:row-start-2 sm:self-center',
};

const playKey = (card: CardCode) => spadesEngine.moveKey({ type: 'play', card });

/**
 * Spades' Board. Remounts the table for every new deal (so the deal animates again when
 * the practice hand restarts), keyed by the 13 cards the learner was dealt.
 */
export function SpadesBoard(props: SpadesBoardProps) {
  return <SpadesTable key={dealtToLearner(props.state).join('')} {...props} />;
}

function SpadesTable({
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
}: SpadesBoardProps) {
  const reduced = useReducedMotionPref();
  const rootRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const bidFocused = useRef(false);
  const mine = useMemo(() => state.hands[human] ?? [], [state.hands, human]);
  const bidding = state.phase === 'bid';
  const myBid = state.bids[human] ?? null;
  const picking = bidding && myBid === null;
  const myTurn = !over && state.turn === human;
  const nameOf = (seat: number) => seatName(personas, seat);

  /* ------------------------------------------------------------ bidding */
  const [picked, setPicked] = useState<number | null>(null);

  const selectBid = (bid: number) => {
    setPicked(bid);
  };

  const submitBid = () => {
    if (busy) return;
    if (picked === null) {
      announce(t('spades.picker.pickFirst'));
      return;
    }
    onMove({ type: 'bid', tricks: picked });
  };

  // 0–9 choose a bid and B bids, from anywhere on the page — except while typing or inside
  // another dialog. (Bids 10–13 are one arrow press away in the bid picker.)
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (!picking) return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const key = e.key.toLowerCase();
    const digit = /^[0-9]$/.test(key) ? Number(key) : null;
    if (digit === null && key !== 'b') return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && isTypingTarget(el)) return;
    const dialog = el?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    e.preventDefault();
    if (digit !== null && digit <= MAX_BID) {
      setPicked(digit);
      rootRef.current
        ?.querySelector<HTMLElement>(`[data-testid="spades-bid-${digit}"]`)
        ?.focus({ preventScroll: true });
      return;
    }
    submitBid();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // The bid picker disappears once the learner has bid: keep keyboard focus in the hand.
  useLayoutEffect(() => {
    if (picking || !bidFocused.current) return;
    bidFocused.current = false;
    handRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [picking]);

  /* ------------------------------------------------------------ playing */
  const legalCards = useMemo(
    () => new Set(legalMoves.flatMap((m) => (m.type === 'play' ? [m.card] : []))),
    [legalMoves],
  );
  const canPlayNow = !bidding && myTurn && !busy;
  const highlighted = new Set(
    mine.flatMap((c, i) => (coachMode && highlight.has(playKey(c)) ? [i] : [])),
  );
  const suggestedAt =
    suggestedKey === null ? -1 : mine.findIndex((c) => playKey(c) === suggestedKey);

  const view = trickView(state);
  const us = teamTally(state, 0);
  const them = teamTally(state, 1);
  const busyReason = over
    ? t('spades.picker.over')
    : t('spades.picker.wait', { name: nameOf(state.turn) });

  return (
    <div
      ref={rootRef}
      data-testid="spades-board"
      data-phase={state.phase}
      className="relative flex flex-col gap-2.5 sm:gap-3"
    >
      {/* The bots and the trick */}
      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] items-start gap-1.5 pt-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-3">
        {[1, 2, 3].map((seat) => {
          const persona = personas[seat];
          if (!persona) return null;
          return (
            <OpponentSeat
              key={seat}
              seat={seat}
              persona={persona}
              partner={seat === partnerOf(human)}
              active={!over && state.turn === seat}
              thinking={thinking === seat}
              thinkingLabel={bidding ? t('spades.seat.bidding') : t('play.seat.thinking')}
              bid={state.bids[seat] ?? null}
              tricks={state.tricksWon[seat] ?? 0}
              count={(state.hands[seat] ?? []).length}
              className={SEAT_CLASS[seat]}
            />
          );
        })}
        <div className="col-span-3 col-start-1 row-start-2 flex min-w-0 flex-col items-center gap-2 py-1 sm:col-span-1 sm:col-start-2 sm:row-start-2">
          {bidding ? (
            <BiddingCentre waitingFor={myTurn ? null : nameOf(state.turn)} reduced={reduced} />
          ) : (
            <TrickArea
              view={view}
              trickCount={state.tricks.length}
              personas={personas}
              human={human}
            />
          )}
          {!bidding ? (
            <span
              data-testid="spades-trick-number"
              className="text-mist text-[0.6875rem] font-bold tracking-[0.14em] uppercase"
            >
              {t('spades.table.trickOf', { n: Math.min(view.number, 13) })}
            </span>
          ) : null}
        </div>
      </div>

      <TeamPanels
        us={us}
        them={them}
        personas={personas}
        spadesBroken={state.spadesBroken}
        showBroken={!bidding}
      />

      {/* The learner */}
      <div
        data-testid="spades-seat-0"
        data-active={myTurn || undefined}
        className={cn(
          'relative flex flex-col gap-1 rounded-2xl border px-1 pt-2 pb-1 transition-[border-color,box-shadow] duration-200',
          myTurn
            ? 'border-gold-300/70 shadow-[0_0_0_1px_rgb(245_215_122/0.25),0_0_26px_-6px_rgb(245_215_122/0.5)]'
            : 'border-transparent',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 px-2">
          <p className="flex flex-wrap items-center gap-1.5">
            <span className="text-gold-100 text-sm font-bold">{nameOf(human)}</span>
            <BidBadge
              seat={human}
              name={nameOf(human)}
              bid={myBid}
              tricks={state.tricksWon[human] ?? 0}
            />
            <TricksCount seat={human} name={nameOf(human)} tricks={state.tricksWon[human] ?? 0} />
          </p>
          {myTurn ? (
            <span
              data-testid="spades-your-turn"
              className="bg-gold-300 text-ink rounded-full px-2 py-0.5 text-xs font-bold"
            >
              {t('play.seat.yourTurn')}
            </span>
          ) : null}
        </div>
        {/* Once all 13 cards are played the hand is empty: drop it, so no blank box is
            left above the score sheet. */}
        <div ref={handRef} hidden={mine.length === 0}>
          <Hand
            cards={mine}
            label={picking ? t('spades.zone.youBid') : t('spades.zone.you')}
            onActivate={(card) => onMove({ type: 'play', card })}
            playable={canPlayNow ? (card) => legalCards.has(card) : undefined}
            highlighted={highlighted}
            suggested={suggestedAt >= 0 ? suggestedAt : null}
            dealFrom="top"
            disabled={busy}
            data-testid="spades-hand"
          />
        </div>
      </div>

      {picking ? (
        <div
          role="group"
          aria-label={t('spades.picker.label')}
          onFocus={() => {
            bidFocused.current = true;
          }}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
              bidFocused.current = false;
            }
          }}
        >
          <BidPicker
            selected={picked}
            onSelect={selectBid}
            onSubmit={submitBid}
            busy={busy}
            busyReason={busyReason}
            coachMode={coachMode}
            highlight={highlight}
            suggestedKey={suggestedKey}
          />
        </div>
      ) : null}

      {over ? <ScoreSheet state={state} personas={personas} /> : null}

      <p
        data-testid="spades-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('spades.keys.title')}:</span>
        <span>{t('spades.keys.move')}</span>
        <span>{t('spades.keys.act')}</span>
        {picking ? <span>{t('spades.keys.digits')}</span> : null}
        {picking ? <span>{t('spades.keys.bid')}</span> : null}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- pieces */

/** The bidding centrepiece: a gold spade under a marquee title, and whose bid it is. */
function BiddingCentre({ waitingFor, reduced }: { waitingFor: string | null; reduced: boolean }) {
  return (
    <div
      role="group"
      aria-label={t('spades.zone.trickBidding')}
      data-testid="spades-bidding-centre"
      className="flex flex-col items-center gap-1 py-1 text-center sm:gap-1.5 sm:py-2"
    >
      <span
        aria-hidden="true"
        className="relative inline-flex size-14 items-center justify-center drop-shadow-[0_0_10px_rgb(245_215_122/0.45)] sm:size-24"
      >
        <motion.svg
          viewBox="0 0 80 80"
          className="text-gold-300 absolute inset-0 size-full"
          animate={reduced ? undefined : { rotate: 360 }}
          transition={reduced ? undefined : { duration: 14, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx={40}
            cy={40}
            r={30}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeDasharray="2 6"
            strokeWidth={3}
            strokeLinecap="round"
          />
        </motion.svg>
        <motion.svg
          viewBox="0 0 24 24"
          className="relative size-7 sm:size-9"
          animate={reduced ? undefined : { scale: [1, 1.08, 1] }}
          transition={reduced ? undefined : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <path
            d="M12 2.5c-.5.6-8 6.6-8 11.3 0 2.5 2 4.4 4.4 4.4 1.3 0 2.5-.6 3.2-1.5-.3 1.9-1.1 3.4-2.6 4.8h6c-1.5-1.4-2.3-2.9-2.6-4.8.7.9 1.9 1.5 3.2 1.5 2.4 0 4.4-1.9 4.4-4.4 0-4.7-7.5-10.7-8-11.3z"
            fill="#17161b"
            stroke="#f5d77a"
            strokeWidth={1}
          />
        </motion.svg>
      </span>
      <p className="font-display text-foil text-lg leading-none font-bold">
        {t('spades.table.biddingTitle')}
      </p>
      <p className="text-cream/85 min-h-4 text-xs font-semibold">
        {waitingFor
          ? t('spades.table.biddingWait', { name: waitingFor })
          : t('spades.table.biddingYou')}
      </p>
    </div>
  );
}
