'use client';
/**
 * Career numbers as a grid of scoreboard tiles (a <dl>): played, wins, losses,
 * pushes, win rate, biggest win, current streak, best streak and titles earned,
 * plus a wins/pushes/losses record bar. Render only after the stores have hydrated.
 */
import { type ReactNode, useId } from 'react';
import { cn } from '@/components/ui/cn';
import { CardsIcon, SparkleIcon, StarIcon, TrophyIcon } from '@/components/ui/icons';
import { CoinIcon, formatJeet, formatJeetDelta } from '@/components/ui/Jeet';
import { t } from '@/lib/i18n';
import { useStats } from '@/store/stats';
import { bestStreakText, streakText, winRate } from './stats-data';

interface TileProps {
  label: string;
  testId: string;
  children: ReactNode;
  icon?: ReactNode;
  hint?: string;
  className?: string;
  tone?: 'default' | 'hot' | 'cold';
}

function Tile({ label, testId, children, icon, hint, className, tone = 'default' }: TileProps) {
  return (
    <div
      className={cn(
        'relative flex min-w-0 flex-col gap-2 overflow-hidden rounded-xl border px-3.5 pt-3 pb-3.5 sm:px-4',
        tone === 'hot'
          ? 'border-gold-300/60 bg-[linear-gradient(160deg,rgb(245_215_122/0.18),rgb(3_17_11/0.55))]'
          : tone === 'cold'
            ? 'border-velvet-400/45 bg-[linear-gradient(160deg,rgb(158_32_54/0.3),rgb(3_17_11/0.55))]'
            : 'border-gold-300/20 bg-felt-950/45',
        className,
      )}
    >
      <dt className="text-gold-300 flex items-start justify-between gap-2 text-[0.6875rem] leading-tight font-bold tracking-[0.14em] uppercase">
        <span>{label}</span>
        {icon ? (
          <span aria-hidden="true" className="text-gold-300/70 -mt-0.5 shrink-0">
            {icon}
          </span>
        ) : null}
      </dt>
      {/* Values line up under their labels across a row; a hint settles at the bottom. */}
      <dd className="flex min-w-0 flex-1 flex-col">
        <span data-testid={testId} className="block">
          {children}
        </span>
        {hint ? <span className="text-mist mt-auto block pt-1 text-xs">{hint}</span> : null}
      </dd>
    </div>
  );
}

/** Size/weight for big numbers; colour is added per tile. */
const NUMBER = 'tabular text-3xl leading-none font-extrabold sm:text-[2.125rem]';
const PHRASE = 'font-display block text-xl leading-tight font-bold sm:text-[1.375rem]';

function None() {
  return (
    <>
      <span aria-hidden="true" className={cn(NUMBER, 'text-mist')}>
        {t('stats.tiles.none')}
      </span>
      <span className="sr-only">{t('stats.tiles.noneLabel')}</span>
    </>
  );
}

