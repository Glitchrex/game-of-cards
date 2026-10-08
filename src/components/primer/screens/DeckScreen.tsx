'use client';
import { useRef, useState } from 'react';
import { type CardCode } from '@/games/core/cards';
import { Hand, Pile } from '@/components/cards';
import { t } from '@/lib/i18n';
import { ScreenFrame } from '../ScreenFrame';
import { chipButton } from '../styles';

/** One of every rank, mixing all four suits. */
const FAN: CardCode[] = [
  'AS',
  '2H',
  '3D',
  '4C',
  '5S',
  '6H',
  '7D',
  '8C',
  '9S',
  'TH',
  'JD',
  'QC',
  'KS',
];

export function DeckScreen({ focusHeading }: { focusHeading: boolean }) {
  const [fanned, setFanned] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const spread = () => {
    setFanned(true);
    // The deck button disappears; keep keyboard focus on the toggle.
    requestAnimationFrame(() => toggleRef.current?.focus());
  };

  return (
    <ScreenFrame
      focusHeading={focusHeading}
      title={t('primer.screens.deck.title')}
      body={<p>{t('primer.screens.deck.body')}</p>}
      action={fanned ? undefined : t('primer.screens.deck.action')}
      feedback={fanned ? { tone: 'right', text: t('primer.screens.deck.fanned') } : null}
      extra={
        <div>
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setFanned((f) => !f)}
            className={`${chipButton} border-gold-300/50 text-gold-200 hover:bg-gold-300/10`}
          >
            {fanned ? t('primer.screens.deck.stack') : t('primer.screens.deck.spread')}
          </button>
        </div>
      }
    >
      {fanned ? (
        <Hand cards={FAN} label={t('primer.screens.deck.fanLabel')} layout="fan" size="md" />
      ) : (
        <Pile
          count={52}
          label={t('primer.screens.deck.deckButton')}
          onClick={spread}
          size="lg"
          highlighted
          showCount
          data-testid="primer-deck"
        />
      )}
    </ScreenFrame>
  );
}
