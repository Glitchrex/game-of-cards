'use client';
/**
 * The loss overlay: a gentle comic beat (the cards wobble and deflate, a film reel
 * snaps), the roast line, its film, a real tip in a gold card, and Rematch.
 * Roast the move, never the person — the copy lives in content/titles.ts.
 */
import { motion } from 'motion/react';
import { useId, useRef } from 'react';
import { type Roast as RoastLine } from '@content/titles';
import { PlayingCard } from '@/components/cards';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { BookIcon } from '@/components/ui/icons';
import { formatJeetDelta } from '@/components/ui/Jeet';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { OverlayShell } from './OverlayShell';
import { stripTipPrefix } from './personas';
import { RatingPrompt } from './RatingPrompt';

export interface RoastProps {
  roast: RoastLine;
  /** One of the game's tips (content file), shown in the Tip card. */
  tip: string;
  gameName: string;
  /** Net Jeet for the hand (negative for a loss). */
  netJeet: number;
  /** The engine's one-sentence account of the hand, so the learner sees why they lost. */
  summary?: string;
  onRematch: () => void;
  onClose: () => void;
  /** Enables "Review the rules" and the rating prompt. */
  gameSlug?: string;
  open?: boolean;
}

/** Half a strip of film with sprocket holes; `side` decides which end is torn. */
function FilmHalf({ side }: { side: 'left' | 'right' }) {
  const torn =
    side === 'left'
      ? 'M0 0 H54 L58 5 L53 10 L59 15 L52 20 L57 26 L53 30 H0 Z'
      : 'M6 0 H60 V30 H6 L2 25 L8 20 L1 15 L7 10 L2 5 Z';
  const x0 = side === 'left' ? 4 : 12;
  return (
    <svg viewBox="0 0 60 30" width={84} height={42} aria-hidden="true" focusable="false">
      <path d={torn} fill="#17161b" stroke="#8a6312" strokeWidth={1} />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x={x0 + i * 11} y={2.5} width={5} height={3.2} rx={0.8} fill="#f1e7cf" />
          <rect x={x0 + i * 11} y={24.3} width={5} height={3.2} rx={0.8} fill="#f1e7cf" />
        </g>
      ))}
      <rect x={x0} y={8} width={18} height={14} rx={1.5} fill="#f5d77a" fillOpacity={0.35} />
      <rect x={x0 + 22} y={8} width={18} height={14} rx={1.5} fill="#f5d77a" fillOpacity={0.2} />
    </svg>
  );
}

function RoastStage() {
  const reduce = useReducedMotionPref();
  if (reduce) {
    return (
      <div aria-hidden="true" className="flex items-end justify-center gap-3 pb-3">
        <FilmHalf side="left" />
        <div className="flex -space-x-5">
          <PlayingCard code="7C" size="sm" decorative className="-rotate-6" />
          <PlayingCard code="2D" size="sm" decorative className="rotate-6" />
        </div>
        <FilmHalf side="right" />
      </div>
    );
  }
  return (
    <div
      aria-hidden="true"
      className="relative flex items-end justify-center gap-2 pb-3"
      data-testid="roast-stage"
    >
      <motion.div
        initial={{ rotate: 0, x: 0, y: 0 }}
        animate={{ rotate: [0, 0, -16], x: [0, 0, -10], y: [0, 0, 8] }}
        transition={{ duration: 1.1, times: [0, 0.55, 1], ease: 'easeOut', delay: 0.2 }}
        style={{ transformOrigin: '100% 50%' }}
      >
        <FilmHalf side="left" />
      </motion.div>
      <div className="relative flex -space-x-5">
        <motion.div
          style={{ transformOrigin: '50% 100%' }}
          animate={{
            rotate: [0, -10, 8, -6, 4, -14],
            scaleY: [1, 1, 1, 1, 0.92, 0.8],
            y: [0, 0, 0, 0, 3, 9],
          }}
          transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.3 }}
        >
          <PlayingCard code="7C" size="sm" decorative />
        </motion.div>
        <motion.div
          style={{ transformOrigin: '50% 100%' }}
          animate={{
            rotate: [0, 9, -7, 5, -3, 12],
            scaleY: [1, 1, 1, 1, 0.9, 0.78],
            y: [0, 0, 0, 0, 4, 10],
          }}
          transition={{ duration: 1.6, ease: 'easeInOut', delay: 0.38 }}
        >
          <PlayingCard code="2D" size="sm" decorative />
        </motion.div>
        <motion.svg
          viewBox="-20 -20 40 40"
          width={44}
          height={44}
          className="absolute -top-7 left-1/2 -ml-[22px]"
          initial={{ scale: 0, opacity: 0, rotate: 0 }}
          animate={{ scale: [0, 1.25, 0], opacity: [0, 1, 0], rotate: 25 }}
          transition={{ duration: 0.6, delay: 0.75 }}
        >
          <path
            d="M0 -18 L4 -5 L18 -6 L7 2 L12 16 L0 7 L-12 16 L-7 2 L-18 -6 L-4 -5 Z"
            fill="#f5d77a"
            stroke="#8a6312"
          />
        </motion.svg>
      </div>
      <motion.div
        initial={{ rotate: 0, x: 0, y: 0 }}
        animate={{ rotate: [0, 0, 14], x: [0, 0, 10], y: [0, 0, 10] }}
        transition={{ duration: 1.1, times: [0, 0.55, 1], ease: 'easeOut', delay: 0.2 }}
        style={{ transformOrigin: '0% 50%' }}
      >
        <FilmHalf side="right" />
      </motion.div>
    </div>
  );
}

