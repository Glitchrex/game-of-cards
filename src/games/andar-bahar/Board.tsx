'use client';
/**
 * The Andar Bahar table (built on the Blackjack reference, src/games/blackjack/README.md).
 *
 *   ┌──────────────────────────────────────────┐
 *   │ [Dealer seat: Jhatpat Jamuna]     [deck] │  dealer + the face-down deck
 *   │ ┌ ANDAR · Inside · Pays 0.9 to 1 ──(●) 5┐│  lane 1: inside (gets card 1, 3, 5…)
 *   │ │ 4♣ K♦ 9♠ 2♥ 7♠ ← MATCH!               ││
 *   │ └────────────────────────────────────────┘│
 *   │  Cards dealt        JOKER       Next card │  running count · joker · next lane
 *   │   Card 9           [ 7♥ ]       ↑ Andar   │
 *   │ ┌ BAHAR · Outside · Pays 1 to 1 ──────── 4┐│  lane 2: outside (card 2, 4, 6…)
 *   │ │ 3♦ J♣ 5♥ 8♣                           ││
 *   │ └────────────────────────────────────────┘│
 *   │   [ Bet on Andar ]    [ Bet on Bahar ]     │  bet buttons (A / B)
 *   └──────────────────────────────────────────┘
 *
 * - Only face-up cards reach the DOM: the deck is drawn as card backs with a count (public),
 *   never with its codes. Cards are named in each lane's label for screen readers.
 * - The learner can press either bet button at any time; while the dealer deals (busy) the
 *   buttons keep focus but ignore presses, as in Blackjack.
 * - The controller announces every move (engine.describeMove); the Board only labels zones.
 */
import { useEffect, useEffectEvent, useRef, useState, type RefObject } from 'react';
import { CardBack } from '@/components/cards';
import { Seat } from '@/components/play/Seat';
import { type BoardProps } from '@/games/core/module';
import {
  cardsDealt,
  DEALER,
  dealtInOrder,
  isSide,
  nextSide,
  settle,
  type AndarBaharMove,
  type AndarBaharState,
  type Side,
} from './engine';
import { BetBar } from './board/BetBar';
import { JokerStrip } from './board/JokerStrip';
import { Lane, type LaneOutcome } from './board/Lane';
import { abt } from './board/strings';
import { JHATPAT_JAMUNA } from './personas';

export type AndarBaharBoardProps = BoardProps<AndarBaharState, AndarBaharMove>;

const SHORTCUTS: Readonly<Record<string, Side>> = { a: 'andar', b: 'bahar' };

function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

interface RoundTrack {
  id: number;
  joker: string;
  dealt: number;
  bet: Side | null;
}

/**
 * Andar Bahar's Board. Remounts the table for every new deal (a new joker, or the cards
 * going back to zero), so the joker is turned up again and the first cards fly in.
 */
export function AndarBaharBoard(props: AndarBaharBoardProps) {
  const { state } = props;
  const dealt = cardsDealt(state);
  const [round, setRound] = useState<RoundTrack>(() => ({
    id: 0,
    joker: state.joker,
    dealt,
    bet: state.bet,
  }));
  if (round.joker !== state.joker || round.dealt !== dealt || round.bet !== state.bet) {
    const fresh =
      round.joker !== state.joker ||
      dealt < round.dealt ||
      (state.bet === null && round.bet !== null);
    // Adjusting state while rendering (React's documented pattern for "a prop changed").
    setRound({ id: fresh ? round.id + 1 : round.id, joker: state.joker, dealt, bet: state.bet });
  }
  return <AndarBaharTable key={round.id} {...props} />;
}

