'use client';
/** Corner ribbon on a game poster showing the learner's status for that game. */
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { useHydrated } from '@/store/hydrate';
import { statusOf, useProgress, type LearnStatus } from '@/store/progress';

const STYLES: Record<LearnStatus, string> = {
  'not-started': 'bg-felt-950/90 text-mist border-mist/30',
  learning: 'bg-ivory text-ink border-white/60',
  learned: 'bg-gold-300 text-ink border-gold-100/70',
  mastered: 'bg-velvet-600 text-gold-100 border-gold-300/70',
};

export interface ProgressRibbonProps {
  slug: string;
  tier: 1 | 2;
  className?: string;
}

export function ProgressRibbon({ slug, tier, className }: ProgressRibbonProps) {
  const hydrated = useHydrated();
  const progress = useProgress((s) => s.games[slug]);
  const base = cn(
    'pointer-events-none absolute top-[30px] -right-[30px] z-10 w-[150px] rotate-45 border-y py-1 text-center text-[0.625rem] leading-tight font-black tracking-[0.16em] uppercase shadow-[0_6px_14px_-6px_rgb(0_0_0/0.8)]',
    className,
  );
  if (!hydrated) {
    return (
      <span
        aria-hidden="true"
        data-testid={`ribbon-${slug}`}
        className={cn(base, 'bg-felt-950/60 border-mist/15 text-transparent')}
      >
        ·
      </span>
    );
  }
  const status = statusOf(progress, tier);
  const label = t(`catalog.card.status.${status}`);
  return (
    <span data-testid={`ribbon-${slug}`} data-status={status} className={cn(base, STYLES[status])}>
      <span aria-hidden="true">
        {status === 'mastered' ? '★ ' : ''}
        {label}
      </span>
      <span className="sr-only">{t('catalog.card.statusLabel', { status: label })}</span>
    </span>
  );
}
