'use client';
/**
 * The Blackjack table — the REFERENCE Board every other game copies (see ./README.md).
 *
 *   ┌──────────────────────────────────────────┐
 *   │ [Dealer seat]                     [shoe] │  dealer zone: persona, cards, total
 *   │            K♠  ▒▒   (Shows 10)           │  (the hole card stays face down)
 *   │      ‿ BLACKJACK PAYS 3 TO 2 ‿           │  rules printed on the felt
 *   │          ‿ Dealer stands on all 17s ‿    │
 *   │            9♥  7♣   (●) Hard 16          │  learner zone: one or two hands, bets
 *   │  [ Hit ] [ Stand ] [ Double ] [ Split ]  │  action bar (H / S / D / P)
 *   └──────────────────────────────────────────┘
 *
 * Rules of the road for Boards:
 * - Render ONLY what the learner may see: the hole card is passed to PlayingCard as a
 *   placeholder code while face down (a face-down PlayingCard never mounts its face), and
 *   totals/labels are computed from the visible cards. The shoe is drawn as card backs.
 * - Let the learner ATTEMPT any move: unavailable actions look secondary but still call
 *   `onMove`, so the controller can explain why (coach panel / error callout). Only `busy`
 *   (dealer's turn, round over) stops input — and even then buttons keep focus.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import { motion, useAnimate } from 'motion/react';
import {
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { CardBack, PlayingCard, rowLayout } from '@/components/cards';
import { joinNames } from '@/components/play/personas';
import { Seat } from '@/components/play/Seat';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { cardName, type CardCode } from '@/games/core/cards';
import { type BoardProps } from '@/games/core/module';
import { t, type TKey } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import {
  BLACKJACK_TOTAL,
  cardPoints,
  DEALER,
  handValue,
  isAce,
  isBlackjack,
  settleRound,
  visibleDealerCards,
  type BlackjackHand,
  type BlackjackMove,
  type BlackjackState,
  type HandOutcome,
  type LearnerMoveType,
} from './engine';
import { DEALER_SITARA } from './personas';

export type BlackjackBoardProps = BoardProps<BlackjackState, BlackjackMove>;

/* ------------------------------------------------------------------ constants */

/** Seconds between the cards of the opening deal (learner, dealer, learner, dealer). */
const DEAL_STAGGER = 0.16;
/** Seconds a card takes to fly from the shoe to its place. */
const TRAVEL = 0.46;
/** Seconds into the flight when a face-up card turns over. */
const FLIP_AT = 0.1;
const GLIDE = [0.22, 1, 0.36, 1] as const;
/** The order of the opening deal, by card id (see `handSlots` / `dealerSlots`). */
const OPENING_DEAL = ['p0', 'd0', 'p1', 'd1'];

/** One hand: big cards. Two hands (after a split) share the width. */
const CARD_W = 'clamp(54px, 15vw, 96px)';
const SPLIT_CARD_W = 'clamp(46px, 12.5vw, 80px)';
const overlap = (w: string) => `calc(-0.36 * ${w})`;

/**
 * The code given to PlayingCard for the face-down hole card. PlayingCard never mounts the
 * face of a face-down card, so this placeholder never reaches the DOM — and neither does
 * the real hole card until it is revealed.
 */
const FACE_DOWN_PLACEHOLDER: CardCode = 'AS';

interface ActionSpec {
  type: LearnerMoveType;
  /** Keyboard shortcut (also announced with aria-keyshortcuts). */
  key: 'H' | 'S' | 'D' | 'P';
  label: TKey;
  hint: TKey;
  icon: ReactNode;
}

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

