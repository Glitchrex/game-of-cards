/**
 * Learning-status visuals shared by the journey map and the stats table. A status is
 * never shown by colour alone: every badge pairs an icon with its text label.
 */
import { cn } from '@/components/ui/cn';
import { BookIcon, CheckIcon, StarIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { type LearnStatus } from '@/store/progress';

export function statusLabel(status: LearnStatus): string {
  return t(`journey.status.${status}`);
}

/** A dashed ring: "nothing here yet". */
function NotStartedIcon({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle
        cx="12"
        cy="12"
        r="7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="3 3.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface StatusIconProps {
  status: LearnStatus;
  size?: number;
  className?: string;
}

/** Decorative icon for a status (the caller always renders the text label too). */
export function StatusIcon({ status, size = 16, className }: StatusIconProps) {
  if (status === 'mastered') return <StarIcon size={size} className={className} />;
  if (status === 'learned') return <CheckIcon size={size} className={className} />;
  if (status === 'learning') return <BookIcon size={size} className={className} />;
  return <NotStartedIcon size={size} className={className} />;
}

const BADGE_TONES: Record<LearnStatus, string> = {
  'not-started': 'border-mist/30 bg-felt-950/60 text-mist',
  learning: 'border-gold-300 bg-felt-950/40 text-gold-200',
  learned: 'border-gold-200/70 bg-gold-300 text-ink',
  mastered:
    'border-gold-100 bg-[linear-gradient(180deg,var(--color-gold-100),var(--color-gold-300)_55%,var(--color-gold-500))] text-ink shadow-[0_0_14px_-2px_rgb(245_215_122/0.7)]',
};

export interface StatusBadgeProps {
  status: LearnStatus;
  className?: string;
  'data-testid'?: string;
}

/** Pill with icon + label, e.g. "★ Mastered". */
export function StatusBadge({ status, className, 'data-testid': testId }: StatusBadgeProps) {
  return (
    <span
      data-testid={testId}
      data-status={status}
      className={cn(
        'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs leading-none font-bold whitespace-nowrap',
        BADGE_TONES[status],
        className,
      )}
    >
      <StatusIcon status={status} size={14} className="shrink-0" />
      <span>{statusLabel(status)}</span>
    </span>
  );
}
