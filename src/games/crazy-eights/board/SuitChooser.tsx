'use client';
/**
 * The suit chooser that opens when the learner plays an Eight: four big suit buttons
 * (shape + name + how many of that suit they still hold), keyboard and screen-reader
 * friendly. It is an inline panel just above the hand rather than a modal, so the pile
 * and the hand stay in view while the learner decides.
 *
 * Keys: focus starts on the coach's pick (or Spades); ←/→/↑/↓ move between suits,
 * Enter/Space or S/H/D/C name one, Esc goes back to the hand.
 */
import { motion } from 'motion/react';
import { useEffect, useId, useRef, type KeyboardEvent } from 'react';
import { SuitIcon } from '@/components/cards';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { cardShort, SUIT_NAMES, type CardCode, type Suit } from '@/games/core/cards';
import { t } from '@/games/crazy-eights/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { CHOOSER_SUITS, heldOfSuit, keyOf, playMove } from './shared';

export interface SuitChooserProps {
  eight: CardCode;
  hand: readonly CardCode[];
  coachMode: boolean;
  highlight: ReadonlySet<string>;
  suggestedKey: string | null;
  onPick: (suit: Suit) => void;
  onCancel: () => void;
}

export function SuitChooser({
  eight,
  hand,
  coachMode,
  highlight,
  suggestedKey,
  onPick,
  onCancel,
}: SuitChooserProps) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const titleId = `${ids}-title`;
  const leadId = `${ids}-lead`;
  const pickId = `${ids}-pick`;
  const refs = useRef(new Map<Suit, HTMLButtonElement>());
  const pickedSuit = CHOOSER_SUITS.find((s) => suggestedKey === keyOf(playMove(eight, s)));

  // Opening the chooser moves focus into it: onto the coach's pick, or the first suit.
  const firstFocus = pickedSuit ?? CHOOSER_SUITS[0];
  useEffect(() => {
    if (firstFocus) refs.current.get(firstFocus)?.focus();
    // Only when the chooser opens (or the coach's pick changes).
  }, [firstFocus]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
      return;
    }
    const delta =
      e.key === 'ArrowRight' || e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowLeft' || e.key === 'ArrowUp'
          ? -1
          : 0;
    if (delta === 0) return;
    const current = CHOOSER_SUITS.findIndex((s) => refs.current.get(s) === document.activeElement);
    const n = CHOOSER_SUITS.length;
    const next = CHOOSER_SUITS[((current < 0 ? 0 : current + delta) + n) % n];
    if (!next) return;
    e.preventDefault();
    refs.current.get(next)?.focus();
  };

  return (
    <motion.div
      role="group"
      aria-labelledby={titleId}
      aria-describedby={leadId}
      data-testid="c8-suit-chooser"
      data-card={eight}
      onKeyDown={onKeyDown}
      initial={reduced ? false : { opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 28 }}
      className="border-gold-300/70 relative mx-auto flex w-full max-w-[34rem] flex-col gap-3 rounded-2xl border bg-[linear-gradient(180deg,rgb(3_17_11/0.92),rgb(6_36_23/0.95))] px-3 pt-3 pb-3 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.95),0_0_0_1px_rgb(245_215_122/0.2)] sm:px-4"
    >
      <span
        aria-hidden="true"
        className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-6 top-0 h-3 opacity-40"
      />
      <div className="flex flex-col gap-0.5 pt-1 text-center">
        <p
          id={titleId}
          className="font-display text-foil text-lg leading-tight font-bold sm:text-xl"
        >
          {t('crazyEights.chooser.title')}
        </p>
        <p id={leadId} className="text-cream text-sm leading-snug">
          {t('crazyEights.chooser.lead', { card: cardShort(eight) })}
          {coachMode ? <span className="text-mist"> {t('crazyEights.chooser.hint')}</span> : null}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {CHOOSER_SUITS.map((suit) => {
          const held = heldOfSuit(hand, eight, suit);
          const glow = coachMode && highlight.has(keyOf(playMove(eight, suit)));
          const suggested = pickedSuit === suit;
          return (
            <button
              key={suit}
              ref={(el) => {
                if (el) refs.current.set(suit, el);
                else refs.current.delete(suit);
              }}
              type="button"
              data-testid={`c8-suit-${suit}`}
              data-highlighted={glow || undefined}
              data-suggested={suggested || undefined}
              aria-label={t('crazyEights.chooser.suitLabel', {
                suit: SUIT_NAMES[suit],
                held:
                  held === 1
                    ? t('crazyEights.chooser.youHoldOne')
                    : t('crazyEights.chooser.youHold', { n: held }),
              })}
              aria-describedby={suggested ? pickId : undefined}
              aria-keyshortcuts={suit}
              onClick={() => onPick(suit)}
              className={cn(
                'group/suit ease-snap relative flex min-h-[5.25rem] flex-col items-center justify-center gap-0.5 rounded-xl border-2 bg-[linear-gradient(180deg,#fffaf0,#efe4c8)] px-2 py-2 text-center shadow-[inset_0_1px_0_rgb(255_255_255/0.8),0_10px_20px_-12px_rgb(0_0_0/0.9)] transition-[transform,filter,box-shadow] duration-150 select-none hover:-translate-y-0.5 hover:brightness-105 active:translate-y-px',
                suggested ? 'border-gold-200' : 'border-gold-500/60',
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
                    {t('crazyEights.chooser.pick')}
                  </span>
                </>
              ) : null}
              <SuitIcon
                suit={suit}
                size={34}
                className="transition-transform duration-150 group-hover/suit:scale-110"
              />
              <span className="text-ink text-sm leading-tight font-extrabold">
                {SUIT_NAMES[suit]}
              </span>
              <span aria-hidden="true" className="text-ink/65 text-[0.6875rem] font-semibold">
                {held === 1
                  ? t('crazyEights.chooser.youHoldOne')
                  : t('crazyEights.chooser.youHold', { n: held })}
              </span>
              <kbd
                aria-hidden="true"
                className="border-ink/25 text-ink/60 absolute top-1 right-1 hidden size-5 items-center justify-center rounded border font-sans text-[0.625rem] font-bold pointer-fine:inline-flex"
              >
                {suit}
              </kbd>
            </button>
          );
        })}
      </div>
      <span id={pickId} className="sr-only">
        {t('crazyEights.chooser.suggested')}
      </span>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} data-testid="c8-suit-cancel">
          {t('crazyEights.chooser.cancel')}
        </Button>
        <p aria-hidden="true" className="text-mist hidden text-xs pointer-fine:block">
          {t('crazyEights.chooser.keys')}
        </p>
      </div>
    </motion.div>
  );
}
