'use client';
/**
 * The end of the hand: a moon banner when someone took all 26 points, and the final score
 * sheet (points taken, the score after the moon rule, the winner or winners).
 */
import { motion } from 'motion/react';
import { useId } from 'react';
import { cn } from '@/components/ui/cn';
import { HeartIcon, TrophyIcon } from '@/components/ui/icons';
import { type BotPersona } from '@/games/core/module';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type HeartsState } from '../engine';
import { lowestScorers, scoreHand, SEATS } from '../rules';
import { capturedBy } from './shared';

export function ScoreSheet({
  state,
  personas,
}: {
  state: HeartsState;
  personas: readonly BotPersona[];
}) {
  const reduced = useReducedMotionPref();
  const captionId = useId();
  const { scores, moonShooter } = scoreHand(state.points);
  const winners = lowestScorers(scores);
  const nameOf = (seat: number) => personas[seat]?.name ?? t('play.seat.you');

  return (
    <motion.section
      aria-labelledby={captionId}
      data-testid="hearts-scores"
      initial={reduced ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduced ? { duration: 0 } : { duration: 0.4, delay: 0.25 }}
      className="border-gold-300/45 relative mx-auto w-full max-w-[30rem] overflow-hidden rounded-2xl border bg-[linear-gradient(180deg,rgb(11_31_22/0.92),rgb(6_20_14/0.95))] px-3 py-3 shadow-[0_18px_40px_-20px_rgb(0_0_0/0.95)] sm:px-4"
    >
      {moonShooter !== null ? (
        <motion.p
          data-testid="hearts-moon"
          data-shooter={moonShooter}
          initial={reduced ? false : { scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 16 }}
          className="font-display text-foil mb-2 text-center text-xl font-bold sm:text-2xl"
        >
          <span aria-hidden="true">☾ </span>
          {moonShooter === 0
            ? t('hearts.results.youMoon')
            : t('hearts.results.moon', { name: nameOf(moonShooter) })}
          <span className="text-mist mt-0.5 block font-sans text-xs font-semibold">
            {t('hearts.results.moonHint')}
          </span>
        </motion.p>
      ) : null}
      <table className="w-full border-collapse text-sm">
        <caption id={captionId} className="mb-2 text-start">
          <span className="font-display text-gold-100 block text-lg font-bold">
            {t('hearts.results.title')}
          </span>
          <span className="text-mist text-xs">{t('hearts.results.caption')}</span>
        </caption>
        <thead>
          <tr className="text-mist text-[0.6875rem] tracking-[0.12em] uppercase">
            <th scope="col" className="py-1 text-start font-semibold">
              {t('hearts.results.player')}
            </th>
            <th scope="col" className="py-1 text-end font-semibold">
              {t('hearts.results.taken')}
            </th>
            <th scope="col" className="py-1 text-end font-semibold">
              {t('hearts.results.score')}
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: SEATS }, (_, seat) => {
            const won = winners.includes(seat);
            const captured = capturedBy(state, seat);
            return (
              <tr
                key={seat}
                data-testid={`hearts-score-${seat}`}
                data-score={scores[seat]}
                data-winner={won || undefined}
                className={cn(
                  'border-gold-300/15 border-t',
                  won ? 'text-gold-100' : 'text-cream/85',
                  seat === 0 && 'font-bold',
                )}
              >
                <th scope="row" className="py-1.5 text-start font-semibold">
                  <span className="inline-flex items-center gap-1.5">
                    {won ? (
                      <TrophyIcon size={14} className="text-gold-300" aria-hidden="true" />
                    ) : (
                      <span aria-hidden="true" className="inline-block w-3.5" />
                    )}
                    {nameOf(seat)}
                    {won ? <span className="sr-only">({t('hearts.results.winner')})</span> : null}
                  </span>
                </th>
                <td className="tabular py-1.5 text-end">
                  <span className="inline-flex items-center gap-1">
                    <HeartIcon size={11} className="text-velvet-300" aria-hidden="true" />
                    {captured.points}
                  </span>
                </td>
                <td className="tabular py-1.5 text-end text-base font-extrabold">{scores[seat]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </motion.section>
  );
}
