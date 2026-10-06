'use client';
/**
 * The middle of the table: the closed stock (face down — its order never reaches the page),
 * the wild-joker card tucked under it sideways, and the open pile with its top card face up.
 * The stock and the open pile are buttons (draw / take the top card); so is the wild-joker
 * card, so a learner who tries to take it hears why nobody may.
 */
import { useState, type RefObject } from 'react';
import { PlayingCard, Pile } from '@/components/cards';
import { cn } from '@/components/ui/cn';
import { cardName, type CardCode, type Rank } from '@/games/core/cards';
import { t } from '@/lib/i18n';
import { rankPlural, wildCaption } from './arrange';
import { Flyer } from './Flyer';

/** Size of the stock / open pile cards. */
export const PILE_CARD_W = 'clamp(56px, 15vw, 84px)';

export interface Landing {
  /** Changes with every discard. */
  id: string;
  from: RefObject<HTMLElement | null>;
}

export interface CoachMarks {
  highlighted: boolean;
  suggested: boolean;
}

export interface TableCenterProps {
  stockCount: number;
  discard: readonly CardCode[];
  wildCard: CardCode;
  wildRank: Rank;
  busy: boolean;
  stockMarks: CoachMarks;
  openMarks: CoachMarks;
  /** The card that was just thrown onto the open pile, flying in from its thrower. */
  landing: Landing | null;
  stockRef: RefObject<HTMLElement | null>;
  openRef: RefObject<HTMLElement | null>;
  onStock: () => void;
  onOpen: () => void;
  onWild: () => void;
}

export function TableCenter({
  stockCount,
  discard,
  wildCard,
  wildRank,
  busy,
  stockMarks,
  openMarks,
  landing,
  stockRef,
  openRef,
  onStock,
  onOpen,
  onWild,
}: TableCenterProps) {
  const [landedId, setLandedId] = useState<string | null>(null);
  const inFlight = landing !== null && landedId !== landing.id;
  // While the thrown card is in the air, the pile still shows the card underneath it.
  const shown = inFlight ? discard.slice(0, -1) : discard;
  const top = shown[shown.length - 1] ?? null;
  const thrown = discard[discard.length - 1] ?? null;
  const wildRule = wildCaption(wildCard, wildRank);
  const wildLabel = t('indianRummy.zone.wild', {
    card: cardName(wildCard),
    rule:
      wildCard === 'X1' || wildCard === 'X2'
        ? t('indianRummy.zone.wildRulePrinted')
        : t('indianRummy.zone.wildRule', { rank: rankPlural(wildRank) }),
  });

  return (
    <div
      role="group"
      aria-label={t('indianRummy.zone.table')}
      data-testid="rummy-table"
      className="flex items-start justify-center gap-5 sm:gap-10"
    >
      {/* Stock with the wild-joker card tucked underneath, sideways. */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative" style={{ paddingInlineStart: `calc(${PILE_CARD_W} * 0.75)` }}>
          <div className="relative z-10">
            <Pile
              ref={stockRef as RefObject<HTMLButtonElement | null>}
              count={stockCount}
              label={
                stockCount > 0 ? t('indianRummy.zone.stock') : t('indianRummy.zone.stockEmpty')
              }
              faceUp={false}
              onClick={onStock}
              disabled={busy}
              highlighted={stockMarks.highlighted}
              suggested={stockMarks.suggested}
              size="md"
              style={{ width: PILE_CARD_W }}
              data-testid="rummy-stock"
            />
          </div>
          {/* After the stock in the focus order; drawn underneath it. */}
          <button
            type="button"
            data-testid="rummy-wild"
            data-card={wildCard}
            aria-label={wildLabel}
            aria-disabled={busy || undefined}
            onClick={busy ? undefined : onWild}
            className={cn(
              'absolute top-1/2 left-0 z-0 block -translate-y-1/2 rotate-90 rounded-md',
              busy ? 'cursor-not-allowed' : 'cursor-pointer',
            )}
            style={{ width: PILE_CARD_W, marginInlineStart: `calc(${PILE_CARD_W} * 0.2)` }}
          >
            <PlayingCard code={wildCard} decorative style={{ width: PILE_CARD_W }} />
          </button>
        </div>
        <p className="text-cream text-center text-[0.6875rem] leading-tight font-semibold sm:text-xs">
          <span className="text-gold-200 block font-bold tracking-[0.12em] uppercase">
            {t('indianRummy.caption.stock')}
          </span>
          <span data-testid="rummy-wild-label" className="text-mist block">
            {t('indianRummy.caption.wild')}: {wildRule}
          </span>
        </p>
      </div>

      {/* The open pile. */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="relative">
          <Pile
            ref={openRef as RefObject<HTMLButtonElement | null>}
            count={shown.length}
            topCard={top}
            label={shown.length > 0 ? t('indianRummy.zone.open') : t('indianRummy.zone.openEmpty')}
            onClick={onOpen}
            disabled={busy}
            highlighted={openMarks.highlighted}
            suggested={openMarks.suggested}
            size="md"
            style={{ width: PILE_CARD_W }}
            data-testid="rummy-discard-pile"
          />
          {landing && thrown ? (
            <Flyer
              key={landing.id}
              from={landing.from}
              onLanded={() => setLandedId(landing.id)}
              className="pointer-events-none absolute inset-0 z-20"
            >
              {() =>
                landedId === landing.id ? null : (
                  <PlayingCard code={thrown} decorative style={{ width: PILE_CARD_W }} />
                )
              }
            </Flyer>
          ) : null}
        </div>
        <p className="text-gold-200 text-center text-[0.6875rem] leading-tight font-bold tracking-[0.12em] uppercase sm:text-xs">
          {t('indianRummy.caption.open')}
        </p>
      </div>
    </div>
  );
}
