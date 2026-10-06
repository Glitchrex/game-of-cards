'use client';
/**
 * One bot's place at the Crazy Eights table: the shared <Seat/> (avatar, name, tagline,
 * turn glow, thinking dots) holding a fan of card BACKS — how many cards the bot holds,
 * never which — and a count chip that shouts "2 cards left!" and "Last card!". Once the
 * game is over the bot's cards turn face up with their points.
 */
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState, type Ref } from 'react';
import { CardBack, cardCountText, PlayingCard, rowLayout } from '@/components/cards';
import { Seat } from '@/components/play/Seat';
import { cn } from '@/components/ui/cn';
import { type CardCode } from '@/games/core/cards';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { handPoints } from '../engine';
import { cardList, countText, DEAL_SECONDS } from './shared';

export interface OpponentSeatProps {
  seat: PlayerId;
  persona: BotPersona;
  /** How many cards the seat holds (public). */
  count: number;
  /** The seat's real cards — passed ONLY once the game is over. */
  revealed: readonly CardCode[] | null;
  active: boolean;
  thinking: boolean;
  winner: boolean;
  /** The game ended blocked: points decide it, so show them. */
  showPoints: boolean;
  /** Hide taglines when the row is crowded (three opponents on a phone). */
  compact: boolean;
  /** Where cards fly to and from (the fan). */
  fanRef: Ref<HTMLDivElement>;
}

