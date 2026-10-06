'use client';
/**
 * The passing step: a counter of picked cards, the big "Pass 3 cards left" button, the
 * coach's suggested three (with a one-press "Pick these 3"), and — once the learner has
 * passed — the three cards on their way to the next player.
 *
 * The Pass button never uses the real `disabled` attribute: with the wrong number of cards
 * picked it looks secondary and carries aria-disabled, but still calls `onPass`, so the
 * coach can explain why (the engine's "Pick exactly 3 cards" reason).
 */
import { motion } from 'motion/react';
import { useId, useRef } from 'react';
import { PlayingCard } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { CheckIcon, SparkleIcon } from '@/components/ui/icons';
import { type CardCode } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { PASS_SIZE } from '../rules';
import { cardList } from './shared';

const MINI_W = 'clamp(30px, 8.5vw, 40px)';

export interface PassBarProps {
  picked: readonly CardCode[];
  /** Name of the player who receives the learner's cards. */
  targetName: string;
  /** "left" / "right" / "across". */
  direction: string;
  busy: boolean;
  /** Wording for screen readers while busy. */
  busyReason: string;
  /** The learner's own passed cards, once chosen (in transit until everyone has passed). */
  sent: readonly CardCode[] | null;
  /** Coach mode and the picked cards are a legal pass: the button glows. */
  glow: boolean;
  /** The coach's suggested pass (after "What would a pro do?"). */
  suggestion: readonly CardCode[] | null;
  /** The picked cards are exactly the coach's suggestion: the button pulses. */
  suggested: boolean;
  onPass: () => void;
  onUseSuggestion: () => void;
  onButtonFocus: (focused: boolean) => void;
}

