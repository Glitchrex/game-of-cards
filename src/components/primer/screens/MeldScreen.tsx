'use client';
import { useState } from 'react';
import { type CardCode, cardName } from '@/games/core/cards';
import { CardScene, PlayingCard } from '@/components/cards';
import { type TKey, t } from '@/lib/i18n';
import { ScreenFrame, type Feedback } from '../ScreenFrame';

interface Group {
  cards: CardCode[];
  correct: boolean;
  feedback: TKey;
}

const GROUPS: Group[] = [
  { cards: ['5H', '6H', '8H'], correct: false, feedback: 'primer.screens.meld.wrongGap' },
  { cards: ['JC', 'QC', 'KC'], correct: true, feedback: 'primer.screens.meld.right' },
  { cards: ['9S', '9D', '4C'], correct: false, feedback: 'primer.screens.meld.wrongSet' },
];

export function MeldScreen({ focusHeading }: { focusHeading: boolean }) {
  const [chosen, setChosen] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const solved = chosen !== null && GROUPS[chosen]?.correct === true;

  const choose = (i: number) => {
    const g = GROUPS[i];
    if (!g) return;
    setChosen(i);
    setFeedback({ tone: g.correct ? 'done' : 'wrong', text: t(g.feedback) });
  };

  return (
    <ScreenFrame
      focusHeading={focusHeading}
      title={t('primer.screens.meld.title')}
      body={<p>{t('primer.screens.meld.body')}</p>}
      action={solved ? undefined : t('primer.screens.meld.action')}
      feedback={feedback}
    >
      <CardScene
        size="xs"
        showCaption={false}
        scene={{
          animate: 'deal',
          zones: [
            {
              id: 'set',
              label: t('primer.screens.meld.setExample'),
              cards: ['7S', '7H', '7D'],
              layout: 'row',
            },
            {
              id: 'run',
              label: t('primer.screens.meld.runExample'),
              cards: ['4C', '5C', '6C'],
              layout: 'row',
            },
          ],
        }}
      />
      <div className="bg-gold-300/15 h-px w-full max-w-md" aria-hidden="true" />
      <ul
        aria-label={t('primer.screens.meld.choicesLabel')}
        className="grid w-full max-w-xl grid-cols-1 gap-2 min-[420px]:grid-cols-3"
      >
        {GROUPS.map((g, i) => {
          const picked = chosen === i;
          const tone = picked ? (g.correct ? 'right' : 'wrong') : null;
          return (
            <li key={i}>
              <button
                type="button"
                onClick={() => choose(i)}
                aria-pressed={picked}
                aria-label={t('primer.screens.meld.groupLabel', {
                  n: i + 1,
                  cards: g.cards.map(cardName).join(', '),
                })}
                className={`flex w-full items-center justify-center gap-3 rounded-2xl border-2 px-3 py-2 transition duration-150 hover:-translate-y-0.5 min-[420px]:flex-col min-[420px]:gap-1.5 ${
                  tone === 'right'
                    ? 'border-gold-300 bg-gold-300/10 shadow-glow'
                    : tone === 'wrong'
                      ? 'border-velvet-400 bg-velvet-500/10'
                      : 'border-gold-300/25 bg-felt-950/35 hover:border-gold-300/60'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="text-mist w-20 text-left text-[11px] font-bold tracking-[0.14em] whitespace-nowrap uppercase min-[420px]:w-auto min-[420px]:text-center"
                >
                  {t('primer.screens.meld.groupN', { n: i + 1 })}
                </span>
                <span aria-hidden="true" className="flex">
                  {g.cards.map((c, j) => (
                    <span key={c} className={j === 0 ? '' : '-ml-3'}>
                      <PlayingCard code={c} size="sm" decorative />
                    </span>
                  ))}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </ScreenFrame>
  );
}
