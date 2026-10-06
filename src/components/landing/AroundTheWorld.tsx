/**
 * "Games from around the world": one ticket stub per region with its game count and
 * flags, linking to the catalog filtered by that region (/games?region=<region>).
 * Server component.
 */
import Link from 'next/link';
import { type CatalogGame } from '@/lib/content/catalog';
import { REGIONS, REGION_LABELS, type Region } from '@/lib/content/schema';
import { t } from '@/lib/i18n';
import { flagEmoji } from './pick-data';

export interface RegionSummary {
  region: Region;
  label: string;
  count: number;
  /** Distinct country codes in catalog order (at most `maxFlags`). */
  countryCodes: string[];
}

/** Regions that have at least one game, most games first (ties keep REGIONS order). */
export function summarizeRegions(
  games: readonly Pick<CatalogGame, 'origin'>[],
  maxFlags = 3,
): RegionSummary[] {
  const byRegion = new Map<Region, { count: number; codes: string[] }>();
  for (const g of games) {
    const entry = byRegion.get(g.origin.region) ?? { count: 0, codes: [] };
    entry.count += 1;
    const code = g.origin.countryCode.toUpperCase();
    if (!entry.codes.includes(code)) entry.codes.push(code);
    byRegion.set(g.origin.region, entry);
  }
  return REGIONS.filter((r) => byRegion.has(r))
    .map((region) => {
      const { count, codes } = byRegion.get(region)!;
      return {
        region,
        label: REGION_LABELS[region],
        count,
        countryCodes: codes.slice(0, maxFlags),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export function AroundTheWorld({ games }: { games: readonly Pick<CatalogGame, 'origin'>[] }) {
  const regions = summarizeRegions(games);
  if (regions.length === 0) return null;
  return (
    <section aria-labelledby="world-title" className="relative py-14 sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_60%_at_50%_50%,rgb(20_110_72/0.22),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-gold-300 text-xs font-bold tracking-[0.24em] uppercase">
            {t('landing.world.eyebrow')}
          </p>
          <h2
            id="world-title"
            className="font-display text-gold-100 mt-2 text-3xl leading-tight font-bold sm:text-[2.5rem]"
          >
            {t('landing.world.title')}
          </h2>
          <p className="text-mist mt-3 text-base leading-relaxed text-pretty">
            {t('landing.world.intro')}
          </p>
        </header>
        {/* Two columns on phones (an odd last stub spans both); from tablets up, a centred
            wrap so a short last row sits in the middle instead of hanging to the left. */}
        <ul className="mt-10 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center sm:gap-4 sm:[&>li]:basis-[calc((100%-2rem)/3)] lg:[&>li]:basis-[calc((100%-3rem)/4)] max-sm:[&>li:last-child:nth-child(odd)]:col-span-2">
          {regions.map((r) => {
            const countText =
              r.count === 1
                ? t('landing.world.gamesOne')
                : t('landing.world.games', { count: r.count });
            return (
              <li key={r.region}>
                <Link
                  href={`/games?region=${r.region}`}
                  data-testid={`region-${r.region}`}
                  className="group border-gold-300/35 bg-felt-800 hover:border-gold-300/80 ease-snap hover:bg-felt-700 relative flex h-full min-h-[7rem] flex-col justify-between overflow-hidden rounded-xl border p-4 pl-6 transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5"
                >
                  {/* ticket-stub perforation */}
                  <span
                    aria-hidden="true"
                    className="border-gold-300/30 absolute top-2 bottom-2 left-3 border-l-2 border-dotted"
                  />
                  <span
                    aria-hidden="true"
                    className="bg-felt-900 absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full"
                  />
                  <span className="font-display text-gold-100 text-lg leading-tight font-bold sm:text-xl">
                    {r.label}
                  </span>{' '}
                  <span className="mt-3 flex items-end justify-between gap-2">
                    <span className="text-gold-300 text-sm font-bold whitespace-nowrap">
                      {countText}
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-base leading-none tracking-[0.1em] sm:text-lg"
                    >
                      {r.countryCodes.map((c) => flagEmoji(c)).join('')}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
