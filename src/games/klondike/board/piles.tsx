'use client';
/**
 * The piles on the Klondike felt: stock, waste, the four foundations and the seven columns.
 * Each pile is ONE real <button> (a Tab stop, Enter/Space activates it, ←/→/↑/↓ move between
 * piles); the cards inside are decorative for screen readers — the pile's label lists them —
 * but can be tapped or dragged with a pointer.
 *
 * Hidden information: face-down column cards are drawn with CardBack and the stock is a stack
 * of backs with a count, so no hidden card code or name is ever in the DOM (until the game is
 * over, when the columns' face-down cards are turned up so the learner sees what was there).
 */
import { motion } from 'motion/react';
import { useId, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
  CardBack,
  PlayingCard,
  SuitIcon,
  useCardDrag,
  useDropTargetState,
} from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { suitOf, type StandardCard, type Suit } from '@/games/core/cards';
import { useReducedMotionPref } from '@/lib/motion';
import { klondikeMoveKey, type KlondikeSource } from '../engine';
import { useTable } from './context';
import { useFlipIn, useFlyIn } from './fly';
import {
  anyStartsWith,
  cardMove,
  cascadeHeight,
  cascadeSteps,
  columnId,
  columnLabel,
  foundationId,
  foundationLabel,
  pileOfSource,
  runText,
  sourceCards,
  sourcePrefix,
  targetOf,
  wasteLabel,
  type PileId,
} from './model';
import { kt } from './strings';

/** One card: its width is the table's --kw custom property (7 columns fit any width). */
const CARD_BOX: CSSProperties = { width: 'var(--kw)' };
const kw = (n: number) => `calc(var(--kw) * ${n})`;
const CARD_HEIGHT = kw(1.4);

/* ------------------------------------------------------------- pile shell */

interface PileShellProps {
  id: PileId;
  label: string;
  /** Extra screen-reader text (selection, coach notes). */
  description?: string;
  /** Glows: a legal source/destination in coach mode. */
  highlighted?: boolean;
  /** Pulses: the coach's pick. */
  suggested?: boolean;
  /** The picked-up cards are here. */
  selected?: boolean;
  /** Cards can be picked up from here (exposed as a toggle: aria-pressed). */
  selectable?: boolean;
  /** Accepts drops (columns and foundations). */
  droppable?: boolean;
  testId: string;
  className?: string;
  style?: CSSProperties;
  onClick: () => void;
  children: ReactNode;
  /** Also keep the button in this ref (the stock: cards fly from it). */
  extraRef?: RefObject<HTMLButtonElement | null>;
}

function PileShell({
  id,
  label,
  description,
  highlighted = false,
  suggested = false,
  selected = false,
  selectable = true,
  droppable = false,
  testId,
  className,
  style,
  onClick,
  children,
  extraRef,
}: PileShellProps) {
  const { busy, registerPile, onPileFocus } = useTable();
  const reduced = useReducedMotionPref();
  const descId = useId();
  const drop = useDropTargetState(droppable ? id : undefined);
  return (
    <button
      ref={(el) => {
        registerPile(id)(el);
        if (extraRef) extraRef.current = el;
      }}
      type="button"
      data-pile={id}
      data-testid={testId}
      data-drop-id={droppable ? id : undefined}
      data-highlighted={highlighted || undefined}
      data-suggested={suggested || undefined}
      data-selected={selected || undefined}
      aria-label={label}
      aria-describedby={description ? descId : undefined}
      aria-pressed={selectable ? selected : undefined}
      aria-disabled={busy || undefined}
      onFocus={() => onPileFocus(id)}
      onClick={() => onClick()}
      className={cn(
        // While a card is dragged out of this pile, the pile rises above its neighbours.
        // touch-manipulation: a quick double-tap sends a card home instead of zooming the page.
        'relative block min-w-0 touch-manipulation rounded-[10px] text-left select-none has-[[data-dragging]]:z-50',
        busy ? 'cursor-default' : 'cursor-pointer',
        className,
      )}
      style={style}
    >
      {children}
      {highlighted && !suggested ? (
        <span
          aria-hidden="true"
          className="shadow-glow pointer-events-none absolute -inset-1 z-40 rounded-[12px]"
        />
      ) : null}
      {suggested ? (
        <>
          <motion.span
            aria-hidden="true"
            data-testid="klondike-suggested-ring"
            className="pointer-events-none absolute -inset-1.5 z-40 rounded-[13px] shadow-[0_0_0_3px_var(--color-gold-200),0_0_24px_6px_rgb(245_215_122/0.8)]"
            animate={reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45] }}
            transition={
              reduced ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <span
            aria-hidden="true"
            className="bg-gold-200 text-ink absolute -top-2.5 left-1/2 z-50 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1 py-px text-[0.5rem] font-extrabold tracking-[0.06em] whitespace-nowrap uppercase shadow sm:text-[0.5625rem]"
          >
            <SparkleIcon size={8} />
            {kt('klondike.coach.pick')}
          </span>
        </>
      ) : null}
      {drop.isOver ? (
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -inset-1.5 z-40 rounded-[13px] border-2',
            drop.isValid
              ? 'border-gold-300 bg-gold-300/10 shadow-glow'
              : 'border-velvet-400 border-dashed',
          )}
        />
      ) : null}
      {description ? (
        <span id={descId} className="sr-only">
          {description}
        </span>
      ) : null}
    </button>
  );
}

