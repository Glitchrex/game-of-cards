'use client';
/**
 * The /stats page body. Everything here comes from persisted stores, so it renders
 * a skeleton until they have hydrated.
 */
import { useEffect, useMemo } from 'react';
import { type GameSummary } from '@/components/journey/journey-data';
import { t } from '@/lib/i18n';
import { useHydrated } from '@/store/hydrate';
import { AwardsShelf } from './AwardsShelf';
import { GameTable } from './GameTable';
import { ResetProgress } from './ResetProgress';
import { StatTiles } from './StatTiles';
import { WalletCard } from './WalletCard';

export interface StatsDashboardProps {
  /** Every game in the catalog (slug, name, tier), in journey order. */
  games: readonly GameSummary[];
  /** titleId → blurb for share cards. */
  titleBlurbs?: Readonly<Record<string, string>>;
}

function Skeleton() {
  return (
    <div aria-busy="true" data-testid="stats-skeleton" className="flex flex-col gap-6">
      <p className="sr-only">{t('stats.loading')}</p>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <div className="panel flex flex-col gap-4 p-5 sm:p-6">
          <span className="bg-mist/15 h-6 w-36 animate-pulse rounded" />
          <span className="bg-felt-950/50 h-28 animate-pulse rounded-2xl" />
          <span className="bg-felt-950/50 h-12 animate-pulse rounded-xl" />
          <span className="bg-felt-950/40 h-32 animate-pulse rounded-xl" />
        </div>
        <div className="panel p-5 sm:p-6">
          <span className="bg-mist/15 block h-6 w-44 animate-pulse rounded" />
          <span className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
            {Array.from({ length: 9 }, (_, i) => (
              <span key={i} className="bg-felt-950/50 h-24 animate-pulse rounded-xl" />
            ))}
          </span>
        </div>
      </div>
      <div aria-hidden="true" className="panel h-80 animate-pulse rounded-3xl" />
    </div>
  );
}

/**
 * The sections only exist after hydration, so a deep link such as `/stats#awards`
 * (from the win celebration) can't be resolved by the browser on load. Scroll to it
 * once the real content is in place.
 */
function useScrollToHash(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    let id = '';
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return; // a malformed hash is not worth a crash
    }
    const target = id ? document.getElementById(id) : null;
    if (target && !target.contains(document.activeElement)) {
      target.scrollIntoView?.({ block: 'start' });
    }
  }, [ready]);
}

export function StatsDashboard({ games, titleBlurbs }: StatsDashboardProps) {
  const hydrated = useHydrated();
  const gameNames = useMemo(
    () => Object.fromEntries(games.map((g) => [g.slug, g.name])) as Record<string, string>,
    [games],
  );
  useScrollToHash(hydrated);
  if (!hydrated) return <Skeleton />;
  return (
    <div className="flex flex-col gap-6 sm:gap-8">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <WalletCard gameNames={gameNames} className="lg:h-full" />
        <StatTiles className="lg:h-full" />
      </div>
      <AwardsShelf gameNames={gameNames} titleBlurbs={titleBlurbs} />
      <GameTable games={games} />
      <ResetProgress />
    </div>
  );
}
