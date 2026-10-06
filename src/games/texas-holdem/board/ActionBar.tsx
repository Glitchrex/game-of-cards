'use client';
/**
 * The learner's controls: Fold / Check / Call / All-in, then the bet-sizing panel — a
 * keyboard-accessible slider with labelled min and max, quick sizes (Min, ½ Pot, ¾ Pot,
 * Pot, Max) that set the slider, and the Bet / Raise button that confirms it.
 *
 * Every action can be attempted: unavailable ones look secondary and carry aria-disabled,
 * but still call `onPress`, so the controller can explain why. Only `busy` ignores presses
 * (buttons keep focus — a real `disabled` would drop it to <body>).
 */
import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { t, type TKey } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type SizeId, type Sizing } from './view';

export type ActionId = 'fold' | 'check' | 'call' | 'raise' | 'all-in';

export interface ActionState {
  /** The engine would accept this move right now. */
  legal: boolean;
  /** Coach mode: the move glows. */
  glow: boolean;
  /** The coach's pick: the move pulses. */
  suggested: boolean;
}

export interface QuickSize {
  id: SizeId;
  amount: number;
  glow: boolean;
  suggested: boolean;
}

/** Keyboard shortcut per action (also announced with aria-keyshortcuts). */
export const ACTION_KEYS: Readonly<Record<ActionId, string>> = {
  fold: 'F',
  check: 'K',
  call: 'C',
  raise: 'R',
  'all-in': 'A',
};

const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

const ICONS: Record<ActionId, ReactNode> = {
  fold: (
    <svg {...ICON_PROPS}>
      <rect x={4} y={4} width={10} height={14} rx={2} transform="rotate(-10 9 11)" />
      <path d="M15 15l5 5M20 15l-5 5" />
    </svg>
  ),
  check: (
    <svg {...ICON_PROPS}>
      <path d="M4 15c2.5-1 4-1 6.5 0s4 1 6.5 0" />
      <path d="M9 10.5l2 2 4.5-5" />
    </svg>
  ),
  call: (
    <svg {...ICON_PROPS}>
      <ellipse cx={12} cy={7.5} rx={7} ry={2.8} />
      <path d="M5 7.5v4c0 1.6 3.1 2.8 7 2.8s7-1.2 7-2.8v-4" />
      <path d="M9 19.5h6" />
    </svg>
  ),
  raise: (
    <svg {...ICON_PROPS}>
      <path d="M12 20V7M7 11.5L12 6.5l5 5" />
      <path d="M5 3.5h14" />
    </svg>
  ),
  'all-in': (
    <svg {...ICON_PROPS}>
      <ellipse cx={12} cy={6} rx={6.5} ry={2.5} />
      <path d="M5.5 6v3.5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V6" />
      <path d="M5.5 9.5V13c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V9.5" />
      <path d="M5.5 13v3.5c0 1.4 2.9 2.5 6.5 2.5s6.5-1.1 6.5-2.5V13" />
    </svg>
  ),
};

const SIZE_LABEL: Record<SizeId, TKey> = {
  min: 'texasHoldem.actions.sizes.min',
  half: 'texasHoldem.actions.sizes.half',
  threeQuarters: 'texasHoldem.actions.sizes.threeQuarters',
  pot: 'texasHoldem.actions.sizes.pot',
  max: 'texasHoldem.actions.sizes.max',
};

const SIZE_TESTID: Record<SizeId, string> = {
  min: 'holdem-size-min',
  half: 'holdem-size-half',
  threeQuarters: 'holdem-size-three-quarters',
  pot: 'holdem-size-pot',
  max: 'holdem-size-max',
};

export interface ActionBarProps {
  actions: Readonly<Record<ActionId, ActionState>>;
  /** Chips it costs to call (0 when there is nothing to call). */
  toCall: number;
  /** The learner's whole stack (what All-in puts in). */
  stack: number;
  sizing: Sizing;
  amount: number;
  onAmount: (amount: number) => void;
  quick: readonly QuickSize[];
  busy: boolean;
  busyReason: string;
  flash: ActionId | null;
  onPress: (id: ActionId) => void;
}

