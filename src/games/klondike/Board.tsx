'use client';
/**
 * The Klondike Solitaire table (see ../blackjack/README.md for the Board checklist).
 *
 *   ┌───────────────────────────────────────────────┐
 *   │ (Pinto)  Cards home 14 / 52 · Stake back ×1.35 │  Vegas readout (break-even tick at 11)
 *   │ [stock] [waste]        [♠] [♥] [♦] [♣]        │  top row
 *   │ [c1] [c2] [c3] [c4] [c5] [c6] [c7]            │  seven cascaded columns
 *   │ [ Draw ] [ Send home ] [ Auto-finish ] [Done] │  action bar (D / A)
 *   └───────────────────────────────────────────────┘
 *
 * How the learner moves cards — every path ends in `onMove`, so an illegal attempt is
 * explained by the controller (coach panel / error callout) instead of being blocked here:
 * - Tap (or Enter/Space on) a pile to pick up its top card; tap a deeper face-up card in a
 *   column (or press ↑/↓ while the column is picked) to take a run; then tap (or Enter on) a
 *   column or a foundation to put it there. Tapping the picked pile again, or Esc, cancels.
 * - Mouse / pen: drag a card or a run onto a column or a foundation.
 * - Double-tap a card, or press A, to send it to its foundation. D (or the stock) draws.
 * - ←/→ walk the piles in Tab order (stock, waste, foundations, columns); ↑/↓ hop between
 *   the top row and the columns. Auto-finish sends safe cards home one move at a time.
 *
 * Hidden information never reaches the DOM: face-down column cards are CardBacks, the stock
 * is a stack of backs with a count. When the game is over the columns' face-down cards are
 * shown (dimmed). Announcements of applied moves come from the controller; the Board only
 * announces what it does itself (picking up / putting back cards, auto-finish notes).
 */
import {
  useEffect,
  useEffectEvent,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { announce } from '@/components/layout/LiveAnnouncer';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { useMediaQuery } from '@/components/ui/hooks';
import { SUITS, SUIT_NAMES } from '@/games/core/cards';
import { type BoardProps } from '@/games/core/module';
import { useReducedMotionPref } from '@/lib/motion';
import { actionIcon, ActionBar, Readout, type ActionSpec } from './board/chrome';
import { TableContext, type TableContextValue } from './board/context';
import {
  cardMove,
  columnOf,
  homeMove,
  horizontalNeighbour,
  parsePile,
  pileOfSource,
  PILE_ORDER,
  runText,
  sameSource,
  sourceCards,
  stakeBack,
  stockMove,
  suggestionView,
  suitOfPile,
  targetOf,
  topSource,
  verticalNeighbour,
  type PileId,
  type Selection,
} from './board/model';
import { Column, Foundation, Stock, Waste } from './board/piles';
import { kt } from './board/strings';
import {
  autoFoundationMoves,
  canAutoFinish,
  foundationCount,
  type KlondikeMove,
  type KlondikeSource,
  type KlondikeState,
} from './engine';

export type KlondikeBoardProps = BoardProps<KlondikeState, KlondikeMove>;

/** Two taps on the same card within this many ms send it to its foundation. */
const DOUBLE_TAP_MS = 380;
/** Pause between auto-finish moves (so each card is seen going home). */
const AUTO_STEP_MS = 190;
const AUTO_STEP_REDUCED_MS = 60;
/** Gap between the seven columns. */
const GAP = 'clamp(3px, 1.15cqw, 12px)';

function isTypingTarget(el: Element): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'radio', 'range', 'reset', 'submit'].includes(el.type);
  }
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Klondike's Board. The table remounts for every new deal (so the opening deal animates
 * again when a practice hand restarts): a position with no moves made that is not the one
 * already shown can only be a fresh deal.
 */
