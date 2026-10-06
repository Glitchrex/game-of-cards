'use client';
/**
 * The Baccarat (Punto Banco) table. Built the way the Blackjack reference Board is (see
 * src/games/blackjack/README.md).
 *
 *   ┌──────────────────────────────────────────┐
 *   │ [Croupier seat]                   [shoe] │  the croupier deals one card per move
 *   │          ‿ PUNTO BANCO ‿                 │  printed on the felt
 *   │   PLAYER            │          BANKER    │  two hand zones: cards, total, the sum
 *   │   K♣ 2♦ 3♦   (5)    │    J♣ 4♦ 5♣  (9)   │  worked out ("K + 2 + 3 = 5")
 *   │      ▸ Player has 2 → draws a third card │  the drawing rule that applied
 *   │      ▸ Banker has 4, … → Banker draws    │
 *   │  [ PLAYER 1:1 ] [ TIE 8:1 ] [BANKER .95] │  the three betting spots (P / T / B)
 *   └──────────────────────────────────────────┘
 *
 * - Every dealt card is public (it lands face up), and the shoe is drawn as card backs, so
 *   the face-down shoe order never reaches the DOM.
 * - The learner can press any betting spot; the engine accepts all three during the bet,
 *   and while the croupier deals the spots ignore presses (they keep focus) and explain that
 *   bets are locked.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import { AnimatePresence, motion, useAnimate } from 'motion/react';
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import { CardBack, PlayingCard, rowLayout } from '@/components/cards';
import { joinNames } from '@/components/play/personas';
import { Seat } from '@/components/play/Seat';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { cardName, rankOf, type CardCode } from '@/games/core/cards';
import { type BoardProps } from '@/games/core/module';
import { t, type TKey } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import {
  baccaratEngine,
  bankerDraws,
  cardPoints,
  coupOdds,
  DEALER,
  dealtInOrder,
  handTotal,
  isNatural,
  nextHand,
  PAYOUT,
  PAYOUT_WORDS,
  percent,
  playerDraws,
  playerThirdValue,
  settle,
  type BaccaratMove,
  type BaccaratState,
  type BetOn,
  type CoupWinner,
  type Hand,
} from './engine';
import { CROUPIER_CHANDNI } from './personas';

export type BaccaratBoardProps = BoardProps<BaccaratState, BaccaratMove>;

/* ------------------------------------------------------------------ constants */

/** Seconds between cards that are already on the table when it mounts. */
const DEAL_STAGGER = 0.16;
/** Seconds a card takes to fly from the shoe (the croupier deals one every ~0.4 s). */
const TRAVEL = 0.4;
/** Seconds into the flight when the card turns face up. */
const FLIP_AT = 0.1;
const GLIDE = [0.22, 1, 0.36, 1] as const;

const CARD_W = 'clamp(48px, 13.5vw, 88px)';
const overlap = (w: string) => `calc(-0.34 * ${w})`;

/** Betting spots, left to right as printed on the felt (Player on the left, Banker right). */
const SPOT_ORDER: readonly BetOn[] = ['player', 'tie', 'banker'];

const SPOT_KEY: Readonly<Record<BetOn, 'P' | 'T' | 'B'>> = {
  player: 'P',
  tie: 'T',
  banker: 'B',
};

const SHORTCUTS: Readonly<Record<string, BetOn>> = { p: 'player', t: 'tie', b: 'banker' };

const SPOT_NAME: Readonly<Record<BetOn, TKey>> = {
  player: 'baccarat.spots.player',
  tie: 'baccarat.spots.tie',
  banker: 'baccarat.spots.banker',
};

const HAND_LABEL: Readonly<Record<Hand, TKey>> = {
  player: 'baccarat.hand.player',
  banker: 'baccarat.hand.banker',
};

/* -------------------------------------------------------------- pure helpers */

const betKey = (on: BetOn) => baccaratEngine.moveKey({ type: 'bet', on });

/** How a card is written in the worked sum: "K", "10", "7", "A". */
function rankText(code: CardCode): string {
  const rank = rankOf(code);
  return rank === 'T' ? '10' : rank;
}

interface MathView {
  /** "K + 5 = 5" · "9 + 8 = 17 → 7". */
  text: string;
  /** "0 plus 5 makes 5" · "9 plus 8 makes 17; only the last digit counts, so 7". */
  sr: string;
}

