'use client';
/**
 * The bidding step: a radio group of bids from Nil (0) to 13, and the big "Bid" button.
 *
 * - The radio group is one tab stop (roving tabindex): ←/→/↑/↓ move and select, Home/End
 *   jump to Nil / 13, Enter or Space selects the focused bid. Digits 0–9 pick a bid from
 *   anywhere on the page and B submits (the Board's window listener).
 * - The Bid button never uses the real `disabled` attribute: with nothing picked, or while
 *   another player bids, it looks secondary and carries aria-disabled but keeps focus.
 * - Coach mode: the selected bid's button glows; the coach's pick pulses on its number,
 *   a "Suggested: 3" chip picks it in one press, and the Bid button pulses once it is
 *   selected.
 */
import { motion } from 'motion/react';
import { useId, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/components/ui/cn';
import { CheckIcon, SparkleIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { MAX_BID, NIL } from '../rules';
import { bidWords } from './shared';

const BIDS = Array.from({ length: MAX_BID + 1 }, (_, n) => n);

export const bidKey = (n: number) => `bid:${n}`;

export interface BidPickerProps {
  selected: number | null;
  onSelect: (bid: number) => void;
  onSubmit: () => void;
  /** Not the learner's turn to bid (presses on Bid are ignored; picking still works). */
  busy: boolean;
  busyReason: string;
  coachMode: boolean;
  highlight: ReadonlySet<string>;
  suggestedKey: string | null;
}

export function BidPicker({
  selected,
  onSelect,
  onSubmit,
  busy,
  busyReason,
  coachMode,
  highlight,
  suggestedKey,
}: BidPickerProps) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const suggestedBid =
    suggestedKey !== null && suggestedKey.startsWith('bid:') ? Number(suggestedKey.slice(4)) : null;
  const tabStop = selected ?? suggestedBid ?? 0;
  const ready = selected !== null && !busy;
  const selectedKey = selected === null ? null : bidKey(selected);
  const glow = coachMode && !busy && selectedKey !== null && highlight.has(selectedKey);
  const pulse = !busy && selectedKey !== null && selectedKey === suggestedKey;
  // The hint line ("Pick a number first" / "Lock in your bid") is part of the button's
  // name already, so the description only adds what the name doesn't say.
  const describedBy = [
    busy ? `${ids}-busy` : selected === null ? `${ids}-not-ready` : null,
    pulse ? `${ids}-suggested` : null,
  ]
    .filter(Boolean)
    .join(' ');

  const move = (to: number) => {
    const n = Math.max(0, Math.min(MAX_BID, to));
    onSelect(n);
    refs.current[n]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const from = selected ?? tabStop;
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        next = from >= MAX_BID ? 0 : from + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        next = from <= 0 ? MAX_BID : from - 1;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = MAX_BID;
        break;
      default:
        return;
    }
    e.preventDefault();
    e.stopPropagation();
    move(next);
  };

  return (
    <div
      data-testid="spades-bidding"
      className="mx-auto flex w-full max-w-[34rem] flex-col items-stretch gap-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-1">
        <p id={`${ids}-legend`} className="text-gold-100 text-sm font-bold">
          {t('spades.picker.legend')}
        </p>
        <p className="text-mist text-xs">{t('spades.picker.nilHint')}</p>
      </div>
      <div
        role="radiogroup"
        aria-labelledby={`${ids}-legend`}
        data-testid="spades-bid-options"
        onKeyDown={onKeyDown}
        className="grid grid-cols-7 gap-1 sm:gap-1.5"
      >
        {BIDS.map((n) => {
          const checked = selected === n;
          const lit = coachMode && highlight.has(bidKey(n));
          const pick = suggestedBid === n;
          return (
            <button
              key={n}
              ref={(el) => {
                refs.current[n] = el;
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={n === NIL ? t('spades.picker.nilName') : bidWords(n)}
              aria-describedby={pick ? `${ids}-suggested` : undefined}
              tabIndex={n === tabStop ? 0 : -1}
              data-testid={`spades-bid-${n}`}
              data-highlighted={lit || undefined}
              data-suggested={pick || undefined}
              onClick={() => move(n)}
              className={cn(
                'ease-snap tabular relative flex min-h-11 min-w-0 items-center justify-center rounded-lg border text-base font-extrabold transition-[transform,background-color,border-color,box-shadow] duration-150 select-none active:translate-y-px sm:min-h-12',
                checked
                  ? 'border-gold-100 text-ink bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),0_8px_18px_-10px_rgb(236_193_83/0.95)]'
                  : 'border-gold-300/35 bg-felt-950/55 text-gold-100 hover:border-gold-300/70 hover:bg-felt-950/75',
                lit && !checked && 'border-gold-300/60',
                n === NIL && 'text-[0.8125rem] tracking-wide',
              )}
            >
              {pick ? (
                <motion.span
                  aria-hidden="true"
                  data-testid="spades-bid-ring"
                  className="pointer-events-none absolute -inset-1 rounded-[0.7rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_20px_4px_rgb(245_215_122/0.85)]"
                  animate={
                    reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.06, 1] }
                  }
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
                  }
                />
              ) : null}
              <span aria-hidden="true">{n === NIL ? t('spades.bid.nil') : n}</span>
            </button>
          );
        })}
      </div>

      {suggestedBid !== null ? (
        <button
          type="button"
          data-testid="spades-bid-suggestion"
          data-bid={suggestedBid}
          onClick={() => move(suggestedBid)}
          className="border-gold-200/70 bg-felt-950/55 text-gold-100 hover:bg-gold-300/15 mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold"
        >
          {selected === suggestedBid ? (
            <CheckIcon size={16} />
          ) : (
            <SparkleIcon size={14} className="text-gold-300" />
          )}
          {t('spades.picker.coachSuggests', { bid: bidWords(suggestedBid) })}
        </button>
      ) : null}

      <button
        type="button"
        data-testid="spades-bid-submit"
        data-bid={selected ?? undefined}
        data-ready={ready || undefined}
        data-highlighted={glow || undefined}
        data-suggested={pulse || undefined}
        aria-keyshortcuts="B"
        aria-disabled={!ready || undefined}
        aria-describedby={describedBy || undefined}
        onClick={onSubmit}
        className={cn(
          'ease-snap relative flex min-h-14 w-full flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none',
          busy
            ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-70'
            : ready
              ? 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px'
              : 'border-gold-300/40 bg-felt-950/45 text-gold-200 hover:border-gold-300/70 active:translate-y-px',
        )}
      >
        {glow && !pulse ? (
          <span
            aria-hidden="true"
            className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
          />
        ) : null}
        {pulse ? (
          <>
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-1 rounded-[0.95rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
              animate={reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.02, 1] }}
              transition={
                reduced ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
              }
            />
            <span
              aria-hidden="true"
              className="bg-gold-200 text-ink absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
            >
              <SparkleIcon size={9} />
              {t('spades.picker.pick')}
            </span>
          </>
        ) : null}
        <span className="text-base leading-tight font-extrabold">
          {selected === null
            ? t('spades.picker.submitEmpty')
            : t('spades.picker.submit', { bid: bidWords(selected) })}
        </span>{' '}
        <span
          id={`${ids}-hint`}
          className={cn('text-xs leading-tight font-semibold', ready ? 'text-ink/75' : 'text-mist')}
        >
          {selected === null ? t('spades.picker.submitHint') : t('spades.picker.submitHintReady')}
        </span>
        <kbd
          aria-hidden="true"
          className={cn(
            'absolute top-1 right-1 hidden size-5 items-center justify-center rounded border font-sans text-[0.625rem] leading-none font-bold pointer-fine:inline-flex',
            ready ? 'border-ink/30 text-ink/70' : 'border-gold-300/40 text-gold-200/80',
          )}
        >
          B
        </kbd>
      </button>
      <span id={`${ids}-busy`} className="sr-only">
        {busyReason}
      </span>
      <span id={`${ids}-not-ready`} className="sr-only">
        {t('spades.picker.notReady')}
      </span>
      <span id={`${ids}-suggested`} className="sr-only">
        {t('spades.picker.suggested')}
      </span>
    </div>
  );
}