export function OpponentSeat({
  seat,
  persona,
  count,
  revealed,
  active,
  thinking,
  winner,
  showPoints,
  compact,
  fanRef,
}: OpponentSeatProps) {
  return (
    <Seat
      persona={persona}
      active={active}
      thinking={thinking}
      layout="column"
      avatarSize={compact ? 'xs' : 'sm'}
      showTagline={!compact}
      className={cn(
        'h-full min-h-[9.5rem] justify-between px-1.5 py-2 sm:min-h-[10.5rem] sm:px-3',
        winner && 'border-gold-200/90 shadow-[0_0_30px_-6px_rgb(245_215_122/0.8)]',
      )}
      data-testid={`c8-seat-${seat}`}
    >
      <div className="flex flex-col items-center gap-1.5">
        <div ref={fanRef} className="flex w-full justify-center">
          {revealed ? (
            <RevealedFan name={persona.name} cards={revealed} />
          ) : (
            <BackFan seat={seat} name={persona.name} count={count} />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1">
          <CountChip seat={seat} count={count} winner={winner} />
          {showPoints && revealed ? (
            <span
              data-testid={`c8-points-${seat}`}
              data-points={handPoints(revealed)}
              className="border-gold-300/40 bg-felt-950/75 text-gold-100 tabular rounded-full border px-2 py-0.5 text-[0.6875rem] font-bold"
            >
              <span className="sr-only">
                {t('crazyEights.count.pointsLabel', {
                  name: persona.name,
                  n: handPoints(revealed),
                })}
              </span>
              <span aria-hidden="true">
                {t('crazyEights.count.points', { n: handPoints(revealed) })}
              </span>
            </span>
          ) : null}
        </div>
      </div>
    </Seat>
  );
}

const FAN_W = 'clamp(18px, 5vw, 30px)';

/** A fan of card backs: only the count is real. */
function BackFan({ seat, name, count }: { seat: PlayerId; name: string; count: number }) {
  const reduced = useReducedMotionPref();
  const row = rowLayout(count, FAN_W, `calc(-0.6 * ${FAN_W})`, 0.18);
  // Only the opening deal staggers; cards drawn later arrive straight away.
  const [opening] = useState(count);
  return (
    <div
      role="img"
      aria-label={t('crazyEights.zone.backs', { name, count: cardCountText(count) })}
      data-testid={`c8-backs-${seat}`}
      data-count={count}
      className="relative flex items-end justify-center"
      style={{ ...row.container, minHeight: `calc(${FAN_W} * 1.45)` }}
    >
      <AnimatePresence initial={!reduced}>
        {Array.from({ length: count }, (_, i) => (
          <motion.span
            key={i}
            aria-hidden="true"
            className="relative inline-flex shrink-0"
            style={{ marginInlineStart: row.margin(i), zIndex: i }}
            initial={reduced ? false : { opacity: 0, y: 60, rotate: -14, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, rotate: (i - (count - 1) / 2) * 3, scale: 1 }}
            exit={
              reduced
                ? { opacity: 0, transition: { duration: 0 } }
                : { opacity: 0, y: 26, transition: { duration: 0.2 } }
            }
            transition={
              reduced
                ? { duration: 0 }
                : {
                    delay: i < opening ? Math.min(i * 0.05 + seat * 0.03, DEAL_SECONDS - 0.2) : 0,
                    type: 'spring',
                    stiffness: 420,
                    damping: 30,
                  }
            }
          >
            <CardBack size="xs" style={{ width: FAN_W }} />
          </motion.span>
        ))}
      </AnimatePresence>
    </div>
  );
}

const REVEAL_W = 'clamp(26px, 7.5vw, 40px)';

/** The bot's cards turned face up at the end of the game. */
function RevealedFan({ name, cards }: { name: string; cards: readonly CardCode[] }) {
  const reduced = useReducedMotionPref();
  // Mount face down, then turn the cards over (the flip is the "showdown" moment).
  const [down, setDown] = useState(!reduced);
  useEffect(() => {
    if (!down) return;
    const id = window.setTimeout(() => setDown(false), 120);
    return () => window.clearTimeout(id);
  }, [down]);
  const row = rowLayout(cards.length, REVEAL_W, `calc(-0.45 * ${REVEAL_W})`, 0.3);
  const label =
    cards.length > 0
      ? t('crazyEights.zone.revealed', { name, cards: cardList(cards) })
      : t('crazyEights.zone.revealedEmpty', { name });
  return (
    <div
      role="img"
      aria-label={label}
      className="relative flex items-end justify-center"
      style={{ ...row.container, minHeight: `calc(${REVEAL_W} * 1.4)` }}
    >
      {cards.map((code, i) => (
        <span
          key={code}
          className="relative inline-flex shrink-0"
          style={{ marginInlineStart: row.margin(i), zIndex: i }}
        >
          <PlayingCard
            code={code}
            faceDown={down}
            flipDelay={i * 0.06}
            size="xs"
            decorative
            style={{ width: REVEAL_W }}
          />
        </span>
      ))}
    </div>
  );
}

function CountChip({ seat, count, winner }: { seat: PlayerId; count: number; winner: boolean }) {
  const reduced = useReducedMotionPref();
  const last = count === 1;
  const warn = count === 2;
  return (
    <motion.span
      key={count}
      data-testid={`c8-count-${seat}`}
      data-count={count}
      data-last={last || undefined}
      initial={reduced || !(last || warn) ? false : { scale: 1.6, rotate: -8, opacity: 0 }}
      animate={{ scale: 1, rotate: 0, opacity: 1 }}
      transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 460, damping: 16 }}
      className={cn(
        'inline-flex min-h-6 items-center rounded-full border px-2 text-[0.6875rem] font-extrabold tracking-wide whitespace-nowrap uppercase shadow-[0_6px_14px_-8px_rgb(0_0_0/0.9)]',
        winner
          ? 'border-gold-100 text-ink bg-[linear-gradient(180deg,var(--color-gold-100),var(--color-gold-400))]'
          : last
            ? 'border-velvet-300/80 bg-velvet-600 text-cream'
            : warn
              ? 'border-gold-300/70 bg-felt-950/80 text-gold-200'
              : 'border-gold-300/30 bg-felt-950/70 text-mist',
      )}
    >
      {countText(count, winner)}
    </motion.span>
  );
}
