/**
 * "How a post travels": Open → Planned → In progress → Done. Doubles as the
 * legend for the status badges on every post (same icons, same tones).
 */
import { cn } from '@/components/ui/cn';
import { POST_STATUSES } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { PostStatusBadge } from './PostBadges';

export function StatusPipeline({ className }: { className?: string }) {
  return (
    <section aria-labelledby="status-pipeline-heading" className={cn('min-w-0', className)}>
      <h2
        id="status-pipeline-heading"
        className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.22em] uppercase"
      >
        {t('community.page.pipeline')}
      </h2>
      <ol className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-0">
        {POST_STATUSES.map((status, i) => (
          <li
            key={status}
            className="border-gold-300/15 bg-felt-950/40 relative flex flex-col items-start gap-1.5 rounded-xl border px-3 py-2.5 sm:items-center sm:rounded-none sm:border-y sm:border-r-0 sm:border-l-0 sm:bg-transparent sm:px-2 sm:text-center sm:first:rounded-l-xl sm:first:border-l sm:last:rounded-r-xl sm:last:border-r"
          >
            {i > 0 ? (
              <span
                aria-hidden="true"
                className="text-gold-300/60 absolute top-1/2 -left-2 hidden -translate-y-1/2 text-xs sm:block"
              >
                ▸
              </span>
            ) : null}
            <PostStatusBadge status={status} size="sm" />
            <span className="text-mist text-xs leading-snug">
              {t(`community.page.pipelineHints.${status}`)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
