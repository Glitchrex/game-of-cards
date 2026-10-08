'use client';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type FocusEvent,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { type CardCode } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { PlayingCard } from './PlayingCard';
import { CARD_WIDTHS, type CardSize } from './sizes';
import { cardCountText, cardKeys, fanPose, fanSpill, rowLayout } from './layout';

export type HandLayout = 'fan' | 'row' | 'overlap';
export type DealDirection = 'top' | 'bottom' | 'left' | 'right';

export interface HandProps {
  cards: CardCode[];
  /** Accessible name, e.g. "Your hand". */
  label: string;
  /** Called when a card is clicked/tapped or activated with Enter/Space. */
  onActivate?: (code: CardCode, index: number) => void;
  /** Cards for which this returns false are marked "can't be played" (and dimmed). */
  playable?: (code: CardCode, index: number) => boolean;
  /** Dim non-playable cards (default true). */
  dimUnplayable?: boolean;
  /** Indexes with a gold glow (e.g. legal moves in coach mode). */
  highlighted?: ReadonlySet<number>;
  /** Index of the coach's suggested card. */
  suggested?: number | null;
  /** Indexes that are selected (raised). Providing this exposes aria-pressed. */
  selected?: ReadonlySet<number>;
  layout?: HandLayout;
  size?: CardSize;
  /** Opponent's hand: render backs and announce the count. */
  faceDown?: boolean;
  /** Where the cards fly in from when dealt. */
  dealFrom?: DealDirection;
  /** Busy (e.g. a bot is thinking): cards stay focusable but ignore activation. */
  disabled?: boolean;
  fourColor?: boolean;
  className?: string;
  'data-testid'?: string;
}

const DEAL_OFFSET: Record<DealDirection, { x: string; y: string; rotate: number }> = {
  top: { x: '0%', y: '-170%', rotate: -10 },
  bottom: { x: '0%', y: '170%', rotate: 10 },
  left: { x: '-260%', y: '0%', rotate: -14 },
  right: { x: '260%', y: '0%', rotate: 14 },
};

const GAP: Record<HandLayout, (w: string) => string> = {
  row: () => '6px',
  overlap: (w) => `calc(-0.42 * ${w})`,
  fan: (w) => `calc(-0.5 * ${w})`,
};

/**
 * A hand of cards. Interactive hands are a single tab stop (roving tabindex):
 * ←/→ or ↑/↓ move between cards, Home/End jump to the ends and Enter/Space
 * activates. Cards deal in with a stagger and re-flow with layout animation.
 */
