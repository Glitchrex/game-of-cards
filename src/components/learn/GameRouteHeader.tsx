/**
 * Small header for the learn / try / quiz routes: breadcrumb back to the game
 * hub, a kicker and the page's h1. Server-renderable (no hooks).
 */
import Link from 'next/link';
import { type ReactNode } from 'react';
import { ChevronRightIcon } from '@/components/ui/icons';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';

export interface GameRouteHeaderProps {
  slug: string;
  name: string;
  /** Current page label in the breadcrumb ("Lesson", "Quiz"…). */
  kicker: string;
  title: string;
  /** Optional extra content on the right (badges, links). */
  aside?: ReactNode;
  className?: string;
}

export function GameRouteHeader({
  slug,
  name,
  kicker,
  title,
  aside,
  className,
}: GameRouteHeaderProps) {
  return (
    <header className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        <nav aria-label={t('learn.header.breadcrumb')}>
          <ol className="text-mist flex flex-wrap items-center gap-1 text-sm font-semibold">
            <li className="flex items-center gap-1">
              <Link
                href="/games"
                className="hover:text-gold-200 inline-flex min-h-11 items-center underline-offset-4 hover:underline"
              >
                {t('learn.header.games')}
              </Link>
              <ChevronRightIcon size={14} className="text-gold-300/70" />
            </li>
            <li className="flex items-center gap-1">
              <Link
                href={`/games/${slug}`}
                className="text-gold-200 hover:text-gold-100 inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                aria-label={t('learn.header.backToHub', { name })}
                data-testid="hub-link"
              >
                {name}
              </Link>
              <ChevronRightIcon size={14} className="text-gold-300/70" />
            </li>
            <li aria-current="page" className="text-cream/80">
              {kicker}
            </li>
          </ol>
        </nav>
        <h1 className="font-display text-foil mt-1 text-[2rem] leading-[1.05] font-black tracking-[-0.02em] text-balance sm:text-5xl">
          {title}
        </h1>
      </div>
      {aside ? <div className="shrink-0">{aside}</div> : null}
    </header>
  );
}