export function Roast({
  roast,
  tip,
  gameName,
  netJeet,
  summary,
  onRematch,
  onClose,
  gameSlug,
  open = true,
}: RoastProps) {
  const reduce = useReducedMotionPref();
  const titleId = useId();
  const summaryId = useId();
  const tipId = useId();
  const rematchRef = useRef<HTMLButtonElement>(null);
  const tipText = stripTipPrefix(tip);

  const rise = (delay: number) =>
    reduce
      ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
      : {
          initial: { opacity: 0, y: 14 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] as const },
        };

  return (
    <OverlayShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={summary ? `${summaryId} ${tipId}` : tipId}
      initialFocusRef={rematchRef}
      tone="velvet"
      closeLabel={t('play.roast.close')}
      data-testid="roast"
    >
      <div className="border-gold-300/40 relative overflow-hidden rounded-[28px] border bg-[radial-gradient(120%_80%_at_50%_0%,var(--color-felt-700),var(--color-felt-900)_60%,var(--color-felt-950))] px-5 pt-10 pb-6 text-center shadow-[0_40px_90px_-30px_rgb(0_0_0/0.95)] sm:px-10 sm:pt-12 sm:pb-8">
        <RoastStage />

        <motion.p
          {...rise(0.5)}
          className="text-velvet-300 mt-5 text-[0.6875rem] font-bold tracking-[0.3em] uppercase sm:text-xs"
        >
          {t('play.roast.eyebrow')}
        </motion.p>
        <motion.h2
          {...rise(0.6)}
          id={titleId}
          data-testid="roast-text"
          className="font-display text-cream mt-2 text-[clamp(1.6rem,6.5vw,2.5rem)] leading-tight font-bold italic"
        >
          {roast.text}
        </motion.h2>
        <motion.p {...rise(0.7)} className="text-mist mt-2 text-sm italic">
          {t('play.roast.inspired', { film: roast.film })}
        </motion.p>

        <motion.p
          {...rise(0.8)}
          className="border-mist/20 bg-felt-950/50 text-mist mx-auto mt-5 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border px-4 py-1.5 text-sm"
          data-testid="roast-jeet"
        >
          <span>{t('play.roast.lost', { game: gameName })}</span>{' '}
          <span className="tabular text-cream font-bold">
            {formatJeetDelta(netJeet)} {t('wallet.currency')}
          </span>
        </motion.p>
        {summary ? (
          <motion.p
            {...rise(0.82)}
            id={summaryId}
            data-testid="roast-summary"
            className="text-cream/90 mx-auto mt-3 max-w-md text-sm leading-relaxed"
          >
            <span className="sr-only">{t('play.roast.happened')}: </span>
            {summary}
          </motion.p>
        ) : null}
        <motion.p {...rise(0.85)} className="text-mist/90 mt-2 text-xs">
          {t('play.roast.gentle')}
        </motion.p>

        <motion.div
          {...rise(0.95)}
          id={tipId}
          data-testid="roast-tip"
          className="border-gold-300/60 relative mt-6 rounded-2xl border bg-[linear-gradient(180deg,rgb(245_215_122/0.16),rgb(245_215_122/0.06))] px-4 py-4 text-left shadow-[0_0_30px_-12px_rgb(245_215_122/0.6)]"
        >
          <Badge tone="gold" size="sm">
            {t('play.roast.tip')}
          </Badge>
          <p className="text-cream mt-2 text-[0.9375rem] leading-relaxed font-medium">{tipText}</p>
        </motion.div>

        <motion.div
          {...rise(1.05)}
          className="mt-6 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:justify-center"
        >
          {gameSlug ? (
            <Button
              variant="secondary"
              href={`/games/${gameSlug}/learn`}
              leadingIcon={<BookIcon size={18} />}
            >
              {t('play.roast.rules')}
            </Button>
          ) : null}
          <Button ref={rematchRef} onClick={onRematch} data-testid="rematch-button">
            {t('play.roast.rematch')}
          </Button>
        </motion.div>

        {gameSlug ? (
          <motion.div {...rise(1.15)} className="mt-6">
            <RatingPrompt gameSlug={gameSlug} context="game" />
          </motion.div>
        ) : null}
      </div>
    </OverlayShell>
  );
}
