'use client';
/**
 * Discard / Declare / Drop. Unavailable actions look secondary and carry aria-disabled, but
 * stay focusable and still call their handler, so the coach can explain why not (the Board
 * only blocks presses while it isn't the learner's turn). Coach mode: legal actions glow,
 * the coach's pick pulses.
 */
import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';

export type ActionId = 'discard' | 'declare' | 'drop';

export interface ActionView {
  id: ActionId;
  /** Short visible label ("Discard"). */
  label: string;
  /** Full accessible name ("Discard K♦"). */
  name: string;
  hint: string;
  /** Shortcut key shown on the button (also aria-keyshortcuts). */
  shortcut?: string;
  legal: boolean;
  glow: boolean;
  suggested: boolean;
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

export const ACTION_ICONS: Record<ActionId, ReactNode> = {
  discard: (
    <svg {...ICON_PROPS}>
      <rect x={4} y={3} width={11} height={15} rx={2} />
      <path d="M17 15.5l3 3m0 0l-3 3m3-3h-7" />
    </svg>
  ),
  declare: (
    <svg {...ICON_PROPS}>
      <rect x={2.5} y={6} width={8} height={12} rx={1.5} transform="rotate(-10 6.5 12)" />
      <rect x={8} y={5} width={8} height={12} rx={1.5} />
      <rect x={13.5} y={6} width={8} height={12} rx={1.5} transform="rotate(10 17.5 12)" />
    </svg>
  ),
  drop: (
    <svg {...ICON_PROPS}>
      <path d="M5 4h9l-1.5 4L14 12H5" />
      <path d="M5 4v17" />
    </svg>
  ),
};

export function ActionBar({
  actions,
  busy,
  busyReason,
  onPress,
}: {
  actions: readonly ActionView[];
  busy: boolean;
  busyReason: string;
  onPress: (id: ActionId) => void;
}) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const busyId = `${ids}-busy`;
  const unavailableId = `${ids}-unavailable`;
  const suggestedId = `${ids}-suggested`;
  return (
    <>
      <div
        role="group"
        aria-label={t('indianRummy.actions.label')}
        data-testid="rummy-actions"
        className="grid grid-cols-3 gap-1.5 sm:gap-3"
      >
        {actions.map((a) => {
          const unavailable = !busy && !a.legal;
          const glow = !busy && a.glow;
          const suggested = !busy && a.suggested;
          const hintId = `${ids}-${a.id}-hint`;
          const describedBy = [
            hintId,
            busy ? busyId : unavailable ? unavailableId : null,
            suggested ? suggestedId : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={a.id}
              type="button"
              data-testid={`rummy-${a.id}`}
              data-legal={a.legal || undefined}
              data-highlighted={glow || undefined}
              data-suggested={suggested || undefined}
              aria-label={a.name}
              aria-keyshortcuts={a.shortcut}
              aria-disabled={busy || unavailable || undefined}
              aria-describedby={describedBy}
              onClick={() => onPress(a.id)}
              className={cn(
                'ease-snap relative flex min-h-16 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none sm:min-h-[4.5rem]',
                busy
                  ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
                  : a.legal && a.id === 'drop'
                    ? // Giving up is always available before the first draw, but it is never
                      // the move a beginner should reach for: available, not golden.
                      'border-velvet-300/70 bg-velvet-600/35 text-cream hover:border-velvet-300 hover:bg-velvet-600/55 active:translate-y-px'
                    : a.legal
                      ? 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px'
                      : 'border-gold-300/40 bg-felt-950/45 text-gold-200 hover:border-gold-300/70 hover:bg-felt-950/65 active:translate-y-px',
                a.id === 'drop' && !busy && !a.legal && 'opacity-80',
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
                    data-testid="rummy-suggested-ring"
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
                    {t('indianRummy.actions.pick')}
                  </span>
                </>
              ) : null}
              <span aria-hidden="true" className="inline-flex">
                {ACTION_ICONS[a.id]}
              </span>
              <span className="text-[0.9375rem] leading-tight font-extrabold sm:text-base">
                {a.label}
              </span>
              <span
                id={hintId}
                className={cn(
                  'max-w-full truncate text-[0.625rem] leading-tight font-semibold sm:text-xs',
                  a.legal && !busy
                    ? a.id === 'drop'
                      ? 'text-cream/85'
                      : 'text-ink/75'
                    : 'text-mist',
                )}
              >
                {a.hint}
              </span>
              {a.shortcut ? (
                <kbd
                  aria-hidden="true"
                  className={cn(
                    'absolute top-1 right-1 hidden size-4 items-center justify-center rounded border font-sans text-[0.5625rem] leading-none font-bold sm:size-5 sm:text-[0.625rem] pointer-fine:inline-flex',
                    a.legal && !busy
                      ? 'border-ink/30 text-ink/70'
                      : 'border-gold-300/40 text-gold-200/80',
                  )}
                >
                  {a.shortcut}
                </kbd>
              ) : null}
            </button>
          );
        })}
      </div>
      <span id={busyId} className="sr-only">
        {busyReason}
      </span>
      <span id={unavailableId} className="sr-only">
        {t('indianRummy.actions.unavailable')}
      </span>
      <span id={suggestedId} className="sr-only">
        {t('indianRummy.actions.suggested')}
      </span>
    </>
  );
}