/** Wins / pushes / losses as one stacked bar (a visual echo of the tiles above). */
function RecordBar({ wins, pushes, losses }: { wins: number; pushes: number; losses: number }) {
  const total = wins + pushes + losses;
  if (total <= 0) return null;
  const parts = [
    {
      key: 'wins',
      n: wins,
      bar: 'bg-[linear-gradient(90deg,var(--color-gold-500),var(--color-gold-200))]',
      dot: 'bg-gold-300',
    },
    { key: 'pushes', n: pushes, bar: 'bg-mist/60', dot: 'bg-mist/60' },
    {
      key: 'losses',
      n: losses,
      bar: 'bg-[linear-gradient(90deg,var(--color-velvet-600),var(--color-velvet-400))]',
      dot: 'bg-velvet-400',
    },
  ] as const;
  return (
    <div aria-hidden="true" data-testid="stat-record" className="mt-4">
      <p className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.14em] uppercase">
        {t('stats.tiles.record')}
      </p>
      <div className="bg-felt-950/80 ring-gold-300/15 mt-2 flex h-3 gap-0.5 overflow-hidden rounded-full ring-1">
        {parts.map((p) =>
          p.n > 0 ? (
            <span
              key={p.key}
              className={cn('h-full', p.bar)}
              style={{ width: `${(p.n / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <p className="text-mist mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
        {parts.map((p) => (
          <span key={p.key} className="inline-flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', p.dot)} />
            {t(`stats.tiles.${p.key}`)}
            <span className="tabular text-cream">{formatJeet(p.n)}</span>
          </span>
        ))}
      </p>
    </div>
  );
}

export function StatTiles({ className }: { className?: string }) {
  const played = useStats((s) => s.played);
  const wins = useStats((s) => s.wins);
  const losses = useStats((s) => s.losses);
  const pushes = useStats((s) => s.pushes);
  const biggestWin = useStats((s) => s.biggestWin);
  const currentStreak = useStats((s) => s.currentStreak);
  const bestStreak = useStats((s) => s.bestStreak);
  const titles = useStats((s) => s.awards.length);
  const headingId = useId();
  const rate = winRate(wins, played);

  return (
    <section
      aria-labelledby={headingId}
      className={cn('panel flex flex-col p-5 sm:p-6', className)}
    >
      <h2 id={headingId} className="font-display text-gold-100 text-2xl leading-tight font-bold">
        {t('stats.tiles.heading')}
      </h2>
      <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:flex-1 lg:auto-rows-fr">
        <Tile label={t('stats.tiles.played')} testId="stat-played" icon={<CardsIcon size={18} />}>
          <span className={cn(NUMBER, 'text-cream')}>{formatJeet(played)}</span>
        </Tile>
        <Tile label={t('stats.tiles.wins')} testId="stat-wins" icon={<TrophyIcon size={18} />}>
          <span className={cn(NUMBER, 'text-gold-100')}>{formatJeet(wins)}</span>
        </Tile>
        <Tile label={t('stats.tiles.losses')} testId="stat-losses">
          <span className={cn(NUMBER, 'text-cream')}>{formatJeet(losses)}</span>
        </Tile>
        <Tile
          label={t('stats.tiles.pushes')}
          testId="stat-pushes"
          hint={t('stats.tiles.pushesHint')}
        >
          <span className={cn(NUMBER, 'text-cream')}>{formatJeet(pushes)}</span>
        </Tile>
        <Tile label={t('stats.tiles.winRate')} testId="stat-win-rate">
          {rate === null ? (
            <None />
          ) : (
            <>
              <span className={cn(NUMBER, 'text-gold-100')}>
                {t('stats.tiles.winRateValue', { pct: rate })}
              </span>
              <span
                aria-hidden="true"
                className="bg-felt-950/80 ring-gold-300/15 mt-2.5 block h-1.5 overflow-hidden rounded-full ring-1"
              >
                <span
                  className="block h-full rounded-full bg-[linear-gradient(90deg,var(--color-gold-500),var(--color-gold-200))]"
                  style={{ width: `${rate}%` }}
                />
              </span>
            </>
          )}
        </Tile>
        <Tile
          label={t('stats.tiles.biggestWin')}
          testId="stat-biggest-win"
          icon={<CoinIcon size={18} />}
        >
          {biggestWin > 0 ? (
            <>
              {/* Big amounts step down a size (and, in the extreme, wrap) instead of overflowing. */}
              <span
                className={cn(
                  'tabular text-gold-100 block leading-none font-extrabold [overflow-wrap:anywhere]',
                  formatJeetDelta(biggestWin).length > 6
                    ? 'text-2xl sm:text-[1.75rem]'
                    : 'text-3xl sm:text-[2.125rem]',
                )}
              >
                {formatJeetDelta(biggestWin)}
              </span>
              <span className="sr-only"> {t('wallet.currency')}</span>
            </>
          ) : (
            <None />
          )}
        </Tile>
        <Tile
          label={t('stats.tiles.currentStreak')}
          testId="stat-streak"
          icon={currentStreak > 0 ? <SparkleIcon size={18} /> : undefined}
          tone={currentStreak >= 2 ? 'hot' : currentStreak <= -2 ? 'cold' : 'default'}
          className="col-span-2 sm:col-span-1"
        >
          <span
            className={cn(
              PHRASE,
              currentStreak > 0
                ? 'text-gold-100'
                : currentStreak < 0
                  ? 'text-velvet-300'
                  : 'text-mist',
            )}
          >
            {streakText(currentStreak)}
          </span>
        </Tile>
        <Tile label={t('stats.tiles.bestStreak')} testId="stat-best-streak">
          {bestStreak > 0 ? (
            <span className={cn(PHRASE, 'text-cream')}>{bestStreakText(bestStreak)}</span>
          ) : (
            <None />
          )}
        </Tile>
        <Tile label={t('stats.tiles.titles')} testId="stat-titles" icon={<StarIcon size={18} />}>
          <span className={cn(NUMBER, 'text-gold-100')}>{formatJeet(titles)}</span>
        </Tile>
      </dl>
      <RecordBar wins={wins} pushes={pushes} losses={losses} />
    </section>
  );
}
