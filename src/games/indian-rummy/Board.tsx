'use client';
/**
 * The Indian Rummy table (built like the Blackjack reference Board — see
 * ../blackjack/README.md).
 *
 *   ┌──────────────────────────────────────────┐
 *   │ [Dadi Diamond · 13 cards]   ▒▒▒▒▒▒▒▒▒▒▒  │  opponent seat(s): card backs only
 *   │      ⟂8♦[▒ stock]      [open pile 5♣]    │  wild-joker card tucked under the stock
 *   │   Your turn: draw a card from …          │  step banner
 *   │  Points left 23  · Ready to declare!  ⇅  │  deadwood counter, group/sort toggle
 *   │ [Pure seq ✓ 4♥5♥6♥] [Set ✓ 9♠9♦9♣] [Not  │  the hand, in groups that wrap
 *   │   grouped yet K♠ 2♦ 7♣ …]                │
 *   │  [ Discard ] [ Declare ] [ Drop ]        │  action bar (D / R)
 *   └──────────────────────────────────────────┘
 *
 * Turn flow: draw (stock / open pile) → select a card (tap, or arrows + Enter) → Discard
 * (or press the selected card again) / Declare. Drop is offered before drawing, behind a
 * confirmation that names its cost.
 *
 * Rules of the road (same as every Board):
 * - Render ONLY what the learner may see: the stock is card backs, opponents' hands are a
 *   count of backs until the game is over, and a bot's blind draw is never named.
 * - Let the learner ATTEMPT any move: everything calls `onMove`, and the controller explains
 *   illegal ones (the coach panel / error callout). Only `busy` blocks presses — and even
 *   then every control keeps focus.
 * - Announcements come from the controller (engine.describeMove); the Board labels zones.
 */
