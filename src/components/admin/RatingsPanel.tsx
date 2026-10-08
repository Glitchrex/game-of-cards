'use client';
import { useState } from 'react';
import { plural, prettySlug } from '@/components/community/format';
import { RelativeTime } from '@/components/community/RelativeTime';
import { Button } from '@/components/ui/Button';
import { Stars } from '@/components/ui/Stars';
import { type Rating, type RatingSummary } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { PanelEmpty, PanelHeading } from './PanelBits';

export interface RatingsPanelProps {
  ratings: Rating[];
  summary: RatingSummary[];
  /** slug → display name from the game catalog. */
  gameNames: Readonly<Record<string, string>>;
}

const PAGE = 20;

export function RatingsPanel({ ratings, summary, gameNames }: RatingsPanelProps) {
  const [shown, setShown] = useState(PAGE);
  const nameOf = (slug: string) => gameNames[slug] ?? prettySlug(slug);
  const sorted = [...summary].sort(
    (a, b) => b.count - a.count || nameOf(a.gameSlug).localeCompare(nameOf(b.gameSlug)),
  );
  const visible = ratings.slice(0, shown);

  if (ratings.length === 0 && summary.length === 0) {
    return (
      <section aria-labelledby="admin-ratings-heading">
        <PanelHeading id="admin-ratings-heading">{t('admin.ratings.summaryHeading')}</PanelHeading>
        <PanelEmpty>{t('admin.ratings.empty')}</PanelEmpty>
      </section>
    );
  }

  return (
    <div className="grid gap-8">
      <section aria-labelledby="admin-ratings-heading">
        <PanelHeading id="admin-ratings-heading" count={sorted.length}>
          {t('admin.ratings.summaryHeading')}
        </PanelHeading>
        <div className="border-gold-300/20 mt-4 overflow-x-auto rounded-2xl border">
          <table
            className="w-full min-w-[20rem] text-left text-sm"
            data-testid="admin-ratings-summary"
          >
            <thead className="bg-felt-950/60 text-gold-300 text-[0.6875rem] tracking-[0.18em] uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-bold">
                  {t('admin.ratings.game')}
                </th>
                <th scope="col" className="px-4 py-3 text-right font-bold">
                  {t('admin.ratings.count')}
                </th>
                <th scope="col" className="px-4 py-3 font-bold">
                  {t('admin.ratings.average')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-gold-300/10 divide-y">
              {sorted.map((row) => (
                <tr key={row.gameSlug} data-testid={`admin-rating-summary-${row.gameSlug}`}>
                  <th scope="row" className="text-cream px-4 py-3 font-semibold">
                    {nameOf(row.gameSlug)}
                  </th>
                  <td className="text-mist tabular px-4 py-3 text-right">
                    {row.count.toLocaleString('en-US')}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <Stars
                        readOnly
                        value={row.average}
                        label={t('admin.ratings.averageLabel', {
                          value: row.average.toFixed(1),
                          count: plural(
                            row.count,
                            'admin.ratings.countOne',
                            'admin.ratings.countMany',
                          ),
                        })}
                      />
                      <span aria-hidden="true" className="text-gold-200 tabular font-bold">
                        {row.average.toFixed(1)}
                      </span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="admin-ratings-latest-heading">
        <PanelHeading id="admin-ratings-latest-heading" count={ratings.length}>
          {t('admin.ratings.latestHeading')}
        </PanelHeading>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {visible.map((r) => (
            <li
              key={r.id}
              data-testid={`admin-rating-${r.id}`}
              className="border-gold-300/20 bg-felt-800/70 flex flex-col gap-2 rounded-2xl border p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-cream font-semibold">{nameOf(r.gameSlug)}</span>
                <Stars readOnly value={r.stars} />
              </div>
              {r.comment ? (
                <p className="text-cream/95 text-[0.9375rem] leading-relaxed break-words whitespace-pre-line">
                  {r.comment}
                </p>
              ) : (
                <p className="text-mist text-sm italic">{t('admin.ratings.noComment')}</p>
              )}
              <RelativeTime iso={r.createdAt} className="text-mist mt-auto text-[0.8125rem]" />
            </li>
          ))}
        </ul>
        {ratings.length > shown ? (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => setShown((n) => n + PAGE)}>
              {t('admin.ratings.showMore')}
            </Button>
            <span className="text-mist text-sm" aria-live="polite">
              {t('admin.ratings.showing', { shown: visible.length, total: ratings.length })}
            </span>
          </div>
        ) : null}
      </section>
    </div>
  );
}
