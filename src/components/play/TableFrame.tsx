'use client';
import { type ReactNode, type Ref } from 'react';
import { CardBack } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';

export interface TableFrameProps {
  /** Accessible name of the table region, e.g. "Blackjack table". */
  label: string;
  /** Left side of the header strip (game name, ribbon…). */
  header?: ReactNode;
  /** Right side of the header strip (bet chip, Rules link…). */
  aside?: ReactNode;
  /** Centred under the header (turn indicator). */
  status?: ReactNode;
  children: ReactNode;
  /** Under the felt, still inside the rail (error callout, hand-over bar). */
  footer?: ReactNode;
  busy?: boolean;
  /** Stretch to the parent's height (content centred vertically). */
  fill?: boolean;
  /** -1 lets the shell move focus to the table when a hand starts. */
  tabIndex?: number;
  ref?: Ref<HTMLElement>;
  className?: string;
  'data-testid'?: string;
}

/**
 * The card table: a padded velvet rail with gold piping around a lit green felt,
 * a marquee-bulb strip along the top, and slots for a header, status and footer.
 */
export function TableFrame({
  label,
  header,
  aside,
  status,
  children,
  footer,
  busy,
  fill = false,
  tabIndex,
  ref,
  className,
  'data-testid': testId,
}: TableFrameProps) {
  return (
    <section
      ref={ref}
      tabIndex={tabIndex}
      aria-label={label}
      aria-busy={busy || undefined}
      data-testid={testId}
      className={cn(
        'relative rounded-[30px] bg-[linear-gradient(180deg,var(--color-velvet-600),var(--color-velvet-700)_55%,#3d0b16)] p-2 shadow-[0_30px_60px_-30px_rgb(0_0_0/0.95),inset_0_1px_0_rgb(255_255_255/0.18)] outline-offset-4 sm:p-3',
        fill && 'flex flex-col',
        className,
      )}
    >
      <div
        className={cn(
          'border-gold-300/45 felt relative overflow-hidden rounded-[22px] border shadow-[inset_0_0_60px_rgb(0_0_0/0.55)]',
          fill && 'flex flex-1 flex-col',
        )}
      >
        <span
          aria-hidden="true"
          className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-8 top-0 h-3.5 opacity-50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,rgb(255_246_217/0.12),transparent_70%)]"
        />
        {header || aside ? (
          <div className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-3 pt-5 sm:px-5">
            <div className="min-w-0">{header}</div>
            {aside ? <div className="flex flex-wrap items-center gap-2">{aside}</div> : null}
          </div>
        ) : null}
        {status ? (
          <div className="relative flex min-h-10 justify-center px-3 pt-3">{status}</div>
        ) : null}
        <div
          className={cn(
            'relative px-2 pt-3 pb-4 sm:px-5 sm:pb-6',
            fill && 'flex flex-1 flex-col justify-center',
          )}
        >
          {children}
        </div>
      </div>
      {footer ? <div className="relative px-1 pt-2 sm:px-2">{footer}</div> : null}
    </section>
  );
}

/** Felt placeholder shown while a game module loads. */
export function TableSkeleton({ className }: { className?: string }) {
  return (
    <div role="status" aria-live="polite" data-testid="table-skeleton" className={className}>
      <span className="sr-only">{t('play.shell.loading')}</span>
      <TableFrame label={t('play.shell.loading')} busy>
        <div
          aria-hidden="true"
          className="flex min-h-[320px] flex-col items-center justify-center gap-6 sm:min-h-[400px]"
        >
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <CardBack
                key={i}
                size="sm"
                className="animate-pulse"
                style={{ animationDelay: `${i * 160}ms`, transform: `rotate(${(i - 1) * 8}deg)` }}
              />
            ))}
          </div>
          <div className="bg-gold-300/15 h-3 w-48 animate-pulse rounded-full" />
          <div className="bg-gold-300/10 h-10 w-64 animate-pulse rounded-xl" />
          <p className="text-mist text-sm font-semibold">{t('play.shell.loading')}</p>
        </div>
      </TableFrame>
    </div>
  );
}
