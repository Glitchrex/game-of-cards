import { type ReactNode } from 'react';
import { cn } from './cn';

export type ProgressTone = 'gold' | 'felt' | 'velvet';

export interface ProgressBarProps {
  value: number;
  /** Default 100. */
  max?: number;
  /** Accessible name (also shown above the bar when `showLabel`). */
  label: string;
  /** Human-friendly value, e.g. "Step 3 of 8". Defaults to a percentage. */
  valueText?: string;
  /** Render the label and value text visibly above the bar. */
  showLabel?: boolean;
  /** Extra content on the right side of the label row. */
  aside?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  tone?: ProgressTone;
  className?: string;
}

const heights = { sm: 'h-1.5', md: 'h-2.5', lg: 'h-3.5' } as const;

const fills: Record<ProgressTone, string> = {
  gold: 'bg-[linear-gradient(90deg,var(--color-gold-500),var(--color-gold-300)_70%,var(--color-gold-100))] shadow-[0_0_12px_rgb(245_215_122/0.45)]',
  felt: 'bg-[linear-gradient(90deg,var(--color-felt-500),var(--color-felt-400))]',
  velvet: 'bg-[linear-gradient(90deg,var(--color-velvet-600),var(--color-velvet-400))]',
};

/** Determinate progress bar (role="progressbar" with aria-valuenow/min/max). */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  showLabel = false,
  aside,
  size = 'md',
  tone = 'gold',
  className,
}: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.max(0, Math.min(safeMax, value));
  const pct = (clamped / safeMax) * 100;
  const text = valueText ?? `${Math.round(pct)}%`;
  return (
    <div className={cn('w-full', className)}>
      {showLabel ? (
        <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
          <span className="text-cream font-semibold">{label}</span>
          <span className="flex items-center gap-2">
            <span className="tabular text-mist">{text}</span>
            {aside}
          </span>
        </div>
      ) : null}
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={safeMax}
        aria-valuetext={text}
        className={cn(
          'bg-felt-950/70 ring-gold-300/15 relative w-full overflow-hidden rounded-full shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)] ring-1',
          heights[size],
        )}
      >
        <div
          className={cn(
            'ease-glide h-full rounded-full transition-[width] duration-500',
            fills[tone],
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
