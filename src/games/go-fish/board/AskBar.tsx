'use client';
/**
 * The Ask bar: one big button whose label is the sentence you are about to say — "Ask
 * Kanta Kaka for Sevens" — once you have picked a player and a rank. Until then it says
 * what is still missing, looks secondary and carries aria-disabled, but it stays pressable
 * (the coach explains what an ask needs). "Use the coach's pick" fills in the suggestion.
 */
import { motion } from 'motion/react';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { SuggestedRing } from './Seats';

export interface AskBarProps {
  /** "Ask Kanta Kaka for Sevens", or null while a player or rank is missing. */
  sentence: string | null;
  /** What is still missing (shown in place of the sentence). */
  missing: string;
  busy: boolean;
  busyReason: string;
  glow: boolean;
  suggested: boolean;
  /** The coach has a pick that differs from the current selection. */
  canUsePick: boolean;
  onAsk: () => void;
  onUsePick: () => void;
  ids: { busy: string; suggested: string; incomplete: string };
}

export function AskBar({
  sentence,
  missing,
  busy,
  busyReason,
  glow,
  suggested,
  canUsePick,
  onAsk,
  onUsePick,
  ids,
}: AskBarProps) {
  const reduced = useReducedMotionPref();
  const ready = sentence !== null;
  const describedBy = [
    busy ? ids.busy : !ready ? ids.incomplete : null,
    suggested && !busy ? ids.suggested : null,
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="mx-auto flex w-full max-w-[34rem] flex-col items-stretch gap-2">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          data-testid="gofish-ask"
          data-ready={ready || undefined}
          data-highlighted={glow || undefined}
          data-suggested={suggested || undefined}
          aria-disabled={busy || !ready || undefined}
          aria-describedby={describedBy || undefined}
          onClick={onAsk}
          className={cn(
            'ease-snap relative flex min-h-14 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none active:translate-y-px',
            busy
              ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
              : ready
                ? 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06]'
                : 'border-gold-300/40 bg-felt-950/45 text-gold-200 hover:border-gold-300/70',
          )}
        >
          {glow && !suggested ? (
            <span
              aria-hidden="true"
              className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
            />
          ) : null}
          {suggested ? <SuggestedRing testId="gofish-ask-ring" /> : null}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width={22}
            height={22}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M4 5h16v10H9l-5 4z" />
            <path d="M10.5 9a1.75 1.75 0 1 1 2.6 1.5c-.7.4-1.1.8-1.1 1.5" />
          </svg>
          <span
            data-testid="gofish-preview"
            className={cn(
              'text-[0.9375rem] leading-tight font-extrabold sm:text-base',
              !ready && 'font-bold',
            )}
          >
            {sentence ?? missing}
          </span>
        </button>
      </div>
      {canUsePick && !busy ? (
        <motion.button
          type="button"
          data-testid="gofish-use-pick"
          onClick={onUsePick}
          initial={reduced ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="border-gold-300/50 text-gold-100 hover:bg-gold-300/10 mx-auto inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold"
        >
          <SparkleIcon size={14} />
          {t('goFish.ask.usePick')}
        </motion.button>
      ) : null}
      <span id={ids.busy} className="sr-only">
        {busyReason}
      </span>
      <span id={ids.incomplete} className="sr-only">
        {t('goFish.ask.incomplete')}
      </span>
      <span id={ids.suggested} className="sr-only">
        {t('goFish.ask.suggested')}
      </span>
      <p
        data-testid="gofish-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('goFish.ask.keys')}:</span>
        <span>{t('goFish.ask.keyArrows')}</span>
        <span>{t('goFish.ask.keyEnter')}</span>
        <span>{t('goFish.ask.keyRanks')}</span>
      </p>
    </div>
  );
}
