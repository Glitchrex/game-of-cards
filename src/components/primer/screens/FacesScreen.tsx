'use client';
import { useState } from 'react';
import { type CardCode, RANK_NAMES, rankOf } from '@/games/core/cards';
import { PlayingCard } from '@/components/cards';
import { t } from '@/lib/i18n';
import { ScreenFrame, type Feedback } from '../ScreenFrame';

const FACES: CardCode[] = ['JD', 'QS', 'KH'];
const MEET_KEYS = {
  J: 'primer.screens.faces.J',
  Q: 'primer.screens.faces.Q',
  K: 'primer.screens.faces.K',
} as const;

export function FacesScreen({ focusHeading }: { focusHeading: boolean }) {
  const [shown, setShown] = useState<boolean[]>([false, false, false]);
  const [last, setLast] = useState<number | null>(null);
  const met = shown.filter(Boolean).length;

  const reveal = (i: number) => {
    setShown((s) => s.map((v, j) => v || j === i));
    setLast(i);
  };

  let feedback: Feedback | null = null;
  const lastCode = last === null ? undefined : FACES[last];
  if (lastCode) {
    const meet = t(MEET_KEYS[rankOf(lastCode) as keyof typeof MEET_KEYS]);
    feedback =
      met === FACES.length
        ? { tone: 'done', text: `${meet} ${t('primer.screens.faces.done')}` }
        : {
            tone: 'right',
            text: `${meet} ${t('primer.screens.faces.met', { count: met })}`,
          };
  }

  return (
    <ScreenFrame
      focusHeading={focusHeading}
      title={t('primer.screens.faces.title')}
      body={<p>{t('primer.screens.faces.body')}</p>}
      action={met === FACES.length ? undefined : t('primer.screens.faces.action')}
      feedback={feedback}
    >
      <ul className="flex items-start justify-center gap-2 sm:gap-6">
        {FACES.map((code, i) => (
          <li key={code} className="flex flex-col items-center gap-2">
            <PlayingCard
              code={code}
              size="lg"
              style={{ width: 'clamp(64px, 24vw, 112px)' }}
              faceDown={!shown[i]}
              highlighted={!shown[i]}
              onClick={() => reveal(i)}
              ariaLabel={shown[i] ? undefined : t('primer.screens.faces.revealLabel', { n: i + 1 })}
              data-testid={`face-card-${i}`}
            />
            <span
              aria-hidden="true"
              className={`text-sm font-bold tracking-wide transition-opacity ${
                shown[i] ? 'text-gold-200 opacity-100' : 'opacity-0'
              }`}
            >
              {RANK_NAMES[rankOf(code)]}
            </span>
          </li>
        ))}
      </ul>
    </ScreenFrame>
  );
}
