'use client';
import { useRef, useState } from 'react';
import { type CardCode, RANKS, card, cardName } from '@/games/core/cards';
import { CARD_WIDTHS, Hand, PlayingCard, rowLayout } from '@/components/cards';
import { t } from '@/lib/i18n';
import { ScreenFrame, type Feedback } from '../ScreenFrame';
import { secondaryButton } from '../styles';

const LADDER: CardCode[] = RANKS.map((r) => card(r, 'S'));
const POOL: CardCode[] = ['9C', '3C', 'KC', '6C'];
const ORDER: CardCode[] = ['3C', '6C', '9C', 'KC'];

function Ladder() {
  const w = CARD_WIDTHS.xs;
  const row = rowLayout(LADDER.length, w, '4px', 0.45);
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div
        role="img"
        aria-label={t('primer.screens.ranks.ladderLabel')}
        className="mx-auto flex justify-center"
        style={row.container}
      >
        {LADDER.map((c, i) => (
          <span key={c} className="relative shrink-0" style={{ marginInlineStart: row.margin(i) }}>
            <PlayingCard code={c} size="xs" decorative />
          </span>
        ))}
      </div>
      <div
        aria-hidden="true"
        className="text-mist flex w-full max-w-[34rem] justify-between px-1 text-[11px] font-bold tracking-[0.16em] uppercase"
      >
        <span>← {t('primer.screens.ranks.low')}</span>
        <span>{t('primer.screens.ranks.high')} →</span>
      </div>
    </div>
  );
}

export function RanksScreen({ focusHeading }: { focusHeading: boolean }) {
  const [placed, setPlaced] = useState<CardCode[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const remaining = POOL.filter((c) => !placed.includes(c));
  const done = placed.length === ORDER.length;

  const pick = (code: CardCode) => {
    if (code === ORDER[placed.length]) {
      const next = [...placed, code];
      setPlaced(next);
      // The last card leaves the pool: move focus to "Try again".
      if (next.length === ORDER.length) requestAnimationFrame(() => resetRef.current?.focus());
      setFeedback(
        next.length === ORDER.length
          ? { tone: 'done', text: t('primer.screens.ranks.done') }
          : { tone: 'right', text: t('primer.screens.ranks.right', { card: cardName(code) }) },
      );
    } else {
      setFeedback({ tone: 'wrong', text: t('primer.screens.ranks.wrong') });
    }
  };

  const reset = () => {
    setPlaced([]);
    setFeedback(null);
  };

  return (
    <ScreenFrame
      focusHeading={focusHeading}
      title={t('primer.screens.ranks.title')}
      body={
        <>
          <p>{t('primer.screens.ranks.body')}</p>
          <p className="text-mist mt-2">{t('primer.screens.ranks.ace')}</p>
        </>
      }
      action={done ? undefined : t('primer.screens.ranks.action')}
      feedback={feedback}
      extra={
        done ? (
          <div>
            <button ref={resetRef} type="button" onClick={reset} className={secondaryButton}>
              {t('primer.screens.ranks.reset')}
            </button>
          </div>
        ) : undefined
      }
    >
      <Ladder />
      <div className="bg-gold-300/15 h-px w-full max-w-md" aria-hidden="true" />
      <div className="flex w-full flex-col items-center gap-1 sm:flex-row sm:items-end sm:justify-center sm:gap-8">
        {remaining.length > 0 && (
          <Hand
            cards={remaining}
            label={t('primer.screens.ranks.poolLabel')}
            onActivate={(code) => pick(code)}
            layout="row"
            size="md"
            dealFrom="top"
            data-testid="ranks-pool"
          />
        )}
        <div className="flex flex-col items-center">
          <p className="text-mist mb-1 text-[11px] font-bold tracking-[0.16em] uppercase">
            {t('primer.screens.ranks.orderedLabel')}
          </p>
          {placed.length > 0 ? (
            <Hand
              cards={placed}
              label={t('primer.screens.ranks.orderedLabel')}
              layout="row"
              size="sm"
              dealFrom="top"
            />
          ) : (
            <p className="border-gold-300/30 text-mist flex h-[84px] items-center rounded-xl border-2 border-dashed px-4 text-sm">
              {t('primer.screens.ranks.orderedEmpty')}
            </p>
          )}
        </div>
      </div>
    </ScreenFrame>
  );
}