const ACTIONS: readonly ActionSpec[] = [
  {
    type: 'hit',
    key: 'H',
    label: 'blackjack.actions.hit',
    hint: 'blackjack.actions.hitHint',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x={3} y={3} width={11} height={15} rx={2} />
        <path d="M18.5 12.5v8M14.5 16.5h8" />
      </svg>
    ),
  },
  {
    type: 'stand',
    key: 'S',
    label: 'blackjack.actions.stand',
    hint: 'blackjack.actions.standHint',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x={3} y={3} width={11} height={15} rx={2} />
        <path d="M14.5 17.5l2.6 2.6 4.6-5.2" />
      </svg>
    ),
  },
  {
    type: 'double',
    key: 'D',
    label: 'blackjack.actions.double',
    hint: 'blackjack.actions.doubleHint',
    icon: (
      <svg {...ICON_PROPS}>
        <ellipse cx={12} cy={7.5} rx={7.5} ry={3} />
        <path d="M4.5 7.5v4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-4" />
        <path d="M4.5 12.5v4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-4" />
      </svg>
    ),
  },
  {
    type: 'split',
    key: 'P',
    label: 'blackjack.actions.split',
    hint: 'blackjack.actions.splitHint',
    icon: (
      <svg {...ICON_PROPS}>
        <rect x={2.2} y={5.5} width={9} height={13} rx={1.6} transform="rotate(-12 6.7 12)" />
        <rect x={12.8} y={5.5} width={9} height={13} rx={1.6} transform="rotate(12 17.3 12)" />
      </svg>
    ),
  },
];

const SHORTCUTS: Readonly<Record<string, LearnerMoveType>> = {
  h: 'hit',
  s: 'stand',
  d: 'double',
  p: 'split',
};

/* -------------------------------------------------------------- pure helpers */

interface TotalView {
  total: number;
  soft: boolean;
  /** "Soft 17", "Hard 16", "8", "21", "24". */
  text: string;
  bust: boolean;
  blackjack: boolean;
}

/** How a total reads on the table: soft/hard wording, plain numbers for 21 and busts. */
function totalView(cards: readonly CardCode[], canBeBlackjack: boolean): TotalView {
  const { total, soft } = handValue(cards);
  const bust = total > BLACKJACK_TOTAL;
  const blackjack = canBeBlackjack && isBlackjack(cards);
  const key: TKey =
    bust || total === BLACKJACK_TOTAL
      ? 'blackjack.total.plain'
      : soft
        ? 'blackjack.total.soft'
        : total >= 12
          ? 'blackjack.total.hard'
          : 'blackjack.total.plain';
  return { total, soft: soft && !bust, text: t(key, { n: total }), bust, blackjack };
}

/** The dealer's total from the visible cards only ("Shows 10" while the hole card is down). */
function dealerTotalView(state: BlackjackState, revealed: boolean): TotalView {
  const up = state.dealer[0];
  if (revealed || up === undefined) return totalView(state.dealer, true);
  const points = cardPoints(up);
  return {
    total: points === 1 ? 11 : points,
    soft: points === 1,
    text: isAce(up) ? t('blackjack.total.showsAce') : t('blackjack.total.shows', { total: points }),
    bust: false,
    blackjack: false,
  };
}

interface Slot {
  /** Stable id for the card's place in the round: p0/p1 (first two), s0/s1 (after a split)… */
  id: string;
  /** null = the face-down hole card. */
  code: CardCode | null;
}

function dealerSlots(state: BlackjackState, revealed: boolean): Slot[] {
  const visible = visibleDealerCards(state);
  return state.dealer.map((card, i) => ({
    id: `d${i}`,
    code: revealed ? card : (visible[i] ?? null),
  }));
}

/**
 * Card ids for the learner's hands. The opening cards are p0 and p1; after a split, hand 1
 * keeps p0, hand 2 receives p1 (it slides across) and each gets a new second card (s0, s1).
 */
function handSlots(state: BlackjackState): Slot[][] {
  if (state.hands.length < 2) {
    return state.hands.map((h) =>
      h.cards.map((code, i) => ({ id: i < 2 ? `p${i}` : `h0-${i}`, code })),
    );
  }
  return state.hands.map((h, hi) =>
    h.cards.map((code, i) => ({
      id: i === 0 ? `p${hi}` : i === 1 ? `s${hi}` : `h${hi}-${i}`,
      code,
    })),
  );
}

