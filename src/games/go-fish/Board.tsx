'use client';
/**
 * The Go Fish table. Same shape as the Blackjack reference Board (see
 * src/games/blackjack/README.md):
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [Machli Mira ▸ 5 cards]  [Kanta Kaka ▸ 7]    │  seats = "who to ask" buttons
 *   │   ▒▒▒▒▒  books: 7777          ▒▒▒▒▒▒▒        │  (gofish-target-<seat>), backs, books
 *   │        “Kanta Kaka asked you for Sevens”     │  the latest ask, as everyone heard it
 *   │              ~~ ▒ ▒▒ ▒ ~~  GO FISH!          │  the pond (count) + the splash
 *   │ You · Your turn — ask someone!   books: KKKK │  your books (gofish-books-0)
 *   │   [3 3] [7] [9 9 9] [Q]  ← ranks             │  your hand by rank (gofish-rank-<R>)
 *   │   [ Ask Kanta Kaka for Sevens ]              │  gofish-ask
 *   └──────────────────────────────────────────────┘
 *
 * - Only what the learner may see is rendered: bots' hands are card backs (a count), the
 *   pond is backs, and the bubble/splash read only the public part of the log (a bot's Go
 *   Fish draw stays secret unless it was the rank it asked for).
 * - The learner may ATTEMPT anything: every seat (even one with no cards) and every rank
 *   can be picked, and Ask works with a missing player or rank — the controller explains.
 * - Announcements of moves come from the controller (engine.describeMove); the Board only
 *   announces the learner's picks and labels the zones.
 */
import { useEffect, useEffectEvent, useId, useMemo, useRef, useState } from 'react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { cn } from '@/components/ui/cn';
import { TrophyIcon } from '@/components/ui/icons';
import { type Rank } from '@/games/core/cards';
import { type BoardProps } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/games/go-fish/i18n';
import { AskBar } from './board/AskBar';
import { HandGroups } from './board/HandGroups';
import { LastAskBubble, Pond, Splash } from './board/Pond';
import { BookRow, OpponentSeat } from './board/Seats';
import {
  askKey,
  booksText,
  freshRanks,
  isTypingTarget,
  lastAsk,
  lastAskIndex,
  moveFor,
  personaFor,
  rankForKey,
  rankGroups,
} from './board/shared';
import { useRoving } from './board/useRoving';
import { askableSeats, type GoFishMove, type GoFishState } from './engine';
import { rankPlural } from './rules';

export type GoFishBoardProps = BoardProps<GoFishState, GoFishMove>;

/**
 * Placeholders for an incomplete ask. The learner may press Ask before picking a player or
 * a rank; the engine's checkMove then explains what an ask needs ("Pick one of the other
 * players…", "Pick a rank to ask for…") instead of the Board silently ignoring the press.
 */
const NO_TARGET: PlayerId = -1;
const NO_RANK = '' as Rank;

/**
 * Go Fish's Board. Remounts the table for every new deal (so the deal animates again when
 * the practice hand restarts). A deal is recognised by its first logged event, which the
 * engine carries over unchanged from move to move.
 */
export function GoFishBoard(props: GoFishBoardProps) {
  const id = useDealId(props.state);
  return <GoFishTable key={id} {...props} />;
}

function useDealId(state: GoFishState): number {
  const first = state.log[0] ?? null;
  const [deal, setDeal] = useState(() => ({ id: 0, start: state, first }));
  const fresh = first === null ? state !== deal.start : deal.first !== null && first !== deal.first;
  if (fresh) {
    setDeal({ id: deal.id + 1, start: state, first });
  } else if (first !== null && deal.first === null) {
    setDeal({ ...deal, first });
  }
  return fresh ? deal.id + 1 : deal.id;
}

interface Selection {
  rank: Rank | null;
  /** Log length when the rank was picked: a rank pick lasts until the next move. */
  rankAt: number;
  target: PlayerId | null;
  targetAt: number;
}