export function KlondikeBoard(props: KlondikeBoardProps) {
  const [deal, setDeal] = useState({ state: props.state, n: 0 });
  if (deal.state !== props.state) {
    const fresh = props.state.moveCount === 0 || props.state.moveCount < deal.state.moveCount;
    setDeal({ state: props.state, n: deal.n + (fresh ? 1 : 0) });
  }
  return <KlondikeTable key={deal.n} {...props} />;
}

function KlondikeTable({
  state,
  legalMoves,
  onMove,
  busy,
  coachMode,
  highlight,
  suggestedKey,
  over,
}: KlondikeBoardProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stockRef = useRef<HTMLButtonElement | null>(null);
  const pileEls = useRef(new Map<PileId, HTMLElement>());
  const lastTap = useRef<{ key: string; at: number } | null>(null);
  /** The pile that last had focus ("Send home" sends its top card). Not state: no re-render. */
  const lastFocused = useRef<PileId | null>(null);
  const layoutPrefix = useId();
  const reduced = useReducedMotionPref();
  const wide = useMediaQuery('(min-width: 640px)');
  const fine = useMediaQuery('(pointer: fine)');

  const [rawSelection, setSelection] = useState<Selection | null>(null);
  const [note, setNote] = useState<{ text: string; at: number } | null>(null);
  const [auto, setAuto] = useState<{ end: number } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [dealt, setDealt] = useState(false);

  // The opening deal has been laid out: from now on new cards animate one by one.
  useEffect(() => {
    const id = window.setTimeout(() => setDealt(true), 0);
    return () => window.clearTimeout(id);
  }, []);

  // A selection belongs to the position it was made in; any applied move clears it.
  const selection =
    rawSelection &&
    !busy &&
    rawSelection.at === state.moveCount &&
    sourceCards(state, rawSelection.source).length > 0
      ? rawSelection
      : null;
  const visibleNote = note && note.at === state.moveCount ? note.text : null;
  const suggestion = useMemo(
    () => suggestionView(state, legalMoves, suggestedKey),
    [state, legalMoves, suggestedKey],
  );
  const autoMoves = useMemo(() => (over ? [] : autoFoundationMoves(state)), [state, over]);
  const autoRunning = auto !== null && !busy && state.moveCount < auto.end && autoMoves.length > 0;

  /* ---------------------------------------------------------- actions */

  const say = (text: string) => {
    setNote({ text, at: state.moveCount });
    announce(text);
  };

  const attempt = (move: KlondikeMove) => {
    if (busy) return;
    setAuto(null);
    setSelection(null);
    onMove(move);
  };

  /** `deeper`: ↑/↓ changed how many cards are held — announce just the new run. */
  const pick = (source: KlondikeSource, deeper = false) => {
    const cards = sourceCards(state, source);
    setSelection({ source, at: state.moveCount });
    setNote(null);
    announce(
      deeper
        ? kt('klondike.select.holding', { cards: runText(cards) })
        : source.kind === 'tableau'
          ? kt('klondike.select.pickedFromColumn', { cards: runText(cards), n: source.pile + 1 })
          : kt('klondike.select.picked', { cards: runText(cards) }),
    );
  };

  const putBack = () => {
    setSelection(null);
    announce(kt('klondike.select.cancelled'));
  };

  const activate = (id: PileId) => {
    if (busy) return;
    if (id === 'stock') {
      attempt(stockMove(state));
      return;
    }
    const here = topSource(state, id);
    if (selection) {
      if (pileOfSource(selection.source) === id) {
        putBack();
        return;
      }
      const target = targetOf(id);
      if (target) {
        attempt(cardMove(selection.source, target));
        return;
      }
      // The waste never receives cards: pick up its top card instead.
    }
    if (here) {
      pick(here);
      return;
    }
    const col = columnOf(id);
    const suit = suitOfPile(id);
    if (col !== null) say(kt('klondike.select.emptyColumn', { n: col + 1 }));
    else if (suit) say(kt('klondike.select.emptyFoundation', { suit: SUIT_NAMES[suit] }));
    else say(kt('klondike.select.nothing'));
  };

  /** True (and the card goes home) when this tap is the second of a double-tap. */
  const doubleTap = (key: string, timeStamp: number, source: KlondikeSource): boolean => {
    const prev = lastTap.current;
    lastTap.current = { key, at: timeStamp };
    if (
      prev &&
      prev.key === key &&
      timeStamp - prev.at >= 0 &&
      timeStamp - prev.at < DOUBLE_TAP_MS
    ) {
      lastTap.current = null;
      attempt(homeMove(source));
      return true;
    }
    return false;
  };

  const tapCard = (pile: number, index: number, timeStamp: number) => {
    if (busy) return;
    const source: KlondikeSource = { kind: 'tableau', pile, index };
    const code = state.tableau[pile]?.faceUp[index];
    if (doubleTap(`t${pile}:${code ?? index}`, timeStamp, source)) return;
    if (selection && !(selection.source.kind === 'tableau' && selection.source.pile === pile)) {
      attempt(cardMove(selection.source, { kind: 'tableau', pile }));
      return;
    }
    if (selection && sameSource(selection.source, source)) {
      putBack();
      return;
    }
    pick(source);
  };

  const tapFaceDown = (pile: number) => {
    if (busy) return;
    if (selection && !(selection.source.kind === 'tableau' && selection.source.pile === pile)) {
      attempt(cardMove(selection.source, { kind: 'tableau', pile }));
      return;
    }
    // Face-down cards can't move: let the engine explain why.
    attempt(homeMove({ kind: 'tableau', pile, index: -1 }));
  };

  const tapTop = (id: PileId, timeStamp: number) => {
    if (busy) return;
    const source = topSource(state, id);
    const top = source ? sourceCards(state, source)[0] : undefined;
    const pickedHere = selection !== null && pileOfSource(selection.source) === id;
    // A double-tap sends the card home — unless other cards are picked up, when the tap
    // means "put them here".
    if (
      source &&
      (!selection || pickedHere) &&
      doubleTap(`${id}:${top ?? ''}`, timeStamp, source)
    ) {
      return;
    }
    activate(id);
  };

  const drop = (source: KlondikeSource, targetId: string) => {
    const id = parsePile(targetId);
    const target = id ? targetOf(id) : null;
    if (!id || !target) return;
    if (source.kind === 'tableau' && target.kind === 'tableau' && source.pile === target.pile) {
      return;
    }
    attempt(cardMove(source, target));
  };

  const sendHome = (from: PileId | null) => {
    if (busy) return;
    const source = selection?.source ?? (from ? topSource(state, from) : null);
    if (!source) {
      say(kt('klondike.actions.homeNothing'));
      return;
    }
    attempt(homeMove(source));
  };

  const autoFinish = () => {
    if (busy) return;
    setSelection(null);
    if (autoMoves.length === 0) {
      say(kt('klondike.actions.autoNone'));
      return;
    }
    setAuto({ end: state.moveCount + autoMoves.length });
    announce(kt('klondike.actions.autoRunning'));
  };

  // Auto-finish: one safe move at a time, each after a short pause.
  useEffect(() => {
    if (!autoRunning) return;
    const next = autoMoves[0];
    if (!next) return;
    const id = window.setTimeout(() => onMove(next), reduced ? AUTO_STEP_REDUCED_MS : AUTO_STEP_MS);
    return () => window.clearTimeout(id);
  }, [autoRunning, autoMoves, onMove, reduced]);

  const resign = () => {
    setConfirmOpen(false);
    attempt({ type: 'resign' });
  };

  /* --------------------------------------------------------- keyboard */

  const focusPile = (id: PileId | null) => {
    if (id) pileEls.current.get(id)?.focus();
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target instanceof Element ? e.target.closest('[data-pile]') : null;
    const id = el ? parsePile(el.getAttribute('data-pile') ?? '') : null;
    if (!id) return;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowRight':
        e.preventDefault();
        focusPile(horizontalNeighbour(id, e.key === 'ArrowLeft' ? -1 : 1));
        return;
      case 'Home':
        e.preventDefault();
        focusPile(PILE_ORDER[0] ?? null);
        return;
      case 'End':
        e.preventDefault();
        focusPile(PILE_ORDER[PILE_ORDER.length - 1] ?? null);
        return;
      case 'ArrowUp':
      case 'ArrowDown': {
        e.preventDefault();
        const col = columnOf(id);
        const sel = selection?.source;
        if (col !== null && sel?.kind === 'tableau' && sel.pile === col && !busy) {
          // Choose how deep a run to pick up: ↑ takes one more card, ↓ one fewer.
          const faceUp = state.tableau[col]?.faceUp.length ?? 0;
          const index =
            e.key === 'ArrowUp' ? Math.max(0, sel.index - 1) : Math.min(faceUp - 1, sel.index + 1);
          if (index !== sel.index) pick({ kind: 'tableau', pile: col, index }, true);
          return;
        }
        focusPile(verticalNeighbour(id, e.key === 'ArrowUp' ? 'up' : 'down'));
        return;
      }
    }
  };

  // D draws, A sends home, Esc puts the cards back — anywhere on the page, except while
  // typing or inside another dialog.
  const onShortcut = useEffectEvent((e: KeyboardEvent) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    const key = e.key.toLowerCase();
    if (key !== 'd' && key !== 'a' && key !== 'escape') return;
    const target = e.target instanceof Element ? e.target : null;
    if (target && isTypingTarget(target)) return;
    const dialog = target?.closest('[role="dialog"], [role="alertdialog"], [aria-modal="true"]');
    if (dialog && !dialog.contains(rootRef.current)) return;
    if (key === 'escape') {
      if (!selection) return;
      e.preventDefault();
      putBack();
      return;
    }
    e.preventDefault();
    if (busy) return;
    if (key === 'd') attempt(stockMove(state));
    else {
      // The focused pile's top card (or the picked-up card), when focus is on the table.
      const pileEl = target?.closest('[data-pile]');
      const pile = pileEl ? parsePile(pileEl.getAttribute('data-pile') ?? '') : null;
      sendHome(pile);
    }
  });
  useEffect(() => {
    const listener = (e: KeyboardEvent) => onShortcut(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  /* ------------------------------------------------------------ view */

  const ctx: TableContextValue = {
    state,
    busy,
    over,
    coachMode,
    highlight,
    suggestion,
    selection,
    cardSize: wide ? 'sm' : 'xs',
    revealAll: over,
    dealt,
    dragEnabled: fine,
    layoutPrefix,
    stockRef,
    registerPile: (id) => (el) => {
      if (el) pileEls.current.set(id, el);
      else pileEls.current.delete(id);
    },
    onPileFocus: (id) => {
      lastFocused.current = id;
    },
    activate,
    tapCard,
    tapFaceDown,
    tapTop,
    drop,
    dragStart: () => setSelection(null),
  };

  const home = foundationCount(state);
  const recycle = state.stock.length === 0 && state.waste.length > 0;
  const canDraw = state.stock.length > 0 || recycle;
  const anyHome = [...highlight].some((k) => k.endsWith('>f'));
  const legalHome = legalMoves.some((m) => m.type === 'move' && m.to.kind === 'foundation');
  const suggestedType = suggestion?.move.type;
  const actions: ActionSpec[] = [
    {
      id: 'draw',
      testId: 'klondike-draw',
      label: recycle ? kt('klondike.actions.recycle') : kt('klondike.actions.draw'),
      hint: recycle ? kt('klondike.actions.recycleHint') : kt('klondike.actions.drawHint'),
      icon: actionIcon(recycle ? 'recycle' : 'draw'),
      shortcut: 'D',
      available: canDraw,
      glow: coachMode && (highlight.has('draw') || highlight.has('recycle')),
      suggested: suggestedType === 'draw' || suggestedType === 'recycle',
      onPress: () => activate('stock'),
    },
    {
      id: 'home',
      testId: 'klondike-home',
      label: kt('klondike.actions.home'),
      hint: kt('klondike.actions.homeHint'),
      icon: actionIcon('home'),
      shortcut: 'A',
      available: legalHome,
      glow: coachMode && anyHome,
      suggested: false,
      onPress: () => sendHome(lastFocused.current),
    },
    {
      id: 'auto',
      testId: 'klondike-autofinish',
      label: kt('klondike.actions.auto'),
      hint: canAutoFinish(state) ? kt('klondike.actions.autoAll') : kt('klondike.actions.autoHint'),
      icon: actionIcon('auto'),
      available: autoMoves.length > 0,
      glow: coachMode && canAutoFinish(state),
      suggested: false,
      onPress: autoFinish,
    },
    {
      id: 'resign',
      testId: 'klondike-resign',
      label: kt('klondike.actions.resign'),
      hint: kt('klondike.actions.resignHint'),
      icon: actionIcon('resign'),
      // Always legal (so never announced as unavailable), but never styled as the glowing
      // "go on, do it" option unless it is the coach's pick.
      available: true,
      quiet: true,
      glow: false,
      suggested: suggestedType === 'resign',
      onPress: () => {
        if (!busy) setConfirmOpen(true);
      },
    },
  ];

  return (
    <TableContext value={ctx}>
      <div
        ref={rootRef}
        data-testid="klondike-board"
        data-over={over || undefined}
        data-selected={selection ? 'true' : undefined}
        onKeyDown={onKeyDown}
        className="relative flex flex-col gap-3 sm:gap-4"
        style={{ containerType: 'inline-size' }}
      >
        <Readout home={home} recycles={state.recycles} cleared={home === 52} />

        <div
          className="flex flex-col gap-3 sm:gap-5"
          style={{
            ['--kg' as string]: GAP,
            ['--kw' as string]: `min(calc((100cqw - 6 * ${GAP}) / 7), 100px)`,
          }}
        >
          <div
            role="group"
            aria-label={kt('klondike.zone.topRow')}
            className="mx-auto grid w-fit grid-cols-7 items-start"
            style={{ columnGap: 'var(--kg)' }}
          >
            <Stock />
            <Waste />
            <span aria-hidden="true" />
            {SUITS.map((suit) => (
              <Foundation key={suit} suit={suit} />
            ))}
          </div>

          <div
            role="group"
            aria-label={kt('klondike.zone.tableau')}
            className="mx-auto grid w-fit grid-cols-7 items-start pt-1"
            style={{ columnGap: 'var(--kg)' }}
          >
            {state.tableau.map((_, pile) => (
              <Column key={pile} pile={pile} />
            ))}
          </div>
        </div>

        <p
          data-testid="klondike-note"
          aria-hidden="true"
          className="text-mist min-h-5 text-center text-sm leading-snug"
        >
          {visibleNote ?? (selection ? runText(sourceCards(state, selection.source)) : null)}
        </p>

        <ActionBar
          actions={actions}
          busy={busy}
          busyReason={over ? kt('klondike.actions.over') : kt('klondike.actions.wait')}
        />

        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={kt('klondike.resign.title')}
          description={
            home > 0
              ? kt('klondike.resign.body', {
                  home: home === 1 ? '1 card' : `${home} cards`,
                  n: stakeBack(home),
                })
              : kt('klondike.resign.bodyNone')
          }
          size="sm"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => setConfirmOpen(false)}
                data-testid="klondike-resign-cancel"
              >
                {kt('klondike.resign.cancel')}
              </Button>
              <Button variant="danger" onClick={resign} data-testid="klondike-resign-confirm">
                {kt('klondike.resign.confirm')}
              </Button>
            </>
          }
        />
      </div>
    </TableContext>
  );
}