/** Seconds to wait before a card that appears in this render starts flying. */
function dealDelay(id: string, opening: ReadonlySet<string>): number {
  if (opening.has(id)) {
    const i = OPENING_DEAL.indexOf(id);
    return (i >= 0 ? i : OPENING_DEAL.length) * DEAL_STAGGER;
  }
  // After a split the moved card slides over first, then each hand gets its new card.
  if (id === 's0') return 0.2;
  if (id === 's1') return 0.2 + DEAL_STAGGER;
  return 0;
}

/** A key that changes with every new deal (from visible cards only), to restart the deal animation. */
function roundKey(state: BlackjackState): string {
  const [first, second] = state.hands;
  const p1 = second ? second.cards[0] : first?.cards[1];
  return [first?.cards[0], state.dealer[0], p1, state.decks].join('-');
}

function cardList(codes: readonly (CardCode | null)[]): string {
  return joinNames(codes.map((c) => (c ? cardName(c) : t('blackjack.zone.faceDown'))));
}

const OUTCOME_KEY: Record<HandOutcome, TKey> = {
  win: 'blackjack.outcome.win',
  blackjack: 'blackjack.outcome.blackjack',
  push: 'blackjack.outcome.push',
  loss: 'blackjack.outcome.loss',
};

function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/* ---------------------------------------------------------------- the board */

/**
 * Blackjack's Board. Remounts the table for every new deal (so the opening deal animates
 * again when the practice hand restarts), keyed by the visible opening cards.
 */
export function BlackjackBoard(props: BlackjackBoardProps) {
  return <BlackjackTable key={roundKey(props.state)} {...props} />;
}

