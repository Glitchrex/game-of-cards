'use client';
import { t } from '@/lib/i18n';

export interface ProgressBarProps {
  /** 1-based current step (may equal `total` when finished). */
  current: number;
  total: number;
  /** All steps done (the finish screen). */
  complete?: boolean;
  className?: string;
}

/** Marquee-bulb progress: one bulb per step, lit up to the current one. */
export function ProgressBar({ current, total, complete = false, className }: ProgressBarProps) {
  const text = t('primer.stepOf', { current, total });
  return (
    <div className={className}>
      <div
        role="progressbar"
        aria-label={t('primer.progressLabel')}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current}
        aria-valuetext={text}
        className="flex items-center gap-1.5"
      >
        {Array.from({ length: total }, (_, i) => {
          const lit = complete || i < current;
          const now = !complete && i === current - 1;
          return (
            <span
              key={i}
              aria-hidden="true"
              className={`relative h-2 flex-1 rounded-full transition-colors duration-300 ${
                lit
                  ? 'bg-gold-300 shadow-[0_0_10px_1px_rgb(245_215_122/0.55)]'
                  : 'bg-felt-950/70 ring-gold-300/20 ring-1'
              }`}
            >
              {now && (
                <span className="animate-bulb bg-gold-100/70 absolute inset-0 rounded-full" />
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
