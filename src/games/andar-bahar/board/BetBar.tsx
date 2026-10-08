'use client';
/**
 * The two big bet buttons: "Bet on Andar" and "Bet on Bahar". They stay on screen (and in
 * the tab order) for the whole deal, so focus never drops to <body>: once the bet is placed
 * the chosen side reads "Your bet" and both wait, aria-disabled, while the dealer deals.
 *
 * Keyboard: Tab reaches each button, ←/→ (or ↑/↓) move between them, Enter/Space bets, and
 * the A / B shortcuts work anywhere on the page (handled by the Board).
 */
import { motion } from 'motion/react';
import { useId, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { useReducedMotionPref } from '@/lib/motion';
import { type Side } from '../engine';
import { abt, type AndarBaharKey } from './strings';

interface BetSpec {
  side: Side;
  key: 'A' | 'B';
  label: AndarBaharKey;
  hint: AndarBaharKey;
}

export const BETS: readonly BetSpec[] = [
  { side: 'andar', key: 'A', label: 'andarBahar.bet.andar', hint: 'andarBahar.bet.andarHint' },
  { side: 'bahar', key: 'B', label: 'andarBahar.bet.bahar', hint: 'andarBahar.bet.baharHint' },
];

export interface BetBarProps {
  /** Sides the learner may bet on right now (legal moves). */
  legal: ReadonlySet<Side>;
  /** The side already bet on, if any. */
  chosen: Side | null;
  busy: boolean;
  busyReason: string;
  coachMode: boolean;
  /** moveKey()s to glow (coach mode). */
  highlight: ReadonlySet<string>;
  suggestedKey: string | null;
  /** The side whose shortcut was just pressed (a brief pressed look). */
  flash: Side | null;
  onPress: (side: Side) => void;
}

export function BetBar({
  legal,
  chosen,
  busy,
  busyReason,
  coachMode,
  highlight,
  suggestedKey,
  flash,
  onPress,
}: BetBarProps) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const busyId = `${ids}-busy`;
  const suggestedId = `${ids}-suggested`;
  const chosenId = `${ids}-chosen`;
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // ←/→ and ↑/↓ hop between the two buttons (both stay in the Tab order too).
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const i = refs.current.findIndex((el) => el === document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1;
    refs.current[(i + step + BETS.length) % BETS.length]?.focus();
  };

  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-2 pt-1">
      <div
        role="group"
        aria-label={abt('andarBahar.bet.label')}
        data-testid="ab-actions"
        onKeyDown={onKeyDown}
        className="grid grid-cols-2 gap-2 sm:gap-3"
      >
        {BETS.map((b, index) => {
          const key = `bet:${b.side}`;
          const isLegal = legal.has(b.side);
          const isChosen = chosen === b.side;
          const glow = coachMode && !busy && highlight.has(key);
          const suggested = !busy && suggestedKey === key;
          const hintId = `${ids}-${b.side}-hint`;
          const describedBy = [
            hintId,
            isChosen ? chosenId : null,
            busy ? busyId : null,
            suggested ? suggestedId : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={b.side}
              ref={(el) => {
                refs.current[index] = el;
              }}
              type="button"
              data-testid={`ab-${b.side}`}
              data-legal={isLegal || undefined}
              data-chosen={isChosen || undefined}
              data-highlighted={glow || undefined}
              data-suggested={suggested || undefined}
              data-pressed={flash === b.side || undefined}
              aria-label={abt(b.label)}
              aria-keyshortcuts={b.key}
              aria-disabled={busy || undefined}
              aria-describedby={describedBy}
              onClick={() => onPress(b.side)}
              className={cn(
                'ease-snap relative flex min-h-[4.5rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-2 py-2 text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none sm:min-h-20 pointer-fine:max-sm:pt-6',
                isChosen
                  ? 'border-gold-200 bg-felt-950/60 text-gold-100 shadow-[0_0_0_2px_rgb(245_215_122/0.55)]'
                  : busy
                    ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
                    : 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px',
                isChosen && busy && 'cursor-not-allowed',
                flash === b.side && 'translate-y-px brightness-110',
              )}
            >
              {glow && !suggested ? (
                <span
                  aria-hidden="true"
                  className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
                />
              ) : null}
              {suggested ? (
                <>
                  <motion.span
                    aria-hidden="true"
                    data-testid="ab-suggested-ring"
                    className="pointer-events-none absolute -inset-1 rounded-[0.95rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
                    animate={
                      reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.04, 1] }
                    }
                    transition={
                      reduced
                        ? { duration: 0 }
                        : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
                    }
                  />
                  <span
                    aria-hidden="true"
                    className="bg-gold-200 text-ink absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
                  >
                    <SparkleIcon size={9} />
                    {abt('andarBahar.bet.pick')}
                  </span>
                </>
              ) : null}
              {isChosen ? (
                <span
                  aria-hidden="true"
                  className="bg-gold-300 text-ink absolute -top-2.5 left-1/2 z-10 -translate-x-1/2 rounded-full px-2 py-px text-[0.5625rem] font-extrabold tracking-[0.1em] whitespace-nowrap uppercase shadow"
                >
                  {abt('andarBahar.bet.chosen')}
                </span>
              ) : null}
              <span className="text-[1.0625rem] leading-tight font-extrabold sm:text-lg">
                {abt(b.label)}
              </span>
              <span
                id={hintId}
                className={cn(
                  'text-[0.6875rem] leading-tight font-semibold sm:text-xs',
                  !busy && !isChosen ? 'text-ink/75' : 'text-mist',
                )}
              >
                {abt(b.hint)}
              </span>
              <kbd
                aria-hidden="true"
                className={cn(
                  'absolute top-1 right-1 hidden size-5 items-center justify-center rounded border font-sans text-[0.625rem] leading-none font-bold pointer-fine:inline-flex',
                  !busy && !isChosen
                    ? 'border-ink/30 text-ink/70'
                    : 'border-gold-300/40 text-gold-200/80',
                )}
              >
                {b.key}
              </kbd>
            </button>
          );
        })}
      </div>
      <span id={busyId} hidden>
        {busyReason}
      </span>
      <span id={suggestedId} hidden>
        {abt('andarBahar.bet.suggested')}
      </span>
      <span id={chosenId} hidden>
        {abt('andarBahar.bet.chosenSr')}
      </span>
      <p
        data-testid="ab-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{abt('andarBahar.bet.keys')}:</span>
        {BETS.map((b) => (
          <span key={b.side} className="inline-flex items-center gap-1">
            <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
              {b.key}
            </kbd>
            {abt(b.label)}
          </span>
        ))}
      </p>
    </div>
  );
}
