/**
 * "Now showing": the featured games as a row of cinema posters under a marquee sign.
 * A swipeable, snap-scrolling row on phones/tablets; a lobby-card board on wide screens.
 * Server component.
 */
import { type ReactNode } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { ChevronRightIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { FeaturedPoster, type FeaturedPosterGame } from './FeaturedPoster';

/** A dark sign ringed with marquee bulbs; every other bulb twinkles. */
export function MarqueeSign({ children }: { children: ReactNode }) {
  return (
    <div className="bg-felt-950 relative mt-3 rounded-2xl p-[9px] shadow-[0_0_44px_-12px_rgb(245_215_122/0.55)]">
      <div aria-hidden="true" className="marquee-bulbs absolute inset-0 rounded-2xl opacity-55" />
      <div
        aria-hidden="true"
        className="marquee-bulbs animate-bulb absolute inset-0 rounded-2xl [background-size:28px_28px] [background-position:-7px_-7px]"
      />
      <div className="border-gold-300/60 relative rounded-xl border bg-[radial-gradient(120%_140%_at_50%_0%,#9e2036,#3d0b15_70%)] px-6 py-2 sm:px-10 sm:py-2.5">
        {children}
      </div>
    </div>
  );
}

export interface NowShowingProps {
  games: readonly FeaturedPosterGame[];
  /** Size of the whole catalog, for the "See all" button. */
  totalCount: number;
}

export function NowShowing({ games, totalCount }: NowShowingProps) {
  if (games.length === 0) return null;
  return (
    <section
      aria-labelledby="now-showing-title"
      className="relative py-14 [contain-intrinsic-size:auto_820px] [content-visibility:auto] sm:py-20 lg:[contain-intrinsic-size:auto_890px]"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-[radial-gradient(50%_80%_at_50%_0%,rgb(245_215_122/0.1),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <header className="flex flex-col items-center text-center">
          <p className="text-gold-300 text-xs font-bold tracking-[0.24em] uppercase">
            {t('landing.nowShowing.eyebrow')}
          </p>
          <MarqueeSign>
            <h2
              id="now-showing-title"
              className="font-display text-foil text-3xl leading-tight font-black tracking-[0.06em] uppercase sm:text-[2.75rem]"
            >
              {t('landing.nowShowing.title')}
            </h2>
          </MarqueeSign>
          <p className="text-mist mt-4 max-w-xl text-base leading-relaxed text-pretty">
            {t('landing.nowShowing.intro')}
          </p>
        </header>

        <ul
          className={cn(
            '-mx-4 mt-9 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:thin] [scrollbar-color:var(--color-felt-500)_transparent] gap-4 overflow-x-auto px-4 pt-2 pb-6 sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0',
            games.length === 4 || games.length <= 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3',
          )}
        >
          {games.map((game, i) => (
            <li key={game.slug} className="w-[15rem] shrink-0 snap-start lg:w-auto">
              <FeaturedPoster game={game} index={i} />
            </li>
          ))}
        </ul>

        <div className="mt-8 flex justify-center">
          <Button href="/games" variant="secondary" trailingIcon={<ChevronRightIcon size={18} />}>
            {totalCount > 0
              ? t('landing.nowShowing.seeAll', { count: totalCount })
              : t('landing.nowShowing.seeAllNoCount')}
          </Button>
        </div>
      </div>
    </section>
  );
}