function GoFishTable({
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
}: GoFishBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const layoutPrefix = useId().replace(/[^A-Za-z0-9_-]/g, '');
  const ids = useId();
  const busyId = `${ids}-busy`;
  const suggestedId = `${ids}-suggested`;
  const incompleteId = `${ids}-incomplete`;

  const seats = useMemo(
    () => Array.from({ length: state.players - 1 }, (_, i) => i + 1),
    [state.players],
  );
  const nameOf = (seat: PlayerId) =>
    seat === human ? t('goFish.you.name') : personaFor(personas, seat).name;
  const objectOf = (seat: PlayerId) =>
    seat === human ? t('goFish.you.object') : personaFor(personas, seat).name;

  const hand = useMemo(() => state.hands[human] ?? [], [state.hands, human]);
  const groups = useMemo(() => rankGroups(hand), [hand]);
  const askable = askableSeats(state, human);
  const logLen = state.log.length;
  const myTurn = !over && state.turn === human;

  /* ------------------------------------------------------------ picks */
  const [sel, setSel] = useState<Selection>({ rank: null, rankAt: 0, target: null, targetAt: 0 });
  const rank = sel.rank !== null && sel.rankAt === logLen ? sel.rank : null;
  const chosenTarget =
    sel.target !== null &&
    (sel.targetAt === logLen || (!over && (state.hands[sel.target]?.length ?? 0) > 0))
      ? sel.target
      : null;
  const onlyChoice = !over && askable.length === 1 ? (askable[0] ?? null) : null;
  const target = chosenTarget ?? onlyChoice;

  // Coach mode: ranks and seats that are part of some legal ask glow; the coach's pick pulses.
  const glowMoves = coachMode
    ? legalMoves.filter((m) => highlight.has(askKey(m.target, m.rank)))
    : [];
  const glowRanks = new Set(glowMoves.map((m) => m.rank));
  const glowTargets = new Set(glowMoves.map((m) => m.target));
  const suggestion = moveFor(legalMoves, suggestedKey);
  const selectionKey = rank !== null && target !== null ? askKey(target, rank) : null;
  const askGlow = coachMode && !busy && selectionKey !== null && highlight.has(selectionKey);
  const askSuggested = !busy && selectionKey !== null && selectionKey === suggestedKey;

  const sentence =
    rank !== null && target !== null
      ? t('goFish.ask.button', { name: nameOf(target), rank: rankPlural(rank) })
      : null;
  const missing =
    rank === null && target === null
      ? t('goFish.ask.pickBoth')
      : rank === null
        ? t('goFish.ask.pickRank')
        : t('goFish.ask.pickPlayer');

  const announcePicks = (r: Rank | null, tg: PlayerId | null, picked: 'rank' | 'target') => {
    if (r !== null && tg !== null) {
      announce(t('goFish.ask.ready', { name: nameOf(tg), rank: rankPlural(r) }));
    } else if (picked === 'rank' && r !== null) {
      announce(
        `${t('goFish.ask.rankPicked', { rank: rankPlural(r) })} ${t('goFish.ask.pickPlayer')}.`,
      );
    } else if (tg !== null) {
      announce(
        `${t('goFish.ask.targetPicked', { name: nameOf(tg) })} ${t('goFish.ask.pickRank')}.`,
      );
    }
  };

  const pickRank = (r: Rank) => {
    if (busy) return;
    setSel((s) => ({ ...s, rank: r, rankAt: logLen }));
    announcePicks(r, target, 'rank');
  };
  const pickTarget = (seat: PlayerId) => {
    if (busy) return;
    setSel((s) => ({ ...s, target: seat, targetAt: logLen }));
    announcePicks(rank, seat, 'target');
  };
  const usePick = () => {
    if (busy || !suggestion) return;
    setSel({ rank: suggestion.rank, rankAt: logLen, target: suggestion.target, targetAt: logLen });
    announcePicks(suggestion.rank, suggestion.target, 'rank');
  };
  const ask = () => {
    if (busy) return;
    onMove({ type: 'ask', target: target ?? NO_TARGET, rank: rank ?? NO_RANK });
  };

  // Rank keys anywhere on the page (A, 2–9, T/0, J, Q, K) — except while typing, inside
  // another dialog, with a modifier held or on key repeat.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const r = rankForKey(e.key);
    if (r === null) return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && isTypingTarget(el)) return;
    const dialog = el?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    e.preventDefault();
    pickRank(r);
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  /* ------------------------------------------------------------ what just happened */
  // Asks made before this table mounted don't splash; books laid down before it don't pop.
  const [mountedAsk] = useState(() => lastAskIndex(state.log));
  const [booksAtMount] = useState(() => state.books.map((b) => b.length));
  const latest = lastAsk(state.log);
  const splashAsk = latest && latest.index > mountedAsk ? latest : null;
  const fresh = useMemo(() => freshRanks(state, human), [state, human]);

  const seatRoving = useRoving(seats.map(String));
  const winners = new Set(over ? state.winners : []);
  const busyReason = over
    ? t('goFish.ask.over')
    : t('goFish.ask.wait', { name: nameOf(state.turn) });
  const wentAgain =
    myTurn && latest !== null && latest.seat === human && (latest.got > 0 || latest.wish);
  const youStatus = over
    ? t('goFish.you.over')
    : myTurn
      ? wentAgain
        ? t('goFish.you.again')
        : t('goFish.you.turn')
      : t('goFish.you.waiting', { name: nameOf(state.turn) });
  const myBooks = state.books[human] ?? [];

  return (
    <div
      ref={rootRef}
      data-testid="gofish-board"
      data-phase={state.phase}
      data-turn={over ? undefined : state.turn}
      data-players={state.players}
      className="relative flex flex-col gap-3 sm:gap-4"
    >
      {/* The other players: press a seat to choose who to ask. */}
      <div
        role="toolbar"
        aria-label={t('goFish.zone.seats')}
        aria-orientation="horizontal"
        onKeyDown={seatRoving.onKeyDown}
        onFocus={seatRoving.onFocus}
        onBlur={seatRoving.onBlur}
        className={cn(
          'grid gap-2 sm:gap-3',
          seats.length === 1
            ? 'mx-auto w-full max-w-[16rem] grid-cols-1'
            : seats.length === 3
              ? 'grid-cols-2 sm:grid-cols-3'
              : 'grid-cols-2 lg:[grid-template-columns:repeat(var(--n),minmax(0,1fr))]',
        )}
        style={{ ['--n' as string]: seats.length }}
      >
        {seats.map((seat) => (
          <OpponentSeat
            key={seat}
            seat={seat}
            persona={personaFor(personas, seat)}
            count={state.hands[seat]?.length ?? 0}
            books={state.books[seat] ?? []}
            booksFreshFrom={booksAtMount[seat] ?? 0}
            active={!over && state.turn === seat}
            thinking={thinking === seat}
            // Only on your turn: while a bot plays, an “Asking” tag on its seat reads as if
            // that bot were the one asking.
            picked={!busy && target === seat}
            glow={!busy && glowTargets.has(seat)}
            suggested={!busy && suggestion?.target === seat}
            winner={winners.has(seat)}
            busy={busy}
            roving={seatRoving}
            busyId={busyId}
            suggestedId={suggestedId}
            onPick={pickTarget}
          />
        ))}
      </div>

      {/* The middle: the latest ask, the pond and the splash. */}
      <div className="flex flex-col items-center gap-2.5">
        <LastAskBubble ask={latest} nameOf={nameOf} objectOf={objectOf} />
        <div className="relative w-full pb-2">
          <Pond count={state.stock.length} shimmer={!over} />
          <Splash ask={splashAsk} />
        </div>
        <p className="text-gold-200/80 font-display text-[0.6875rem] tracking-[0.22em] uppercase">
          <span aria-hidden="true">‿ {t('goFish.felt.rule')} ‿</span>
          <span className="sr-only">{t('goFish.felt.rules')}</span>
        </p>
      </div>

      {/* The learner: books, hand by rank, the Ask bar. */}
      <div
        role="group"
        aria-label={t('goFish.you.zone')}
        data-testid="gofish-you"
        data-active={myTurn || undefined}
        data-winner={winners.has(human) || undefined}
        className={cn(
          'relative flex flex-col gap-2 rounded-2xl border px-2 pt-2 pb-3 transition-[border-color,box-shadow] duration-200 sm:px-3',
          myTurn
            ? 'border-gold-300/70 shadow-[0_0_0_1px_rgb(245_215_122/0.25),0_0_26px_-6px_rgb(245_215_122/0.5)]'
            : 'border-gold-300/15',
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          <p className="flex min-w-0 items-center gap-2">
            <span className="text-gold-100 text-sm font-bold">{t('goFish.you.name')}</span>
            <span
              data-testid="gofish-you-status"
              className={cn(
                'rounded-full px-2 py-0.5 text-xs font-bold',
                myTurn ? 'bg-gold-300 text-ink' : 'text-mist',
              )}
            >
              {youStatus}
            </span>
            {winners.has(human) ? (
              <span className="bg-gold-300 text-ink inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.625rem] font-extrabold tracking-[0.12em] uppercase">
                <TrophyIcon size={11} />
                {t('goFish.seat.winner')}
              </span>
            ) : null}
          </p>
          <p className="text-mist text-xs font-semibold" data-testid="gofish-you-count">
            {booksText(myBooks.length)}
          </p>
        </div>
        <BookRow
          seat={human}
          name={t('goFish.you.name')}
          books={myBooks}
          width="clamp(26px, 7.4vw, 38px)"
          freshFrom={booksAtMount[human] ?? 0}
          layoutPrefix={layoutPrefix}
          emptyText={t('goFish.you.noBooks')}
          you
          className="min-h-10"
        />
        <HandGroups
          groups={groups}
          picked={rank}
          glow={busy ? new Set() : glowRanks}
          suggested={!busy && suggestion ? suggestion.rank : null}
          fresh={fresh}
          busy={busy}
          busyId={busyId}
          suggestedId={suggestedId}
          layoutPrefix={layoutPrefix}
          onPick={pickRank}
        />
        <AskBar
          sentence={sentence}
          missing={missing}
          busy={busy}
          busyReason={busyReason}
          glow={askGlow}
          suggested={askSuggested}
          canUsePick={coachMode && suggestion !== null && selectionKey !== suggestedKey && !busy}
          onAsk={ask}
          onUsePick={usePick}
          ids={{ busy: busyId, suggested: suggestedId, incomplete: incompleteId }}
        />
      </div>
    </div>
  );
}