function BlackjackTable({
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
}: BlackjackBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const shoeRef = useRef<HTMLDivElement>(null);
  const layoutPrefix = useId();
  const dealer = personas[DEALER] ?? DEALER_SITARA;
  const revealed = state.holeRevealed || over;
  const dealerCards = dealerSlots(state, revealed);
  const hands = handSlots(state);
  // Cards on the table when this deal mounted fly in as the opening deal, in casino order.
  const [opening] = useState<ReadonlySet<string>>(
    () => new Set([...dealerCards, ...hands.flat()].map((s) => s.id)),
  );
  const settlement = state.phase === 'over' ? settleRound(state) : null;
  const split = state.hands.length > 1;
  const dealerTurn = state.phase === 'dealer' && !over;
  const legal = new Set(legalMoves.map((m) => m.type));

  const [flash, setFlash] = useState<LearnerMoveType | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const id = window.setTimeout(() => setFlash(null), 180);
    return () => window.clearTimeout(id);
  }, [flash]);

  const press = (type: LearnerMoveType) => {
    if (busy) return;
    onMove({ type });
  };

  // H / S / D / P anywhere on the page — except while typing or inside another dialog.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
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
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const dealerView = dealerTotalView(state, revealed);
  const dealerLabel =
    dealerCards.length > 0
      ? t('blackjack.zone.dealer', { cards: cardList(dealerCards.map((s) => s.code)) })
      : t('blackjack.zone.dealerEmpty');
  const busyReason = over
    ? t('blackjack.actions.over')
    : t('blackjack.actions.wait', { name: dealer.name });

  return (
    <div
      ref={rootRef}
      data-testid="bj-board"
      data-phase={state.phase}
      className="relative flex flex-col gap-3 sm:gap-4"
    >
      {/* Dealer zone */}
      <div className="flex flex-col items-center gap-2">
        <div className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-start gap-2 sm:grid-cols-[1fr_minmax(0,20rem)_1fr]">
          <Seat
            persona={dealer}
            active={dealerTurn}
            thinking={thinking === DEALER}
            // House rules leave the dealer no choices: she plays, she doesn't think.
            thinkingLabel={t('play.seat.playing')}
            className="col-start-1 row-start-1 min-h-[4.875rem] justify-center sm:col-start-2"
            data-testid="bj-dealer-seat"
          />
          <Shoe ref={shoeRef} decks={state.decks} />
        </div>
        <div
          role="group"
          aria-label={dealerLabel}
          data-testid="bj-dealer-hand"
          data-hole={revealed ? 'revealed' : 'hidden'}
          className="flex w-full items-center justify-center gap-2.5 sm:gap-4"
        >
          <CardRow
            slots={dealerCards}
            width={CARD_W}
            opening={opening}
            shoeRef={shoeRef}
            layoutPrefix={layoutPrefix}
          />
          <div className="flex shrink-0 flex-col items-start gap-1.5">
            <TotalPill testId="bj-dealer-total" view={dealerView} dealer />
            <StatusBadges view={dealerView} />
          </div>
        </div>
      </div>

      <FeltPrint />

      {/* Learner zone */}
      <div
        role={split ? 'group' : undefined}
        aria-label={split ? t('blackjack.zone.hands') : undefined}
        className={cn('grid items-start gap-2 sm:gap-4', split ? 'grid-cols-2' : 'grid-cols-1')}
      >
        {state.hands.map((hand, i) => (
          <HandSpot
            key={`hand-${i}`}
            hand={hand}
            index={i}
            count={state.hands.length}
            slots={hands[i] ?? []}
            active={state.phase === 'player' && state.activeHand === i}
            status={
              state.phase !== 'player'
                ? null
                : i === state.activeHand
                  ? 'playing'
                  : i > state.activeHand
                    ? 'next'
                    : 'done'
            }
            outcome={settlement?.hands[i]?.outcome ?? null}
            opening={opening}
            shoeRef={shoeRef}
            layoutPrefix={layoutPrefix}
          />
        ))}
      </div>

      <ActionBar
        legal={legal}
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

/* ------------------------------------------------------------------- pieces */

function Shoe({ decks, ref }: { decks: number; ref: RefObject<HTMLDivElement | null> }) {
  return (
    <div
      aria-hidden="true"
      className="col-start-2 row-start-1 flex flex-col items-center gap-1 justify-self-end sm:col-start-3"
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
        {/* The shoe box: a brass-rimmed wedge holding the decks. */}
        <span className="border-gold-500/70 absolute -inset-x-2 top-[48%] -bottom-1.5 rounded-t-[3px] rounded-b-lg border bg-[linear-gradient(180deg,#2a1b20,#0b0709)] shadow-[0_10px_18px_-8px_rgb(0_0_0/0.95),inset_0_1px_0_rgb(245_215_122/0.4)]" />
        <span className="bg-gold-300/70 absolute -inset-x-2 top-[48%] h-px" />
        <span className="border-gold-400/50 bg-felt-950/60 absolute inset-x-1.5 bottom-0.5 h-2 rounded-sm border" />
      </div>
      <span className="text-mist text-[0.625rem] font-semibold tracking-[0.12em] whitespace-nowrap uppercase max-[359px]:hidden">
        {t('blackjack.shoe.caption', { n: decks })}
      </span>
    </div>
  );
}

/** "Blackjack pays 3 to 2" and "Dealer stands on all 17s", printed along the felt's curve. */
function FeltPrint() {
  const raw = useId();
  const id = raw.replace(/[^A-Za-z0-9_-]/g, '');
  return (
    <div className="relative -my-1 flex justify-center">
      <p className="sr-only">{t('blackjack.felt.rules')}</p>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 320 46"
        className="w-full max-w-[28rem] overflow-visible"
        data-testid="bj-felt-print"
      >
        <defs>
          <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff6d9" />
            <stop offset="55%" stopColor="#f5d77a" />
            <stop offset="100%" stopColor="#d6a42c" />
          </linearGradient>
          <path id={`${id}-outer`} d="M 18 8 Q 160 42 302 8" />
          <path id={`${id}-inner`} d="M 60 26 Q 160 54 260 26" />
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
          fontSize={14.5}
          fontWeight={800}
          letterSpacing={2.2}
          className="font-display uppercase"
        >
          <textPath href={`#${id}-outer`} startOffset="50%" textAnchor="middle">
            {t('blackjack.felt.pays')}
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
            {t('blackjack.felt.stands')}
          </textPath>
        </text>
      </svg>
    </div>
  );
}

function CardRow({
  slots,
  width,
  opening,
  shoeRef,
  layoutPrefix,
  movedIds,
  children,
}: {
  slots: readonly Slot[];
  width: string;
  opening: ReadonlySet<string>;
  shoeRef: RefObject<HTMLDivElement | null>;
  layoutPrefix: string;
  /** Cards that arrive by sliding from another hand (a split), not from the shoe. */
  movedIds?: ReadonlySet<string>;
  /** Laid over the row's top-right corner (the WIN / LOSE stamp). */
  children?: ReactNode;
}) {
  const row = rowLayout(slots.length, width, overlap(width), 0.3);
  // The cards themselves are decorative: the zone's aria-label lists them.
  return (
    <div
      className="relative flex shrink items-end justify-center"
      style={{ ...row.container, minHeight: `calc(${width} * 1.4)` }}
    >
      {slots.map((slot, i) => (
        <TableCard
          key={slot.id}
          code={slot.code}
          width={width}
          fresh={!movedIds?.has(slot.id)}
          delay={dealDelay(slot.id, opening)}
          shoeRef={shoeRef}
          layoutId={`${layoutPrefix}-${slot.id}`}
          marginInlineStart={row.margin(i)}
          zIndex={i}
        />
      ))}
      {children}
    </div>
  );
}

/**
 * One card on the felt. A freshly dealt card flies in from the shoe (measured, so it works
 * at any screen size) and turns face up mid-flight; the hole card flips where it lies when
 * revealed. Reduced motion: cards simply appear.
 */
function TableCard({
  code,
  width,
  fresh,
  delay,
  shoeRef,
  layoutId,
  marginInlineStart,
  zIndex,
}: {
  code: CardCode | null;
  width: string;
  fresh: boolean;
  delay: number;
  shoeRef: RefObject<HTMLDivElement | null>;
  layoutId: string;
  marginInlineStart?: string;
  zIndex: number;
}) {
  const reduced = useReducedMotionPref();
  // Decided once, when the card lands on the table.
  const [flying] = useState(() => fresh && !reduced);
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
      { x: [x, 0], y: [y, 0], rotate: [-16, 0], scale: [0.72, 1], opacity: [0, 1] },
      { delay, duration: TRAVEL, ease: GLIDE, opacity: { delay, duration: 0.12 } },
    );
    const timer = window.setTimeout(() => setLanded(true), (delay + FLIP_AT) * 1000);
    return () => {
      controls.stop();
      window.clearTimeout(timer);
    };
  }, [flying, delay, shoeRef, animate, scope]);

  const faceDown = code === null || !landed;
  return (
    <motion.div
      layout={reduced ? false : 'position'}
      layoutId={reduced ? undefined : layoutId}
      className="relative shrink-0"
      style={{ marginInlineStart, zIndex }}
    >
      <div ref={scope} style={flying ? { opacity: 0 } : undefined}>
        <PlayingCard
          code={code ?? FACE_DOWN_PLACEHOLDER}
          faceDown={faceDown}
          decorative
          style={{ width }}
        />
      </div>
    </motion.div>
  );
}

