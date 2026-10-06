'use client';
import { useId, useMemo, useState } from 'react';
import { type BettingSpec } from '@/games/core/module';
import { type Difficulty } from '@/games/core/types';
import { UdhaarOffer } from '@/components/layout/UdhaarOffer';
import { Button } from '@/components/ui/Button';
import { cn } from '@/components/ui/cn';
import { CardsIcon } from '@/components/ui/icons';
import { JeetAmount, formatJeet } from '@/components/ui/Jeet';
import { Segmented } from '@/components/ui/Segmented';
import { t } from '@/lib/i18n';
import { canAfford, escrowFor } from '@/lib/settle';
import { playSound } from '@/lib/sound';
import { shade } from './BotAvatar';

export interface BetPanelProps {
  betting: BettingSpec;
  gameName: string;
  /** Current wallet balance (read after hydration). */
  balance: number;
  onDeal: (stake: number, difficulty: Difficulty) => void;
  /** Preselect this stake (e.g. the last bet when playing again). */
  initialStake?: number;
  initialDifficulty?: Difficulty;
  /** Difficulty choices (default Easy / Normal). One choice hides the control. */
  difficulties?: readonly Difficulty[];
  className?: string;
}

/** Casino-chip colours by denomination order (smallest first). */
const CHIP_COLOURS = ['#c22f47', '#1b5fc1', '#12793a', '#17161b', '#6b3fa0', '#b4841a', '#0e7c86'];

