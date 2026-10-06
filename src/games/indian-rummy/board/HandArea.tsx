'use client';
/**
 * The learner's hand, laid out in labelled groups that wrap onto several rows (14 cards fit
 * at 375 px). The whole hand is ONE tab stop — a roving-tabindex toolbar across every group:
 * ←/→ move card by card, ↑/↓ jump to the previous / next group, Home/End go to the ends,
 * Enter/Space selects a card (press again on the selected card to discard it) and Escape
 * clears the selection. Cards glide to their new group whenever the arrangement changes.
 */
import { LayoutGroup, motion } from 'motion/react';
import {
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { PlayingCard, rowLayout } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { useMediaQuery } from '@/components/ui/hooks';
import { type CardCode } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { groupLabel, groupTitle, isMeld, type DisplayGroup } from './arrange';
import { Flyer } from './Flyer';

/** Card width in the hand: big enough to read, small enough for 14 cards in a few rows. */
export const HAND_CARD_W = 'clamp(46px, 12.4vw, 76px)';
const OVERLAP = `calc(-0.34 * ${HAND_CARD_W})`;

export interface CardArrival {
  from: RefObject<HTMLElement | null>;
  delay: number;
}

export interface HandAreaProps {
  groups: DisplayGroup[];
  label: string;
  selectedKey: string | null;
  /** Key of the card just drawn this turn (gets a "new" tag). */
  drawnKey: string | null;
  /** Cards that arrive in this render and where they fly in from. */
  arrivals: ReadonlyMap<string, CardArrival>;
  /** Ask for focus on this card (after the learner draws it); changes with `focusToken`. */
  focusKey: string | null;
  focusToken: number;
  rootRef: RefObject<HTMLElement | null>;
  isHighlighted: (code: CardCode) => boolean;
  /** The card the coach suggests throwing (its first copy pulses). */
  suggestedCode: CardCode | null;
  onPress: (key: string, code: CardCode) => void;
  onClear: () => void;
  ref?: RefObject<HTMLDivElement | null>;
}

export function HandArea({
  groups,
  label,
  selectedKey,
  drawnKey,
  arrivals,
  focusKey,
  focusToken,
  rootRef,
  isHighlighted,
  suggestedCode,
  onPress,
  onClear,
  ref,
}: HandAreaProps) {
  const reduced = useReducedMotionPref();
  const wide = useMediaQuery('(min-width: 640px)');
  const flat = groups.flatMap((g) => g.cards);
  const keys = flat.map((c) => c.key);
  const [roving, setRoving] = useState<{ key: string | null; index: number }>({
    key: null,
    index: 0,
  });
  const found = roving.key ? keys.indexOf(roving.key) : -1;
  const current =
    flat.length === 0 ? -1 : found >= 0 ? found : Math.min(roving.index, flat.length - 1);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const containerRef = useRef<HTMLDivElement | null>(null);
  /** The learner was working in the hand (focus should survive cards moving between groups). */
  const wantsFocus = useRef(false);

  const focusAt = (i: number) => {
    const key = keys[i];
    if (key === undefined) return;
    setRoving({ key, index: i });
    cardRefs.current.get(key)?.focus();
  };

  // A card that moves to another group remounts there: keep focus on it (or its neighbour).
  const order = keys.join('|');
  useLayoutEffect(() => {
    if (!wantsFocus.current) return;
    const active = document.activeElement;
    if (active && active !== document.body) return;
    const key = current >= 0 ? keys[current] : undefined;
    const el = key ? cardRefs.current.get(key) : undefined;
    if (el) el.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  // After the learner draws, hand them the new card (if they were playing at this table).
  useLayoutEffect(() => {
    if (!focusKey) return;
    const active = document.activeElement;
    const atTable = !active || active === document.body || rootRef.current?.contains(active);
    if (!atTable) return;
    const el = cardRefs.current.get(focusKey);
    if (!el) return;
    wantsFocus.current = true;
    el.focus();
    const i = keys.indexOf(focusKey);
    setRoving({ key: focusKey, index: Math.max(0, i) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusToken]);

  const groupStarts: number[] = [];
  let offset = 0;
  for (const g of groups) {
    groupStarts.push(offset);
    offset += g.cards.length;
  }
  const groupOf = (i: number) => {
    let gi = 0;
    for (let k = 0; k < groupStarts.length; k++) if ((groupStarts[k] ?? 0) <= i) gi = k;
    return gi;
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (flat.length === 0) return;
    const at = Math.max(current, 0);
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
        next = Math.min(at + 1, flat.length - 1);
        break;
      case 'ArrowLeft':
        next = Math.max(at - 1, 0);
        break;
      case 'ArrowDown': {
        const gi = groupOf(at);
        next = groupStarts[Math.min(gi + 1, groups.length - 1)] ?? at;
        break;
      }
      case 'ArrowUp': {
        const gi = groupOf(at);
        const start = groupStarts[gi] ?? 0;
        next = at > start ? start : (groupStarts[Math.max(gi - 1, 0)] ?? 0);
        break;
      }
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = flat.length - 1;
        break;
      case 'Escape':
        if (selectedKey !== null) {
          e.preventDefault();
          onClear();
        }
        return;
      default:
        return;
    }
    e.preventDefault();
    focusAt(next);
  };

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    wantsFocus.current = true;
    const holder = (e.target as HTMLElement).closest<HTMLElement>('[data-card-key]');
    const key = holder?.dataset.cardKey;
    if (key) setRoving({ key, index: keys.indexOf(key) });
  };
  const onBlur = (e: FocusEvent<HTMLDivElement>) => {
    const to = e.relatedTarget as Node | null;
    if (to && !containerRef.current?.contains(to)) wantsFocus.current = false;
  };

  const suggestedIndex = suggestedCode ? flat.findIndex((c) => c.code === suggestedCode) : -1;

  return (
    <div
      ref={(el) => {
        containerRef.current = el;
        if (ref) ref.current = el;
      }}
      role="toolbar"
      aria-label={label}
      aria-orientation="horizontal"
      data-testid="rummy-hand"
      data-count={flat.length}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      className="flex w-full flex-wrap items-end justify-center gap-x-2 gap-y-2.5 sm:gap-x-3"
    >
      <LayoutGroup>
        {groups.map((g, gi) => {
          const row = rowLayout(g.cards.length, HAND_CARD_W, OVERLAP, 0.3);
          const meld = isMeld(g.kind);
          return (
            <div
              key={g.id}
              role="group"
              aria-label={groupLabel(g)}
              data-testid="rummy-group"
              data-kind={g.kind}
              // An explicit width: the card row inside is a size container, which has no
              // intrinsic width of its own to shrink-wrap around.
              style={{ width: `min(100%, calc(${row.natural} + 0.75rem + 2px))` }}
              className={cn(
                'relative flex min-w-0 flex-col items-center gap-1 rounded-xl border px-1.5 pt-1 pb-1.5',
                meld
                  ? g.kind === 'pure-sequence'
                    ? 'border-gold-300/70 bg-gold-300/[0.07] shadow-[0_0_18px_-8px_rgb(245_215_122/0.8)]'
                    : 'border-gold-300/40 bg-felt-950/30'
                  : g.kind === 'unmatched'
                    ? 'border-mist/35 bg-felt-950/20 border-dashed'
                    : 'border-gold-300/20 bg-felt-950/25',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'max-w-full rounded-lg px-1.5 text-center text-[0.625rem] leading-[0.875rem] font-extrabold tracking-[0.06em] uppercase sm:text-[0.6875rem]',
                  meld ? 'bg-gold-300 text-ink' : 'text-mist',
                )}
              >
                {groupTitle(g.kind)}
              </span>
              <div
                className="relative flex items-end justify-center"
                style={{ ...row.container, paddingTop: `calc(${HAND_CARD_W} * 0.2)` }}
              >
                {g.cards.map((c, ci) => {
                  const i = (groupStarts[gi] ?? 0) + ci;
                  const arrival = arrivals.get(c.key) ?? null;
                  const selected = selectedKey === c.key;
                  const focusable = current === i;
                  const descriptions = [
                    c.joker ? t('indianRummy.card.joker') : null,
                    drawnKey === c.key ? t('indianRummy.card.drawn') : null,
                    suggestedIndex === i ? t('indianRummy.card.pick') : null,
                  ].filter(Boolean);
                  return (
                    <motion.div
                      key={c.key}
                      layoutId={reduced ? undefined : `rummy-${c.key}`}
                      layout={reduced ? false : 'position'}
                      transition={
                        reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 36 }
                      }
                      data-card-key={c.key}
                      data-joker={c.joker || undefined}
                      data-selected={selected || undefined}
                      className="relative shrink-0"
                      style={{ marginInlineStart: row.margin(ci), zIndex: selected ? 40 : ci }}
                    >
                      <Flyer from={arrival?.from ?? null} delay={arrival?.delay ?? 0}>
                        {(landed) => (
                          <PlayingCard
                            ref={(el: HTMLElement | null) => {
                              if (el) cardRefs.current.set(c.key, el);
                              else cardRefs.current.delete(c.key);
                            }}
                            code={c.code}
                            faceDown={!landed}
                            size={wide ? 'md' : 'xs'}
                            style={{ width: HAND_CARD_W }}
                            data-testid="rummy-card"
                            selected={selected}
                            highlighted={isHighlighted(c.code)}
                            suggested={suggestedIndex === i}
                            ariaDescription={descriptions.join(', ') || undefined}
                            tabIndex={focusable ? 0 : -1}
                            onClick={() => onPress(c.key, c.code)}
                          />
                        )}
                      </Flyer>
                      {c.joker ? <JokerBadge /> : null}
                      {drawnKey === c.key ? <NewTag /> : null}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </LayoutGroup>
    </div>
  );
}

/** The small gold star with a "J" on every joker (printed or wild). */
function JokerBadge() {
  return (
    <span
      aria-hidden="true"
      data-testid="rummy-joker-badge"
      className="border-gold-100 text-ink pointer-events-none absolute -bottom-1 -left-1 z-50 inline-flex size-[1.15rem] items-center justify-center rounded-full border bg-[radial-gradient(circle_at_35%_30%,var(--color-gold-100),var(--color-gold-400))] text-[0.5625rem] leading-none font-black shadow-[0_2px_6px_rgb(0_0_0/0.6)]"
    >
      ★{t('indianRummy.card.jokerBadge')}
    </span>
  );
}

/** A little tag over the card just drawn this turn. */
function NewTag() {
  return (
    <span
      aria-hidden="true"
      className="bg-velvet-500 text-cream pointer-events-none absolute -top-1 left-1/2 z-50 -translate-x-1/2 rounded-full px-1 text-[0.5rem] leading-3 font-extrabold tracking-wider uppercase shadow"
    >
      {t('indianRummy.card.newTag')}
    </span>
  );
}