function TotalPill({
  testId,
  view,
  dealer = false,
}: {
  testId: string;
  view: TotalView;
  dealer?: boolean;
}) {
  return (
    <span
      className={cn(
        'border-gold-300/45 bg-felt-950/80 text-gold-100 inline-flex min-h-8 items-center rounded-full border px-3 text-sm font-bold shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)] sm:text-base',
        view.bust && 'border-velvet-400/70 text-velvet-300',
        view.blackjack && 'border-gold-200 text-gold-200',
      )}
    >
      <span className="sr-only">
        {dealer ? t('blackjack.total.dealerLabel') : t('blackjack.total.label')}{' '}
      </span>
      <span
        data-testid={testId}
        data-total={view.total}
        data-soft={view.soft || undefined}
        data-bust={view.bust || undefined}
        data-blackjack={view.blackjack || undefined}
        className="tabular"
      >
        {view.text}
      </span>
    </span>
  );
}

function StatusBadges({ view }: { view: TotalView }) {
  const reduced = useReducedMotionPref();
  if (!view.bust && !view.blackjack) return null;
  return (
    <motion.span
      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
      className="inline-flex"
    >
      {view.bust ? (
        <Badge tone="velvet" data-testid="bj-badge-bust">
          {t('blackjack.badge.bust')}
        </Badge>
      ) : (
        <Badge tone="gold" icon={<SparkleIcon size={12} />} data-testid="bj-badge-blackjack">
          {t('blackjack.badge.blackjack')}
        </Badge>
      )}
    </motion.span>
  );
}

