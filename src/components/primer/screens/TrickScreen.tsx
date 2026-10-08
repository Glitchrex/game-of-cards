'use client';
import { useState } from 'react';
import { motion, useAnimate } from 'motion/react';
import { type CardCode, type Suit, SUIT_NAMES, cardName } from '@/games/core/cards';
import { PlayingCard, SuitIcon } from '@/components/cards';
import { type TKey, t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { ScreenFrame, type Feedback } from '../ScreenFrame';

type Seat = 'west' | 'north' | 'east' | 'south';

interface Play {
  seat: Seat;
  code: CardCode;
  /** Feedback shown when this card is picked as the winner. */
  feedback: TKey;
}

export interface TrickConfig {
  ns: 'trick' | 'trump';
  /** In playing order; the first card is the one that was led. */
  plays: Play[];
  /** Index into `plays` of the winning card. */
  winner: number;
  led: Suit;
  trump?: Suit;
}

export const TRICK: TrickConfig = {
  ns: 'trick',
  led: 'H',
  winner: 2,
  plays: [
    { seat: 'west', code: '7H', feedback: 'primer.screens.trick.wrongLow' },
    { seat: 'north', code: 'KC', feedback: 'primer.screens.trick.wrongOffSuit' },
    { seat: 'east', code: 'TH', feedback: 'primer.screens.trick.right' },
    { seat: 'south', code: '4H', feedback: 'primer.screens.trick.wrongLow' },
  ],
};

export const TRUMP: TrickConfig = {
  ns: 'trump',
  led: 'D',
  trump: 'S',
  winner: 2,
  plays: [
    { seat: 'west', code: '9D', feedback: 'primer.screens.trump.wrongLow' },
    { seat: 'north', code: 'AD', feedback: 'primer.screens.trump.wrongAce' },
    { seat: 'east', code: '2S', feedback: 'primer.screens.trump.right' },
    { seat: 'south', code: 'JD', feedback: 'primer.screens.trump.wrongLow' },
  ],
};

const SEAT_CELL: Record<Seat, string> = {
  north: 'col-start-2 row-start-1',
  west: 'col-start-1 row-start-2',
  east: 'col-start-3 row-start-2',
  south: 'col-start-2 row-start-3',
};

/** Where each seat's card flies in from. */
const SEAT_FROM: Record<Seat, { x: number; y: number; rotate: number }> = {
  north: { x: 0, y: -70, rotate: -8 },
  west: { x: -80, y: 0, rotate: -12 },
  east: { x: 80, y: 0, rotate: 12 },
  south: { x: 0, y: 80, rotate: 6 },
};

const SEAT_TILT: Record<Seat, number> = { north: 2, west: -4, east: 4, south: -1 };

export function TrickScreen({
  config,
  focusHeading,
}: {
  config: TrickConfig;
  focusHeading: boolean;
}) {
  const reduced = useReducedMotionPref();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [solved, setSolved] = useState(false);
  const { ns } = config;

  const seatName = (seat: Seat) => t(`primer.screens.trick.seats.${seat}`);

  const choose = (i: number) => {
    const play = config.plays[i];
    if (!play) return;
    if (i === config.winner) {
      setSolved(true);
      setFeedback({ tone: 'done', text: t(play.feedback) });
      return;
    }
    setFeedback({ tone: 'wrong', text: t(play.feedback) });
    const el = scope.current?.querySelector(`[data-seat="${play.seat}"]`);
    if (el && !reduced) animate(el, { x: [0, -7, 7, -4, 4, 0] }, { duration: 0.4 });
  };

  const centre = config.trump ? (
    <div className="border-gold-300/60 bg-felt-950/60 shadow-glow flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-center">
      <span className="bg-ivory flex size-9 items-center justify-center rounded-full">
        <SuitIcon suit={config.trump} size={24} />
      </span>
      <span className="text-gold-200 text-[11px] leading-tight font-bold">
        {t('primer.screens.trump.badge')}
      </span>
    </div>
  ) : (
    <div className="border-gold-300/30 bg-felt-950/50 flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-center">
      <span className="bg-ivory flex size-9 items-center justify-center rounded-full">
        <SuitIcon suit={config.led} size={24} />
      </span>
      <span className="text-gold-200 text-[11px] leading-tight font-bold">
        {t('primer.screens.trick.ledBadge', { suit: SUIT_NAMES[config.led] })}
      </span>
    </div>
  );

  return (
    <ScreenFrame
      focusHeading={focusHeading}
      title={t(`primer.screens.${ns}.title`)}
      body={<p>{t(`primer.screens.${ns}.body`)}</p>}
      action={solved ? undefined : t(`primer.screens.${ns}.action`)}
      feedback={feedback}
    >
      <div
        ref={scope}
        role="group"
        aria-label={t('primer.screens.trick.tableLabel')}
        className="grid w-full max-w-[22rem] grid-cols-3 grid-rows-[auto_auto_auto] place-items-center gap-x-1 gap-y-2"
      >
        <div className="col-start-2 row-start-2">{centre}</div>
        {config.plays.map((play, i) => {
          const from = SEAT_FROM[play.seat];
          const isWinner = solved && i === config.winner;
          return (
            <motion.div
              key={play.seat}
              className={`${SEAT_CELL[play.seat]} flex flex-col items-center gap-1`}
              initial={reduced ? false : { opacity: 0, ...from }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: SEAT_TILT[play.seat] }}
              transition={
                reduced
                  ? { duration: 0 }
                  : { delay: 0.25 + i * 0.32, type: 'spring', stiffness: 260, damping: 24 }
              }
            >
              <div data-seat={play.seat}>
                <PlayingCard
                  code={play.code}
                  size="md"
                  onClick={() => choose(i)}
                  suggested={isWinner}
                  dimmed={solved && !isWinner}
                  ariaLabel={t('primer.screens.trick.playedBy', {
                    card: cardName(play.code),
                    seat: seatName(play.seat),
                  })}
                  ariaDescription={i === 0 ? t('primer.screens.trick.led') : undefined}
                  data-testid={`${ns}-card-${i}`}
                />
              </div>
              <span className="text-mist flex items-center gap-1 text-[11px] font-bold tracking-[0.12em] uppercase">
                {seatName(play.seat)}
                {i === 0 && (
                  <span className="bg-gold-300 text-ink rounded-full px-1.5 py-px text-[10px] tracking-normal">
                    {t('primer.screens.trick.led')}
                  </span>
                )}
                {isWinner && (
                  <span className="bg-gold-300 text-ink rounded-full px-1.5 py-px text-[10px] tracking-normal">
                    {t('primer.screens.trick.winnerBadge')}
                  </span>
                )}
              </span>
            </motion.div>
          );
        })}
      </div>
    </ScreenFrame>
  );
}
