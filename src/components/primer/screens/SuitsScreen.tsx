'use client';
import { useState } from 'react';
import { type Suit, SUITS } from '@/games/core/cards';
import { SuitIcon } from '@/components/cards';
import { t } from '@/lib/i18n';
import { ScreenFrame, type Feedback } from '../ScreenFrame';
import { chipButton } from '../styles';

function suitText(s: Suit): { name: string; fact: string } {
  const keys = {
    S: ['primer.screens.suits.S.name', 'primer.screens.suits.S.fact'],
    H: ['primer.screens.suits.H.name', 'primer.screens.suits.H.fact'],
    D: ['primer.screens.suits.D.name', 'primer.screens.suits.D.fact'],
    C: ['primer.screens.suits.C.name', 'primer.screens.suits.C.fact'],
  } as const;
  const [name, fact] = keys[s];
  return { name: t(name), fact: t(fact) };
}

export function SuitsScreen({ focusHeading }: { focusHeading: boolean }) {
  const [found, setFound] = useState<Suit[]>([]);
  const [last, setLast] = useState<Suit | null>(null);
  const [fourColor, setFourColor] = useState(false);

  const tap = (s: Suit) => {
    setLast(s);
    setFound((f) => (f.includes(s) ? f : [...f, s]));
  };

  let feedback: Feedback | null = null;
  if (last) {
    const all = found.length === SUITS.length;
    const progress = all
      ? t('primer.screens.suits.done')
      : t('primer.screens.suits.found', { count: found.length });
    feedback = { tone: all ? 'done' : 'right', text: `${suitText(last).fact} ${progress}` };
  }

  return (
    <ScreenFrame
      focusHeading={focusHeading}
      title={t('primer.screens.suits.title')}
      body={<p>{t('primer.screens.suits.body')}</p>}
      action={t('primer.screens.suits.action')}
      feedback={feedback}
      extra={
        <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
          <button
            type="button"
            aria-pressed={fourColor}
            onClick={() => setFourColor((v) => !v)}
            className={`${chipButton} shrink-0 whitespace-nowrap ${
              fourColor
                ? 'border-gold-300 bg-gold-300 text-ink'
                : 'border-gold-300/50 text-gold-200 hover:bg-gold-300/10'
            }`}
          >
            <span aria-hidden="true" className="bg-ivory flex gap-0.5 rounded-full px-1.5 py-1">
              {SUITS.map((s) => (
                <SuitIcon key={s} suit={s} size={14} fourColor={fourColor} />
              ))}
            </span>
            {t('primer.screens.suits.fourColor')}
          </button>
          <p className="text-mist text-sm">{t('primer.screens.suits.fourColorHint')}</p>
        </div>
      }
    >
      <ul
        aria-label={t('primer.screens.suits.groupLabel')}
        className="grid w-full max-w-md grid-cols-4 gap-2 sm:gap-4"
      >
        {SUITS.map((s) => {
          const known = found.includes(s);
          return (
            <li key={s}>
              <button
                type="button"
                aria-pressed={known}
                aria-label={suitText(s).name}
                onClick={() => tap(s)}
                className={`group shadow-card flex w-full flex-col items-center gap-1.5 rounded-2xl border p-2 pt-3 transition duration-150 hover:-translate-y-0.5 sm:p-3 ${
                  known ? 'border-gold-300 bg-ivory shadow-glow' : 'border-gold-600/40 bg-parchment'
                }`}
              >
                <SuitIcon suit={s} size={48} fourColor={fourColor} className="drop-shadow-none" />
                <span
                  aria-hidden="true"
                  className={`min-h-5 text-xs font-bold tracking-wide sm:text-sm ${
                    known ? 'text-ink' : 'text-ink/70'
                  }`}
                >
                  {known ? suitText(s).name : '?'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScreenFrame>
  );
}