/** The hand's total worked out, so the "only the last digit counts" rule is visible. */
export function mathView(cards: readonly CardCode[]): MathView | null {
  if (cards.length === 0) return null;
  const points = cards.map(cardPoints);
  const sum = points.reduce((a, b) => a + b, 0);
  const total = sum % 10;
  const expr = cards.map(rankText).join(' + ');
  const spoken = points.join(' + ');
  return sum >= 10
    ? {
        text: `${expr} = ${sum} → ${total}`,
        sr: t('baccarat.zone.mathDrop', { expr: spoken, sum, n: total }),
      }
    : { text: `${expr} = ${total}`, sr: t('baccarat.zone.mathSr', { expr: spoken, n: total }) };
}

export interface RuleLine {
  id: 'values' | 'opening' | 'natural' | 'player' | 'banker' | 'done' | 'waiting';
  text: string;
}

function outcomeText(winner: CoupWinner, p: number, b: number): string {
  if (winner === 'tie') return t('baccarat.rule.tie', { n: p });
  return winner === 'player'
    ? t('baccarat.rule.playerWins', { p, b })
    : t('baccarat.rule.bankerWins', { p, b });
}

/**
 * The drawing rules that have applied so far, in plain words, from the face-up cards only:
 * the natural check, the Player rule and the Banker rule (with the third-card table).
 */
export function ruleLines(state: BaccaratState): RuleLine[] {
  const { player, banker } = state;
  // Until the first drawing rule applies, say what the cards are worth: a beginner seeing
  // "K + 2 = 2" needs to know a King counts 0.
  const values: RuleLine = { id: 'values', text: t('baccarat.rule.values') };
  if (player.length === 0 && state.phase === 'bet') {
    return [values, { id: 'waiting', text: t('baccarat.rule.waiting') }];
  }
  if (player.length < 2 || banker.length < 2) {
    return [values, { id: 'opening', text: t('baccarat.rule.opening') }];
  }
  const lines: RuleLine[] = [];
  const p2 = handTotal(player.slice(0, 2));
  const b2 = handTotal(banker.slice(0, 2));
  const pNat = isNatural(player.slice(0, 2));
  const bNat = isNatural(banker.slice(0, 2));
  if (pNat || bNat) {
    lines.push({
      id: 'natural',
      text:
        pNat && bNat
          ? t('baccarat.rule.naturalBoth')
          : t('baccarat.rule.natural', {
              hand: t(HAND_LABEL[pNat ? 'player' : 'banker']),
              n: pNat ? p2 : b2,
            }),
    });
  } else {
    const pDraws = playerDraws(p2);
    lines.push({
      id: 'player',
      text: t(pDraws ? 'baccarat.rule.playerDraws' : 'baccarat.rule.playerStands', { n: p2 }),
    });
    // Banker's rule is decided once Player's third card (if any) is on the table.
    if (!pDraws || player.length === 3) {
      const third = playerThirdValue(state);
      const verdict = t(bankerDraws(b2, third) ? 'baccarat.rule.draws' : 'baccarat.rule.stands');
      lines.push({
        id: 'banker',
        text:
          third === null
            ? t('baccarat.rule.bankerAfterStand', { n: b2, verdict })
            : t('baccarat.rule.bankerTable', { n: b2, v: third, verdict }),
      });
    }
  }
  if (state.winner !== null) {
    const p = handTotal(player);
    const b = handTotal(banker);
    lines.push({
      id: 'done',
      text: t('baccarat.rule.done', { outcome: outcomeText(state.winner, p, b) }),
    });
  }
  return lines;
}

interface Slot {
  /** Stable id for the card's place in the coup: player-0, banker-2… */
  id: string;
  code: CardCode;
  /** 1-based position in the deal order (P, B, P, B, third cards). */
  number: number;
  third: boolean;
}

function slotsFor(state: BaccaratState, hand: Hand): Slot[] {
  return dealtInOrder(state)
    .filter((d) => d.hand === hand)
    .map((d, i) => ({ id: `${hand}-${i}`, code: d.card, number: d.number, third: d.third }));
}

function zoneLabel(hand: Hand, cards: readonly CardCode[]): string {
  if (cards.length === 0) {
    return t(hand === 'player' ? 'baccarat.zone.playerEmpty' : 'baccarat.zone.bankerEmpty');
  }
  const names = cards.map((c, i) =>
    i === 2 ? `${cardName(c)} (${t('baccarat.zone.third')})` : cardName(c),
  );
  return t(hand === 'player' ? 'baccarat.zone.player' : 'baccarat.zone.banker', {
    cards: joinNames(names),
  });
}

function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/* ---------------------------------------------------------------- the board */

