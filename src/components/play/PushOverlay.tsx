'use client';
import { motion } from 'motion/react';
import { useId, useRef } from 'react';
import { Button } from '@/components/ui/Button';
import { CoinIcon } from '@/components/ui/Jeet';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { OverlayShell } from './OverlayShell';
import { RatingPrompt } from './RatingPrompt';

export interface PushOverlayProps {
  gameName: string;
  onPlayAgain: () => void;
  onClose: () => void;
  /** Shows the game rating prompt when given. */
  gameSlug?: string;
  /**
   * The engine's account of the hand ("You and the dealer both have 18…", or two split
   * hands that broke even). Replaces the generic "nobody won" line when given.
   */
  summary?: string;
  open?: boolean;
}

/** A calm "It's a push — your Jeet is back" intermission card. */
export function PushOverlay({
  gameName,
  onPlayAgain,
  onClose,
  gameSlug,
  summary,
  open = true,
}: PushOverlayProps) {
  const reduce = useReducedMotionPref();
  const titleId = useId();
  const bodyId = useId();
  const againRef = useRef<HTMLButtonElement>(null);

  return (
    <OverlayShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={bodyId}
      initialFocusRef={againRef}
      tone="calm"
      closeLabel={t('play.push.close')}
      data-testid="push-overlay"
      panelClassName="max-w-lg"
    >
      <div className="panel bg-felt-800 relative overflow-hidden px-5 pt-10 pb-6 text-center sm:px-8">
        <motion.div
          aria-hidden="true"
          className="mx-auto flex w-max items-center"
          initial={reduce ? false : { y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: reduce ? 0 : 0.5 }}
        >
          <CoinIcon size={40} />
          <CoinIcon size={40} className="-ml-3" />
        </motion.div>
        <p className="text-gold-300 mt-4 text-[0.6875rem] font-bold tracking-[0.3em] uppercase">
          {t('play.push.eyebrow', { game: gameName })}
        </p>
        <h2
          id={titleId}
          data-testid="push-title"
          className="font-display text-gold-100 mt-2 text-[1.75rem] leading-tight font-bold sm:text-3xl"
        >
          {t('play.push.title')}
        </h2>
        <p id={bodyId} className="text-mist mt-2 text-[0.9375rem] leading-relaxed">
          {summary ? (
            <>
              <span data-testid="push-summary" className="text-cream">
                {summary}
              </span>{' '}
              {t('play.push.returned')}
            </>
          ) : (
            t('play.push.body')
          )}
        </p>
        <div className="mt-6 flex justify-center">
          <Button ref={againRef} onClick={onPlayAgain} data-testid="play-again">
            {t('play.push.playAgain')}
          </Button>
        </div>
        {gameSlug ? <RatingPrompt gameSlug={gameSlug} context="game" className="mt-6" /> : null}
      </div>
    </OverlayShell>
  );
}