/** "50" · "500" · "1K" · "2.5K" — fits on a chip; the full amount is the accessible name. */
export function chipLabel(amount: number): string {
  if (amount >= 1000) {
    const k = amount / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(amount);
}

/** Sorted, de-duplicated stake options inside [minStake, maxStake]. */
export function stakeChoices(betting: BettingSpec): number[] {
  const all = [...new Set(betting.stakeOptions)]
    .filter((n) => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b);
  const inRange = all.filter((n) => n >= betting.minStake && n <= betting.maxStake);
  return inRange.length > 0 ? inRange : all;
}

function PokerChip({
  amount,
  colour,
  selected,
  disabled,
  needs,
  onPick,
}: {
  amount: number;
  colour: string;
  selected: boolean;
  disabled: boolean;
  needs: string | null;
  onPick: () => void;
}) {
  const descId = useId();
  const face = shade(colour, -0.12);
  return (
    <button
      type="button"
      data-testid={`stake-${amount}`}
      aria-pressed={selected}
      aria-label={t('play.bet.chipLabel', { amount: formatJeet(amount) })}
      aria-describedby={needs ? descId : undefined}
      disabled={disabled}
      onClick={onPick}
      className={cn(
        'group/chip ease-snap relative inline-flex size-[3.25rem] shrink-0 items-center justify-center rounded-full transition-[transform,filter,box-shadow] duration-150 sm:size-16',
        selected
          ? '-translate-y-1.5 shadow-[0_0_0_3px_var(--color-gold-200),0_0_22px_2px_rgb(245_215_122/0.6),0_12px_20px_-8px_rgb(0_0_0/0.8)]'
          : 'shadow-[0_6px_12px_-6px_rgb(0_0_0/0.85)] hover:-translate-y-1 active:translate-y-0',
        disabled && 'cursor-not-allowed opacity-40 grayscale-[0.7] hover:translate-y-0',
      )}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className="absolute inset-0">
        <circle cx={32} cy={32} r={31} fill={colour} />
        {[0, 1, 2, 3, 4, 5, 6, 7].map((k) => (
          <rect
            key={k}
            x={28.5}
            y={1.5}
            width={7}
            height={9}
            rx={1.2}
            fill="#fbf6ea"
            transform={`rotate(${k * 45} 32 32)`}
          />
        ))}
        <circle cx={32} cy={32} r={22} fill={face} />
        <circle
          cx={32}
          cy={32}
          r={22}
          fill="none"
          stroke="#fbf6ea"
          strokeOpacity={0.85}
          strokeWidth={1.4}
          strokeDasharray="3 2.6"
        />
        <circle cx={32} cy={32} r={17.5} fill="none" stroke="#f5d77a" strokeOpacity={0.6} />
        <ellipse cx={24} cy={17} rx={10} ry={4} fill="#ffffff" fillOpacity={0.16} />
      </svg>
      <span
        aria-hidden="true"
        className="tabular relative text-sm font-extrabold text-white [text-shadow:0_1px_2px_rgb(0_0_0/0.6)] sm:text-[0.9375rem]"
      >
        {chipLabel(amount)}
      </span>
      {needs ? (
        <span id={descId} className="sr-only">
          {needs}
        </span>
      ) : null}
    </button>
  );
}

/**
 * "Box office" bet panel: chip buttons for each stake (unaffordable ones are disabled
 * and explained), what the bet means, the escrow that will be set aside, bot
 * difficulty, and a big Deal button. Offers the Daily Udhaar when nothing is affordable.
 */
export function BetPanel({
  betting,
  gameName,
  balance,
  onDeal,
  initialStake,
  initialDifficulty,
  difficulties,
  className,
}: BetPanelProps) {
  const headingId = useId();
  const summaryId = useId();
  const options = useMemo(() => stakeChoices(betting), [betting]);
  const levels =
    difficulties && difficulties.length > 0 ? difficulties : (['easy', 'normal'] as const);
  const [picked, setPicked] = useState<number | null>(initialStake ?? null);
  const [difficulty, setDifficulty] = useState<Difficulty>(() =>
    initialDifficulty && levels.includes(initialDifficulty)
      ? initialDifficulty
      : levels.includes('normal')
        ? 'normal'
        : (levels[0] ?? 'normal'),
  );

  const affordable = (stake: number) => canAfford(balance, stake, betting.maxLossUnits);
  const affordableOptions = options.filter(affordable);
  // Keep the learner's pick when it is still affordable; otherwise fall back to the
  // biggest affordable chip below it (or the smallest affordable one).
  const stake =
    picked !== null && options.includes(picked) && affordable(picked)
      ? picked
      : picked !== null
        ? ([...affordableOptions].reverse().find((s) => s <= picked) ??
          affordableOptions[0] ??
          null)
        : (affordableOptions[0] ?? null);
  const someLocked = affordableOptions.length > 0 && affordableOptions.length < options.length;
  const broke = affordableOptions.length === 0;
  const showEscrow = betting.maxLossUnits > 1;

  return (
    <section
      aria-labelledby={headingId}
      data-testid="bet-panel"
      className={cn('panel relative overflow-hidden p-5 sm:p-6', className)}
    >
      <span
        aria-hidden="true"
        className="marquee-bulbs animate-bulb pointer-events-none absolute inset-x-6 top-0 h-3.5 opacity-60"
      />
      <p className="text-gold-300 text-[0.6875rem] font-bold tracking-[0.22em] uppercase">
        {t('play.bet.eyebrow')}
      </p>
      <h2
        id={headingId}
        className="font-display text-foil mt-1 text-[1.75rem] leading-tight font-bold sm:text-3xl"
      >
        {t('play.bet.title')}
      </h2>
      <p className="text-cream/90 mt-2 text-[0.9375rem] leading-relaxed">{betting.describe}</p>

      <p className="border-gold-300/20 bg-felt-950/45 mt-4 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm">
        <span className="text-mist font-semibold">{t('play.bet.balance')}</span>{' '}
        <JeetAmount amount={balance} showUnit className="text-gold-200 text-base" />
      </p>

      <fieldset className="mt-5 min-w-0">
        <legend className="text-cream text-sm font-semibold">{t('play.bet.chooseStake')}</legend>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2 py-1.5 sm:justify-start sm:gap-3">
          {options.map((amount, i) => {
            const ok = affordable(amount);
            return (
              <PokerChip
                key={amount}
                amount={amount}
                colour={CHIP_COLOURS[i % CHIP_COLOURS.length] ?? '#c22f47'}
                selected={stake === amount}
                disabled={!ok}
                needs={
                  ok
                    ? null
                    : t('play.bet.needs', {
                        escrow: formatJeet(escrowFor(amount, betting.maxLossUnits)),
                      })
                }
                onPick={() => {
                  setPicked(amount);
                  playSound('chip');
                }}
              />
            );
          })}
        </div>
        {someLocked ? (
          <p className="text-mist mt-3 text-[0.8125rem] leading-snug">
            {t('play.bet.unaffordable')}
          </p>
        ) : null}
      </fieldset>

      {stake !== null ? (
        <div id={summaryId} className="mt-4 space-y-1.5">
          <p className="text-gold-100 text-base font-bold">
            {t('play.bet.dealSummary', { stake: formatJeet(stake), game: gameName })}
          </p>
          <p className="text-mist text-sm leading-relaxed" data-testid="bet-escrow">
            {showEscrow
              ? t('play.bet.escrow', {
                  escrow: formatJeet(escrowFor(stake, betting.maxLossUnits)),
                })
              : t('play.bet.simple', { stake: formatJeet(stake) })}
          </p>
        </div>
      ) : null}

      {broke ? (
        <div className="mt-4 space-y-3">
          <p className="text-velvet-300 text-sm font-semibold">{t('play.bet.broke')}</p>
          <UdhaarOffer compact />
        </div>
      ) : null}

      {levels.length > 1 ? (
        <Segmented
          className="mt-5"
          legend={t('play.bet.difficulty')}
          hint={t('play.bet.difficultyHint')}
          value={difficulty}
          onValueChange={setDifficulty}
          options={levels.map((d) => ({ value: d, label: t(`play.bet.${d}`) }))}
        />
      ) : null}

      <Button
        size="lg"
        fullWidth
        className="mt-6 text-lg"
        data-testid="deal-button"
        disabled={stake === null}
        aria-describedby={stake !== null ? summaryId : undefined}
        leadingIcon={<CardsIcon size={22} />}
        onClick={() => {
          if (stake !== null) onDeal(stake, difficulty);
        }}
      >
        {t('play.bet.deal')}
      </Button>
      <p className="text-mist mt-3 text-center text-xs">{t('play.bet.pretend')}</p>
    </section>
  );
}
