/**
 * Movie-poster style game card for the catalog (and anywhere games are
 * featured): felt "poster art" with the title in Fraunces, flag + country,
 * a progress ribbon, then the hook and quick facts. The whole card is one
 * link to the game hub (stretched link), named by the game title.
 */
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import {
  ClockIcon,
  ClubIcon,
  DiamondIcon,
  HeartIcon,
  SpadeIcon,
  UsersIcon,
} from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { flagEmoji, type GameCardData } from './catalog-data';
import { DifficultyPips } from './DifficultyPips';
import { ProgressRibbon } from './ProgressRibbon';

export interface GameCardProps {
  game: GameCardData;
  /** Heading level of the title (default 2). */
  headingLevel?: 2 | 3;
  className?: string;
}

/** "2–5 players", "4 players", "1 player". */
export function playersText(players: { min: number; max: number }): string {
  if (players.min === players.max) {
    return players.min === 1
      ? t('catalog.card.playersOne')
      : t('catalog.card.playersExact', { n: players.min });
  }
  return t('catalog.card.players', { min: players.min, max: players.max });
}

const SUITS = [SpadeIcon, HeartIcon, DiamondIcon, ClubIcon] as const;

/** Stable small hash so each poster gets its own suit watermark and tilt. */
function hash(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function GameCard({ game, headingLevel = 2, className }: GameCardProps) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  const h = hash(game.slug);
  const Suit = SUITS[h % SUITS.length] ?? SpadeIcon;
  const red = Suit === HeartIcon || Suit === DiamondIcon;
  const tilt = (h % 2 ? 1 : -1) * (8 + (h % 9));
  return (
    <article
      data-testid={`game-card-${game.slug}`}
      className={cn(
        'group/card border-gold-300/30 bg-felt-800 ease-glide has-[a:focus-visible]:outline-gold-300 hover:border-gold-300/60 relative flex flex-col overflow-hidden rounded-[18px] border shadow-[0_16px_34px_-22px_rgb(0_0_0/0.95)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:shadow-[0_26px_44px_-24px_rgb(0_0_0/0.95),0_0_0_1px_rgb(245_215_122/0.25)] has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2',
        className,
      )}
    >
      {/*
        Poster art. The decorations and the text share one grid cell, and nothing
        between the title link and the <article> is positioned, so the link's
        stretched ::after hit area covers the whole card.
      */}
      <div className="felt grid min-h-[11.5rem]">
        <div
          aria-hidden="true"
          className="pointer-events-none relative col-start-1 row-start-1 overflow-hidden"
        >
          <span className="marquee-bulbs absolute inset-x-5 top-0 h-3 opacity-55" />
          <span className="absolute inset-0 bg-[radial-gradient(70%_80%_at_30%_0%,rgb(245_215_122/0.16),transparent_70%)]" />
          <Suit
            size={150}
            className={cn(
              'ease-glide absolute -right-6 -bottom-8 opacity-[0.13] transition-transform duration-500 group-hover/card:scale-105',
              red ? 'text-velvet-300' : 'text-ivory',
            )}
            style={{ rotate: `${tilt}deg` }}
          />
        </div>

        <div className="z-10 col-start-1 row-start-1 flex flex-col justify-between px-4 pt-6 pb-4">
          <p className="border-gold-300/35 bg-felt-950/55 text-cream inline-flex w-fit max-w-[70%] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold">
            <span aria-hidden="true" className="text-sm leading-none">
              {flagEmoji(game.countryCode)}
            </span>
            <span className="truncate">{game.country}</span>
          </p>

          <div className="mt-6">
            <Badge tone="outline" size="sm">
              {game.typeLabel}
            </Badge>
            <H className="font-display text-foil mt-2 text-[1.875rem] leading-[1.02] font-black tracking-[-0.02em] text-balance">
              <Link
                href={`/games/${game.slug}`}
                className="after:absolute after:inset-0 after:z-20 after:rounded-[18px] after:content-[''] focus-visible:outline-none"
              >
                {game.name}
              </Link>
            </H>
          </div>
        </div>
      </div>
      <ProgressRibbon slug={game.slug} tier={game.tier} />

      {/* Details */}
      <div className="border-gold-300/20 flex flex-1 flex-col gap-3 border-t px-4 pt-3.5 pb-4">
        <p className="text-mist line-clamp-3 text-[0.9375rem] leading-snug">{game.hook}</p>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] font-semibold">
          <span className="text-cream inline-flex items-center gap-1.5">
            <UsersIcon size={16} className="text-gold-300" />
            {playersText(game.players)}
          </span>
          <span className="text-cream inline-flex items-center gap-1.5">
            <ClockIcon size={16} className="text-gold-300" />
            <span className="line-clamp-1">{game.length}</span>
          </span>
          <DifficultyPips value={game.difficulty} />
        </div>
        {game.tier === 1 ? (
          <div>
            <Badge tone="gold" size="md" icon={<SpadeIcon size={12} />}>
              {t('catalog.card.playVsBot')}
            </Badge>
          </div>
        ) : null}
      </div>
    </article>
  );
}
