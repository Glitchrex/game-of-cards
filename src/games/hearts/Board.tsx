'use client';
/**
 * The Hearts table. Same shape as the Blackjack reference Board (see
 * src/games/blackjack/README.md):
 *
 *   ┌──────────────────────────────────────────────┐
 *   │ [Left seat]      [Across seat]   [Right seat] │  mobile: the three bots in a row
 *   │                    ┌──┐                       │  desktop: left / across / right
 *   │              ┌──┐  │Q♣│  ┌──┐                 │  around the trick
 *   │              │J♣│      │K♣│   ← the trick     │
 *   │                    ┌──┐                       │  four slots, one per seat
 *   │                    │2♣│                       │
 *   │   Trick 2 / 13          ♥ Hearts not broken   │
 *   │ You ♥0                              Your turn │
 *   │  [ your 13 cards — one tab stop, ← → Enter ]  │  hearts-hand
 *   │  [ 2 of 3 picked ] [ Pass 3 cards left ]      │  hearts-pass (pass phase only)
 *   └──────────────────────────────────────────────┘
 *
 * - Only what the learner may see is rendered: the bots' hands are card backs (a count),
 *   the cards they pass are never shown, and the learner's own passed and received cards
 *   are.
 * - The learner may ATTEMPT anything: any card can be played (illegal ones are dimmed and
 *   the controller explains why), and the Pass button works with any number picked.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import { useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Hand, PlayingCard } from '@/components/cards';
import { announce } from '@/components/layout/LiveAnnouncer';
import { cn } from '@/components/ui/cn';
import { HeartIcon } from '@/components/ui/icons';
import { cardName, type CardCode } from '@/games/core/cards';
import { type BoardProps } from '@/games/core/module';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { heartsEngine, type HeartsMove, type HeartsState } from './engine';
import { PASS_SIZE, passSource, passTarget } from './rules';
import { PassBar } from './board/PassBar';
import { ScoreSheet } from './board/ScoreSheet';
import { OpponentSeat, PointsPill } from './board/Seats';
import {
  capturedBy,
  cardList,
  dealtToLearner,
  directionText,
  isTypingTarget,
  trickView,
} from './board/shared';
import { TrickArea } from './board/TrickArea';

export type HeartsBoardProps = BoardProps<HeartsState, HeartsMove>;

const RECEIVED_W = 'clamp(34px, 9.5vw, 46px)';

/** Grid placement of each bot seat: a row of three on phones, around the trick on desktop. */
const SEAT_CLASS: Record<number, string> = {
  1: 'col-start-1 row-start-1 sm:row-start-2 sm:self-center',
  2: 'col-start-2 row-start-1 sm:mx-auto sm:w-full sm:max-w-[12rem]',
  3: 'col-start-3 row-start-1 sm:row-start-2 sm:self-center',
};

const playKey = (card: CardCode) => heartsEngine.moveKey({ type: 'play', card });

/**
 * Hearts' Board. Remounts the table for every new deal (so the deal animates again when
 * the practice hand restarts), keyed by the 13 cards the learner was dealt.
 */
export function HeartsBoard(props: HeartsBoardProps) {
  return <HeartsTable key={dealtToLearner(props.state).join('')} {...props} />;
}

