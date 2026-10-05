import { cn } from './cn';

export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  size?: SpinnerSize;
  /** When set, the spinner is announced (role="status") with this text. */
  label?: string;
  className?: string;
}

const px: Record<SpinnerSize, number> = { sm: 16, md: 24, lg: 40 };

/** A gold "poker chip" spinner. Decorative unless `label` is given. */
export function Spinner({ size = 'md', label, className }: SpinnerProps) {
  const s = px[size];
  const svg = (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={cn('animate-spin', className)}
    >
      <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.22" strokeWidth="3" />
      <path
        d="M21.5 12A9.5 9.5 0 0 0 12 2.5"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="2.2" fill="currentColor" fillOpacity="0.6" />
    </svg>
  );
  if (!label) return svg;
  return (
    <span role="status" className="inline-flex items-center">
      {svg}
      <span className="sr-only">{label}</span>
    </span>
  );
}
