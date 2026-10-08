'use client';
/**
 * The learner's controls: one big gold Flip button (F, Space or Enter) and an Auto-flip
 * convenience that plays the next 10 battles one Flip at a time (A). Both keep focus while
 * busy — they carry aria-disabled, never `disabled` — so keyboard users never lose their
 * place, and presses are simply ignored until it's time to flip again.
 */
import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { t } from '@/games/war/i18n';
import { useReducedMotionPref } from '@/lib/motion';

export type WarAction = 'flip' | 'auto';

const ICON_PROPS = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

function FlipIcon() {
  return (
    <svg {...ICON_PROPS} width={26} height={26}>
      <rect x={2.5} y={5} width={9} height={13} rx={1.6} transform="rotate(-10 7 11.5)" />
      <rect x={12.5} y={5} width={9} height={13} rx={1.6} transform="rotate(10 17 11.5)" />
      <path d="M9 2.8c2-1 4-1 6 0M15 2.8l-.6-1.6M15 2.8l-1.7.3" />
    </svg>
  );
}

function AutoIcon({ running }: { running: boolean }) {
  return running ? (
    <svg {...ICON_PROPS} width={20} height={20}>
      <rect x={6} y={6} width={12} height={12} rx={2} />
    </svg>
  ) : (
    <svg {...ICON_PROPS} width={20} height={20}>
      <path d="M5 5.5l7 6.5-7 6.5zM12 5.5l7 6.5-7 6.5z" />
    </svg>
  );
}

export function ActionBar({
  busy,
  busyReason,
  canFlip,
  coachMode,
  highlighted,
  suggested,
  autoRunning,
  flash,
  onPress,
}: {
  busy: boolean;
  busyReason: string;
  /** Flip is a legal move right now. */
  canFlip: boolean;
  coachMode: boolean;
  /** The coach highlights Flip (its moveKey is in `highlight`). */
  highlighted: boolean;
  /** Flip is the coach's pick (`suggestedKey`). */
  suggested: boolean;
  autoRunning: boolean;
  flash: WarAction | null;
  onPress: (action: WarAction) => void;
}) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const busyId = `${ids}-busy`;
  const flipHintId = `${ids}-flip-hint`;
  const autoHintId = `${ids}-auto-hint`;
  const suggestedId = `${ids}-suggested`;
  const glow = coachMode && !busy && highlighted;
  const pick = !busy && suggested;

  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-2 pt-1">
      <div
        role="group"
        aria-label={t('war.actions.label')}
        data-testid="war-actions"
        className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:gap-3"
      >
        <button
          type="button"
          data-testid="war-flip"
          data-legal={canFlip || undefined}
          data-highlighted={glow || undefined}
          data-suggested={pick || undefined}
          data-pressed={flash === 'flip' || undefined}
          aria-label={t('war.actions.flip')}
          aria-keyshortcuts="F Space Enter"
          aria-disabled={busy || undefined}
          aria-describedby={[flipHintId, busy ? busyId : null, pick ? suggestedId : null]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onPress('flip')}
          className={cn(
            'ease-snap relative flex min-h-[4.5rem] min-w-0 items-center justify-center gap-3 rounded-2xl border px-4 py-2 transition-[transform,filter,opacity] duration-150 select-none sm:min-h-20',
            busy
              ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
              : 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_12px_26px_-12px_rgb(236_193_83/0.95)] hover:brightness-[1.06] active:translate-y-px',
            flash === 'flip' && 'translate-y-px brightness-110',
          )}
        >
          {glow && !pick ? (
            <span
              aria-hidden="true"
              className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[1.1rem]"
            />
          ) : null}
          {pick ? (
            <>
              <motion.span
                aria-hidden="true"
                data-testid="war-suggested-ring"
                className="pointer-events-none absolute -inset-1 rounded-[1.2rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
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
                {t('war.actions.pick')}
              </span>
            </>
          ) : null}
          <FlipIcon />
          <span className="flex flex-col items-start text-left">
            <span className="font-display text-xl leading-none font-extrabold tracking-[0.08em] uppercase sm:text-2xl">
              {t('war.actions.flip')}
            </span>
            <span
              id={flipHintId}
              className={cn(
                'text-[0.6875rem] leading-tight font-semibold sm:text-xs',
                busy ? 'text-mist' : 'text-ink/75',
              )}
            >
              {t('war.actions.flipHint')}
            </span>
          </span>
          <kbd
            aria-hidden="true"
            className={cn(
              'absolute top-1.5 right-1.5 hidden size-5 items-center justify-center rounded border font-sans text-[0.625rem] leading-none font-bold pointer-fine:inline-flex',
              busy ? 'border-gold-300/40 text-gold-200/80' : 'border-ink/30 text-ink/70',
            )}
          >
            F
          </kbd>
        </button>

        <button
          type="button"
          data-testid="war-auto"
          data-running={autoRunning || undefined}
          data-pressed={flash === 'auto' || undefined}
          aria-pressed={autoRunning}
          aria-label={autoRunning ? t('war.actions.stop') : t('war.actions.auto')}
          aria-keyshortcuts="A"
          aria-disabled={(busy && !autoRunning) || undefined}
          aria-describedby={[autoHintId, busy && !autoRunning ? busyId : null]
            .filter(Boolean)
            .join(' ')}
          onClick={() => onPress('auto')}
          className={cn(
            'ease-snap relative flex min-h-[4.5rem] min-w-[5.5rem] flex-col items-center justify-center gap-0.5 rounded-2xl border px-2.5 py-2 text-center transition-[transform,background-color,border-color,opacity] duration-150 select-none max-[359px]:max-w-[6.5rem] sm:min-h-20 sm:min-w-28',
            busy && !autoRunning
              ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
              : autoRunning
                ? 'border-gold-200 bg-felt-950/75 text-gold-100 shadow-[inset_0_0_0_1px_rgb(245_215_122/0.5)]'
                : 'border-gold-300/45 bg-felt-950/45 text-gold-200 hover:border-gold-300/75 hover:bg-felt-950/65 active:translate-y-px',
            flash === 'auto' && 'translate-y-px',
          )}
        >
          <AutoIcon running={autoRunning} />
          <span className="text-sm leading-tight font-extrabold">
            {autoRunning ? t('war.actions.stop') : t('war.actions.auto')}
          </span>
          <span id={autoHintId} className="text-mist text-[0.625rem] leading-tight font-semibold">
            {autoRunning ? t('war.actions.stopHint') : t('war.actions.autoHint')}
          </span>
          <kbd
            aria-hidden="true"
            className="border-gold-300/40 text-gold-200/80 absolute top-1 right-1 hidden size-4 items-center justify-center rounded border font-sans text-[0.5625rem] leading-none font-bold pointer-fine:inline-flex"
          >
            A
          </kbd>
        </button>
      </div>
      <span id={busyId} className="sr-only">
        {busyReason}
      </span>
      <span id={suggestedId} className="sr-only">
        {t('war.actions.suggested')}
      </span>
      <p
        data-testid="war-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('war.actions.keys')}:</span>
        <span className="inline-flex items-center gap-1">
          <Kbd>F</Kbd>
          <Kbd>{t('war.actions.keySpace')}</Kbd>
          {t('war.actions.flip')}
        </span>
        <span className="inline-flex items-center gap-1">
          <Kbd>A</Kbd>
          {t('war.actions.autoKey')}
        </span>
      </p>
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
      {children}
    </kbd>
  );
}
