'use client';
/**
 * The War table (built on the Blackjack reference Board — see ../blackjack/README.md).
 *
 *   ┌──────────────────────────────────────────┐
 *   │ [Bugle Bhaskar seat]            [pile 26]│  opponent: persona + face-down pile
 *   │ ┌ Battle 3 ─────────── [ WAR! ] ───────┐ │
 *   │ │   You        (VS)    Bugle Bhaskar   │ │  battle area: both sides' cards
 *   │ │  A♠ ▒▒▒ A♥           A♦ ▒▒▒ J♣       │ │
 *   │ │      You win the war! You take 10.   │ │
 *   │ └──────────────────────────────────────┘ │
 *   │ [You seat]                      [pile 31]│  learner: seat + face-down pile
 *   │ Battle 3 of 60 ··············· 57 left   │  battle counter + progress
 *   │ You 31 [■■■■■■■■■■■▒▒▒▒▒▒▒▒] Bhaskar 21  │  who holds more cards
 *   │ [        FLIP (F)        ] [ Auto ×10 ]  │  actions
 *   └──────────────────────────────────────────┘
 *
 * Engine design (engine.ts): it is always the learner's turn; one Flip fights a whole
 * battle, wars included, so the bot never has a move of its own.
 *
 * Rules of the road (as in Blackjack):
 * - Render ONLY what the learner may see: both piles are face down (Pile with a count), and
 *   the cards laid face down in a war are CardBacks with no code, so they never reach the
 *   DOM — not even after the game.
 * - The learner may press Flip at any time; the controller explains when it can't be
 *   applied. Only `busy` (game over / paused) stops input, and buttons keep focus.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import { motion } from 'motion/react';
import { useEffect, useEffectEvent, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Pile } from '@/components/cards';
import { Seat } from '@/components/play/Seat';
import { type BoardProps } from '@/games/core/module';
import { t } from '@/games/war/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { ActionBar, type WarAction } from './board/ActionBar';
import { BattleArea } from './board/BattleArea';
import { Scoreboard } from './board/Scoreboard';
import { countsBefore, revealMs } from './board/view';
import { type Pair, type WarMove, type WarSeat, type WarState } from './engine';
import { BUGLE_BHASKAR } from './personas';

export type WarBoardProps = BoardProps<WarState, WarMove>;

const BOT: WarSeat = 1;
const FLIP: WarMove = { type: 'flip' };
/** Battles played by one press of Auto-flip. */
export const AUTO_BATTLES = 10;
/** ms Auto-flip waits after a battle's reveal before the next Flip. */
export const AUTO_PAUSE_MS = 550;
/** ms between Auto-flips under reduced motion (there is no reveal to wait for). */
export const AUTO_REDUCED_MS = 700;

function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/** Space and Enter belong to whatever control has focus; they only Flip from the table. */
const INTERACTIVE =
  'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [role="switch"], [role="radio"], [role="option"], [tabindex]:not([tabindex="-1"])';

/**
 * War's Board. A new game (the battle count goes back down, e.g. "Try another practice
 * hand") remounts the table, so Auto-flip and the reveal start fresh.
 */
export function WarBoard(props: WarBoardProps) {
  const battles = props.state.battles;
  const [game, setGame] = useState({ id: 0, battles });
  if (battles !== game.battles) {
    setGame({ id: battles < game.battles ? game.id + 1 : game.id, battles });
  }
  return <WarTable key={game.id} {...props} />;
}