/** An empty slot printed on the felt (dashed outline, optional emblem). */
function EmptySlot({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'border-gold-300/40 bg-felt-950/30 flex items-center justify-center border-2 border-dashed',
        className,
      )}
      style={{ ...CARD_BOX, aspectRatio: '5 / 7', borderRadius: '8% / 5.714%' }}
    >
      {children}
    </span>
  );
}

/* --------------------------------------------------------------- shared */

/** Screen-reader notes for a pile: selection, destination, coach picks, waiting. */
function useNotes(
  id: PileId,
  opts: {
    selectedHere: boolean;
    isTarget: boolean;
    canMove: boolean;
    canReceive: boolean;
    /** What "a move starts here" means for this pile (default: a card can move). */
    moveNote?: string;
  },
): string {
  const { selection, suggestion, busy, over, state } = useTable();
  const notes: string[] = [];
  if (busy) notes.push(over ? kt('klondike.actions.over') : kt('klondike.actions.wait'));
  if (opts.selectedHere && selection) {
    notes.push(
      kt('klondike.select.selectedHere', { cards: runText(sourceCards(state, selection.source)) }),
    );
    notes.push(kt('klondike.select.toggle'));
  } else if (selection && opts.isTarget) {
    notes.push(kt('klondike.select.destination'));
  }
  if (suggestion?.from === id) notes.push(kt('klondike.coach.source'));
  else if (suggestion?.to === id) notes.push(kt('klondike.coach.target'));
  else if (opts.canReceive) notes.push(kt('klondike.coach.canReceive'));
  else if (opts.canMove) notes.push(opts.moveNote ?? kt('klondike.coach.canMove'));
  return notes.join(' ');
}

/** Coach-mode glow for a destination while cards are picked up. */
function useReceives(id: PileId): boolean {
  const { coachMode, selection, highlight, state } = useTable();
  const target = targetOf(id);
  if (!coachMode || !selection || !target) return false;
  if (pileOfSource(selection.source) === id) return false;
  if (target.kind === 'foundation') {
    const base = sourceCards(state, selection.source)[0];
    if (!base || foundationId(suitOf(base)) !== id) return false;
  }
  return highlight.has(klondikeMoveKey(cardMove(selection.source, target)));
}

interface DragCardProps {
  code: StandardCard;
  source: KlondikeSource;
  /** Lifted: part of the picked-up run. */
  selected: boolean;
  highlighted: boolean;
  suggested: boolean;
  flyFromStock?: boolean;
  /** Seconds before the flight from the stock starts (the opening deal). */
  flyDelay?: number;
  flipIn?: boolean;
  /** Can be picked up by dragging (only the top card of the waste / a foundation). */
  draggable?: boolean;
  onTap: (timeStamp: number) => void;
  className?: string;
  style?: CSSProperties;
  /** Cards stacked on this one (dragged along with it). */
  children?: ReactNode;
}

/**
 * A face-up card that can be tapped, double-tapped and (with a mouse or pen) dragged; the
 * cards stacked on it are its children, so a run moves as one.
 */