function HeartsTable({
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
}: HeartsBoardProps) {
  const reduced = useReducedMotionPref();
  const rootRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const passFocused = useRef(false);
  const mine = useMemo(() => state.hands[human] ?? [], [state.hands, human]);
  const passing = state.phase === 'pass';
  const myTurn = !over && state.turn === human;
  const nameOf = (seat: number) => personas[seat]?.name ?? t('play.seat.you');

  /* ------------------------------------------------------------ passing */
  const [picks, setPicks] = useState<CardCode[]>([]);
  // Picks only ever name cards still in the hand (they leave it once passed).
  const picked = passing ? picks.filter((c) => mine.includes(c)) : [];
  const sent = passing ? (state.passed[human] ?? null) : null;
  const target = passTarget(human, state.passDirection);
  const direction = directionText(state.passDirection);
  const passMoves = useMemo(
    () => (passing ? legalMoves.filter((m) => m.type === 'pass') : []),
    [passing, legalMoves],
  );
  const suggestedPass = useMemo(() => {
    if (!passing || suggestedKey === null) return null;
    const move = passMoves.find((m) => heartsEngine.moveKey(m) === suggestedKey);
    return move?.type === 'pass' ? move.cards : null;
  }, [passing, suggestedKey, passMoves]);
  const pickedKey = heartsEngine.moveKey({ type: 'pass', cards: picked });

  const togglePick = (card: CardCode) => {
    if (busy) return;
    let next: CardCode[];
    let message: string;
    if (picked.includes(card)) {
      next = picked.filter((c) => c !== card);
      message = t('hearts.pass.unpicked', { card: cardName(card), n: next.length });
    } else if (picked.length >= PASS_SIZE) {
      // A fourth pick swaps out the earliest one, so exactly three stay chosen.
      const [oldest, ...rest] = picked;
      next = [...rest, card];
      message = t('hearts.pass.swapped', {
        old: oldest ? cardName(oldest) : '',
        new: cardName(card),
        n: next.length,
      });
    } else {
      next = [...picked, card];
      message = t('hearts.pass.picks', { cards: cardName(card), n: next.length });
    }
    setPicks(next);
    announce(message);
  };

  const pass = () => {
    if (busy) return;
    onMove({ type: 'pass', cards: picked });
  };

  const pickSuggestion = () => {
    if (busy || !suggestedPass) return;
    setPicks([...suggestedPass]);
    announce(t('hearts.pass.picks', { cards: cardList(suggestedPass), n: suggestedPass.length }));
  };

  // P passes from anywhere on the page — except while typing or inside another dialog.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (!passing || sent) return;
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.key.toLowerCase() !== 'p') return;
    const el = e.target instanceof Element ? e.target : null;
    if (el && isTypingTarget(el)) return;
    const dialog = el?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    e.preventDefault();
    pass();
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  // The Pass button disappears when the cards change hands: keep keyboard focus in the hand.
  useLayoutEffect(() => {
    if (passing || !passFocused.current) return;
    passFocused.current = false;
    handRef.current?.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }, [passing]);

  /* ------------------------------------------------------------ playing */
  const legalCards = useMemo(
    () => new Set(legalMoves.flatMap((m) => (m.type === 'play' ? [m.card] : []))),
    [legalMoves],
  );
  const canPlayNow = !passing && myTurn && !busy;
  const highlighted = new Set(
    mine.flatMap((c, i) =>
      passing
        ? suggestedPass?.includes(c)
          ? [i]
          : []
        : coachMode && highlight.has(playKey(c))
          ? [i]
          : [],
    ),
  );
  const suggestedAt =
    passing || suggestedKey === null ? -1 : mine.findIndex((c) => playKey(c) === suggestedKey);
  const selected = passing
    ? new Set(mine.flatMap((c, i) => (picked.includes(c) ? [i] : [])))
    : undefined;

  const view = trickView(state);
  const received = !passing && state.tricks.length === 0 ? state.received[human] : null;
  const receivedFrom = passSource(human, state.passDirection);
  const busyReason = over
    ? t('hearts.status.over')
    : sent
      ? t('hearts.pass.wait')
      : t('hearts.status.wait', { name: nameOf(state.turn) });

  return (
    <div
      ref={rootRef}
      data-testid="hearts-board"
      data-phase={state.phase}
      className="relative flex flex-col gap-2.5 sm:gap-3"
    >
      {/* The bots and the trick */}
      <div className="grid grid-cols-3 items-start gap-1.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)] sm:gap-3">
        {[1, 2, 3].map((seat) => {
          const persona = personas[seat];
          if (!persona) return null;
          const hasPassed = passing && state.passed[seat] !== null;
          return (
            <OpponentSeat
              key={seat}
              seat={seat}
              persona={persona}
              active={!over && state.turn === seat}
              thinking={thinking === seat}
              thinkingLabel={passing ? t('hearts.seat.choosing') : t('play.seat.thinking')}
              captured={capturedBy(state, seat)}
              count={(state.hands[seat] ?? []).length}
              note={hasPassed ? t('hearts.seat.passed') : undefined}
              className={SEAT_CLASS[seat]}
            />
          );
        })}
        <div className="col-span-3 col-start-1 row-start-2 flex min-w-0 flex-col items-center gap-2 py-1 sm:col-span-1 sm:col-start-2 sm:row-start-2">
          {passing ? (
            <PassingCompass
              passDirection={state.passDirection}
              direction={direction}
              reduced={reduced}
            />
          ) : (
            <TrickArea
              view={view}
              trickCount={state.tricks.length}
              personas={personas}
              human={human}
            />
          )}
          {!passing ? (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <span
                data-testid="hearts-trick-number"
                className="text-mist text-[0.6875rem] font-bold tracking-[0.14em] uppercase"
              >
                {t('hearts.table.trickOf', { n: Math.min(view.number, 13) })}
              </span>
              <HeartsBrokenChip broken={state.heartsBroken} reduced={reduced} />
            </div>
          ) : null}
        </div>
      </div>

      {received && received.length > 0 ? (
        <div
          role="group"
          aria-label={t('hearts.pass.receivedLabel', {
            name: nameOf(receivedFrom),
            cards: cardList(received),
          })}
          data-testid="hearts-received"
          className="border-gold-300/30 bg-felt-950/45 mx-auto flex items-center gap-2 rounded-xl border px-3 py-1"
        >
          <span aria-hidden="true" className="text-gold-200 text-xs font-bold">
            {t('hearts.pass.received', { name: nameOf(receivedFrom) })}
          </span>
          <span aria-hidden="true" className="flex">
            {received.map((c, i) => (
              <motion.span
                key={c}
                className="inline-flex"
                style={{ marginInlineStart: i === 0 ? undefined : `calc(-0.3 * ${RECEIVED_W})` }}
                initial={reduced ? false : { opacity: 0, x: -30, rotate: -12 }}
                animate={{ opacity: 1, x: 0, rotate: (i - 1) * 5 }}
                transition={reduced ? { duration: 0 } : { delay: 0.15 + i * 0.08, duration: 0.4 }}
              >
                <PlayingCard code={c} decorative highlighted style={{ width: RECEIVED_W }} />
              </motion.span>
            ))}
          </span>
        </div>
      ) : null}

      {/* The learner */}
      <div
        data-testid="hearts-seat-0"
        data-active={myTurn || undefined}
        className={cn(
          'relative flex flex-col gap-1 rounded-2xl border px-1 pt-2 pb-1 transition-[border-color,box-shadow] duration-200',
          myTurn
            ? 'border-gold-300/70 shadow-[0_0_0_1px_rgb(245_215_122/0.25),0_0_26px_-6px_rgb(245_215_122/0.5)]'
            : 'border-transparent',
        )}
      >
        <div className="flex items-center justify-between gap-2 px-2">
          <p className="flex items-center gap-2">
            <span className="text-gold-100 text-sm font-bold">{nameOf(human)}</span>
            <PointsPill seat={human} name={nameOf(human)} captured={capturedBy(state, human)} />
          </p>
          {myTurn ? (
            <span className="bg-gold-300 text-ink rounded-full px-2 py-0.5 text-xs font-bold">
              {t('play.seat.yourTurn')}
            </span>
          ) : null}
        </div>
        <div ref={handRef}>
          {/* Once the last card is played the empty hand would only leave a gap. */}
          {mine.length > 0 ? (
            <Hand
              cards={mine}
              label={
                passing && !sent
                  ? t('hearts.zone.youPass', { name: nameOf(target) })
                  : t('hearts.zone.you')
              }
              onActivate={(card) => (passing ? togglePick(card) : onMove({ type: 'play', card }))}
              playable={canPlayNow ? (card) => legalCards.has(card) : undefined}
              highlighted={highlighted}
              suggested={suggestedAt >= 0 ? suggestedAt : null}
              selected={selected}
              dealFrom="top"
              disabled={busy}
              data-testid="hearts-hand"
            />
          ) : null}
        </div>
      </div>

      {passing ? (
        <PassBar
          picked={picked}
          targetName={nameOf(target)}
          direction={direction}
          busy={busy}
          busyReason={busyReason}
          sent={sent}
          glow={coachMode && highlight.has(pickedKey)}
          suggestion={suggestedPass}
          suggested={suggestedKey !== null && suggestedKey === pickedKey}
          onPass={pass}
          onUseSuggestion={pickSuggestion}
          onButtonFocus={(focused) => {
            passFocused.current = focused;
          }}
        />
      ) : null}

      {over ? <ScoreSheet state={state} personas={personas} /> : null}

      <p
        data-testid="hearts-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('hearts.keys.title')}:</span>
        <span>{t('hearts.keys.move')}</span>
        <span>{t('hearts.keys.act')}</span>
        {passing ? <span>{t('hearts.keys.pass')}</span> : null}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------- pieces */

/** "Hearts broken" / "Hearts not broken": pops when the first Heart lands. */
function HeartsBrokenChip({ broken, reduced }: { broken: boolean; reduced: boolean }) {
  return (
    <motion.span
      key={broken ? 'broken' : 'whole'}
      data-testid="hearts-broken"
      data-broken={broken}
      initial={reduced || !broken ? false : { scale: 1.6, rotate: -8 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 14 }}
      title={broken ? t('hearts.table.brokenHint') : t('hearts.table.notBrokenHint')}
      className={cn(
        'inline-flex min-h-6 items-center gap-1 rounded-full border px-2 text-[0.6875rem] font-bold',
        broken
          ? 'border-velvet-300/70 bg-velvet-600 text-cream'
          : 'border-gold-300/30 bg-felt-950/60 text-mist',
      )}
    >
      <HeartIcon size={12} className={broken ? 'text-cream' : 'text-velvet-300'} />
      {broken ? t('hearts.table.broken') : t('hearts.table.notBroken')}
      <span className="sr-only">
        {' '}
        {broken ? t('hearts.table.brokenHint') : t('hearts.table.notBrokenHint')}
      </span>
    </motion.span>
  );
}

/** The pass phase centrepiece: a gold ring of arrows turning the way the cards travel. */
function PassingCompass({
  passDirection,
  direction,
  reduced,
}: {
  passDirection: HeartsState['passDirection'];
  direction: string;
  reduced: boolean;
}) {
  // Seen from above, passing left (you → the player on your left) runs clockwise.
  const turn = passDirection === 'right' ? -360 : 360;
  return (
    <div
      data-testid="hearts-passing"
      className="flex flex-col items-center gap-1.5 py-2 text-center"
    >
      <span
        aria-hidden="true"
        className="relative inline-flex size-20 items-center justify-center drop-shadow-[0_0_10px_rgb(245_215_122/0.45)] sm:size-24"
      >
        <motion.svg
          viewBox="0 0 80 80"
          className="text-gold-300 absolute inset-0 size-full"
          animate={reduced ? undefined : { rotate: turn }}
          transition={reduced ? undefined : { duration: 9, repeat: Infinity, ease: 'linear' }}
        >
          <circle
            cx={40}
            cy={40}
            r={28}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeDasharray="3 5"
          />
          {[0, 120, 240].map((deg) => (
            <g key={deg} transform={`rotate(${deg} 40 40)`}>
              <path
                d={
                  passDirection === 'right'
                    ? 'M 64 26 A 28 28 0 0 0 40 12'
                    : 'M 40 12 A 28 28 0 0 1 64 26'
                }
                fill="none"
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
              />
              <path
                d={
                  passDirection === 'right'
                    ? 'M 40 12 l 5.5 -5.5 M 40 12 l 5.5 5.5'
                    : 'M 64 26 l -7.5 -1 M 64 26 l 1.5 -7.5'
                }
                stroke="currentColor"
                strokeWidth={3}
                strokeLinecap="round"
              />
            </g>
          ))}
        </motion.svg>
        <svg viewBox="0 0 24 24" className="relative size-8">
          <path
            d="M12 20.5c-.6-.5-8.5-5.6-8.5-11.1C3.5 6.6 5.6 4.5 8.2 4.5c1.6 0 3 .8 3.8 2.1.8-1.3 2.2-2.1 3.8-2.1 2.6 0 4.7 2.1 4.7 4.9 0 5.5-7.9 10.6-8.5 11.1z"
            fill="#c22f47"
            stroke="#f5d77a"
            strokeWidth={1}
          />
        </svg>
      </span>
      <p className="font-display text-foil text-lg leading-none font-bold">
        {t('hearts.table.passingTitle')}
      </p>
      <p className="text-cream/85 text-xs font-semibold">
        {t('hearts.table.passing', { direction })}
      </p>
    </div>
  );
}