function WarTable({
  state,
  legalMoves,
  onMove,
  busy,
  thinking,
  coachMode,
  highlight,
  suggestedKey,
  personas,
  over,
}: WarBoardProps) {
  const reduced = useReducedMotionPref();
  const rootRef = useRef<HTMLDivElement>(null);
  const youPile = useRef<HTMLDivElement>(null);
  const botPile = useRef<HTMLDivElement>(null);
  const piles: Pair<typeof youPile> = [youPile, botPile];
  const bot = personas[BOT] ?? BUGLE_BHASKAR;
  const battle = state.lastBattle;

  // A battle already on the table when the table mounted is shown as it is (no replay).
  const [settled] = useState(() => battle?.number ?? 0);
  const [revealed, setRevealed] = useState(settled);
  const revealing = battle !== null && battle.number > revealed && !reduced;
  // The piles (and the count bar) catch up when the battle's result lands.
  const live: Pair<number> = [state.piles[0].length, state.piles[1].length];
  const counts = revealing && battle ? countsBefore(battle) : live;
  const gain = !revealing && battle && battle.winner !== null ? battle.won.length : 0;

  const canFlip = legalMoves.some((m) => m.type === 'flip');
  const flipKey = 'flip';

  // Auto-flip: plays up to AUTO_BATTLES battles, one onMove per battle.
  const [autoUntil, setAutoUntil] = useState<number | null>(null);
  const autoRunning = autoUntil !== null && !over && state.battles < autoUntil;
  const autoFlip = useEffectEvent(() => {
    if (!busy) onMove(FLIP);
  });
  useEffect(() => {
    if (!autoRunning || busy) return;
    const wait = reduced ? AUTO_REDUCED_MS : (battle ? revealMs(battle) : 0) + AUTO_PAUSE_MS;
    const id = window.setTimeout(() => autoFlip(), wait);
    return () => window.clearTimeout(id);
  }, [autoRunning, busy, reduced, battle, state.battles]);

  const [flash, setFlash] = useState<WarAction | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 180);
    return () => window.clearTimeout(id);
  }, [flash]);

  const press = (action: WarAction) => {
    if (action === 'auto') {
      if (autoRunning) {
        setAutoUntil(null);
        return;
      }
      if (busy) return;
      setAutoUntil(state.battles + AUTO_BATTLES);
      onMove(FLIP);
      return;
    }
    if (busy) return;
    onMove(FLIP);
  };

  // F / Space / Enter flip and A toggles Auto-flip — except while typing, inside another
  // dialog, or (for Space / Enter) while another control has focus.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const key = e.key.toLowerCase();
    const target = e.target instanceof Element ? e.target : null;
    if (target && isTypingTarget(target)) return;
    const dialog = target?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    let action: WarAction | null = null;
    if (key === 'f') action = 'flip';
    else if (key === 'a') action = 'auto';
    else if (key === ' ' || key === 'enter') {
      if (target?.closest(INTERACTIVE)) return;
      if (busy) return; // let Space scroll the page once the game is over
      action = 'flip';
    }
    if (action === null) return;
    e.preventDefault();
    if (busy && !(action === 'auto' && autoRunning)) return;
    setFlash(action);
    press(action);
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const busyReason = over ? t('war.actions.over') : t('war.actions.wait');

  return (
    <div
      ref={rootRef}
      data-testid="war-board"
      data-phase={state.phase}
      className="relative mx-auto flex w-full max-w-[46rem] flex-col gap-3 sm:gap-4"
    >
      <SeatRow
        seat={BOT}
        name={bot.name}
        count={counts[BOT]}
        gain={gain > 0 && battle?.winner === BOT ? gain : 0}
        gainKey={battle?.number ?? 0}
        pileRef={botPile}
      >
        <Seat
          persona={bot}
          active={false}
          thinking={thinking === BOT}
          className="min-h-[4.875rem] justify-center"
          data-testid="war-bot-seat"
        />
      </SeatRow>

      <BattleArea
        battle={battle}
        settled={settled}
        botName={bot.name}
        piles={piles}
        onRevealed={setRevealed}
      />

      <SeatRow
        seat={0}
        name={bot.name}
        count={counts[0]}
        gain={gain > 0 && battle?.winner === 0 ? gain : 0}
        gainKey={battle?.number ?? 0}
        pileRef={youPile}
      >
        <Seat
          active={!busy && !over}
          thinking={false}
          className="min-h-[4.875rem] justify-center"
          data-testid="war-you-seat"
        />
      </SeatRow>

      <Scoreboard
        battles={state.battles}
        maxBattles={state.maxBattles}
        over={over}
        counts={counts}
        botName={bot.name}
      />

      <ActionBar
        busy={busy}
        busyReason={busyReason}
        canFlip={canFlip}
        coachMode={coachMode}
        highlighted={highlight.has(flipKey)}
        suggested={suggestedKey === flipKey}
        autoRunning={autoRunning}
        flash={flash}
        onPress={press}
      />
    </div>
  );
}

/** A seat with its face-down pile beside it, and a "+N" chip when the pile just grew. */
function SeatRow({
  seat,
  name,
  count,
  gain,
  gainKey,
  pileRef,
  children,
}: {
  seat: WarSeat;
  name: string;
  count: number;
  gain: number;
  gainKey: number;
  pileRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
}) {
  const label = seat === 0 ? t('war.zone.yourPile') : t('war.zone.botPile', { name });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      {children}
      <div
        ref={pileRef}
        data-testid={`war-pile-${seat}`}
        data-count={count}
        className="relative mr-2 mb-2 flex flex-col items-center"
      >
        <Pile count={count} label={label} size="sm" />
        {gain > 0 ? <GainChip key={gainKey} n={gain} seat={seat} /> : null}
      </div>
    </div>
  );
}

function GainChip({ n, seat }: { n: number; seat: WarSeat }) {
  const reduced = useReducedMotionPref();
  return (
    <motion.span
      data-testid={`war-gain-${seat}`}
      initial={reduced ? false : { opacity: 0, y: 10, scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
      className="bg-gold-300 text-ink border-gold-100 tabular absolute -top-2 -left-3 z-20 rounded-full border px-1.5 py-0.5 text-xs font-extrabold shadow-[0_6px_14px_-6px_rgb(0_0_0/0.9)]"
    >
      <span aria-hidden="true">{t('war.lane.gain', { n })}</span>
      <span className="sr-only">{t('war.lane.gainLabel', { n })}</span>
    </motion.span>
  );
}