function DragCard({
  code,
  source,
  selected,
  highlighted,
  suggested,
  flyFromStock = false,
  flyDelay = 0,
  flipIn = false,
  draggable = true,
  onTap,
  className,
  style,
  children,
}: DragCardProps) {
  const t = useTable();
  const reduced = useReducedMotionPref();
  const { dragProps, isDragging } = useCardDrag<KlondikeSource>({
    id: `drag-${code}`,
    payload: source,
    disabled: t.busy || !t.dragEnabled || !draggable,
    onDrop: (target, payload) => {
      if (payload) t.drop(payload, target);
    },
    onDragStart: t.dragStart,
  });
  const {
    scope: flyScope,
    flying,
    landed,
  } = useFlyIn<HTMLSpanElement>({
    from: t.stockRef,
    enabled: flyFromStock,
    delay: flyDelay,
  });
  const dragOn = t.dragEnabled && draggable;
  const flipping = useFlipIn(flipIn);
  const { ref: dragRef, style: dragStyle, ...drag } = dragProps;
  return (
    <motion.span
      {...(dragOn ? drag : {})}
      ref={dragRef}
      layoutId={reduced ? undefined : `${t.layoutPrefix}-${code}`}
      data-testid={`klondike-card-${code}`}
      data-dragging={isDragging || undefined}
      onClick={(e) => {
        e.stopPropagation();
        onTap(e.timeStamp);
      }}
      className={cn('absolute left-0 block', isDragging && 'z-50', className)}
      style={{ ...style, ...(dragOn ? dragStyle : null), ...CARD_BOX }}
    >
      <span ref={flyScope} className="block" style={flying ? { opacity: 0 } : undefined}>
        <PlayingCard
          code={code}
          faceDown={!landed || flipping}
          size={t.cardSize}
          selected={selected}
          highlighted={highlighted}
          suggested={suggested}
          decorative
          style={CARD_BOX}
        />
      </span>
      {children}
    </motion.span>
  );
}

/* ---------------------------------------------------------------- stock */

export function Stock() {
  const t = useTable();
  const { state, coachMode, highlight, suggestion } = t;
  const count = state.stock.length;
  const recycle = count === 0 && state.waste.length > 0;
  const label =
    count > 0
      ? `${kt('klondike.zone.stock')}, ${count === 1 ? '1 card' : `${count} cards`}`
      : recycle
        ? kt('klondike.zone.stockRecycle')
        : kt('klondike.zone.stockEmpty');
  const highlighted = coachMode && (highlight.has('draw') || highlight.has('recycle'));
  const suggested = suggestion?.from === 'stock';
  const notes = useNotes('stock', {
    selectedHere: false,
    isTarget: false,
    canMove: highlighted,
    canReceive: false,
    moveNote: recycle ? kt('klondike.coach.canRecycle') : kt('klondike.coach.canDraw'),
  });
  const layers = count === 0 ? 0 : Math.min(4, Math.ceil(count / 6));
  return (
    <PileShell
      id="stock"
      extraRef={t.stockRef}
      label={label}
      description={notes || undefined}
      highlighted={highlighted}
      suggested={suggested}
      selectable={false}
      testId="klondike-stock"
      onClick={() => t.activate('stock')}
      style={{ ...CARD_BOX, aspectRatio: '5 / 7' }}
    >
      {count === 0 ? (
        <EmptySlot>
          {recycle ? (
            <svg
              viewBox="0 0 24 24"
              className="text-gold-300/80 size-[55%]"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 12a8 8 0 1 1-2.34-5.66" />
              <path d="M20 4v4.5h-4.5" />
            </svg>
          ) : null}
        </EmptySlot>
      ) : (
        <span
          aria-hidden="true"
          className="relative block"
          style={{ ...CARD_BOX, aspectRatio: '5 / 7' }}
        >
          {Array.from({ length: layers }, (_, i) => (
            <span
              key={i}
              className="absolute inset-0 block"
              style={{ transform: `translate(${(layers - i) * 1.5}px, ${(layers - i) * 1.5}px)` }}
            >
              <CardBack style={CARD_BOX} />
            </span>
          ))}
          <span className="absolute inset-0 block">
            <CardBack style={CARD_BOX} />
          </span>
          <span className="border-gold-600 bg-gold-300 text-ink tabular shadow-card absolute -right-1.5 -bottom-1.5 z-10 min-w-5 rounded-full border px-1 py-px text-center text-[0.625rem] leading-none font-bold sm:text-xs">
            {count}
          </span>
        </span>
      )}
    </PileShell>
  );
}

