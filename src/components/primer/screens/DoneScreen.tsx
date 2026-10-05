'use client';
import { CardScene } from '@/components/cards';
import { type TKey, t } from '@/lib/i18n';
import { ScreenFrame } from '../ScreenFrame';

const RECAP: TKey[] = [
  'primer.screens.done.items.deck',
  'primer.screens.done.items.suits',
  'primer.screens.done.items.ranks',
  'primer.screens.done.items.trick',
  'primer.screens.done.items.trump',
  'primer.screens.done.items.meld',
];

export function DoneScreen({ focusHeading }: { focusHeading: boolean }) {
  return (
    <ScreenFrame
      focusHeading={focusHeading}
      title={t('primer.screens.done.title')}
      body={<p>{t('primer.screens.done.body')}</p>}
      stageClassName="min-h-[200px]"
      extra={
        <section aria-labelledby="primer-recap">
          <h3
            id="primer-recap"
            className="text-gold-300 text-sm font-bold tracking-[0.14em] uppercase"
          >
            {t('primer.screens.done.recap')}
          </h3>
          <ul className="text-cream mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {RECAP.map((key) => (
              <li key={key} className="flex items-start gap-2">
                <svg
                  viewBox="0 0 24 24"
                  className="text-gold-300 mt-0.5 size-5 shrink-0"
                  aria-hidden="true"
                  focusable="false"
                >
                  <circle cx="12" cy="12" r="10" fill="currentColor" opacity={0.2} />
                  <path
                    d="M7.5 12.5l3 3 6-7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {t(key)}
              </li>
            ))}
          </ul>
        </section>
      }
    >
      <CardScene
        size="md"
        showCaption={false}
        scene={{
          animate: 'flip',
          zones: [{ id: 'royal', cards: ['TH', 'JH', 'QH', 'KH', 'AH'], layout: 'fan' }],
        }}
      />
    </ScreenFrame>
  );
}