export function Hand({
  cards,
  label,
  onActivate,
  playable,
  dimUnplayable = true,
  highlighted,
  suggested = null,
  selected,
  layout = 'overlap',
  size = 'md',
  faceDown = false,
  dealFrom = 'top',
  disabled = false,
  fourColor,
  className,
  'data-testid': testId,
}: HandProps) {
  const reduced = useReducedMotionPref();
  const n = cards.length;
  const keys = cardKeys(cards);
  const interactive = Boolean(onActivate);
  // Track the focused card by key so the tab stop follows it when other cards
  // come and go; fall back to its old position when it leaves the hand.
  const [focus, setFocus] = useState<{ key: string | null; index: number }>({
    key: null,
    index: 0,
  });
  const [hasFocus, setHasFocus] = useState(false);
  // Only keyboard focus lifts a card above its neighbours: a tapped or clicked card that
  // rose to the top would cover the next cards' visible strips in an overlapping hand.
  const [keyboardFocus, setKeyboardFocus] = useState(false);
  const arrowing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  // Stagger only the opening deal; cards that arrive later fly in straight away.
  const [dealing, setDealing] = useState(true);
  const found = focus.key ? keys.indexOf(focus.key) : -1;
  const current = n === 0 ? -1 : found >= 0 ? found : Math.min(focus.index, n - 1);
  const initialCount = useState(n)[0];

  // ~70 ms per card, but a big hand never takes longer than ~0.6 s to deal.
  const stagger = Math.min(0.07, 0.6 / Math.max(initialCount, 1));

  useEffect(() => {
    const id = window.setTimeout(() => setDealing(false), initialCount * stagger * 1000 + 500);
    return () => window.clearTimeout(id);
  }, [initialCount, stagger]);

  // When the focused card leaves (e.g. it was played), keep focus in the hand.
  const keyList = keys.join('|');
  useLayoutEffect(() => {
    if (!interactive || !hasFocus) return;
    const active = document.activeElement;
    const liveEls = keyList ? keyList.split('|').map((k) => cardRefs.current.get(k)) : [];
    if (active && liveEls.includes(active as HTMLElement)) return;
    const target = current >= 0 ? liveEls[current] : undefined;
    if (target) target.focus();
    else setHasFocus(false);
  }, [keyList, current, interactive, hasFocus]);

  const focusAt = (i: number) => {
    const key = keys[i];
    const el = key ? cardRefs.current.get(key) : undefined;
    setFocus({ key: key ?? null, index: i });
    el?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!interactive || n === 0) return;
    setKeyboardFocus(true);
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = Math.min(current + 1, n - 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = Math.max(current - 1, 0);
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = n - 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    arrowing.current = true;
    focusAt(next);
    arrowing.current = false;
  };

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const holder = (e.target as HTMLElement).closest<HTMLElement>('[data-hand-index]');
    const idx = holder ? Number(holder.dataset.handIndex) : NaN;
    if (!Number.isNaN(idx)) setFocus({ key: keys[idx] ?? null, index: idx });
    setHasFocus(true);
    setKeyboardFocus(arrowing.current || isFocusVisible(e.target));
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    if (!containerRef.current?.contains(e.relatedTarget as Node | null)) setHasFocus(false);
  };

  const width = CARD_WIDTHS[size];
  const row = rowLayout(
    n,
    width,
    GAP[layout](width),
    layout === 'row' ? 0.36 : 0.3,
    layout === 'fan' ? fanSpill(n) : 0,
  );
  const ariaLabel = faceDown
    ? t('primer.cards.handCount', { label, count: cardCountText(n) })
    : label;
  // Interactive: a toolbar of card buttons. Display-only: a list of named cards,
  // or — for face-down hands — one image whose name carries only the count.
  const role = interactive ? 'toolbar' : faceDown ? 'img' : 'list';
  const unplayableText = t('primer.cards.unplayable');
  const deal = DEAL_OFFSET[dealFrom];

  return (
    <div
      ref={containerRef}
      role={role}
      aria-label={ariaLabel}
      aria-orientation={interactive ? 'horizontal' : undefined}
      aria-disabled={interactive && disabled ? true : undefined}
      data-testid={testId}
      onKeyDown={onKeyDown}
      onFocus={interactive ? onFocus : undefined}
      onBlur={interactive ? onBlur : undefined}
      onPointerDown={interactive ? () => setKeyboardFocus(false) : undefined}
      className={`relative mx-auto flex items-end justify-center ${className ?? ''}`}
      style={{
        ...row.container,
        paddingTop: `calc(${width} * 0.32)`,
        paddingBottom: layout === 'fan' ? `calc(${width} * 0.16)` : undefined,
        minHeight: `calc(${width} * 1.72)`,
      }}
    >
      <AnimatePresence initial={!reduced} mode="popLayout">
        {cards.map((code, i) => {
          const key = keys[i] ?? `${code}~${i}`;
          const pose = layout === 'fan' ? fanPose(i, n) : { rotate: 0, y: '0%' };
          const canPlay = playable ? playable(code, i) : true;
          const delay = dealing && !reduced ? i * stagger : 0;
          // The keyboard-focused card rises above its neighbours so its whole face
          // and focus ring are visible in an overlapping hand.
          const focused = interactive && hasFocus && keyboardFocus && current === i;
          return (
            <motion.div
              key={key}
              data-hand-index={i}
              role={role === 'list' ? 'listitem' : undefined}
              layout={reduced ? false : 'position'}
              initial={reduced ? false : { opacity: 0, x: deal.x, y: deal.y, rotate: deal.rotate }}
              animate={{ opacity: 1, x: '0%', y: pose.y, rotate: pose.rotate }}
              exit={
                reduced
                  ? { opacity: 0, transition: { duration: 0 } }
                  : { opacity: 0, y: '-45%', scale: 0.92, transition: { duration: 0.18 } }
              }
              transition={
                reduced
                  ? { duration: 0 }
                  : { type: 'spring', stiffness: 380, damping: 32, mass: 0.8, delay }
              }
              className="relative shrink-0"
              style={{
                marginInlineStart: row.margin(i),
                originX: 0.5,
                originY: 1,
                zIndex: focused ? n + 1 : i,
              }}
            >
              <PlayingCard
                ref={(el: HTMLElement | null) => {
                  if (el) cardRefs.current.set(key, el);
                  else cardRefs.current.delete(key);
                }}
                code={code}
                size={size}
                faceDown={faceDown}
                flipDelay={reduced ? 0 : Math.min(i * 0.05, 0.4)}
                fourColor={fourColor}
                decorative={faceDown && !interactive}
                ariaLabel={
                  faceDown && interactive
                    ? t('primer.cards.faceDownN', { n: i + 1, count: n })
                    : undefined
                }
                ariaDescription={canPlay ? undefined : unplayableText}
                highlighted={highlighted?.has(i) ?? false}
                suggested={suggested === i}
                selected={selected ? selected.has(i) : undefined}
                dimmed={dimUnplayable && !canPlay}
                disabled={disabled}
                lifted={focused}
                tabIndex={interactive ? (current === i ? 0 : -1) : undefined}
                onClick={onActivate ? () => onActivate(code, i) : undefined}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/** Whether the browser shows a focus ring for this focus (keyboard), not a tap or click. */
function isFocusVisible(el: Element): boolean {
  try {
    return el.matches(':focus-visible');
  } catch {
    return true;
  }
}
