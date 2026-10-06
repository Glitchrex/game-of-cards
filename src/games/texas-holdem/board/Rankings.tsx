'use client';
/** The hand-rankings cheat sheet: a popover listing every poker hand, best first, with an example. */
import { Popover } from '@/components/ui/Popover';
import { cn } from '@/components/ui/cn';
import { cardName, cardShort, isRed, type CardCode } from '@/games/core/cards';
import { t, type TKey } from '@/games/texas-holdem/i18n';

interface Ranking {
  name: TKey;
  hint: TKey;
  example: CardCode[];
}

const RANKINGS: readonly Ranking[] = [
  {
    name: 'texasHoldem.rankings.royal',
    hint: 'texasHoldem.rankings.royalHint',
    example: ['AS', 'KS', 'QS', 'JS', 'TS'],
  },
  {
    name: 'texasHoldem.rankings.straightFlush',
    hint: 'texasHoldem.rankings.straightFlushHint',
    example: ['9H', '8H', '7H', '6H', '5H'],
  },
  {
    name: 'texasHoldem.rankings.four',
    hint: 'texasHoldem.rankings.fourHint',
    example: ['QS', 'QH', 'QD', 'QC', '4S'],
  },
  {
    name: 'texasHoldem.rankings.fullHouse',
    hint: 'texasHoldem.rankings.fullHouseHint',
    example: ['KH', 'KD', 'KC', '7S', '7H'],
  },
  {
    name: 'texasHoldem.rankings.flush',
    hint: 'texasHoldem.rankings.flushHint',
    example: ['AD', 'JD', '8D', '6D', '2D'],
  },
  {
    name: 'texasHoldem.rankings.straight',
    hint: 'texasHoldem.rankings.straightHint',
    example: ['TC', '9D', '8S', '7H', '6C'],
  },
  {
    name: 'texasHoldem.rankings.three',
    hint: 'texasHoldem.rankings.threeHint',
    example: ['8S', '8H', '8D', 'KC', '3S'],
  },
  {
    name: 'texasHoldem.rankings.twoPair',
    hint: 'texasHoldem.rankings.twoPairHint',
    example: ['JH', 'JC', '4S', '4D', 'AH'],
  },
  {
    name: 'texasHoldem.rankings.pair',
    hint: 'texasHoldem.rankings.pairHint',
    example: ['TS', 'TH', 'KD', '6C', '2H'],
  },
  {
    name: 'texasHoldem.rankings.high',
    hint: 'texasHoldem.rankings.highHint',
    example: ['AC', 'JD', '8H', '5S', '3C'],
  },
];

export function RankingsSheet({ className }: { className?: string }) {
  return (
    <Popover
      className={className}
      align="end"
      side="top"
      title={t('texasHoldem.rankings.title')}
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
          <span>{t('texasHoldem.rankings.trigger')}</span>
        </>
      }
      triggerClassName="border-gold-300/40 bg-felt-950/60 text-gold-100 hover:border-gold-300/70 inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-bold"
      panelClassName="w-[min(21rem,calc(100vw-1.5rem))]"
    >
      <span data-testid="holdem-rankings" className="block">
        <span className="text-mist mb-2 block text-xs leading-snug">
          {t('texasHoldem.rankings.intro')}
        </span>
        <ol className="flex flex-col gap-1.5">
          {RANKINGS.map((r, i) => (
            <li key={r.name} className="flex items-center gap-2">
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