export function ActionBar({
  actions,
  toCall,
  stack,
  sizing,
  amount,
  onAmount,
  quick,
  busy,
  busyReason,
  flash,
  onPress,
}: ActionBarProps) {
  const ids = useId();
  const busyId = `${ids}-busy`;
  const unavailableId = `${ids}-unavailable`;
  const suggestedId = `${ids}-suggested`;
  const sliderId = `${ids}-slider`;
  const rangeId = `${ids}-range`;
  const allInSize = amount >= sizing.max;
  const raiseLabel =
    sizing.kind === 'bet'
      ? allInSize
        ? t('texasHoldem.actions.betAllIn', { n: amount })
        : t('texasHoldem.actions.betN', { n: amount })
      : allInSize
        ? t('texasHoldem.actions.raiseAllIn', { n: amount })
        : t('texasHoldem.actions.raiseN', { n: amount });

  const describedBy = (id: ActionId, hintId: string | null) => {
    const a = actions[id];
    return [
      hintId,
      busy ? busyId : a.legal ? null : unavailableId,
      !busy && a.suggested ? suggestedId : null,
    ]
      .filter(Boolean)
      .join(' ');
  };

  const button = (id: ActionId, label: string, hint: TKey | null, testId: string) => {
    const a = actions[id];
    const hintId = hint ? `${ids}-${id}-hint` : null;
    return (
      <ActionButton
        key={id}
        id={id}
        testId={testId}
        label={label}
        hint={hint ? t(hint) : null}
        hintId={hintId}
        state={a}
        busy={busy}
        pressed={flash === id}
        describedBy={describedBy(id, hintId)}
        onPress={() => onPress(id)}
      />
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[42rem] flex-col gap-2.5 pt-1">
      <div
        role="group"
        aria-label={t('texasHoldem.actions.label')}
        data-testid="holdem-actions"
        className="grid grid-cols-4 gap-1.5 sm:gap-2.5"
      >
        {button(
          'fold',
          t('texasHoldem.actions.fold'),
          'texasHoldem.actions.foldHint',
          'holdem-fold',
        )}
        {button(
          'check',
          t('texasHoldem.actions.check'),
          'texasHoldem.actions.checkHint',
          'holdem-check',
        )}
        {button(
          'call',
          toCall > 0
            ? t('texasHoldem.actions.callN', { n: toCall })
            : t('texasHoldem.actions.call'),
          'texasHoldem.actions.callHint',
          'holdem-call',
        )}
        {button(
          'all-in',
          stack > 0
            ? t('texasHoldem.actions.allInN', { n: stack })
            : t('texasHoldem.actions.allIn'),
          'texasHoldem.actions.allInHint',
          'holdem-allin',
        )}
      </div>

      <div
        role="group"
        aria-label={t('texasHoldem.actions.sizing')}
        data-testid="holdem-sizing"
        data-kind={sizing.kind}
        className="border-gold-300/25 bg-felt-950/35 grid gap-2.5 rounded-2xl border p-2.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.05)] sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-stretch sm:p-3"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={sliderId} className="text-gold-200 text-xs font-bold tracking-wide">
              {sizing.kind === 'bet'
                ? t('texasHoldem.actions.betAmount')
                : t('texasHoldem.actions.raiseAmount')}
            </label>
            <output
              htmlFor={sliderId}
              aria-hidden="true"
              className="font-display text-gold-100 tabular text-xl leading-none font-bold"
            >
              {amount}
            </output>
          </div>
          <input
            id={sliderId}
            type="range"
            data-testid="holdem-amount"
            min={sizing.min}
            max={sizing.max}
            step={1}
            value={amount}
            disabled={sizing.max <= 0}
            aria-valuetext={t('texasHoldem.actions.valueText', { n: amount })}
            aria-describedby={busy ? `${rangeId} ${busyId}` : rangeId}
            aria-disabled={busy || undefined}
            onChange={(e) => {
              if (!busy) onAmount(Number(e.currentTarget.value));
            }}
            className="accent-gold-300 h-11 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
          />
          <p
            id={rangeId}
            className="text-mist -mt-1 flex justify-between text-[0.6875rem] font-semibold"
          >
            <span data-testid="holdem-amount-min">
              {t('texasHoldem.actions.min', { n: sizing.min })}
            </span>{' '}
            <span data-testid="holdem-amount-max">
              {t('texasHoldem.actions.max', { n: sizing.max })}
            </span>
          </p>
          <div
            role="group"
            aria-label={t('texasHoldem.actions.quick')}
            className="grid grid-cols-5 gap-1"
          >
            {quick.map((q) => (
              <QuickButton
                key={q.id}
                size={q}
                selected={q.amount === amount}
                busy={busy}
                onPick={() => {
                  if (!busy) onAmount(q.amount);
                }}
              />
            ))}
          </div>
        </div>
        {button('raise', raiseLabel, null, 'holdem-raise')}
      </div>

      <span id={busyId} className="sr-only">
        {busyReason}
      </span>
      <span id={unavailableId} className="sr-only">
        {t('texasHoldem.actions.unavailable')}
      </span>
      <span id={suggestedId} className="sr-only">
        {t('texasHoldem.actions.suggested')}
      </span>
      <p
        data-testid="holdem-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('texasHoldem.actions.keys')}:</span>
        {(
          [
            ['fold', 'texasHoldem.actions.keyFold'],
            ['check', 'texasHoldem.actions.keyCheck'],
            ['call', 'texasHoldem.actions.keyCall'],
            ['raise', 'texasHoldem.actions.keyRaise'],
            ['all-in', 'texasHoldem.actions.keyAllIn'],
          ] as const
        ).map(([id, label]) => (
          <span key={id} className="inline-flex items-center gap-1">
            <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
              {ACTION_KEYS[id]}
            </kbd>
            {t(label)}
          </span>
        ))}
      </p>
    </div>
  );
}

function ActionButton({
  id,
  testId,
  label,
  hint,
  hintId,
  state,
  busy,
  pressed,
  describedBy,
  onPress,
}: {
  id: ActionId;
  testId: string;
  label: string;
  hint: string | null;
  hintId: string | null;
  state: ActionState;
  busy: boolean;
  pressed: boolean;
  describedBy: string;
  onPress: () => void;
}) {
  const reduced = useReducedMotionPref();
  const glow = state.glow && !busy;
  const suggested = state.suggested && !busy;
  const live = state.legal && !busy;
  return (
    <button
      type="button"
      data-testid={testId}
      data-legal={state.legal || undefined}
      data-highlighted={glow || undefined}
      data-suggested={suggested || undefined}
      data-pressed={pressed || undefined}
      aria-keyshortcuts={ACTION_KEYS[id]}
      aria-disabled={busy || !state.legal || undefined}
      aria-describedby={describedBy || undefined}
      onClick={onPress}
      className={cn(
        'group/act ease-snap relative flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none',
        id === 'raise' ? 'min-h-14 sm:min-h-full' : 'min-h-[4.25rem] sm:min-h-[4.75rem]',
        busy
          ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
          : live
            ? // One full set of classes per look: cn() does not merge conflicting utilities.
              id === 'fold'
              ? 'text-cream border-velvet-300/60 bg-[linear-gradient(180deg,#b9334b_0%,var(--color-velvet-600)_60%,var(--color-velvet-700)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_22px_-12px_rgb(194_47_71/0.9)] hover:brightness-[1.06] active:translate-y-px'
              : 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px'
            : 'border-gold-300/40 bg-felt-950/45 text-gold-200 hover:border-gold-300/70 hover:bg-felt-950/65 active:translate-y-px',
        pressed && 'translate-y-px brightness-110',
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
            data-testid="holdem-suggested-ring"
            className="pointer-events-none absolute -inset-1 rounded-[0.95rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
            animate={reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45], scale: [1, 1.04, 1] }}
            transition={
              reduced ? { duration: 0 } : { duration: 1.3, repeat: Infinity, ease: 'easeInOut' }
            }
          />
          <span
            aria-hidden="true"
            className="bg-gold-200 text-ink absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-0.5 rounded-full px-1.5 py-px text-[0.5625rem] font-extrabold tracking-[0.08em] whitespace-nowrap uppercase shadow"
          >
            <SparkleIcon size={9} />
            {t('texasHoldem.actions.pick')}
          </span>
        </>
      ) : null}
      <span aria-hidden="true" className="inline-flex">
        {ICONS[id]}
      </span>
      <span className="text-[0.875rem] leading-tight font-extrabold sm:text-base">{label}</span>
      {hint && hintId ? (
        <span
          id={hintId}
          className={cn(
            'hidden text-[0.625rem] leading-tight font-semibold min-[400px]:block sm:text-xs',
            live ? (id === 'fold' ? 'text-cream/80' : 'text-ink/75') : 'text-mist',
          )}
        >
          {hint}
        </span>
      ) : null}
      <kbd
        aria-hidden="true"
        className={cn(
          'absolute top-1 right-1 hidden size-4 items-center justify-center rounded border font-sans text-[0.5625rem] leading-none font-bold sm:size-5 sm:text-[0.625rem] pointer-fine:inline-flex',
          live
            ? id === 'fold'
              ? 'border-cream/40 text-cream/80'
              : 'border-ink/30 text-ink/70'
            : 'border-gold-300/40 text-gold-200/80',
        )}
      >
        {ACTION_KEYS[id]}
      </kbd>
    </button>
  );
}