function HandSpot({
  hand,
  index,
  count,
  slots,
  active,
  status,
  outcome,
  opening,
  shoeRef,
  layoutPrefix,
}: {
  hand: BlackjackHand;
  index: number;
  count: number;
  slots: readonly Slot[];
  active: boolean;
  status: 'playing' | 'next' | 'done' | null;
  outcome: HandOutcome | null;
  opening: ReadonlySet<string>;
  shoeRef: RefObject<HTMLDivElement | null>;
  layoutPrefix: string;
}) {
  const split = count > 1;
  const view = totalView(hand.cards, !hand.fromSplit);
  const cards = cardList(hand.cards);
  const label = !split
    ? t('blackjack.zone.you', { cards })
    : index === 0
      ? t('blackjack.zone.first', { cards })
      : t('blackjack.zone.second', { cards });
  // After a split the second hand's first card slid over from the first hand.
  const moved = split && index === 1 ? MOVED_BY_SPLIT : undefined;

  return (
    <div
      role="group"
      aria-label={label}
      data-testid={`bj-hand-${index}`}
      data-active={active || undefined}
      className={cn(
        'relative flex min-w-0 flex-col items-center gap-1.5 rounded-2xl border px-1.5 pt-1.5 pb-2 transition-[translate,border-color,background-color,box-shadow,opacity] duration-200',
        split
          ? active
            ? 'border-gold-300/85 bg-felt-950/35 -translate-y-1 shadow-[0_0_0_1px_rgb(245_215_122/0.3),0_0_24px_-6px_rgb(245_215_122/0.6)]'
            : 'border-gold-300/15 bg-felt-950/15'
          : 'border-transparent',
        split && status === 'done' && 'opacity-80',
      )}
    >
      {split ? (
        <p className="flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-[0.14em] uppercase">
          <span className="text-gold-200">
            {index === 0 ? t('blackjack.hand.first') : t('blackjack.hand.second')}
          </span>
          {status ? (
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 tracking-[0.08em]',
                status === 'playing' ? 'bg-gold-300 text-ink' : 'text-mist',
              )}
            >
              {t(`blackjack.hand.${status}`)}
            </span>
          ) : null}
        </p>
      ) : null}

      <div className="relative flex w-full justify-center">
        <CardRow
          slots={slots}
          width={split ? SPLIT_CARD_W : CARD_W}
          opening={opening}
          shoeRef={shoeRef}
          layoutPrefix={layoutPrefix}
          movedIds={moved}
        >
          {outcome ? <OutcomeStamp outcome={outcome} /> : null}
        </CardRow>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <BetChips bet={hand.bet} doubled={hand.doubled} />
        <TotalPill
          testId={index === 0 ? 'bj-player-total' : `bj-player-total-${index + 1}`}
          view={view}
        />
        <StatusBadges view={view} />
      </div>
    </div>
  );
}