export function PassBar({
  picked,
  targetName,
  direction,
  busy,
  busyReason,
  sent,
  glow,
  suggestion,
  suggested,
  onPass,
  onUseSuggestion,
  onButtonFocus,
}: PassBarProps) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const passRef = useRef<HTMLButtonElement>(null);
  const n = picked.length;
  const ready = n === PASS_SIZE && !busy;
  const describedBy = [
    `${ids}-to`,
    busy ? `${ids}-busy` : n !== PASS_SIZE ? `${ids}-not-ready` : null,
    suggested && !busy ? `${ids}-suggested` : null,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      role="group"
      aria-label={t('hearts.pass.label')}
      data-testid="hearts-pass-bar"
      className="mx-auto flex w-full max-w-[34rem] flex-col items-center gap-2"
    >
      {sent ? (
        <div
          role="group"
          aria-label={`${t('hearts.pass.sent', { name: targetName })}: ${cardList(sent)}`}
          data-testid="hearts-passed"
          className="border-gold-300/30 bg-felt-950/50 flex items-center gap-2.5 rounded-xl border px-3 py-1.5"
        >
          <div className="flex items-center">
            {sent.map((c, i) => (
              <motion.span
                key={c}
                className="inline-flex"
                style={{ marginInlineStart: i === 0 ? undefined : `calc(-0.35 * ${MINI_W})` }}
                initial={reduced ? false : { opacity: 0, y: 24, rotate: -8 }}
                animate={{ opacity: 1, y: 0, rotate: (i - 1) * 6 }}
                transition={reduced ? { duration: 0 } : { delay: i * 0.06, duration: 0.35 }}
              >
                <PlayingCard code={c} decorative style={{ width: MINI_W }} />
              </motion.span>
            ))}
          </div>
          <div className="text-start">
            <p className="text-gold-100 text-sm font-bold">
              {t('hearts.pass.sent', { name: targetName })}
            </p>
            <p className="text-mist text-xs">{t('hearts.pass.sentHint')}</p>
          </div>
        </div>
      ) : null}

      {suggestion && !sent ? (
        <div
          data-testid="hearts-pass-suggestion"
          className="border-gold-200/70 bg-felt-950/55 relative flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-1.5 rounded-xl border px-3 py-2"
        >
          <p className="text-gold-100 inline-flex items-center gap-1.5 text-sm font-semibold">
            <SparkleIcon size={14} className="text-gold-300" />
            {t('hearts.pass.coachPicks', { cards: cardList(suggestion) })}
          </p>
          <button
            type="button"
            data-testid="hearts-pass-pick"
            onClick={() => {
              onUseSuggestion();
              // Passing is the next step — and this button goes away once the cards are sent.
              passRef.current?.focus();
            }}
            className="border-gold-200/70 text-gold-100 hover:bg-gold-300/15 relative inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold"
          >
            {suggested ? <CheckIcon size={16} /> : null}
            {t('hearts.pass.usePick')}
          </button>
        </div>
      ) : null}

      <div className="flex w-full items-stretch gap-2">
        <div
          data-testid="hearts-pass-count"
          data-count={n}
          className="border-gold-300/30 bg-felt-950/55 flex min-w-[5.5rem] flex-col items-center justify-center gap-1 rounded-xl border px-2 py-1.5"
        >
          <span aria-hidden="true" className="flex gap-1">
            {Array.from({ length: PASS_SIZE }, (_, i) => (
              <motion.span
                key={i}
                className={cn(
                  'block size-2.5 rounded-full border',
                  i < n
                    ? 'border-gold-200 bg-gold-300 shadow-[0_0_8px_rgb(245_215_122/0.8)]'
                    : 'border-gold-300/40',
                )}
                animate={reduced ? undefined : { scale: i < n ? [1.5, 1] : 1 }}
                transition={{ duration: 0.25 }}
              />
            ))}
          </span>
          <span className="text-gold-100 text-xs font-bold whitespace-nowrap">
            {t('hearts.pass.picked', { n })}
          </span>
        </div>
        <button
          ref={passRef}
          type="button"
          data-testid="hearts-pass"
          data-ready={ready || undefined}
          data-highlighted={(glow && !busy) || undefined}
          data-suggested={(suggested && !busy) || undefined}
          aria-keyshortcuts="P"
          aria-disabled={busy || n !== PASS_SIZE || undefined}
          aria-describedby={describedBy}
          onClick={onPass}
          onFocus={() => onButtonFocus(true)}
          onBlur={() => onButtonFocus(false)}
          className={cn(
            'ease-snap relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border px-3 py-2 text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none',
            busy
              ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-70'
              : ready
                ? 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px'
                : 'border-gold-300/40 bg-felt-950/45 text-gold-200 hover:border-gold-300/70 active:translate-y-px',
          )}
        >
          {glow && !busy && !suggested ? (
            <span
              aria-hidden="true"
              className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
            />
          ) : null}
          {suggested && !busy ? (
            <>
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute -inset-1 rounded-[0.95rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
                animate={
                  reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.03, 1] }
                }
                transition={
                  reduced ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
                }
              />
              <span
                aria-hidden="true"
                className="bg-gold-200 text-ink absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
              >
                <SparkleIcon size={9} />
                {t('hearts.pass.pick')}
              </span>
            </>
          ) : null}
          <span className="text-base leading-tight font-extrabold">
            {t('hearts.pass.button', { direction })}
          </span>
          <span
            id={`${ids}-to`}
            className={cn(
              'text-xs leading-tight font-semibold',
              ready ? 'text-ink/75' : 'text-mist',
            )}
          >
            {t('hearts.pass.to', { name: targetName })}
          </span>
          <kbd
            aria-hidden="true"
            className={cn(
              'absolute top-1 right-1 hidden size-5 items-center justify-center rounded border font-sans text-[0.625rem] leading-none font-bold pointer-fine:inline-flex',
              ready ? 'border-ink/30 text-ink/70' : 'border-gold-300/40 text-gold-200/80',
            )}
          >
            P
          </kbd>
        </button>
      </div>
      <p className="text-mist text-center text-xs">
        {sent ? t('hearts.pass.wait') : t('hearts.pass.hint')}
      </p>
      <span id={`${ids}-busy`} className="sr-only">
        {busyReason}
      </span>
      <span id={`${ids}-not-ready`} className="sr-only">
        {t('hearts.pass.notReady')}
      </span>
      <span id={`${ids}-suggested`} className="sr-only">
        {t('hearts.pass.suggested')}
      </span>
    </div>
  );
}
