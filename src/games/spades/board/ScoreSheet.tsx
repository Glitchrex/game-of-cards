'use client';
/**
 * The end of the hand: each partnership's score breakdown — bid, tricks toward it, bid
 * points (made or set), bags, Nil bonuses — and the winning team.
 */
import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '@/components/ui/cn';
import { TrophyIcon } from '@/components/ui/icons';
import { type BotPersona } from '@/games/core/module';
import { t } from '@/games/spades/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type SpadesState } from '../engine';
import { scoreHand, teamSeats, type TeamScore } from '../rules';
import { seatName } from './shared';

function signed(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

export function ScoreSheet({
  state,
  personas,
}: {
  state: SpadesState;
  personas: readonly BotPersona[];
}) {
  const reduced = useReducedMotionPref();
  const captionId = useId();
  const [us, them] = scoreHand(
    state.bids.map((b) => b ?? 0),
    state.tricksWon,
  );
  const tie = us.total === them.total;
  const rows: { score: TeamScore; id: 'us' | 'them'; team: string; label: string }[] = [
    {
      score: us,
      id: 'us',
      team: t('spades.team.us'),
      label: t('spades.team.usNames', { name: seatName(personas, 2) }),
    },
    {
      score: them,
      id: 'them',
      team: t('spades.team.them'),
      label: t('spades.team.themNames', {
        a: seatName(personas, teamSeats(1)[0]),
        b: seatName(personas, teamSeats(1)[1]),
      }),
    },
  ];

  return (
    <motion.section
      aria-labelledby={captionId}
      data-testid="spades-scores"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, delay: 0.25 }}
      className="border-gold-300/45 relative mx-auto w-full max-w-[34rem] overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,rgb(11_31_22/0.92),rgb(6_20_14/0.95))] px-3 py-3 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.95)] sm:px-4"
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption id={captionId} className="mb-2 text-start">
            <span className="font-display text-gold-100 block text-lg font-bold">
              {t('spades.results.title')}
            </span>
            <span className="text-mist text-xs">
              {tie ? t('spades.results.tie') : t('spades.results.caption')}
            </span>
          </caption>
          <thead>
            <tr className="text-mist text-[0.625rem] tracking-[0.1em] uppercase">
              <th scope="col" className="py-1 text-start font-semibold">
                {t('spades.results.team')}
              </th>
              <th scope="col" className="px-1 py-1 text-end font-semibold">
                {t('spades.results.contract')}
              </th>
              <th scope="col" className="px-1 py-1 text-end font-semibold">
                {t('spades.results.contractPoints')}
              </th>
              <th scope="col" className="px-1 py-1 text-end font-semibold">
                {t('spades.results.bags')}
              </th>
              <th scope="col" className="px-1 py-1 text-end font-semibold">
                {t('spades.results.nil')}
              </th>
              <th scope="col" className="py-1 text-end font-semibold">
                {t('spades.results.total')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ score, id, team, label }) => {
              const won = score.total > (id === 'us' ? them.total : us.total);
              return (
                <tr
                  key={id}
                  data-testid={`spades-score-${id}`}
                  data-total={score.total}
                  data-made={score.made}
                  data-bags={score.bags}
                  data-winner={won || undefined}
                  className={cn(
                    'border-gold-300/15 border-t align-top',
                    won ? 'text-gold-100' : 'text-cream/85',
                    id === 'us' && 'font-bold',
                  )}
                >
                  <th scope="row" className="py-1.5 text-start font-semibold">
                    <span className="flex items-start gap-1.5">
                      {won ? (
                        <TrophyIcon
                          size={14}
                          className="text-gold-300 mt-0.5 shrink-0"
                          aria-hidden="true"
                        />
                      ) : (
                        <span aria-hidden="true" className="block w-3.5 shrink-0" />
                      )}
                      <span className="min-w-0">
                        {/* "Us" / "Them" in bold, the players' names small beneath (so a
                            narrow phone doesn't wrap the names one word per line). */}
                        <span className="block">{team}</span>{' '}
                        <span className="text-mist block text-[0.6875rem] leading-snug font-normal">
                          {label}
                        </span>
                        {won ? (
                          <span className="sr-only"> ({t('spades.results.winner')})</span>
                        ) : null}
                        {score.nils.map((n) => (
                          <span
                            key={n.seat}
                            className={cn(
                              'block text-[0.6875rem] font-semibold',
                              n.made ? 'text-gold-300' : 'text-velvet-300',
                            )}
                          >
                            {n.made
                              ? t('spades.results.nilMade', { name: seatName(personas, n.seat) })
                              : t('spades.results.nilFailed', { name: seatName(personas, n.seat) })}
                          </span>
                        ))}
                      </span>
                    </span>
                  </th>
                  <td className="tabular px-1 py-1.5 text-end whitespace-nowrap">
                    {score.contractTricks}/{score.contract}
                    <span
                      className={cn(
                        'block text-[0.625rem] font-semibold uppercase',
                        score.made ? 'text-gold-300' : 'text-velvet-300',
                      )}
                    >
                      {score.contract === 0
                        ? ''
                        : score.made
                          ? t('spades.results.made')
                          : t('spades.results.set')}
                    </span>
                  </td>
                  <td className="tabular px-1 py-1.5 text-end">{signed(score.contractPoints)}</td>
                  <td className="tabular px-1 py-1.5 text-end">{signed(score.bags)}</td>
                  <td className="tabular px-1 py-1.5 text-end">{signed(score.nilPoints)}</td>
                  <td className="tabular py-1.5 text-end text-base font-extrabold">
                    {score.total < 0 ? `−${Math.abs(score.total)}` : score.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-mist mt-2 text-[0.6875rem]">{t('spades.results.bagsHint')}</p>
    </motion.section>
  );
}