const MOVED_BY_SPLIT: ReadonlySet<string> = new Set(['p1']);

/** The bet on a hand: one chip in a printed betting circle, two (×2) after doubling down. */
function BetChips({ bet, doubled }: { bet: number; doubled: boolean }) {
  const reduced = useReducedMotionPref();
  const chips = Math.max(1, Math.min(bet, 4));
  return (
    <span className="relative inline-flex items-center gap-1" data-testid="bj-bet" data-bet={bet}>
      <span
        aria-hidden="true"
        className="border-gold-300/45 relative inline-flex size-9 items-center justify-center rounded-full border border-dashed"
      >
        {Array.from({ length: chips }, (_, i) => (
          <motion.svg
            key={i}
            viewBox="0 0 32 32"
            className="absolute size-7 drop-shadow-[0_2px_2px_rgb(0_0_0/0.6)]"
            initial={i > 0 && !reduced ? { y: -18, opacity: 0 } : false}
            animate={{ y: -i * 3.5, opacity: 1 }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 22 }}
          >
            <circle cx={16} cy={16} r={15} fill={i % 2 === 0 ? '#c22f47' : '#1b5fc1'} />
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
            <circle cx={16} cy={16} r={9.5} fill={i % 2 === 0 ? '#9e2036' : '#174f9f'} />
            <circle cx={16} cy={16} r={9.5} fill="none" stroke="#f5d77a" strokeOpacity={0.8} />
          </motion.svg>
        ))}
      </span>
      {doubled ? (
        <span aria-hidden="true" className="text-gold-200 text-xs font-extrabold">
          ×{bet}
        </span>
      ) : null}
      <span className="sr-only">
        {bet === 1 ? t('blackjack.hand.betOne') : t('blackjack.hand.betMany', { n: bet })}
      </span>
    </span>
  );
}

const STAMP_TONE: Record<HandOutcome, string> = {
  win: 'border-gold-200 bg-gold-300 text-ink',
  blackjack:
    'border-gold-100 bg-[linear-gradient(180deg,var(--color-gold-100),var(--color-gold-400))] text-ink',
  push: 'border-mist/60 bg-felt-900 text-cream',
  loss: 'border-velvet-300/70 bg-velvet-600 text-cream',
};

/** WIN / PUSH / LOSE stamped across a finished hand. */
function OutcomeStamp({ outcome }: { outcome: HandOutcome }) {
  const reduced = useReducedMotionPref();
  return (
    <motion.span
      data-testid="bj-outcome"
      data-outcome={outcome}
      initial={reduced ? false : { scale: 1.8, opacity: 0, rotate: -20 }}
      animate={{ scale: 1, opacity: 1, rotate: -9 }}
      transition={
        reduced ? { duration: 0 } : { delay: 0.3, type: 'spring', stiffness: 420, damping: 17 }
      }
      className={cn(
        'absolute -top-2 -right-2.5 z-30 rounded-md border-2 px-1.5 py-0.5 text-[0.6875rem] font-extrabold tracking-[0.14em] whitespace-nowrap uppercase shadow-[0_8px_18px_-8px_rgb(0_0_0/0.9)] sm:text-sm',
        STAMP_TONE[outcome],
      )}
    >
      <span className="sr-only">{t('blackjack.outcome.label')} </span>
      {t(OUTCOME_KEY[outcome])}
    </motion.span>
  );
}

