'use client';
/**
 * The scoreboard strip under the trick: "Us 4/5" and "Them 3/6" (tricks won toward the
 * team's bid), each team's Nil status, and whether Spades are broken yet.
 */
import { motion } from 'motion/react';
import { cn } from '@/components/ui/cn';
import { SpadeIcon } from '@/components/ui/icons';
import { type BotPersona } from '@/games/core/module';
import { t } from '@/games/spades/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { seatName, tricksWords, type TeamTally } from './shared';

export function TeamPanels({
  us,
  them,
  personas,
  spadesBroken,
  showBroken,
}: {
  us: TeamTally;
  them: TeamTally;
  personas: readonly BotPersona[];
  spadesBroken: boolean;
  /** Hidden during bidding (no card has been played yet). */
  showBroken: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={t('spades.team.label')}
      className="flex flex-wrap items-stretch justify-center gap-1.5 sm:gap-2"
    >
      <TeamPanel tally={us} personas={personas} mine />
      <TeamPanel tally={them} personas={personas} mine={false} />
      {showBroken ? <SpadesBrokenChip broken={spadesBroken} /> : null}
    </div>
  );
}

function TeamPanel({
  tally,
  personas,
  mine,
}: {
  tally: TeamTally;
  personas: readonly BotPersona[];
  mine: boolean;
}) {
  const reduced = useReducedMotionPref();
  const [a, b] = tally.seats;
  const names = mine
    ? t('spades.team.usNames', { name: seatName(personas, b) })
    : t('spades.team.themNames', { a: seatName(personas, a), b: seatName(personas, b) });
  const won = tricksWords(tally.won);
  const aria = tally.bidsIn
    ? t(mine ? 'spades.team.usAria' : 'spades.team.themAria', {
        names,
        won,
        bid: tricksWords(tally.contract),
      })
    : t(mine ? 'spades.team.usAriaNoBid' : 'spades.team.themAriaNoBid', { names, won });
  const made = tally.bidsIn && tally.contract > 0 && tally.need === 0;
  return (
    <div
      data-testid={mine ? 'spades-team-us' : 'spades-team-them'}
      data-bid={tally.bidsIn ? tally.contract : undefined}
      data-tricks={tally.won}
      data-made={made || undefined}
      className={cn(
        'flex min-h-11 min-w-0 items-center gap-2 rounded-xl border px-2.5 py-1',
        mine
          ? 'border-gold-300/60 bg-[linear-gradient(180deg,rgb(245_215_122/0.16),rgb(6_20_14/0.6))]'
          : 'border-gold-300/20 bg-felt-950/55',
      )}
    >
      <span className="sr-only">{aria}</span>
      <span aria-hidden="true" className="flex flex-col leading-none">
        <span
          className={cn(
            'text-[0.625rem] font-extrabold tracking-[0.16em] uppercase',
            mine ? 'text-gold-300' : 'text-mist',
          )}
        >
          {mine ? t('spades.team.us') : t('spades.team.them')}
        </span>
        <span className="text-mist mt-0.5 hidden max-w-[9rem] truncate text-[0.625rem] sm:block">
          {names}
        </span>
      </span>
      <motion.span
        aria-hidden="true"
        key={`${tally.won}/${tally.contract}`}
        data-testid={mine ? 'spades-team-us-progress' : 'spades-team-them-progress'}
        initial={reduced ? false : { scale: 1.35 }}
        animate={{ scale: 1 }}
        transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 480, damping: 18 }}
        className={cn(
          'tabular font-display text-lg leading-none font-bold',
          mine ? 'text-gold-100' : 'text-cream',
        )}
      >
        {tally.bidsIn
          ? t('spades.team.progress', { won: tally.won, bid: tally.contract })
          : t('spades.team.progressNoBid', { won: tally.won })}
      </motion.span>
      {tally.bidsIn && tally.contract > 0 ? (
        <span
          aria-hidden="true"
          className={cn(
            'rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-wide whitespace-nowrap uppercase',
            made ? 'bg-gold-300 text-ink' : 'border-gold-300/30 text-mist border',
          )}
        >
          {made ? t('spades.team.made') : t('spades.team.need', { n: tally.need })}
        </span>
      ) : null}
      {tally.nils.map((n) => (
        <span
          key={n.seat}
          data-testid={`spades-nil-${n.seat}`}
          data-safe={n.safe}
          className={cn(
            'rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-wide whitespace-nowrap',
            n.safe ? 'bg-ink text-cream' : 'bg-velvet-700 text-cream',
          )}
        >
          <span className="sr-only">
            {n.seat === 0
              ? t(n.safe ? 'spades.team.nilSafeYou' : 'spades.team.nilBrokenYou')
              : t(n.safe ? 'spades.team.nilSafe' : 'spades.team.nilBroken', {
                  name: seatName(personas, n.seat),
                })}
          </span>
          <span aria-hidden="true">
            {n.safe ? t('spades.team.nilSafeShort') : t('spades.team.nilBrokenShort')}
          </span>
        </span>
      ))}
    </div>
  );
}

/** "Spades broken" / "Spades not broken": pops when the first Spade trumps another suit. */
export function SpadesBrokenChip({ broken }: { broken: boolean }) {
  const reduced = useReducedMotionPref();
  return (
    <motion.span
      key={broken ? 'broken' : 'whole'}
      data-testid="spades-broken"
      data-broken={broken}
      initial={reduced || !broken ? false : { scale: 1.6, rotate: -8 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 14 }}
      title={broken ? t('spades.table.brokenHint') : t('spades.table.notBrokenHint')}
      className={cn(
        'inline-flex min-h-8 items-center gap-1 self-center rounded-full border px-2.5 text-[0.6875rem] font-bold',
        broken
          ? 'border-cream/60 bg-ink text-cream'
          : 'border-gold-300/30 bg-felt-950/60 text-mist',
      )}
    >
      <SpadeIcon size={12} className={broken ? 'text-cream' : 'text-mist'} />
      {broken ? t('spades.table.broken') : t('spades.table.notBroken')}
      <span className="sr-only">
        {' '}
        {broken ? t('spades.table.brokenHint') : t('spades.table.notBrokenHint')}
      </span>
    </motion.span>
  );
}