/* ---------------------------------------------------------------- waste */

/** How many waste cards are drawn (the top one plus a sliver of the ones beneath). */
const WASTE_SHOWN = 3;

export function Waste() {
  const t = useTable();
  const { state, coachMode, highlight, suggestion, selection } = t;
  const shown = state.waste.slice(-WASTE_SHOWN);
  const top = shown.length - 1;
  const selectedHere = selection?.source.kind === 'waste';
  const canMove = coachMode && !selection && anyStartsWith(highlight, 'move:w>');
  const suggested = suggestion?.from === 'waste';
  const notes = useNotes('waste', { selectedHere, isTarget: false, canMove, canReceive: false });
  return (
    <PileShell
      id="waste"
      label={wasteLabel(state)}
      description={notes || undefined}
      selected={selectedHere}
      testId="klondike-waste"
      onClick={() => t.activate('waste')}
      style={{ ...CARD_BOX, aspectRatio: '5 / 7' }}
    >
      {shown.length === 0 ? <EmptySlot /> : null}
      {shown.map((code, i) => {
        const isTop = i === top;
        return (
          <DragCard
            key={code}
            code={code}
            source={{ kind: 'waste' }}
            draggable={isTop}
            selected={isTop && selectedHere}
            highlighted={isTop && canMove}
            suggested={isTop && suggested}
            // A freshly drawn card flies over from the stock; cards that slide into view
            // underneath (when the top one is played) do not.
            flyFromStock={t.dealt && isTop}
            onTap={(ts) => t.tapTop('waste', ts)}
            style={{ top: 0, zIndex: i, left: `calc(var(--kw) * ${(top - i) * 0.08})` }}
          />
        );
      })}
    </PileShell>
  );
}

/* ----------------------------------------------------------- foundation */

export function Foundation({ suit }: { suit: Suit }) {
  const t = useTable();
  const { state, coachMode, highlight, suggestion, selection } = t;
  const id = foundationId(suit);
  const cards = state.foundations[suit];
  const shown = cards.slice(-2);
  const selectedHere = selection?.source.kind === 'foundation' && selection.source.suit === suit;
  const canMove = coachMode && !selection && anyStartsWith(highlight, `move:f${suit}>`);
  const receives = useReceives(id);
  const suggestedFrom = suggestion?.from === id;
  const suggestedTo = suggestion?.to === id;
  const notes = useNotes(id, {
    selectedHere,
    isTarget: selection !== null && !selectedHere,
    canMove,
    canReceive: receives,
  });
  const complete = cards.length === 13;
  return (
    <PileShell
      id={id}
      label={foundationLabel(state, suit)}
      description={notes || undefined}
      highlighted={receives}
      suggested={suggestedTo}
      selected={selectedHere}
      droppable
      testId={`klondike-foundation-${suit}`}
      onClick={() => t.activate(id)}
      style={{ ...CARD_BOX, aspectRatio: '5 / 7' }}
    >
      <EmptySlot className="absolute inset-0">
        <SuitIcon suit={suit} size={22} className="opacity-45" />
      </EmptySlot>
      {shown.map((code, i) =>
        i === shown.length - 1 ? (
          <DragCard
            key={code}
            code={code}
            source={{ kind: 'foundation', suit }}
            selected={selectedHere}
            highlighted={canMove}
            suggested={suggestedFrom}
            onTap={(ts) => t.tapTop(id, ts)}
            className={complete ? 'drop-shadow-[0_0_10px_rgb(245_215_122/0.75)]' : undefined}
            style={{ top: 0, zIndex: i + 1 }}
          />
        ) : (
          <span
            key={code}
            aria-hidden="true"
            className="absolute top-0 left-0 block"
            style={{ ...CARD_BOX, zIndex: i + 1 }}
          >
            <PlayingCard code={code} size={t.cardSize} decorative style={CARD_BOX} />
          </span>
        ),
      )}
    </PileShell>
  );
}

/* --------------------------------------------------------------- column */

