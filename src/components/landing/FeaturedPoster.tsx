/**
 * A cinema-poster card for one featured game on the landing page's "Now showing" row.
 * Server component; the whole poster is clickable through a stretched link on the title
 * (so the link's accessible name is just the game's name).
 */
import Link from 'next/link';
import { type CatalogGame } from '@/lib/content/catalog';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { flagEmoji, playerRange } from './pick-data';
import { PosterKeyArt, posterCards } from './PosterKeyArt';

export type FeaturedPosterGame = Pick<
  CatalogGame,
  'slug' | 'name' | 'hook' | 'origin' | 'players' | 'difficulty' | 'minutes' | 'tier' | 'lesson'
>;

/** Poster colourways, cycled along the row. */
const TONES = [
  'from-velvet-700 via-[#3d0b15] to-felt-950',
  'from-felt-500 via-felt-800 to-felt-950',
  'from-[#2a2338] via-[#15121d] to-felt-950',
  'from-gold-700 via-[#3b2a08] to-felt-950',
] as const;

export interface FeaturedPosterProps {
  game: FeaturedPosterGame;
  /** Position in the row (picks the colourway). */
  index?: number;
  className?: string;
}

export function FeaturedPoster({ game, index = 0, className }: FeaturedPosterProps) {
  const tone = TONES[index % TONES.length];
  const players =
    game.players.max === 1
      ? t('landing.nowShowing.poster.playersOne')
      : t('landing.nowShowing.poster.players', { range: playerRange(game.players) });
  return (
    <article
      data-testid={`featured-${game.slug}`}
      className={cn(
        'group ease-glide border-gold-300/35 hover:border-gold-300/80 has-[a:focus-visible]:outline-gold-300 relative flex h-full flex-col overflow-hidden rounded-2xl border bg-linear-to-b shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_22px_40px_-24px_rgb(0_0_0/0.95)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_0_0_1px_rgb(245_215_122/0.35),0_28px_50px_-24px_rgb(0_0_0/0.95)] has-[a:focus-visible]:-translate-y-1 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2 lg:flex-row',
        tone,
        className,
      )}
    >
      {/* key art with a little spotlight (beside the text on wide screens) */}
      <div className="relative aspect-[4/3] w-full lg:aspect-auto lg:w-[42%] lg:shrink-0">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(60%_70%_at_50%_30%,rgb(245_215_122/0.28),transparent_70%)]"
        />
        <div
          aria-hidden="true"
          className="marquee-bulbs absolute inset-x-3 top-2 h-2 opacity-60 group-hover:opacity-100"
        />
        <PosterKeyArt
          cards={posterCards(game.lesson)}
          className="ease-snap relative h-full w-full transition-transform duration-300 group-hover:scale-[1.04]"
        />
        {game.tier === 1 ? (
          <span className="bg-gold-300 text-ink absolute bottom-2 left-3 rounded-full px-2 py-0.5 text-[0.625rem] font-bold tracking-[0.12em] whitespace-nowrap uppercase shadow-[0_4px_12px_-4px_rgb(0_0_0/0.7)]">
            {t('landing.nowShowing.poster.playable')}
          </span>
        ) : null}
      </div>

      {/* Deliberately not `relative`: the title link's ::after overlay must be sized by
          the <article>, so the key art is clickable too. */}
      <div className="flex min-w-0 flex-1 flex-col px-4 pt-3 pb-4 lg:pt-4 lg:pl-1">
        <p className="text-gold-200 text-xs font-semibold">
          <span aria-hidden="true">{flagEmoji(game.origin.countryCode)} </span>
          {game.origin.country}
        </p>
        <h3 className="font-display mt-1 text-[1.625rem] leading-[1.1] font-black tracking-[-0.01em] lg:text-2xl">
          <Link
            href={`/games/${game.slug}`}
            className="text-gold-100 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {game.name}
          </Link>
        </h3>
        <p className="text-cream/90 mt-2 line-clamp-3 text-sm leading-relaxed">{game.hook}</p>
        <dl className="border-gold-300/20 text-mist mt-auto flex flex-wrap items-center gap-x-3.5 gap-y-1 border-t pt-3 text-xs">
          <div>
            <dt className="sr-only">{t('landing.nowShowing.poster.playersLabel')}</dt>
            <dd className="text-cream font-semibold whitespace-nowrap">{players}</dd>
          </div>
          <div>
            <dt className="sr-only">{t('landing.nowShowing.poster.lengthLabel')}</dt>
            <dd className="text-cream font-semibold whitespace-nowrap">
              {t('landing.nowShowing.poster.minutes', { minutes: game.minutes })}
            </dd>
          </div>
          <div>
            <dt className="sr-only">{t('landing.nowShowing.poster.difficultyLabel')}</dt>
            <dd className="flex items-center gap-1 py-1">
              <span className="sr-only">
                {t('landing.nowShowing.poster.difficulty', { level: game.difficulty })}
              </span>
              {[1, 2, 3, 4, 5].map((n) => (
                <span
                  key={n}
                  aria-hidden="true"
                  className={cn(
                    'size-1.5 rounded-full',
                    n <= game.difficulty ? 'bg-gold-300' : 'bg-cream/25',
                  )}
                />
              ))}
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