export function BaccaratBoard({
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
}: BaccaratBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shoeRef = useRef<HTMLDivElement>(null);
  const dealer = personas[DEALER] ?? CROUPIER_CHANDNI;
  const playerSlots = slotsFor(state, 'player');
  const bankerSlots = slotsFor(state, 'banker');
  // Cards already on the table when the Board mounts are dealt again in casino order.
  const [opening] = useState<ReadonlySet<string>>(
    () => new Set([...playerSlots, ...bankerSlots].map((s) => s.id)),
  );
  const settlement = state.phase === 'over' && state.bet !== null ? settle(state) : null;
  const winner = over ? state.winner : null;
  const dealing = state.phase === 'deal' && !over;
  const legal = new Set(legalMoves.map((m) => baccaratEngine.moveKey(m)));

  const [flash, setFlash] = useState<BetOn | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 180);
    return () => window.clearTimeout(id);
  }, [flash]);

  const press = (on: BetOn) => {
    if (busy) return;
    onMove({ type: 'bet', on });
  };

  // P / T / B anywhere on the page — except while typing or inside another dialog.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const on = SHORTCUTS[e.key.toLowerCase()];
    if (!on) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && isTypingTarget(target)) return;
    const dialog = target?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    e.preventDefault();
    if (busy) return;
    setFlash(on);
    onMove({ type: 'bet', on });
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const busyReason = over
    ? t('baccarat.spots.over')
    : t('baccarat.spots.wait', { name: dealer.name });

  return (
    <div
      ref={rootRef}
      data-testid="bac-board"
      data-phase={state.phase}
      className="relative flex flex-col gap-3 sm:gap-4"
    >
      {/* Croupier and shoe */}
      <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[1fr_minmax(0,20rem)_1fr]">
        <Seat
          persona={dealer}
          active={dealing}
          thinking={thinking === DEALER}
          // The croupier never chooses: she deals what the rules call for.
          thinkingLabel={t('baccarat.seat.dealing')}
          className="col-start-1 row-start-1 min-h-[4.875rem] justify-center sm:col-start-2"
          data-testid="bac-dealer-seat"
        />
        <Shoe ref={shoeRef} decks={state.decks} />
      </div>

      <FeltPrint />

      {/* The two hands */}
      <div className="grid grid-cols-2 items-stretch gap-2 sm:gap-4">
        {(['player', 'banker'] as const).map((hand) => (
          <HandZone
            key={hand}
            hand={hand}
            slots={hand === 'player' ? playerSlots : bankerSlots}
            cards={state[hand]}
            winner={winner}
            nextUp={dealing && nextHand(state) === hand}
            opening={opening}
            shoeRef={shoeRef}
          />
        ))}
      </div>

      <ResultBanner winner={winner} state={state} />
      <RuleCaption lines={ruleLines(state)} />

      <BetSpots
        state={state}
        legal={legal}
        busy={busy}
        busyReason={busyReason}
        prompt={
          state.phase === 'bet' && !over
            ? null
            : over
              ? t('baccarat.spots.over')
              : t('baccarat.spots.locked', { name: dealer.name })
        }
        coachMode={coachMode}
        highlight={highlight}
        suggestedKey={suggestedKey}
        flash={flash}
        settlement={settlement}
        onPress={press}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- pieces */

function Shoe({ decks, ref }: { decks: number; ref: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      aria-hidden="true"
      className="col-start-2 row-start-1 flex flex-col items-center gap-1 justify-self-end px-2 sm:col-start-3"
    >
      <div
        ref={ref}
        className="relative"
        style={{ width: 'clamp(40px, 10vw, 54px)', aspectRatio: '5 / 7' }}
      >
        {[2, 1, 0].map((i) => (
          <span
            key={i}
            className="absolute inset-0 flex"
            style={{ transform: `translate(${-i * 3}px, ${i * 2}px) rotate(-12deg)` }}
          >
            <CardBack size="xs" style={{ width: '100%' }} />
          </span>
        ))}
        <span className="border-gold-500/70 absolute -inset-x-2 top-[48%] -bottom-1.5 rounded-t-[3px] rounded-b-lg border bg-[linear-gradient(180deg,#1c2442,#07090f)] shadow-[0_10px_18px_-8px_rgb(0_0_0/0.95),inset_0_1px_0_rgb(245_215_122/0.4)]" />
        <span className="bg-gold-300/70 absolute -inset-x-2 top-[48%] h-px" />
        <span className="border-gold-400/50 bg-felt-950/60 absolute inset-x-1.5 bottom-0.5 h-2 rounded-sm border" />
      </div>
      <span className="text-mist text-[0.625rem] font-semibold tracking-[0.12em] whitespace-nowrap uppercase max-[359px]:hidden">
        {t('baccarat.shoe.caption', { n: decks })}
      </span>
    </div>
  );
}

/** "Punto Banco" and "Closest to 9 wins", printed along the felt's curve. */
function FeltPrint() {
  const raw = useId();
  const id = raw.replace(/[^A-Za-z0-9_-]/g, '');
  return (
    <div className="relative -my-1 flex justify-center">
      <p className="sr-only">{t('baccarat.felt.rulesSr')}</p>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 320 46"
        className="w-full max-w-[26rem] overflow-visible"
        data-testid="bac-felt-print"
      >
        <defs>
          <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff6d9" />
            <stop offset="55%" stopColor="#f5d77a" />
            <stop offset="100%" stopColor="#d6a42c" />
          </linearGradient>
          <path id={`${id}-outer`} d="M 30 8 Q 160 40 290 8" />
          <path id={`${id}-inner`} d="M 70 26 Q 160 52 250 26" />
        </defs>
        <path
          d="M 4 -2 Q 160 28 316 -2"
          fill="none"
          stroke="#f5d77a"
          strokeOpacity={0.28}
          strokeWidth={1}
        />
        <text
          fill={`url(#${id}-foil)`}
          fontSize={15}
          fontWeight={800}
          letterSpacing={3}
          className="font-display uppercase"
        >
          <textPath href={`#${id}-outer`} startOffset="50%" textAnchor="middle">
            {t('baccarat.felt.title')}
          </textPath>
        </text>
        <text
          fill="#f4ecd8"
          fillOpacity={0.82}
          fontSize={11.5}
          fontWeight={600}
          letterSpacing={1}
          className="font-sans"
        >
          <textPath href={`#${id}-inner`} startOffset="50%" textAnchor="middle">
            {t('baccarat.felt.rules')}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

function HandZone({
  hand,
  slots,
  cards,
  winner,
  nextUp,
  opening,
  shoeRef,
}: {
  hand: Hand;
  slots: readonly Slot[];
  cards: readonly CardCode[];
  winner: CoupWinner | null;
  nextUp: boolean;
  opening: ReadonlySet<string>;
  shoeRef: RefObject<HTMLDivElement | null>;
}) {
  const reduced = useReducedMotionPref();
  const total = handTotal(cards);
  const natural = isNatural(cards);
  const math = mathView(cards);
  const won = winner === hand;
  const lost = winner !== null && winner !== 'tie' && !won;
  const row = rowLayout(slots.length, CARD_W, overlap(CARD_W), 0.3);
  const prefix = hand === 'player' ? 'bac-player' : 'bac-banker';

  return (
    <div
      role="group"
      aria-label={zoneLabel(hand, cards)}
      data-testid={`${prefix}-hand`}
      data-winner={won || undefined}
      data-next={nextUp || undefined}
      className={cn(
        'relative flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-1.5 pt-2 pb-2 transition-[border-color,background-color,box-shadow,opacity] duration-300',
        won
          ? 'border-gold-200/90 bg-felt-950/40 shadow-[0_0_0_1px_rgb(245_215_122/0.35),0_0_28px_-4px_rgb(245_215_122/0.65)]'
          : nextUp
            ? 'border-gold-300/45 bg-felt-950/25'
            : 'border-gold-300/15 bg-felt-950/15',
        lost && 'opacity-75',
      )}
    >
      <p className="flex items-center gap-1.5">
        <span
          className={cn(
            'font-display text-sm font-extrabold tracking-[0.18em] uppercase sm:text-base',
            hand === 'player' ? 'text-[#9cc2ff]' : 'text-[#ff9aa9]',
          )}
        >
          {t(HAND_LABEL[hand])}
        </span>
        {won ? (
          <Badge
            tone="gold"
            size="sm"
            icon={<SparkleIcon size={11} />}
            data-testid={`${prefix}-wins`}
          >
            {t('baccarat.hand.wins')}
          </Badge>
        ) : null}
      </p>

      <div
        className="relative flex shrink items-end justify-center"
        style={{ ...row.container, minHeight: `calc(${CARD_W} * 1.4)` }}
      >
        {slots.length === 0 ? (
          <span
            aria-hidden="true"
            className="border-gold-300/30 rounded-lg border border-dashed"
            style={{ width: CARD_W, aspectRatio: '5 / 7' }}
          />
        ) : null}
        {slots.map((slot, i) => (
          <TableCard
            key={slot.id}
            code={slot.code}
            third={slot.third}
            delay={opening.has(slot.id) ? (slot.number - 1) * DEAL_STAGGER : 0}
            shoeRef={shoeRef}
            marginInlineStart={row.margin(i)}
            zIndex={i}
          />
        ))}
      </div>

      <div className="flex min-h-8 flex-wrap items-center justify-center gap-1.5">
        <span className="border-gold-300/45 bg-felt-950/80 text-gold-100 inline-flex min-h-8 min-w-8 items-center justify-center rounded-full border px-2.5 text-base font-bold shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)]">
          <span className="sr-only">
            {t(hand === 'player' ? 'baccarat.zone.playerTotal' : 'baccarat.zone.bankerTotal')}{' '}
          </span>
          <motion.span
            key={cards.length}
            data-testid={`${prefix}-total`}
            data-total={cards.length > 0 ? total : undefined}
            data-natural={natural || undefined}
            className="tabular"
            initial={reduced || cards.length === 0 ? false : { scale: 1.45, opacity: 0.4 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 22 }}
          >
            {cards.length > 0 ? total : '–'}
          </motion.span>
        </span>
        {natural ? (
          <motion.span
            initial={reduced ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 18 }}
            className="inline-flex"
          >
            <Badge
              tone="gold"
              size="sm"
              icon={<SparkleIcon size={11} />}
              data-testid={`${prefix}-natural`}
            >
              {t('baccarat.hand.natural', { n: total })}
            </Badge>
          </motion.span>
        ) : null}
      </div>
      <p
        data-testid={`${prefix}-math`}
        className="text-mist tabular min-h-4 text-center text-[0.6875rem] leading-tight font-semibold sm:text-xs"
      >
        {math ? (
          <>
            <span aria-hidden="true">{math.text}</span>
            <span className="sr-only">
              {t('baccarat.zone.math')} {math.sr}
            </span>
          </>
        ) : null}
      </p>
    </div>
  );
}

/**
 * One card on the felt. A freshly dealt card flies in from the shoe (measured, so it works
 * at any width) and turns face up mid-flight. Reduced motion: it simply appears.
 */
function TableCard({
  code,
  third,
  delay,
  shoeRef,
  marginInlineStart,
  zIndex,
}: {
  code: CardCode;
  third: boolean;
  delay: number;
  shoeRef: RefObject<HTMLDivElement | null>;
  marginInlineStart?: string;
  zIndex: number;
}) {
  const reduced = useReducedMotionPref();
  // Decided once, when the card lands on the table.
  const [flying] = useState(() => !reduced);
  const [landed, setLanded] = useState(() => !flying);
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useLayoutEffect(() => {
    if (!flying) return;
    const el = scope.current;
    const shoe = shoeRef.current;
    let x = 60;
    let y = -120;
    if (el && shoe) {
      const a = el.getBoundingClientRect();
      const b = shoe.getBoundingClientRect();
      if (a.width > 0 && b.width > 0) {
        x = b.left + b.width / 2 - (a.left + a.width / 2);
        y = b.top + b.height / 2 - (a.top + a.height / 2);
      }
    }
    const controls = animate(
      el,
      { x: [x, 0], y: [y, 0], rotate: [-16, third ? 6 : 0], scale: [0.72, 1], opacity: [0, 1] },
      { delay, duration: TRAVEL, ease: GLIDE, opacity: { delay, duration: 0.12 } },
    );
    const timer = window.setTimeout(() => setLanded(true), (delay + FLIP_AT) * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(timer);
    };
  }, [flying, delay, shoeRef, animate, scope, third]);

  return (
    <div
      className="relative shrink-0"
      data-third={third || undefined}
      style={{ marginInlineStart, zIndex }}
    >
      <div
        ref={scope}
        style={flying ? { opacity: 0 } : third ? { transform: 'rotate(6deg)' } : undefined}
      >
        <PlayingCard code={code} faceDown={!landed} decorative style={{ width: CARD_W }} />
      </div>
    </div>
  );
}

const BANNER_TONE: Record<CoupWinner, string> = {
  player: 'border-[#9cc2ff]/70 bg-[linear-gradient(180deg,#1f3f7a,#132a55)] text-cream',
  banker: 'border-[#ff9aa9]/70 bg-[linear-gradient(180deg,#7a1f33,#4d1220)] text-cream',
  tie: 'border-gold-100 bg-[linear-gradient(180deg,var(--color-gold-100),var(--color-gold-400))] text-ink',
};

/** "Banker wins · 9 – 5" / "Tie at 8", sprung onto the felt when the coup is decided. */
function ResultBanner({ winner, state }: { winner: CoupWinner | null; state: BaccaratState }) {
  const reduced = useReducedMotionPref();
  const p = handTotal(state.player);
  const b = handTotal(state.banker);
  const title =
    winner === null
      ? ''
      : winner === 'tie'
        ? t('baccarat.banner.tieWins', { n: p })
        : t(winner === 'player' ? 'baccarat.banner.playerWins' : 'baccarat.banner.bankerWins');
  // The winner's total first: "Banker wins 9 – 5".
  const [w, l] = winner === 'player' ? [p, b] : [b, p];
  const score = t('baccarat.banner.score', { w, l });
  const natural = isNatural(state.player) || isNatural(state.banker);
  return (
    <div className="flex min-h-10 items-center justify-center">
      <AnimatePresence>
        {winner !== null ? (
          <motion.p
            key={winner}
            data-testid="bac-result"
            data-winner={winner}
            initial={reduced ? false : { scale: 1.6, opacity: 0, rotate: -6 }}
            animate={{ scale: 1, opacity: 1, rotate: -2 }}
            transition={
              reduced
                ? { duration: 0 }
                : { delay: 0.25, type: 'spring', stiffness: 380, damping: 18 }
            }
            className={cn(
              'font-display inline-flex items-center gap-2 rounded-lg border-2 px-3 py-1 text-sm font-extrabold tracking-[0.14em] uppercase shadow-[0_10px_24px_-10px_rgb(0_0_0/0.95)] sm:text-base',
              BANNER_TONE[winner],
            )}
          >
            <span className="sr-only">
              {t('baccarat.banner.label', {
                text: winner === 'tie' ? title : t('baccarat.banner.scoreSr', { title, w, l }),
              })}
            </span>
            <span aria-hidden="true" className="inline-flex items-center gap-2">
              {winner === 'tie' ? (
                <span data-testid="bac-tie-banner">{t('baccarat.banner.tie')}</span>
              ) : natural ? (
                <span data-testid="bac-natural-banner">{t('baccarat.banner.natural')}</span>
              ) : null}
              {winner === 'tie' ? (
                <span>{t('baccarat.banner.tieScore', { n: p })}</span>
              ) : (
                <>
                  <span>{title}</span>
                  <span className="tabular opacity-85">{score}</span>
                </>
              )}
            </span>
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** The drawing rules that applied so far, newest last. */
function RuleCaption({ lines }: { lines: readonly RuleLine[] }) {
  const reduced = useReducedMotionPref();
  return (
    <div className="mx-auto w-full max-w-[34rem]">
      <p className="sr-only">{t('baccarat.rule.label')}</p>
      <ol
        data-testid="bac-rules"
        className="border-gold-300/20 bg-felt-950/35 flex min-h-[4.25rem] flex-col justify-center gap-1 rounded-xl border px-3 py-2"
      >
        {lines.map((line, i) => {
          const latest = i === lines.length - 1;
          return (
            <motion.li
              key={line.id}
              data-testid="bac-rule"
              data-rule={line.id}
              data-latest={latest || undefined}
              initial={reduced ? false : { opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: reduced ? 0 : 0.25 }}
              className={cn(
                'flex items-start gap-1.5 text-[0.8125rem] leading-snug sm:text-sm',
                latest ? 'text-cream font-semibold' : 'text-mist',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('mt-0.5 shrink-0', latest ? 'text-gold-300' : 'text-gold-300/50')}
              >
                ▸
              </span>
              <span>{line.text}</span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}

interface SpotSettlement {
  bet: BetOn;
  winner: CoupWinner;
  outcome: 'win' | 'loss' | 'push';
}

const STAMP_TONE: Record<SpotSettlement['outcome'], string> = {
  win: 'border-gold-200 bg-gold-300 text-ink',
  push: 'border-mist/60 bg-felt-900 text-cream',
  loss: 'border-velvet-300/70 bg-velvet-600 text-cream',
};

const OUTCOME_KEY: Record<SpotSettlement['outcome'], TKey> = {
  win: 'baccarat.outcome.win',
  push: 'baccarat.outcome.push',
  loss: 'baccarat.outcome.loss',
};

function BetSpots({
  state,
  legal,
  busy,
  busyReason,
  prompt,
  coachMode,
  highlight,
  suggestedKey,
  flash,
  settlement,
  onPress,
}: {
  state: BaccaratState;
  legal: ReadonlySet<string>;
  busy: boolean;
  busyReason: string;
  /** Null during the bet: the "Place your bet" heading is shown instead. */
  prompt: string | null;
  coachMode: boolean;
  highlight: ReadonlySet<string>;
  suggestedKey: string | null;
  flash: BetOn | null;
  settlement: SpotSettlement | null;
  onPress: (on: BetOn) => void;
}) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const busyId = `${ids}-busy`;
  const chosenId = `${ids}-chosen`;
  const suggestedId = `${ids}-suggested`;
  const odds = coupOdds(state.decks);
  const groupRef = useRef<HTMLDivElement>(null);

  // ←/→ (and Home/End) move between the three spots; Tab reaches each of them too.
  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const buttons = [...(groupRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    const at = buttons.findIndex((b) => b === document.activeElement);
    if (at < 0) return;
    e.preventDefault();
    const n = buttons.length;
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? n - 1
          : (at + (e.key === 'ArrowRight' ? 1 : -1) + n) % n;
    buttons[next]?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-2 pt-1">
      <div data-testid="bac-prompt" data-phase={state.phase} className="text-center">
        {prompt === null ? (
          <>
            <p className="font-display text-gold-100 text-base font-bold sm:text-lg">
              {t('baccarat.spots.prompt')}
            </p>
            <p className="text-mist text-xs sm:text-sm">{t('baccarat.spots.promptHint')}</p>
          </>
        ) : (
          <p className="text-mist text-sm font-semibold">{prompt}</p>
        )}
      </div>
      <div
        ref={groupRef}
        role="group"
        aria-label={t('baccarat.spots.label')}
        data-testid="bac-spots"
        onKeyDown={onKeyDown}
        className="grid grid-cols-3 gap-1.5 sm:gap-3"
      >
        {SPOT_ORDER.map((on) => {
          const key = betKey(on);
          const isLegal = legal.has(key);
          const glow = coachMode && !busy && highlight.has(key);
          const suggested = !busy && suggestedKey === key;
          const chosen = state.bet === on;
          const result = chosen && settlement ? settlement.outcome : null;
          const coupWon = settlement?.winner === on;
          const name = t(SPOT_NAME[on]);
          const paysId = `${ids}-${on}-pays`;
          const describedBy = [
            paysId,
            chosen ? chosenId : null,
            busy ? busyId : null,
            suggested ? suggestedId : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={on}
              type="button"
              data-testid={`bac-${on}`}
              data-legal={isLegal || undefined}
              data-highlighted={glow || undefined}
              data-suggested={suggested || undefined}
              data-chosen={chosen || undefined}
              data-pressed={flash === on || undefined}
              aria-label={t('baccarat.spots.aria', { name, words: PAYOUT_WORDS[on] })}
              aria-keyshortcuts={SPOT_KEY[on]}
              aria-disabled={busy || undefined}
              aria-describedby={describedBy}
              onClick={() => onPress(on)}
              className={cn(
                'ease-snap relative flex min-h-[6.25rem] min-w-0 flex-col items-center justify-start gap-0.5 rounded-2xl border-2 px-1 pt-2.5 pb-2 text-center transition-[transform,filter,background-color,border-color,opacity,box-shadow] duration-150 select-none sm:min-h-[7.5rem]',
                on === 'player' &&
                  'bg-[radial-gradient(120%_90%_at_50%_0%,#1d3a6e_0%,#0f2246_80%)]',
                on === 'banker' &&
                  'bg-[radial-gradient(120%_90%_at_50%_0%,#6e1d30_0%,#3d0f1b_80%)]',
                on === 'tie' && 'bg-[radial-gradient(120%_90%_at_50%_0%,#1f6a49_0%,#0b3a27_80%)]',
                chosen || coupWon
                  ? 'border-gold-200 shadow-[0_0_0_1px_rgb(245_215_122/0.45),0_12px_26px_-14px_rgb(245_215_122/0.9)]'
                  : 'border-gold-300/40',
                busy
                  ? cn('cursor-not-allowed', !chosen && !coupWon && 'opacity-60')
                  : 'hover:border-gold-200/90 hover:brightness-110 active:translate-y-px',
                flash === on && 'translate-y-px brightness-110',
              )}
            >
              {glow && !suggested ? (
                <span
                  aria-hidden="true"
                  className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[1.05rem]"
                />
              ) : null}
              {suggested ? (
                <>
                  <motion.span
                    aria-hidden="true"
                    data-testid="bac-suggested-ring"
                    className="pointer-events-none absolute -inset-1 rounded-[1.15rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
                    animate={
                      reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.04, 1] }
                    }
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
                    }
                  />
                  <span
                    aria-hidden="true"
                    className="bg-gold-200 text-ink absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
                  >
                    <SparkleIcon size={9} />
                    {t('baccarat.spots.pick')}
                  </span>
                </>
              ) : null}
              <span
                aria-hidden="true"
                className="font-display text-gold-100 text-[0.8125rem] leading-tight font-extrabold tracking-[0.06em] uppercase min-[360px]:text-[0.9375rem] min-[360px]:tracking-[0.12em] sm:text-lg"
              >
                {name}
              </span>
              <span id={paysId} className="text-gold-300 text-[0.6875rem] font-bold sm:text-xs">
                {t('baccarat.spots.pays', { words: PAYOUT_WORDS[on] })}
                <span className="text-mist block font-semibold">
                  {t('baccarat.spots.winsOften', { pct: percent(odds[on], 1) })}
                </span>
              </span>
              <span className="relative mt-auto flex h-8 items-end justify-center">
                <AnimatePresence>
                  {chosen ? <Chip key="chip" result={result} reduced={reduced} /> : null}
                  {chosen && result === 'win' ? (
                    <Chip key="paid" result="paid" reduced={reduced} />
                  ) : null}
                </AnimatePresence>
              </span>
              {result ? (
                <motion.span
                  data-testid="bac-outcome"
                  data-outcome={result}
                  initial={reduced ? false : { scale: 1.8, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: -9 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { delay: 0.35, type: 'spring', stiffness: 420, damping: 17 }
                  }
                  className={cn(
                    'absolute -top-2 -right-1.5 z-20 rounded-md border-2 px-1.5 py-0.5 text-[0.625rem] font-extrabold tracking-[0.12em] whitespace-nowrap uppercase shadow-[0_8px_18px_-8px_rgb(0_0_0/0.9)] sm:text-xs',
                    STAMP_TONE[result],
                  )}
                >
                  <span className="sr-only">{t('baccarat.outcome.label')} </span>
                  {t(OUTCOME_KEY[result])}
                  {result === 'win' ? (
                    // On a phone the spot is too narrow for "WIN +8×" without covering its name.
                    <span aria-hidden="true" className="max-sm:hidden">
                      {' '}
                      +{PAYOUT[on]}×
                    </span>
                  ) : null}
                </motion.span>
              ) : null}
              <kbd
                aria-hidden="true"
                className="border-gold-300/40 text-gold-200/80 absolute top-1 left-1 hidden size-4 items-center justify-center rounded border font-sans text-[0.5625rem] leading-none font-bold sm:size-5 sm:text-[0.625rem] sm:pointer-fine:inline-flex"
              >
                {SPOT_KEY[on]}
              </kbd>
            </button>
          );
        })}
      </div>
      <span id={busyId} className="sr-only">
        {busyReason}
      </span>
      <span id={chosenId} className="sr-only">
        {t('baccarat.spots.yourBet')}
      </span>
      <span id={suggestedId} className="sr-only">
        {t('baccarat.spots.suggested')}
      </span>
      <p
        data-testid="bac-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('baccarat.spots.keys')}:</span>
        {SPOT_ORDER.map((on) => (
          <span key={on} className="inline-flex items-center gap-1">
            <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
              {SPOT_KEY[on]}
            </kbd>
            {t(SPOT_NAME[on])}
          </span>
        ))}
      </p>
    </div>
  );
}

/**
 * The learner's chip on the chosen spot. It drops onto the spot when the bet is placed; at
 * the end a lost chip is collected by the croupier (it shrinks and fades), and a win is
 * paid with a gold chip beside it.
 */
function Chip({
  result,
  reduced,
}: {
  result: SpotSettlement['outcome'] | 'paid' | null;
  reduced: boolean;
}) {
  const paid = result === 'paid';
  const collected = result === 'loss';
  return (
    <motion.svg
      aria-hidden="true"
      data-testid={paid ? 'bac-chip-paid' : 'bac-chip'}
      data-collected={collected || undefined}
      viewBox="0 0 32 32"
      className={cn('size-8 drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]', paid && '-ml-2.5')}
      initial={
        reduced ? false : paid ? { y: -26, x: 10, opacity: 0 } : { y: 26, opacity: 0, scale: 1.3 }
      }
      animate={
        collected ? { y: 0, opacity: 0.35, scale: 0.85 } : { y: 0, x: 0, opacity: 1, scale: 1 }
      }
      exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.6 }}
      transition={
        reduced
          ? { duration: 0 }
          : collected
            ? { delay: 0.5, duration: 0.5, ease: 'easeIn' }
            : { type: 'spring', stiffness: 460, damping: 22, delay: paid ? 0.55 : 0 }
      }
    >
      <circle cx={16} cy={16} r={15} fill={paid ? '#d6a42c' : '#c22f47'} />
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
      <circle cx={16} cy={16} r={9.5} fill={paid ? '#b4871f' : '#9e2036'} />
      <circle cx={16} cy={16} r={9.5} fill="none" stroke="#f5d77a" strokeOpacity={0.8} />
    </motion.svg>
  );
}