export function Column({ pile }: { pile: number }) {
  const t = useTable();
  const { state, coachMode, highlight, suggestion, selection, revealAll } = t;
  const id = columnId(pile);
  const p = state.tableau[pile] ?? { faceDown: [], faceUp: [] };
  const steps = cascadeSteps(p);
  const height = cascadeHeight(p);
  const selectedHere = selection?.source.kind === 'tableau' && selection.source.pile === pile;
  const selectedFrom =
    selectedHere && selection.source.kind === 'tableau' ? selection.source.index : null;
  const receives = useReceives(id);
  const canMove = coachMode && !selection && anyStartsWith(highlight, `move:t${pile}.`);
  const notes = useNotes(id, {
    selectedHere,
    isTarget: selection !== null && !selectedHere,
    canMove,
    canReceive: receives,
  });
  const suggestedTo = suggestion?.to === id;
  const suggestedFrom = suggestion?.from === id ? suggestion.index : null;
  const downTop = kw(p.faceDown.length * steps.down);
  // The card that just turned over (by the last move, from this column) flips where it lies.
  const flippedNow =
    t.dealt &&
    state.last?.from === 'tableau' &&
    state.last.fromPile === pile &&
    p.faceUp.length > 0 &&
    state.lastFlipped === p.faceUp[0];

  const cardAt = (index: number): ReactNode => {
    const code = p.faceUp[index];
    if (code === undefined) return null;
    const source: KlondikeSource = { kind: 'tableau', pile, index };
    return (
      <DragCard
        key={code}
        code={code}
        source={source}
        selected={selectedFrom !== null && index >= selectedFrom}
        highlighted={canMove && anyStartsWith(highlight, sourcePrefix(source))}
        suggested={suggestedFrom !== null && index >= suggestedFrom}
        flyFromStock={!t.dealt}
        flyDelay={dealOrder(pile, p.faceDown.length + index) * DEAL_STAGGER}
        flipIn={index === 0 && flippedNow}
        onTap={(ts) => t.tapCard(pile, index, ts)}
        style={{ top: index === 0 ? downTop : kw(steps.up), zIndex: 1 }}
      >
        {cardAt(index + 1)}
      </DragCard>
    );
  };

  return (
    <PileShell
      id={id}
      label={columnLabel(state, pile, revealAll)}
      description={notes || undefined}
      highlighted={receives}
      suggested={suggestedTo}
      selected={selectedHere}
      droppable
      testId={`klondike-col-${pile}`}
      onClick={() => t.activate(id)}
      style={{ ...CARD_BOX, minHeight: `calc(${CARD_HEIGHT} + ${kw(height)})` }}
    >
      {p.faceDown.length === 0 && p.faceUp.length === 0 ? (
        <EmptySlot>
          <span className="font-display text-gold-300/55 text-[0.8rem] font-bold sm:text-lg">
            K
          </span>
        </EmptySlot>
      ) : null}
      {p.faceDown.map((code, i) => (
        <FaceDownCard
          // Index keys: a face-down card's identity must never depend on its hidden code.
          key={i}
          order={dealOrder(pile, i)}
          top={kw(i * steps.down)}
          reveal={revealAll ? code : null}
          onTap={() => t.tapFaceDown(pile)}
          testId={`klondike-facedown-${pile}-${i}`}
        />
      ))}
      {cardAt(0)}
    </PileShell>
  );
}

/** Position of a column card in the opening deal (row by row, left to right). */
function dealOrder(pile: number, row: number): number {
  let n = 0;
  for (let r = 0; r < row; r++) n += 7 - r;
  return n + (pile - row);
}

/** Seconds between cards of the opening deal. */
const DEAL_STAGGER = 0.03;

function FaceDownCard({
  order,
  top,
  reveal,
  onTap,
  testId,
}: {
  order: number;
  top: string;
  /** The card's code once the game is over (shown dimmed); null while it is hidden. */
  reveal: StandardCard | null;
  onTap: () => void;
  testId: string;
}) {
  const t = useTable();
  const { scope: flyScope, flying } = useFlyIn<HTMLSpanElement>({
    from: t.stockRef,
    enabled: !t.dealt,
    delay: order * DEAL_STAGGER,
  });
  return (
    <span
      data-testid={testId}
      className="absolute left-0 block"
      style={{ top, ...CARD_BOX }}
      onClick={(e) => {
        e.stopPropagation();
        onTap();
      }}
    >
      <span ref={flyScope} className="block" style={flying ? { opacity: 0 } : undefined}>
        {reveal ? (
          <PlayingCard code={reveal} size={t.cardSize} dimmed decorative style={CARD_BOX} />
        ) : (
          <CardBack style={CARD_BOX} />
        )}
      </span>
    </span>
  );
}
