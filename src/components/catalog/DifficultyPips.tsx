import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';

export interface DifficultyPipsProps {
  /** 1–5. */
  value: number;
  size?: 'sm' | 'md';
  className?: string;
}

/** Five diamond pips, filled up to `value`, read as "Difficulty 2 of 5". */
export function DifficultyPips({ value, size = 'sm', className }: DifficultyPipsProps) {
  const v = Math.max(0, Math.min(5, Math.round(value)));
  const px = size === 'sm' ? 'size-2.5' : 'size-3.5';
  return (
    <span
      role="img"
      aria-label={t('catalog.card.difficulty', { value: v })}
      className={cn('inline-flex items-center gap-1', className)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={cn(
            'rotate-45 rounded-[2px] border',
            px,
            n <= v
              ? 'border-gold-200 bg-gold-300 shadow-[0_0_6px_rgb(245_215_122/0.55)]'
              : 'border-mist/45 bg-transparent',
          )}
        />
      ))}
    </span>
  );
}