function QuickButton({
  size,
  selected,
  busy,
  onPick,
}: {
  size: QuickSize;
  selected: boolean;
  busy: boolean;
  onPick: () => void;
}) {
  const reduced = useReducedMotionPref();
  const name = t(SIZE_LABEL[size.id]);
  return (
    <button
      type="button"
      data-testid={SIZE_TESTID[size.id]}
      data-amount={size.amount}
      data-highlighted={size.glow || undefined}
      data-suggested={size.suggested || undefined}
      aria-pressed={selected}
      aria-disabled={busy || undefined}
      aria-label={t('texasHoldem.actions.sizeLabel', { size: name, n: size.amount })}
      onClick={onPick}
      className={cn(
        'relative flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg border px-0.5 text-center leading-tight transition-[background-color,border-color,box-shadow] duration-150',
        busy && 'cursor-not-allowed opacity-60',
        selected
          ? 'border-gold-200 bg-gold-300/20 text-gold-100'
          : 'border-gold-300/30 bg-felt-950/40 text-gold-200 hover:border-gold-300/60',
        size.glow && 'shadow-[0_0_0_1px_var(--color-gold-300),0_0_12px_rgb(245_215_122/0.4)]',
        size.suggested &&
          'shadow-[0_0_0_2px_var(--color-gold-200),0_0_18px_4px_rgb(245_215_122/0.7)]',
        size.suggested && !reduced && 'animate-pulse',
      )}
    >
      <span className="text-[0.6875rem] font-extrabold whitespace-nowrap sm:text-xs">{name}</span>
      <span aria-hidden="true" className="tabular text-mist text-[0.625rem] font-semibold">
        {size.amount}
      </span>
    </button>
  );
}