function AndarBaharTable({
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
}: AndarBaharBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<HTMLDivElement>(null);
  const dealer = personas[DEALER] ?? JHATPAT_JAMUNA;
  const dealt = dealtInOrder(state);
  // Cards already on the table when it mounted appear in place; later ones fly in.
  const [openingCount] = useState(() => dealt.length);
  const count = dealt.length;
  const finished = state.phase === 'over';
  const settlement = finished ? settle(state) : null;
  const next = state.phase === 'over' ? null : nextSide(state);
  const legal = new Set(
    legalMoves.flatMap((m) => (m.type === 'bet' && isSide(m.side) ? [m.side] : [])),
  );
  const stockLeft = state.stock.length;

  const [flash, setFlash] = useState<Side | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 180);
    return () => window.clearTimeout(id);
  }, [flash]);

  const press = (side: Side) => {
    if (busy) return;
    onMove({ type: 'bet', side });
  };

  // A / B anywhere on the page — except while typing or inside another dialog.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const side = SHORTCUTS[e.key.toLowerCase()];
    if (!side) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && isTypingTarget(target)) return;
    const dialog = target?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    e.preventDefault();
    if (busy) return;
    setFlash(side);
    onMove({ type: 'bet', side });
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const laneProps = (side: Side) => {
    const cards = dealt.filter((c) => c.side === side);
    const winner = settlement?.winner === side;
    const outcome: LaneOutcome | null =
      settlement && settlement.bet === side ? (settlement.won ? 'win' : 'loss') : null;
    return {
      side,
      cards,
      bet: state.bet === side,
      winner,
      loser: settlement !== null && !winner,
      next: next === side && state.phase === 'deal',
      openingCount,
      matchNumber: winner ? (settlement?.matchNumber ?? null) : null,
      outcome,
    };
  };

  const busyReason =
    over || finished
      ? abt('andarBahar.bet.over')
      : abt('andarBahar.bet.wait', { name: dealer.name });

  return (
    <div
      ref={rootRef}
      data-testid="ab-board"
      data-phase={state.phase}
      data-winner={state.winner ?? undefined}
      className="relative flex flex-col gap-3 sm:gap-4"
    >
      {/* Dealer and the face-down deck */}
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:grid-cols-[1fr_minmax(0,20rem)_1fr]">
        <Seat
          persona={dealer}
          active={state.phase === 'deal' && !over}
          thinking={thinking === DEALER}
          // The dealer has no choices: she deals, she doesn't think.
          thinkingLabel={abt('andarBahar.seat.dealing')}
          className="col-start-1 row-start-1 min-h-[4.875rem] justify-center sm:col-start-2"
          data-testid="ab-dealer-seat"
        />
        <Deck ref={deckRef} count={stockLeft} />
      </div>

      <Lane {...laneProps('andar')} sourceRef={deckRef} />
      <JokerStrip joker={state.joker} phase={state.phase} count={count} next={next} />
      <Lane {...laneProps('bahar')} sourceRef={deckRef} />

      <BetBar
        legal={legal}
        chosen={state.bet}
        busy={busy}
        busyReason={busyReason}
        coachMode={coachMode}
        highlight={highlight}
        suggestedKey={suggestedKey}
        flash={flash}
        onPress={press}
      />
    </div>
  );
}

/** The face-down deck the dealer deals from: card backs and a count, never the cards. */
function Deck({ count, ref }: { count: number; ref: RefObject<HTMLDivElement | null> }) {
  const layers = Math.min(3, Math.max(1, Math.ceil(count / 17)));
  return (
    <div
      role="img"
      aria-label={abt('andarBahar.stock.label', {
        n:
          count === 1
            ? abt('andarBahar.lane.countOne')
            : abt('andarBahar.lane.countMany', { n: count }),
      })}
      data-testid="ab-stock"
      data-count={count}
      className="col-start-2 row-start-1 flex flex-col items-center gap-1 justify-self-end sm:col-start-3"
    >
      <div
        ref={ref}
        className="relative"
        style={{ width: 'clamp(38px, 10vw, 52px)', aspectRatio: '5 / 7' }}
      >
        {count > 0
          ? Array.from({ length: layers }, (_, k) => layers - 1 - k).map((i) => (
              <span
                key={i}
                className="absolute inset-0 flex"
                style={{ transform: `translate(${-i * 2.5}px, ${i * 2}px) rotate(-8deg)` }}
              >
                <CardBack size="xs" style={{ width: '100%' }} />
              </span>
            ))
          : null}
      </div>
      <span className="text-mist tabular text-[0.625rem] font-semibold tracking-[0.12em] whitespace-nowrap uppercase">
        {abt('andarBahar.stock.caption', { n: count })}
      </span>
    </div>
  );
}
