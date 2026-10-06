'use client';
/**
 * The learner's hand, grouped by rank: each rank is ONE button (`gofish-rank-<R>`,
 * aria-pressed) showing its cards fanned with a ×count badge, so it is obvious which ranks
 * you can ask for. The row is a roving-tabindex toolbar (one tab stop; ←/→ move,
 * Enter/Space pick). A group that just grew wears a "New" tag; when a group becomes a book
 * it flies to your book area (shared layout id).
 */
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { PlayingCard, rowLayout } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { type Rank } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { rankPlural } from '../rules';
import { SuggestedRing } from './Seats';
import { cardList, type RankGroup } from './shared';
import { useRoving } from './useRoving';

/**
 * Card width in the hand. At 375px six one-card groups still fit on one row (a fresh deal
 * usually has five to seven ranks).
 */
const CARD_W = 'clamp(36px, 9.8vw, 64px)';

export interface HandGroupsProps {
  groups: readonly RankGroup[];
  picked: Rank | null;
  /** Ranks that glow (coach mode: ranks you may ask for). */
  glow: ReadonlySet<Rank>;
  suggested: Rank | null;
  /** Ranks that just arrived (caught, fished or refilled). */
  fresh: ReadonlySet<Rank>;
  busy: boolean;
  busyId: string;
  suggestedId: string;
  layoutPrefix: string;
  onPick: (rank: Rank) => void;
}

export function HandGroups({
  groups,
  picked,
  glow,
  suggested,
  fresh,
  busy,
  busyId,
  suggestedId,
  layoutPrefix,
  onPick,
}: HandGroupsProps) {
  const reduced = useReducedMotionPref();
  const roving = useRoving(groups.map((g) => g.rank));
  // Groups on the table when it mounted are dealt in one after another.
  const [opening] = useState<ReadonlySet<Rank>>(() => new Set(groups.map((g) => g.rank)));

  if (groups.length === 0) {
    return (
      <p data-testid="gofish-hand" data-count={0} className="text-mist py-6 text-center text-sm">
        {t('goFish.zone.handEmpty')}
      </p>
    );
  }

  return (
    <div
      role="toolbar"
      aria-label={t('goFish.zone.hand')}
      aria-orientation="horizontal"
      data-testid="gofish-hand"
      data-count={groups.reduce((n, g) => n + g.cards.length, 0)}
      onKeyDown={roving.onKeyDown}
      onFocus={roving.onFocus}
      onBlur={roving.onBlur}
      className="flex flex-wrap items-end justify-center gap-x-1 gap-y-3 pt-3 sm:gap-x-2.5"
    >
      {groups.map((g, i) => {
        const isPicked = picked === g.rank;
        const isGlow = glow.has(g.rank);
        const isSuggested = suggested === g.rank;
        const isFresh = fresh.has(g.rank);
        const row = rowLayout(g.cards.length, CARD_W, `calc(-0.66 * ${CARD_W})`, 0.3);
        const describedBy = [busy ? busyId : null, isSuggested && !busy ? suggestedId : null]
          .filter(Boolean)
          .join(' ');
        const delay = opening.has(g.rank) && !reduced ? Math.min(i * 0.07, 0.6) : 0;
        return (
          <motion.div
            key={g.rank}
            layoutId={reduced ? undefined : `${layoutPrefix}-rank-${g.rank}`}
            layout={reduced ? false : 'position'}
            initial={reduced ? false : { opacity: 0, y: '-70%', rotate: -8 }}
            animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={
              reduced ? { duration: 0 } : { type: 'spring', stiffness: 360, damping: 28, delay }
            }
            className="relative"
          >
            <button
              ref={roving.refFor(g.rank)}
              type="button"
              data-roving-key={g.rank}
              tabIndex={roving.tabIndexFor(g.rank)}
              data-testid={`gofish-rank-${g.rank}`}
              data-count={g.cards.length}
              data-highlighted={isGlow || undefined}
              data-suggested={isSuggested || undefined}
              data-fresh={isFresh || undefined}
              aria-pressed={isPicked}
              aria-label={t('goFish.zone.group', {
                rank: rankPlural(g.rank),
                cards: cardList(g.cards),
              })}
              aria-describedby={describedBy || undefined}
              aria-disabled={busy || undefined}
              onClick={() => onPick(g.rank)}
              className={cn(
                'ease-snap relative flex min-h-11 min-w-11 flex-col items-center gap-1 rounded-xl border px-0.5 pt-1 pb-1.5 transition-[transform,background-color,border-color,box-shadow] duration-150 select-none sm:px-1',
                isPicked
                  ? 'border-gold-200 -translate-y-2 bg-[linear-gradient(180deg,rgb(245_215_122/0.34),rgb(214_164_44/0.16))] shadow-[inset_0_0_0_1px_rgb(251_232_166/0.6),0_12px_24px_-12px_rgb(245_215_122/0.95)]'
                  : 'hover:border-gold-300/40 hover:bg-felt-950/30 border-transparent hover:-translate-y-1',
                busy && 'cursor-not-allowed',
              )}
            >
              {isGlow && !isSuggested ? (
                <span
                  aria-hidden="true"
                  className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
                />
              ) : null}
              {isSuggested ? <SuggestedRing testId={`gofish-rank-${g.rank}-ring`} /> : null}
              {isFresh && !isSuggested ? (
                <span
                  aria-hidden="true"
                  className="bg-velvet-500 text-ivory absolute -top-2 -left-1 z-20 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] uppercase shadow"
                >
                  {t('goFish.you.new')}
                </span>
              ) : null}
              {/* A fixed width: the button shrinks to fit its content, so the row's usual
                  `min(100%, …)` would collapse to nothing and the cards would spill out. */}
              <span
                className="relative flex items-end"
                style={{ ...row.container, width: row.natural }}
                data-testid={`gofish-cards-${g.rank}`}
              >
                <AnimatePresence initial={false}>
                  {g.cards.map((code, ci) => (
                    <motion.span
                      key={code}
                      className="relative inline-flex shrink-0"
                      style={{ marginInlineStart: row.margin(ci), zIndex: ci }}
                      initial={reduced ? false : { opacity: 0, y: '-60%', rotate: 10 }}
                      animate={{ opacity: 1, y: 0, rotate: 0 }}
                      transition={
                        reduced ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 26 }
                      }
                    >
                      <PlayingCard code={code} decorative style={{ width: CARD_W }} />
                    </motion.span>
                  ))}
                </AnimatePresence>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  'tabular inline-flex min-h-5 items-center rounded-full px-1.5 text-[0.6875rem] leading-none font-extrabold',
                  isPicked ? 'bg-gold-300 text-ink' : 'bg-felt-950/70 text-gold-200',
                )}
              >
                {t('goFish.you.count', { n: g.cards.length })}
              </span>
            </button>
          </motion.div>
        );
      })}
    </div>
  );
}
