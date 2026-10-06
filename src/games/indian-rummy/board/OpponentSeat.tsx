'use client';
/**
 * A bot's place at the table: persona, "Thinking…" dots, and its cards as plain card backs
 * (a count — never the real codes) until the game is over. Then the hand is shown in the
 * groups it makes, with what that player pays.
 */
import { motion } from 'motion/react';
import { useState, type RefObject } from 'react';
import { CardBack, PlayingCard, rowLayout } from '@/components/cards';
import { joinNames } from '@/components/play/personas';
import { Seat } from '@/components/play/Seat';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { type CardCode, type Rank } from '@/games/core/cards';
import { type BotPersona } from '@/games/core/module';
import { type PlayerId } from '@/games/core/types';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { displayGroups, groupLabel, groupTitle, isMeld } from './arrange';
import { Flyer } from './Flyer';

const BACK_W = 'clamp(26px, 6.4vw, 38px)';
const BACK_GAP = `calc(-0.62 * ${BACK_W})`;
const SHOW_W = 'clamp(30px, 7.6vw, 44px)';
const SHOW_GAP = `calc(-0.42 * ${SHOW_W})`;

export interface OpponentSeatProps {
  seat: PlayerId;
  persona: BotPersona;
  count: number;
  active: boolean;
  thinking: boolean;
  dropped: number | null;
  /** The real cards — only passed once the game is over. */
  revealed: readonly CardCode[] | null;
  wildRank: Rank;
  /** What this seat pays (game over), or 'declared' / 'winner'. */
  verdict: { kind: 'pays'; points: number } | { kind: 'declared' } | { kind: 'winner' } | null;
  /** Where a card it draws comes from (stock / open pile), for this render. */
  drawFrom: RefObject<HTMLElement | null> | null;
  /** Opening deal: backs fly from the stock with this stagger. */
  dealFrom: RefObject<HTMLElement | null> | null;
  ref?: RefObject<HTMLDivElement | null>;
}

export function OpponentSeat({
  seat,
  persona,
  count,
  active,
  thinking,
  dropped,
  revealed,
  wildRank,
  verdict,
  drawFrom,
  dealFrom,
  ref,
}: OpponentSeatProps) {
  const reduced = useReducedMotionPref();
  // Backs are keyed by position: a 14th back that appears this render flew in from a pile.
  const [known, setKnown] = useState(() => ({ count, opening: true }));
  if (known.count !== count) setKnown({ count, opening: false });
  const freshFrom = (i: number) => {
    if (known.opening) return dealFrom;
    return i >= count - 1 && drawFrom ? drawFrom : null;
  };
  const row = rowLayout(count, BACK_W, BACK_GAP, 0.25);
  const zoneLabel = revealed
    ? t('indianRummy.zone.opponentRevealed', {
        name: persona.name,
        groups: joinNames(displayGroups(revealed, wildRank, 'group').map(groupLabel)),
      })
    : dropped !== null
      ? t('indianRummy.zone.dropped', { name: persona.name })
      : t('indianRummy.zone.opponent', {
          name: persona.name,
          count: t('indianRummy.seat.cards', { n: count }),
        });

  return (
    <div ref={ref} className="min-w-0">
      <Seat
        persona={persona}
        active={active}
        thinking={thinking}
        score={t('indianRummy.seat.cards', { n: count })}
        data-testid={`rummy-seat-${seat}`}
        className="min-h-[5.25rem]"
      >
        <div
          role="group"
          aria-label={zoneLabel}
          data-testid={`rummy-opponent-hand-${seat}`}
          data-revealed={revealed ? 'true' : 'false'}
          data-count={count}
          className="flex flex-col items-center gap-1.5"
        >
          {revealed ? (
            <div className="flex flex-wrap items-end justify-center gap-1.5">
              {displayGroups(revealed, wildRank, 'group').map((g, gi) => {
                const r = rowLayout(g.cards.length, SHOW_W, SHOW_GAP, 0.3);
                return (
                  <motion.div
                    key={g.id}
                    initial={reduced ? false : { opacity: 0, y: -10, rotateY: 90 }}
                    animate={{ opacity: 1, y: 0, rotateY: 0 }}
                    transition={reduced ? { duration: 0 } : { delay: 0.12 * gi, duration: 0.35 }}
                    style={{ width: `min(100%, calc(${r.natural} + 0.5rem + 2px))` }}
                    className={cn(
                      'flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 pt-0.5 pb-1',
                      isMeld(g.kind) ? 'border-gold-300/50' : 'border-mist/35 border-dashed',
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        'max-w-full text-center text-[0.5625rem] leading-3 font-extrabold tracking-[0.06em] uppercase',
                        isMeld(g.kind) ? 'text-gold-200' : 'text-mist',
                      )}
                    >
                      {groupTitle(g.kind)}
                    </span>
                    <div className="flex items-end" style={r.container}>
                      {g.cards.map((c, i) => (
                        <span
                          key={c.key}
                          className="relative shrink-0"
                          style={{ marginInlineStart: r.margin(i), zIndex: i }}
                        >
                          <PlayingCard
                            code={c.code}
                            size="xs"
                            decorative
                            style={{ width: SHOW_W }}
                          />
                        </span>
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div
              aria-hidden="true"
              className={cn('flex items-end justify-center', dropped !== null && 'opacity-45')}
              style={{ ...row.container, minHeight: `calc(${BACK_W} * 1.4)` }}
            >
              {Array.from({ length: count }, (_, i) => (
                <span
                  key={`b${i}`}
                  className="relative shrink-0"
                  style={{ marginInlineStart: row.margin(i), zIndex: i }}
                >
                  <Flyer from={freshFrom(i)} delay={known.opening ? i * 0.1 + 0.05 : 0}>
                    {() => <CardBack size="xs" style={{ width: BACK_W }} />}
                  </Flyer>
                </span>
              ))}
            </div>
          )}
          {dropped !== null ? (
            <Badge tone="velvet" size="sm" data-testid={`rummy-dropped-${seat}`}>
              {t('indianRummy.seat.dropped', { points: dropped })}
            </Badge>
          ) : null}
          {verdict ? <Verdict verdict={verdict} seat={seat} /> : null}
        </div>
      </Seat>
    </div>
  );
}

function Verdict({
  verdict,
  seat,
}: {
  verdict: NonNullable<OpponentSeatProps['verdict']>;
  seat: PlayerId;
}) {
  const reduced = useReducedMotionPref();
  const text =
    verdict.kind === 'pays'
      ? t('indianRummy.seat.pays', {
          points: t('indianRummy.outcome.points', { points: verdict.points }),
        })
      : verdict.kind === 'declared'
        ? t('indianRummy.seat.declared')
        : t('indianRummy.seat.winner');
  return (
    <motion.span
      initial={reduced ? false : { scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={
        reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20, delay: 0.3 }
      }
      className="inline-flex"
      data-testid={`rummy-verdict-${seat}`}
      data-verdict={verdict.kind}
    >
      <Badge tone={verdict.kind === 'pays' ? 'velvet' : 'gold'}>{text}</Badge>
    </motion.span>
  );
}
