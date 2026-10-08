'use client';
import { useState } from 'react';
import { type CardCode, cardName } from '@/games/core/cards';
import { Hand } from '@/components/cards';
import { t } from '@/lib/i18n';
import { ScreenFrame, type Feedback } from '../ScreenFrame';
import { chipButton } from '../styles';

const OPPONENT: CardCode[] = ['2C', '8D', 'QS', '5H', 'JC'];
const MINE: CardCode[] = ['7H', '2S', 'KD', '9C', '4H'];

export function HandScreen({ focusHeading }: { focusHeading: boolean }) {
  const [peeked, setPeeked] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  let feedback: Feedback | null = null;
  const pickedCode = picked === null ? undefined : MINE[picked];
  if (peeked && pickedCode) {
    feedback = {
      tone: 'done',
      text: t('primer.screens.hand.picked', { card: cardName(pickedCode) }),
    };
  } else if (peeked) {
    feedback = { tone: 'right', text: t('primer.screens.hand.peeked') };
  }

  return (
    <ScreenFrame
      focusHeading={focusHeading}
      title={t('primer.screens.hand.title')}
      body={<p>{t('primer.screens.hand.body')}</p>}
      action={t('primer.screens.hand.action')}
      feedback={feedback}
    >
      <div className="flex w-full flex-col items-center">
        <p
          className="text-mist text-[11px] font-bold tracking-[0.16em] uppercase"
          aria-hidden="true"
        >
          {t('primer.screens.hand.opponent')}
        </p>
        <Hand
          cards={OPPONENT}
          label={t('primer.screens.hand.opponent')}
          faceDown
          layout="fan"
          size="sm"
          dealFrom="top"
        />
      </div>
      <button
        type="button"
        onClick={() => {
          setPeeked((p) => !p);
          setPicked(null);
        }}
        className={`${chipButton} ${
          peeked
            ? 'border-gold-300 bg-gold-300 text-ink'
            : 'border-gold-300/60 text-gold-200 hover:bg-gold-300/10'
        }`}
      >
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true" focusable="false">
          <path
            d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
          />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </svg>
        {peeked ? t('primer.screens.hand.hide') : t('primer.screens.hand.peek')}
      </button>
      <div className="flex w-full flex-col items-center">
        <Hand
          cards={MINE}
          label={t('primer.screens.hand.yours')}
          faceDown={!peeked}
          layout="fan"
          size="md"
          dealFrom="bottom"
          onActivate={(_code, i) => {
            // Tapping a face-down card peeks; once the cards are showing it picks one.
            if (peeked) setPicked(i);
            else setPeeked(true);
          }}
          selected={peeked ? new Set(picked === null ? [] : [picked]) : undefined}
          data-testid="primer-my-hand"
        />
        <p
          className="text-mist text-[11px] font-bold tracking-[0.16em] uppercase"
          aria-hidden="true"
        >
          {t('primer.screens.hand.yours')}
        </p>
      </div>
    </ScreenFrame>
  );
}