function ActionBar({
  legal,
  busy,
  busyReason,
  coachMode,
  highlight,
  suggestedKey,
  flash,
  onPress,
}: {
  legal: ReadonlySet<string>;
  busy: boolean;
  busyReason: string;
  coachMode: boolean;
  highlight: ReadonlySet<string>;
  suggestedKey: string | null;
  flash: LearnerMoveType | null;
  onPress: (type: LearnerMoveType) => void;
}) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const busyId = `${ids}-busy`;
  const unavailableId = `${ids}-unavailable`;
  const suggestedId = `${ids}-suggested`;

  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-2 pt-1">
      <div
        role="group"
        aria-label={t('blackjack.actions.label')}
        data-testid="bj-actions"
        className="grid grid-cols-4 gap-1.5 sm:gap-3"
      >
        {ACTIONS.map((a) => {
          const isLegal = legal.has(a.type);
          const unavailable = !busy && !isLegal;
          const glow = coachMode && !busy && highlight.has(a.type);
          const suggested = !busy && suggestedKey === a.type;
          const hintId = `${ids}-${a.type}-hint`;
          const describedBy = [
            hintId,
            busy ? busyId : unavailable ? unavailableId : null,
            suggested ? suggestedId : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={a.type}
              type="button"
              data-testid={`bj-${a.type}`}
              data-legal={isLegal || undefined}
              data-highlighted={glow || undefined}
              data-suggested={suggested || undefined}
              data-pressed={flash === a.type || undefined}
              aria-label={t(a.label)}
              aria-keyshortcuts={a.key}
              aria-disabled={busy || unavailable || undefined}
              aria-describedby={describedBy}
              onClick={() => onPress(a.type)}
              className={cn(
                'group/act ease-snap relative flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none sm:min-h-20',
                busy
                  ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
                  : isLegal
                    ? 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px'
                    : 'border-gold-300/40 bg-felt-950/45 text-gold-200 hover:border-gold-300/70 hover:bg-felt-950/65 active:translate-y-px',
                flash === a.type && 'translate-y-px brightness-110',
              )}
            >
              {glow && !suggested ? (
                <span
                  aria-hidden="true"
                  className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
                />
              ) : null}
              {suggested ? (
                <>
                  <motion.span
                    aria-hidden="true"
                    data-testid="bj-suggested-ring"
                    className="pointer-events-none absolute -inset-1 rounded-[0.95rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
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
                    {t('blackjack.actions.pick')}
                  </span>
                </>
              ) : null}
              <span aria-hidden="true" className="inline-flex">
                {a.icon}
              </span>
              <span className="text-[0.9375rem] leading-tight font-extrabold sm:text-base">
                {t(a.label)}
              </span>
              <span
                id={hintId}
                className={cn(
                  'text-[0.625rem] leading-tight font-semibold sm:text-xs',
                  isLegal && !busy ? 'text-ink/75' : 'text-mist',
                )}
              >
                {t(a.hint)}
              </span>
              <kbd
                aria-hidden="true"
                className={cn(
                  'absolute top-1 right-1 hidden size-4 items-center justify-center rounded border font-sans text-[0.5625rem] leading-none font-bold sm:size-5 sm:text-[0.625rem] pointer-fine:inline-flex',
                  isLegal && !busy
                    ? 'border-ink/30 text-ink/70'
                    : 'border-gold-300/40 text-gold-200/80',
                )}
              >
                {a.key}
              </kbd>
            </button>
          );
        })}
      </div>
      <span id={busyId} className="sr-only">
        {busyReason}
      </span>
      <span id={unavailableId} className="sr-only">
        {t('blackjack.actions.unavailable')}
      </span>
      <span id={suggestedId} className="sr-only">
        {t('blackjack.actions.suggested')}
      </span>
      <p
        data-testid="bj-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('blackjack.actions.keys')}:</span>
        {ACTIONS.map((a) => (
          <span key={a.type} className="inline-flex items-center gap-1">
            <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
              {a.key}
            </kbd>
            {t(a.label)}
          </span>
        ))}
      </p>
    </div>
  );
}
