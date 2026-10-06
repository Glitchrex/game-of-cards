'use client';
/** "Which hand wins?": a popover listing the six Teen Patti hands, best first, with examples. */
import { Popover } from '@/components/ui/Popover';
import { cn } from '@/components/ui/cn';
import { cardName, cardShort, isRed, type CardCode } from '@/games/core/cards';
import { t, type TKey } from '@/games/teen-patti/i18n';
import { type HandCategory } from '../engine';

interface Ranking {
  category: HandCategory;
  name: TKey;
  hint: TKey;
  example: CardCode[];
}

const RANKINGS: readonly Ranking[] = [
  {
    category: 'trail',
    name: 'teenPatti.rankings.trail',
    hint: 'teenPatti.rankings.trailHint',
    example: ['KS', 'KH', 'KD'],
  },
  {
    category: 'pure-sequence',
    name: 'teenPatti.rankings.pure',
    hint: 'teenPatti.rankings.pureHint',
    example: ['9H', '8H', '7H'],
  },
  {
    category: 'sequence',
    name: 'teenPatti.rankings.sequence',
    hint: 'teenPatti.rankings.sequenceHint',
    example: ['QC', 'JD', 'TS'],
  },
  {
    category: 'colour',
    name: 'teenPatti.rankings.colour',
    hint: 'teenPatti.rankings.colourHint',
    example: ['AD', '9D', '4D'],
  },
  {
    category: 'pair',
    name: 'teenPatti.rankings.pair',
    hint: 'teenPatti.rankings.pairHint',
    example: ['7S', '7C', 'KH'],
  },
  {
    category: 'high-card',
    name: 'teenPatti.rankings.high',
    hint: 'teenPatti.rankings.highHint',
    example: ['AC', 'JH', '5S'],
  },
];

export function RankingsSheet({
  className,
  current,
}: {
  className?: string;
  /** The learner's own hand category, once seen: marked in the list. */
  current?: HandCategory | null;
}) {
  return (
    <Popover
      className={className}
      align="center"
      side="bottom"
      title={t('teenPatti.rankings.title')}
      trigger={
        <>
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.9}
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M5 6h14M5 12h10M5 18h6" />
          </svg>
          <span>{t('teenPatti.rankings.trigger')}</span>
        </>
      }
      triggerClassName="border-gold-300/40 bg-felt-950/60 text-gold-100 hover:border-gold-300/70 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold"
      panelClassName="w-[min(21rem,calc(100vw-1.5rem))]"
    >
      <span data-testid="tp-rankings" className="block">
        <span className="text-mist mb-2 block text-xs leading-snug">
          {t('teenPatti.rankings.intro')}
        </span>
        <ol className="flex flex-col gap-1.5">
          {RANKINGS.map((r, i) => (
            <li
              key={r.category}
              data-category={r.category}
              data-current={current === r.category || undefined}
              className={cn(
                'flex items-center gap-2 rounded-lg px-1 py-0.5',
                current === r.category && 'bg-gold-300/15 ring-gold-300/60 ring-1',
              )}
            >
              <span
                aria-hidden="true"
                className="text-gold-300 tabular w-4 shrink-0 text-right text-xs font-bold"
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-gold-100 block text-sm leading-tight font-bold">
                  {t(r.name)}
                </span>
                <span className="text-mist block text-[0.6875rem] leading-tight">{t(r.hint)}</span>
              </span>
              <span
                role="img"
                aria-label={r.example.map(cardName).join(', ')}
                className="bg-ivory inline-flex shrink-0 gap-0.5 rounded-md px-1 py-0.5 font-sans text-[0.6875rem] font-bold"
              >
                {r.example.map((c) => (
                  <span
                    key={c}
                    aria-hidden="true"
                    className={cn(isRed(c) ? 'text-suit-red' : 'text-suit-black')}
                  >
                    {cardShort(c)}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ol>
      </span>
    </Popover>
  );
}
