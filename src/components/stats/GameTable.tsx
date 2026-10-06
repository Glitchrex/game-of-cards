'use client';
/**
 * "Game by game": the learner's record and learning status for every game they
 * have played or opened. A real <table> from the `sm` breakpoint up; a stack of
 * compact cards on phones (only one of the two is ever displayed). Render only
 * after the stores have hydrated.
 */
import Link from 'next/link';
import { useId, useMemo } from 'react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { TicketIcon } from '@/components/ui/icons';
import { formatJeet, formatJeetDelta } from '@/components/ui/Jeet';
import { type GameSummary } from '@/components/journey/journey-data';
import { StatusBadge } from '@/components/journey/status';
import { t } from '@/lib/i18n';
import { useProgress } from '@/store/progress';
import { useStats } from '@/store/stats';
import { buildGameRows, type GameRow } from './stats-data';

export interface GameTableProps {
  games: readonly GameSummary[];
  className?: string;
}

function GameName({ row, className }: { row: GameRow; className?: string }) {
  const name = row.known ? (
    <Link
      href={`/games/${row.slug}`}
      className="text-cream hover:text-gold-100 decoration-gold-300/50 font-semibold underline-offset-4 hover:underline"
    >
      {row.name}
    </Link>
  ) : (
    <span className="text-cream font-semibold">{row.name}</span>
  );
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      {name}
      {row.tier === 1 && row.known ? (
        <span className="bg-velvet-600 text-cream border-velvet-400/60 inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[0.625rem] font-bold tracking-wide uppercase">
          <TicketIcon size={11} aria-hidden="true" />
          {t('stats.games.playable')}
        </span>
      ) : null}
    </span>
  );
}

function BiggestWin({ value }: { value: number }) {
  if (value <= 0) {
    return (
      <>
        <span aria-hidden="true" className="text-mist">
          {t('stats.tiles.none')}
        </span>
        <span className="sr-only">{t('stats.tiles.noneLabel')}</span>
      </>
    );
  }
  return (
    <span className="text-gold-200 font-bold">
      {formatJeetDelta(value)}
      <span className="sr-only"> {t('wallet.currency')}</span>
    </span>
  );
}

export function GameTable({ games, className }: GameTableProps) {
  const perGame = useStats((s) => s.perGame);
  const progress = useProgress((s) => s.games);
  const rows = useMemo(() => buildGameRows(games, perGame, progress), [games, perGame, progress]);
  const headingId = useId();

  return (
    <section aria-labelledby={headingId} className={cn('panel p-5 sm:p-6', className)}>
      <h2 id={headingId} className="font-display text-gold-100 text-2xl leading-tight font-bold">
        {t('stats.games.heading')}
      </h2>
      <p className="text-mist mt-1 text-sm">{t('stats.games.intro')}</p>

      {rows.length === 0 ? (
        <div className="border-gold-300/25 mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed px-4 py-5">
          <p className="text-cream text-sm">{t('stats.games.empty')}</p>
          <Button href="/journey" variant="secondary" size="sm">
            {t('stats.games.emptyCta')}
          </Button>
        </div>
      ) : (
        <>
          {/* Phones: one compact card per game. */}
          <ul
            role="list"
            className="mt-4 flex flex-col gap-2.5 sm:hidden"
            aria-labelledby={headingId}
          >
            {rows.map((row) => (
              <li
                key={row.slug}
                data-testid={`stats-game-card-${row.slug}`}
                className="border-gold-300/15 bg-felt-950/45 rounded-xl border px-3.5 py-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <GameName row={row} className="min-w-0" />
                  <StatusBadge status={row.status} />
                </div>
                {/* The biggest-win column is wider so "+12,500" fits on a 375 px phone. */}
                <dl className="mt-2.5 grid grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.5fr)] gap-1.5 text-center">
                  {(
                    [
                      ['played', formatJeet(row.played)],
                      ['wins', formatJeet(row.wins)],
                      ['losses', formatJeet(row.losses)],
                    ] as const
                  ).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-felt-900/70 flex flex-col justify-between rounded-lg px-1 py-1.5"
                    >
                      <dt className="text-mist text-[0.625rem] leading-tight font-bold tracking-wide uppercase">
                        {t(`stats.games.${key}`)}
                      </dt>
                      <dd className="tabular text-cream mt-0.5 text-base font-bold">{value}</dd>
                    </div>
                  ))}
                  <div className="bg-felt-900/70 flex flex-col justify-between rounded-lg px-1 py-1.5">
                    <dt className="text-mist text-[0.625rem] leading-tight font-bold tracking-wide uppercase">
                      {t('stats.games.biggestWin')}
                    </dt>
                    <dd className="tabular mt-0.5 text-[0.9375rem] [overflow-wrap:anywhere]">
                      <BiggestWin value={row.biggestWin} />
                    </dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* Tablet and up: a real data table. */}
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-left text-sm" aria-labelledby={headingId}>
              <thead>
                <tr className="border-gold-300/25 text-gold-300 border-b text-[0.6875rem] tracking-[0.14em] uppercase">
                  <th scope="col" className="py-2.5 pr-3 font-bold">
                    {t('stats.games.game')}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-bold">
                    {t('stats.games.played')}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-bold">
                    {t('stats.games.wins')}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-bold">
                    {t('stats.games.losses')}
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-bold">
                    {t('stats.games.biggestWin')}
                  </th>
                  <th scope="col" className="py-2.5 pl-3 font-bold">
                    {t('stats.games.status')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-gold-300/10 divide-y">
                {rows.map((row) => (
                  <tr
                    key={row.slug}
                    data-testid={`stats-game-${row.slug}`}
                    className="hover:bg-white/[0.03]"
                  >
                    <th scope="row" className="py-3 pr-3 font-normal">
                      <GameName row={row} />
                    </th>
                    <td className="tabular text-cream px-3 py-3 text-right font-semibold">
                      {formatJeet(row.played)}
                    </td>
                    <td className="tabular text-cream px-3 py-3 text-right font-semibold">
                      {formatJeet(row.wins)}
                    </td>
                    <td className="tabular text-cream px-3 py-3 text-right font-semibold">
                      {formatJeet(row.losses)}
                    </td>
                    <td className="tabular px-3 py-3 text-right">
                      <BiggestWin value={row.biggestWin} />
                    </td>
                    <td className="py-3 pl-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