import {
  createRef,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from 'react';
import { cardCountText } from '@/components/cards';
import { announce } from '@/components/layout/LiveAnnouncer';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { motion } from 'motion/react';
import { cardShort, type CardCode } from '@/games/core/cards';
import { type BoardProps } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { ActionBar, type ActionId, type ActionView } from './board/ActionBar';
import { displayGroups, type SortMode } from './board/arrange';
import { DropDialog } from './board/DropDialog';
import { HandArea, type CardArrival } from './board/HandArea';
import { OpponentSeat, type OpponentSeatProps } from './board/OpponentSeat';
import { TableCenter, type Landing } from './board/TableCenter';
import {
  bestArrangement,
  declarableDiscards,
  dropKindFor,
  dropPoints,
  indianRummyEngine,
  MAX_PLAYERS,
  type IndianRummyMove,
  type IndianRummyState,
} from './engine';
import { DADI_DIAMOND, INDIAN_RUMMY_ROSTER } from './personas';

export type IndianRummyBoardProps = BoardProps<IndianRummyState, IndianRummyMove>;

/** Seconds between cards of the opening deal (one card per seat in turn). */
const DEAL_STAGGER = 0.05;

const SHORTCUTS: Readonly<Record<string, 'stock' | 'open' | ActionId | 'sort'>> = {
  s: 'stock',
  o: 'open',
  d: 'discard',
  r: 'declare',
  g: 'sort',
};

function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * How far the game has got. It never goes down within one deal, so a smaller number (or a
 * different wild-joker card / dealer) means a new deal — the table remounts and deals again.
 */
function progressOf(s: IndianRummyState): number {
  return s.turnCount * 3 + (s.phase === 'discard' ? 1 : 0) + s.drops.filter(Boolean).length;
}

/**
 * Indian Rummy's Board. Remounts the table for every new deal (so the deal animates again
 * when the practice hand restarts).
 */
export function IndianRummyBoard(props: IndianRummyBoardProps) {
  const { state } = props;
  const sig = `${state.wildCard}|${state.dealer}|${state.players}`;
  const progress = progressOf(state);
  const dealt = (state.hands[props.human] ?? []).join(' ');
  const [deal, setDeal] = useState({ n: 0, sig, progress, hand: dealt });
  const hand = progress === 0 ? dealt : deal.hand;
  if (deal.sig !== sig || progress < deal.progress || (progress === 0 && hand !== deal.hand)) {
    setDeal({ n: deal.n + 1, sig, progress, hand });
  } else if (progress !== deal.progress) {
    setDeal({ ...deal, progress });
  }
  return <RummyTable key={deal.n} {...props} />;
}

function RummyTable({
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
}: IndianRummyBoardProps) {
  const reduced = useReducedMotionPref();
  const rootRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLElement | null>(null);
  const openRef = useRef<HTMLElement | null>(null);
  const handRef = useRef<HTMLDivElement | null>(null);
  const [seatRefs] = useState(() =>
    Array.from({ length: MAX_PLAYERS }, () => createRef<HTMLDivElement | null>()),
  );
  const seatRef = (seat: PlayerId): RefObject<HTMLDivElement | null> =>
    seatRefs[seat] ?? seatRefs[0]!;

  const hand = useMemo(() => state.hands[human] ?? [], [state.hands, human]);
  const wildRank = state.wildRank;
  const myTurn = !over && state.turn === human && !state.drops[human];
  const drawPhase = myTurn && state.phase === 'draw';
  const discardPhase = myTurn && state.phase === 'discard';
  const legalKeys = useMemo(
    () => new Set(legalMoves.map((m) => indianRummyEngine.moveKey(m))),
    [legalMoves],
  );

  /* ---------------------------------------------------------- the hand */

  const [mode, setMode] = useState<SortMode>('group');
  const groups = useMemo(() => displayGroups(hand, wildRank, mode), [hand, wildRank, mode]);
  const flat = useMemo(() => groups.flatMap((g) => g.cards), [groups]);
  const arrangement = useMemo(() => bestArrangement(hand, wildRank), [hand, wildRank]);
  const declarable = useMemo(
    () => (hand.length === 14 ? declarableDiscards(state, human) : []),
    [state, human, hand.length],
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const selected = flat.find((c) => c.key === selectedKey) ?? null;
  const selectedCode = selected?.code ?? null;
  const [note, setNote] = useState<string | null>(null);

  // Which cards are new in this render, and where they flew in from. Tracked from render to
  // render ("storing information from previous renders"), never in an effect.
  const keys = flat.map((c) => c.key);
  const handSig = keys.slice().sort().join('|');
  const [track, setTrack] = useState(() => ({
    sig: handSig,
    mode,
    arrivals: new Map<string, CardArrival>(
      flat.map((c, i) => [
        c.key,
        { from: stockRef, delay: (i * state.players + 1) * DEAL_STAGGER },
      ]),
    ),
    focusKey: null as string | null,
    focusToken: 0,
  }));
  if (track.sig !== handSig || track.mode !== mode) {
    const before = new Set(track.sig.split('|'));
    const fresh = track.mode === mode ? keys.filter((k) => !before.has(k)) : [];
    const source = state.drawn?.from === 'discard' ? openRef : stockRef;
    const drew = state.turn === human && state.phase === 'discard' && fresh.length === 1;
    setTrack({
      sig: handSig,
      mode,
      arrivals: new Map(fresh.map((k) => [k, { from: source, delay: 0 }])),
      focusKey: drew ? (fresh[0] ?? null) : null,
      focusToken: drew ? track.focusToken + 1 : track.focusToken,
    });
    // A new hand (a card drawn or thrown) starts with nothing selected: with two decks, the
    // twin of a thrown card would otherwise inherit its key and stay selected.
    const handChanged = track.sig !== handSig;
    if (selectedKey !== null && (handChanged || !keys.includes(selectedKey))) setSelectedKey(null);
    if (note !== null) setNote(null);
  }
  const drawnKey =
    !over && state.drawn && state.turn === human && state.phase === 'discard'
      ? ([...flat].reverse().find((c) => c.code === state.drawn?.card)?.key ?? null)
      : null;

  /* ----------------------------------------------------- the open pile */

  // Who threw the card now on top of the open pile (so it flies in from their seat).
  const [pile, setPile] = useState(() => ({
    len: state.discard.length,
    turn: state.turn,
    landing: null as Landing | null,
  }));
  if (pile.len !== state.discard.length || pile.turn !== state.turn) {
    const thrownBy = state.discard.length > pile.len ? pile.turn : null;
    setPile({
      len: state.discard.length,
      turn: state.turn,
      landing:
        thrownBy === null
          ? pile.len === state.discard.length
            ? pile.landing
            : null
          : {
              id: `${state.discard.length}-${state.turnCount}`,
              from: thrownBy === human ? handRef : seatRef(thrownBy),
            },
    });
  }

  /* ---------------------------------------------------------- actions */

  const [dropOpen, setDropOpen] = useState(false);
  const dropKind = dropKindFor(state, human);
  const dropCost = dropPoints(dropKind);

  const send = (move: IndianRummyMove) => {
    if (busy) return;
    setNote(null);
    onMove(move);
  };
  const remind = (action: string) => {
    const text = t('indianRummy.actions.selectFirst', { action });
    setNote(text);
    announce(text);
  };

  const pressCard = (key: string, code: CardCode) => {
    if (over) return;
    if (selectedKey === key && !busy) {
      send({ type: 'discard', card: code });
      return;
    }
    setNote(null);
    setSelectedKey(key);
  };

  const press = (id: ActionId) => {
    if (busy) return;
    if (id === 'drop') {
      if (legalKeys.has('drop')) setDropOpen(true);
      else send({ type: 'drop' });
      return;
    }
    const card = selectedCode ?? (discardPhase ? null : hand[0]);
    if (!card) {
      remind(t(id === 'discard' ? 'indianRummy.actions.discard' : 'indianRummy.actions.declare'));
      return;
    }
    send(id === 'discard' ? { type: 'discard', card } : { type: 'declare', discard: card });
  };

  const drawStock = () => send({ type: 'draw', from: 'stock' });
  const drawOpen = () => send({ type: 'draw', from: 'discard' });
  const tryWild = () => send({ type: 'draw', from: 'wild' });
  const toggleMode = () => setMode((m) => (m === 'group' ? 'suit' : 'group'));

  // S / O / D / R / G anywhere on the page — except while typing or inside another dialog.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const action = SHORTCUTS[e.key.toLowerCase()];
    if (!action) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && isTypingTarget(target)) return;
    const dialog = target?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    if (dropOpen) return;
    e.preventDefault();
    if (action === 'sort') toggleMode();
    else if (action === 'stock') drawStock();
    else if (action === 'open') drawOpen();
    else press(action);
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  /* ------------------------------------------------------ coach marks */

  const mark = (key: string) => ({
    highlighted: coachMode && !busy && highlight.has(key),
    suggested: !busy && suggestedKey === key,
  });
  const anyKey = (prefix: string) => [...highlight].some((k) => k.startsWith(prefix));
  const suggestedCard =
    !busy && suggestedKey && /^(discard|declare):/.test(suggestedKey)
      ? (suggestedKey.slice(suggestedKey.indexOf(':') + 1) as CardCode)
      : null;
  const isHighlighted = (code: CardCode) =>
    coachMode && !busy && (highlight.has(`discard:${code}`) || highlight.has(`declare:${code}`));

  const actions: ActionView[] = [
    {
      id: 'discard',
      label: t('indianRummy.actions.discard'),
      name: selectedCode
        ? t('indianRummy.actions.discardCard', { card: cardShort(selectedCode) })
        : t('indianRummy.actions.discard'),
      hint: selectedCode
        ? t('indianRummy.actions.throwCard', { card: cardShort(selectedCode) })
        : t('indianRummy.actions.discardHint'),
      shortcut: 'D',
      legal: selectedCode !== null && legalKeys.has(`discard:${selectedCode}`),
      glow:
        coachMode && (selectedCode ? highlight.has(`discard:${selectedCode}`) : anyKey('discard:')),
      suggested: selectedCode !== null && suggestedKey === `discard:${selectedCode}`,
    },
    {
      id: 'declare',
      label: t('indianRummy.actions.declare'),
      name: selectedCode
        ? t('indianRummy.actions.declareCard', { card: cardShort(selectedCode) })
        : t('indianRummy.actions.declare'),
      hint: selectedCode
        ? t('indianRummy.actions.throwAndShow', { card: cardShort(selectedCode) })
        : t('indianRummy.actions.declareHint'),
      shortcut: 'R',
      legal: selectedCode !== null && legalKeys.has(`declare:${selectedCode}`),
      glow:
        coachMode && (selectedCode ? highlight.has(`declare:${selectedCode}`) : anyKey('declare:')),
      suggested: suggestedKey?.startsWith('declare:') ?? false,
    },
    {
      id: 'drop',
      label: t('indianRummy.actions.drop'),
      name: t('indianRummy.actions.drop'),
      hint: t('indianRummy.actions.dropHint', { points: dropCost }),
      legal: legalKeys.has('drop'),
      glow: coachMode && highlight.has('drop'),
      suggested: suggestedKey === 'drop',
    },
  ];

  /* ------------------------------------------------------- the seats */

  const outcome = state.outcome;
  const result = over && outcome ? indianRummyEngine.result(state) : null;
  const opponents = Array.from({ length: state.players }, (_, i) => i).filter((s) => s !== human);
  const nameOf = (seat: PlayerId) =>
    personas[seat]?.name ?? INDIAN_RUMMY_ROSTER[seat - 1]?.name ?? `Player ${seat}`;
  const verdictFor = (seat: PlayerId): OpponentSeatProps['verdict'] => {
    if (!outcome) return null;
    if (outcome.declarer === seat) return { kind: 'declared' };
    if (outcome.winners.includes(seat)) return { kind: 'winner' };
    if (state.drops[seat]) return null;
    return { kind: 'pays', points: outcome.points[seat] ?? 0 };
  };
  const drawFrom = state.drawn?.from === 'discard' ? openRef : stockRef;

  const step: 'draw' | 'discard' | 'wait' | 'dropped' | 'over' = over
    ? 'over'
    : state.drops[human]
      ? 'dropped'
      : drawPhase
        ? 'draw'
        : discardPhase
          ? 'discard'
          : 'wait';
  const stepText =
    step === 'wait'
      ? t('indianRummy.step.wait', { name: nameOf(state.turn) })
      : t(`indianRummy.step.${step}`);
  const busyReason = over
    ? t('indianRummy.actions.over')
    : t('indianRummy.actions.wait', { name: nameOf(state.turn) });
  const handLabel = t(busy && !over ? 'indianRummy.zone.handBusy' : 'indianRummy.zone.hand', {
    count: cardCountText(hand.length),
  });
  const ready = discardPhase && declarable.length > 0;

  return (
    <div
      ref={rootRef}
      data-testid="rummy-board"
      data-phase={state.phase}
      data-turn={state.turn}
      data-over={over || undefined}
      className="relative flex flex-col gap-3 sm:gap-4"
    >
      {/* Opponents */}
      <div
        className={cn(
          'grid gap-2',
          opponents.length > 1
            ? 'grid-cols-2 sm:grid-cols-[repeat(auto-fit,minmax(13rem,1fr))]'
            : 'grid-cols-1 sm:mx-auto sm:w-full sm:max-w-md',
        )}
      >
        {opponents.map((seat) => {
          const persona = personas[seat] ?? INDIAN_RUMMY_ROSTER[seat - 1] ?? DADI_DIAMOND;
          const drop = state.drops[seat];
          return (
            <OpponentSeat
              key={seat}
              ref={seatRef(seat)}
              seat={seat}
              persona={persona}
              count={(state.hands[seat] ?? []).length}
              active={!over && state.turn === seat}
              thinking={thinking === seat}
              dropped={drop ? dropPoints(drop) : null}
              revealed={over ? (state.hands[seat] ?? []) : null}
              wildRank={wildRank}
              verdict={verdictFor(seat)}
              drawFrom={drawFrom}
              dealFrom={stockRef}
            />
          );
        })}
      </div>

      <TableCenter
        stockCount={state.stock.length}
        discard={state.discard}
        wildCard={state.wildCard}
        wildRank={wildRank}
        busy={busy}
        stockMarks={mark('draw:stock')}
        openMarks={mark('draw:discard')}
        landing={pile.landing}
        stockRef={stockRef}
        openRef={openRef}
        onStock={drawStock}
        onOpen={drawOpen}
        onWild={tryWild}
      />

      {/* Learner zone */}
      <div className="flex flex-col gap-2">
        <motion.p
          key={step}
          data-testid="rummy-step"
          data-step={step}
          initial={reduced ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
          className={cn(
            'mx-auto max-w-[36rem] rounded-full px-3 py-1 text-center text-[0.8125rem] leading-snug font-semibold sm:text-sm',
            step === 'draw' || step === 'discard'
              ? 'bg-gold-300/15 text-gold-100 border-gold-300/40 border'
              : 'text-mist',
          )}
        >
          {stepText}
        </motion.p>

        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="border-gold-300/45 bg-felt-950/80 text-gold-100 inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-bold shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)]"
              title={t('indianRummy.points.hint')}
            >
              <span aria-hidden="true" className="text-mist text-xs font-semibold uppercase">
                {t('indianRummy.points.label')}
              </span>
              <span className="sr-only">
                {t('indianRummy.points.sr', { n: arrangement.deadwoodPoints })}
              </span>
              <span
                aria-hidden="true"
                data-testid="rummy-points"
                data-points={arrangement.deadwoodPoints}
                className="tabular"
              >
                {arrangement.deadwoodPoints}
              </span>
            </span>
            {ready ? (
              <motion.span
                initial={reduced ? false : { scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }
                }
                className="inline-flex"
              >
                <Badge
                  tone="gold"
                  icon={<SparkleIcon size={12} />}
                  data-testid="rummy-ready"
                  title={t('indianRummy.points.readyHint')}
                >
                  {t('indianRummy.points.ready')}
                </Badge>
              </motion.span>
            ) : null}
            {result ? (
              <OutcomeStamp outcome={result.humanOutcome} net={result.humanNetUnits} />
            ) : null}
          </div>
          <button
            type="button"
            data-testid="rummy-sort"
            data-mode={mode}
            aria-keyshortcuts="G"
            aria-label={`${mode === 'group' ? t('indianRummy.sort.toSuits') : t('indianRummy.sort.toGroups')}. ${t('indianRummy.sort.sr', { mode: mode === 'group' ? t('indianRummy.sort.group') : t('indianRummy.sort.suit') })}`}
            onClick={toggleMode}
            className="border-gold-300/45 text-gold-200 hover:border-gold-300 hover:bg-gold-300/10 inline-flex min-h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-semibold"
          >
            <svg
              aria-hidden="true"
              focusable="false"
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
            >
              <path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" />
            </svg>
            {mode === 'group' ? t('indianRummy.sort.toSuits') : t('indianRummy.sort.toGroups')}
          </button>
        </div>

        <HandArea
          ref={handRef}
          groups={groups}
          label={handLabel}
          selectedKey={selectedKey}
          drawnKey={drawnKey}
          arrivals={track.arrivals}
          focusKey={track.focusKey}
          focusToken={track.focusToken}
          rootRef={rootRef}
          isHighlighted={isHighlighted}
          suggestedCode={suggestedCard}
          onPress={pressCard}
          onClear={() => setSelectedKey(null)}
        />

        <p
          data-testid="rummy-note"
          aria-hidden={note ? undefined : true}
          className={cn(
            'text-gold-200 min-h-[1.25rem] text-center text-xs font-semibold sm:text-sm',
            !note && 'invisible',
          )}
        >
          {note}
        </p>
      </div>

      <div className="mx-auto flex w-full max-w-[32rem] flex-col gap-2">
        <ActionBar actions={actions} busy={busy} busyReason={busyReason} onPress={press} />
        <p
          data-testid="rummy-keys"
          className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
        >
          <span className="font-semibold">{t('indianRummy.actions.keys')}:</span>
          {(
            [
              ['S', 'indianRummy.actions.keyStock'],
              ['O', 'indianRummy.actions.keyOpen'],
              ['D', 'indianRummy.actions.keyDiscard'],
              ['R', 'indianRummy.actions.keyDeclare'],
              ['G', 'indianRummy.actions.keySort'],
            ] as const
          ).map(([key, label]) => (
            <span key={key} className="inline-flex items-center gap-1">
              <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
                {key}
              </kbd>
              {t(label)}
            </span>
          ))}
          <span>{t('indianRummy.actions.keyHand')}</span>
        </p>
      </div>

      <DropDialog
        open={dropOpen}
        kind={dropKind}
        points={dropCost}
        onClose={() => setDropOpen(false)}
        onConfirm={() => {
          setDropOpen(false);
          send({ type: 'drop' });
        }}
      />
    </div>
  );
}

const STAMP_TONE = {
  win: 'border-gold-200 bg-gold-300 text-ink',
  push: 'border-mist/60 bg-felt-900 text-cream',
  loss: 'border-velvet-300/70 bg-velvet-600 text-cream',
} as const;

/** "You win · +71 points" stamped beside the points counter when the game ends. */
function OutcomeStamp({ outcome, net }: { outcome: 'win' | 'loss' | 'push'; net: number }) {
  const reduced = useReducedMotionPref();
  const signed = net > 0 ? `+${net}` : net < 0 ? `−${Math.abs(net)}` : '0';
  return (
    <motion.span
      data-testid="rummy-outcome"
      data-outcome={outcome}
      data-net={net}
      initial={reduced ? false : { scale: 1.8, opacity: 0, rotate: -16 }}
      animate={{ scale: 1, opacity: 1, rotate: -4 }}
      transition={
        reduced ? { duration: 0 } : { delay: 0.25, type: 'spring', stiffness: 420, damping: 17 }
      }
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-md border-2 px-2 text-xs font-extrabold tracking-[0.1em] whitespace-nowrap uppercase shadow-[0_8px_18px_-8px_rgb(0_0_0/0.9)] sm:text-sm',
        STAMP_TONE[outcome],
      )}
    >
      <span className="sr-only">{t('indianRummy.outcome.label')} </span>
      {t(`indianRummy.outcome.${outcome}`)}
      <span className="tabular">· {t('indianRummy.outcome.points', { points: signed })}</span>
    </motion.span>
  );
}
