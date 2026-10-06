'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { AlertIcon, ChevronDownIcon, SparkleIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { BotAvatar } from './BotAvatar';
import { COACH_PERSONA } from './personas';

export interface CoachPanelProps {
  /** Panel heading (default "Coach"). */
  title?: string;
  /** What is happening right now, in plain words. */
  situation: ReactNode;
  /** Extra explanation shown under the situation (e.g. feedback on a decision). */
  why?: ReactNode | null;
  /** The "Why can't I do that?" reason for an illegal move — shown prominently. */
  error?: string | null;
  /**
   * Changes whenever a new error is raised (e.g. the controller's `errorSeq`), so that
   * repeating the same mistake is announced again. Optional.
   */
  errorKey?: string | number;
  /** Shows the "What would a pro do?" button. */
  onHint?: () => void;
  hintLabel?: string;
  /** The revealed pro hint (shown in a gold box, announced politely). */
  hintRevealed?: ReactNode | null;
  /** Buttons shown at the bottom of the panel (e.g. "Next", "Try again"). */
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/**
 * The brass "Coach" panel used by coached practice hands and scripted examples.
 * Desktop: a sticky side panel (the parent puts it in a side column). Mobile: it sits
 * in the normal flow BELOW the table (so it never covers the action buttons) and can
 * be collapsed to a single header line; an illegal-move error always stays visible.
 */
export function CoachPanel({
  title,
  situation,
  why,
  error,
  errorKey,
  onHint,
  hintLabel,
  hintRevealed,
  actions,
  children,
  className,
}: CoachPanelProps) {
  const [open, setOpen] = useState(true);
  const reduce = useReducedMotionPref();
  const headingId = useId();
  const bodyId = useId();
  const heading = title ?? t('play.coach.title');

  return (
    <aside
      aria-labelledby={headingId}
      data-testid="coach-panel"
      className={cn(
        'panel relative flex flex-col gap-4 overflow-hidden p-4 sm:p-5 lg:sticky lg:top-24',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-gold-300),transparent)]"
      />
      <header className="flex items-center gap-3">
        <BotAvatar persona={COACH_PERSONA} size="sm" decorative />
        <div className="min-w-0 flex-1">
          <p className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.2em] uppercase">
            {t('play.coach.eyebrow')}
          </p>
          <h2 id={headingId} className="font-display text-gold-100 text-xl leading-tight font-bold">
            {heading}
          </h2>
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="text-gold-200 hover:bg-gold-300/10 inline-flex min-h-11 items-center gap-1 rounded-lg px-2.5 text-sm font-semibold lg:hidden"
        >
          <span>{open ? t('play.coach.hide') : t('play.coach.show')}</span>
          <ChevronDownIcon
            size={18}
            className={cn('transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </header>

      {error ? (
        <motion.div
          key={errorKey ?? error}
          role="alert"
          data-testid="coach-error"
          initial={reduce ? false : { opacity: 0, x: -8 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, x: [0, -5, 5, -3, 0] }}
          transition={{ duration: reduce ? 0 : 0.4 }}
          className="border-velvet-400/80 bg-velvet-700/55 text-cream relative flex items-start gap-2.5 rounded-xl border border-l-4 px-3.5 py-3 shadow-[0_10px_24px_-14px_rgb(194_47_71/0.9)]"
        >
          <AlertIcon size={20} className="text-velvet-300 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-velvet-300 text-xs font-bold tracking-[0.16em] uppercase">
              {t('play.coach.errorTitle')}
            </p>
            <p className="mt-0.5 text-[0.9375rem] leading-snug font-medium">{error}</p>
          </div>
        </motion.div>
      ) : null}

      <div id={bodyId} className={cn('flex flex-col gap-4', !open && 'max-lg:hidden')}>
        <div className="text-cream text-[0.9375rem] leading-relaxed" data-testid="coach-situation">
          {situation}
        </div>

        {why ? (
          <div className="border-gold-300/20 bg-felt-950/35 rounded-xl border px-3.5 py-3">
            <p className="text-gold-300 text-xs font-bold tracking-[0.16em] uppercase">
              {t('play.coach.why')}
            </p>
            <div className="text-mist mt-1 text-sm leading-relaxed">{why}</div>
          </div>
        ) : null}

        {onHint ? (
          <Button
            variant="secondary"
            onClick={onHint}
            data-testid="coach-hint"
            leadingIcon={<SparkleIcon size={18} />}
            className="self-start"
          >
            {hintLabel ?? t('play.coach.hint')}
          </Button>
        ) : null}

        {/* Always mounted so screen readers announce the hint when it appears. */}
        <div aria-live="polite">
          <AnimatePresence initial={false}>
            {hintRevealed ? (
              <motion.div
                key="hint"
                data-testid="coach-hint-text"
                initial={reduce ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4 }}
                transition={{ duration: reduce ? 0 : 0.25 }}
                className="border-gold-300/60 bg-gold-300/10 rounded-xl border px-3.5 py-3 shadow-[0_0_20px_-8px_rgb(245_215_122/0.7)]"
              >
                <p className="text-gold-200 flex items-center gap-1.5 text-xs font-bold tracking-[0.16em] uppercase">
                  <SparkleIcon size={14} />
                  {t('play.coach.hintTitle')}
                </p>
                <div className="text-cream mt-1 text-[0.9375rem] leading-relaxed">
                  {hintRevealed}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {children}

        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </aside>
  );
}
