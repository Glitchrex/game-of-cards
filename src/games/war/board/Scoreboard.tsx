'use client';
/**
 * Under the table: the battle counter ("Battle 12 of 60 · 48 left") with a strip of
 * marquee bulbs that light up as battles are fought, and the card-count bar that shows who
 * holds more cards — gold for the learner, velvet for the opponent.
 */
import { motion } from 'motion/react';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type Pair } from '../engine';

export function Scoreboard({
  battles,
  maxBattles,
  over,
  counts,
  botName,
}: {
  battles: number;
  maxBattles: number;
  over: boolean;
  /** Pile sizes on show (they catch up with the state once a battle's reveal ends). */
  counts: Pair<number>;
  botName: string;
}) {
  const left = maxBattles - battles;
  const counter =
    battles === 0
      ? t('war.counter.none', { max: maxBattles })
      : t('war.counter.battle', { n: battles, max: maxBattles });
  const aside = over
    ? t('war.counter.over', {
        n: battles === 1 ? t('war.counter.battleOne') : t('war.counter.battles', { n: battles }),
      })
    : left === 1
      ? t('war.counter.leftOne')
      : battles > 0
        ? t('war.counter.left', { n: left })
        : null;

  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-2" data-testid="war-scoreboard">
      <div className="flex items-baseline justify-between gap-2">
        <p
          data-testid="war-counter"
          data-battles={battles}
          data-max={maxBattles}
          className="text-gold-100 tabular text-sm font-bold sm:text-base"
        >
          {counter}
        </p>
        {aside ? (
          <p
            className={cn(
              'tabular text-xs font-semibold',
              left <= 5 && !over ? 'text-gold-300' : 'text-mist',
            )}
          >
            {aside}
          </p>
        ) : null}
      </div>
      <BattleProgress battles={battles} maxBattles={maxBattles} />
      <CountBar counts={counts} botName={botName} />
    </div>
  );
}

/** A thin brass track that fills as battles are fought. */
function BattleProgress({ battles, maxBattles }: { battles: number; maxBattles: number }) {
  const reduced = useReducedMotionPref();
  const pct = maxBattles > 0 ? Math.min(100, (battles / maxBattles) * 100) : 0;
  return (
    <div
      aria-hidden="true"
      className="bg-felt-950/70 border-gold-300/20 relative h-1.5 overflow-hidden rounded-full border"
    >
      <motion.span
        className="absolute inset-y-0 left-0 block rounded-full bg-[linear-gradient(90deg,var(--color-gold-500),var(--color-gold-200))]"
        initial={false}
        animate={{ width: `${pct}%` }}
        transition={reduced ? { duration: 0 } : { duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  );
}

function CountBar({ counts, botName }: { counts: Pair<number>; botName: string }) {
  const reduced = useReducedMotionPref();
  const [you, bot] = counts;
  const total = you + bot;
  const share = total > 0 ? (you / total) * 100 : 50;
  const leader = you === bot ? 'level' : you > bot ? 'you' : 'bot';
  const label = `${t('war.bar.label')}: ${t('war.bar.value', { you, name: botName, bot })}`;

  return (
    <div
      role="img"
      aria-label={label}
      data-testid="war-count-bar"
      data-you={you}
      data-bot={bot}
      data-leader={leader}
      className="flex items-center gap-2"
    >
      <span
        aria-hidden="true"
        className={cn(
          'tabular min-w-[4.25rem] text-xs font-extrabold whitespace-nowrap sm:text-sm',
          leader === 'you' ? 'text-gold-200' : 'text-cream/85',
        )}
      >
        {t('war.bar.you', { n: you })}
      </span>
      <span
        aria-hidden="true"
        className="border-gold-300/40 relative h-3.5 flex-1 overflow-hidden rounded-full border bg-[linear-gradient(180deg,var(--color-velvet-500),var(--color-velvet-700))] shadow-[inset_0_1px_2px_rgb(0_0_0/0.6)]"
      >
        <motion.span
          className="absolute inset-y-0 left-0 block bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-500))] shadow-[2px_0_8px_rgb(245_215_122/0.6)]"
          initial={false}
          animate={{ width: `${share}%` }}
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 140, damping: 22 }}
        />
        <span className="bg-cream/60 absolute inset-y-0 left-1/2 block w-px" />
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'tabular max-w-[45%] min-w-[4.25rem] truncate text-right text-xs font-extrabold sm:text-sm',
          leader === 'bot' ? 'text-velvet-300' : 'text-cream/85',
        )}
      >
        {t('war.bar.bot', { name: botName.split(' ').at(-1) ?? botName, n: bot })}
      </span>
    </div>
  );
}
