'use client';
/**
 * The Teen Patti action buttons: "See cards" (beside the learner's hand) and the betting bar
 * (Chaal · cost, Raise · cost, Show · cost, Pack). Unavailable actions look secondary and
 * carry aria-disabled, but stay focusable and still call `onPress`, so the controller can
 * explain why. While `busy`, presses are ignored and the buttons keep focus.
 */
import { motion } from 'motion/react';
import { useId, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { t, type TKey } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { type TeenPattiMoveType } from '../engine';
import { type BetType, type Price } from './view';

/** Keyboard shortcut per action (also exposed with aria-keyshortcuts). */
export const ACTION_KEYS: Readonly<Record<TeenPattiMoveType, string>> = {
  see: 'S',
  chaal: 'C',
  raise: 'R',
  show: 'W',
  pack: 'P',
};

export interface ActionState {
  /** A legal move right now. */
  legal: boolean;
  /** Coach mode: this legal move glows. */
  glow: boolean;
  /** The coach's pick (after "What would a pro do?"). */
  suggested: boolean;
}

const ICON_PROPS = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.9,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  focusable: false,
};

const ICONS: Record<TeenPattiMoveType, ReactNode> = {
  see: (
    <svg {...ICON_PROPS}>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx={12} cy={12} r={2.8} />
    </svg>
  ),
  chaal: (
    <svg {...ICON_PROPS}>
      <ellipse cx={12} cy={8} rx={7.5} ry={3} />
      <path d="M4.5 8v4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V8" />
    </svg>
  ),
  raise: (
    <svg {...ICON_PROPS}>
      <ellipse cx={10} cy={14} rx={6.5} ry={2.6} />
      <path d="M3.5 14v3.4c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6V14" />
      <path d="M19 11V3.5M15.8 6.6 19 3.4l3.2 3.2" />
    </svg>
  ),
  show: (
    <svg {...ICON_PROPS}>
      <rect x={2.2} y={5.5} width={9} height={13} rx={1.6} transform="rotate(-10 6.7 12)" />
      <rect x={12.8} y={5.5} width={9} height={13} rx={1.6} transform="rotate(10 17.3 12)" />
      <path d="M12 2.5v2.2" />
    </svg>
  ),
  pack: (
    <svg {...ICON_PROPS}>
      <rect x={5} y={4} width={11} height={15} rx={2} transform="rotate(-8 10.5 11.5)" />
      <path d="M15 15.5l5 5M20 15.5l-5 5" />
    </svg>
  ),
};

const LABELS: Record<TeenPattiMoveType, TKey> = {
  see: 'teenPatti.actions.see',
  chaal: 'teenPatti.actions.chaal',
  raise: 'teenPatti.actions.raise',
  show: 'teenPatti.actions.show',
  pack: 'teenPatti.actions.pack',
};

/** ←/→ (and Home/End) move between the action buttons; Tab still works as usual. */
export function onActionArrows(e: KeyboardEvent<HTMLElement>, root: HTMLElement | null) {
  if (!root || e.altKey || e.ctrlKey || e.metaKey) return;
  const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
  if (!keys.includes(e.key)) return;
  const buttons = [...root.querySelectorAll<HTMLButtonElement>('[data-tp-action]')];
  const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
  if (i < 0) return;
  e.preventDefault();
  const last = buttons.length - 1;
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? last
        : e.key === 'ArrowRight'
          ? i === last
            ? 0
            : i + 1
          : i === 0
            ? last
            : i - 1;
  buttons[next]?.focus();
}

function costLabel(n: number): string {
  return n === 1 ? t('teenPatti.actions.costLabelOne') : t('teenPatti.actions.costLabel', { n });
}

export interface ActionButtonProps {
  type: TeenPattiMoveType;
  state: ActionState;
  busy: boolean;
  /** Ids of shared descriptions (busy reason, "unavailable", "coach's pick"). */
  describe: { busy: string; unavailable: string; suggested: string };
  /** Boots this action costs (bets only). */
  price?: Price;
  /** Small second line under the label (also the button's description). */
  hint: ReactNode;
  flash: boolean;
  onPress: (type: TeenPattiMoveType) => void;
  /** 'wide' = the big See cards button beside the hand. */
  variant?: 'bar' | 'wide';
  /** Override the label (e.g. "Cards seen"). */
  label?: string;
  tone?: 'gold' | 'velvet';
}

export function ActionButton({
  type,
  state,
  busy,
  describe,
  price,
  hint,
  flash,
  onPress,
  variant = 'bar',
  label,
  tone = 'gold',
}: ActionButtonProps) {
  const reduced = useReducedMotionPref();
  const hintId = useId();
  const unavailable = !busy && !state.legal;
  const glow = state.glow && !busy;
  const suggested = state.suggested && !busy;
  const name = label ?? t(LABELS[type]);
  const visible =
    price && price.cost > 0
      ? t('teenPatti.actions.withCost', { label: name, n: price.cost })
      : name;
  const accessible = price && price.cost > 0 ? `${name}, ${costLabel(price.cost)}` : name;
  const describedBy = [
    hintId,
    busy ? describe.busy : unavailable ? describe.unavailable : null,
    suggested ? describe.suggested : null,
  ]
    .filter(Boolean)
    .join(' ');
  const live = state.legal && !busy;

  return (
    <button
      type="button"
      data-tp-action={type}
      data-testid={`tp-${type}`}
      data-legal={state.legal || undefined}
      data-highlighted={glow || undefined}
      data-suggested={suggested || undefined}
      data-pressed={flash || undefined}
      data-cost={price ? price.cost : undefined}
      data-capped={price?.capped || undefined}
      aria-label={accessible}
      aria-keyshortcuts={ACTION_KEYS[type]}
      aria-disabled={busy || unavailable || undefined}
      aria-describedby={describedBy}
      onClick={() => onPress(type)}
      className={cn(
        'group/act ease-snap relative flex min-w-0 items-center justify-center rounded-xl border text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none',
        variant === 'wide'
          ? 'min-h-12 w-full flex-row gap-2 px-4 py-2 sm:min-h-14'
          : 'min-h-[4.25rem] flex-col gap-0.5 px-1 py-2 sm:min-h-20',
        busy
          ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
          : live
            ? tone === 'velvet'
              ? 'border-velvet-300/70 text-cream bg-[linear-gradient(180deg,var(--color-velvet-400)_0%,var(--color-velvet-600)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_10px_22px_-12px_rgb(194_47_71/0.9)] hover:brightness-110 active:translate-y-px'
              : 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px'
            : 'border-gold-300/40 bg-felt-950/45 text-gold-200 hover:border-gold-300/70 hover:bg-felt-950/65 active:translate-y-px',
        flash && 'translate-y-px brightness-110',
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
            data-testid="tp-suggested-ring"
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
            {t('teenPatti.actions.pick')}
          </span>
        </>
      ) : null}
      <span aria-hidden="true" className="inline-flex">
        {ICONS[type]}
      </span>
      <span
        className={cn('flex min-w-0 flex-col', variant === 'wide' ? 'items-start' : 'items-center')}
      >
        <span
          aria-hidden="true"
          className="text-[0.875rem] leading-tight font-extrabold sm:text-base"
        >
          {visible}
        </span>
        <span
          id={hintId}
          className={cn(
            'text-[0.625rem] leading-tight font-semibold sm:text-xs',
            live ? (tone === 'velvet' ? 'text-cream/80' : 'text-ink/75') : 'text-mist',
          )}
        >
          {hint}
        </span>
      </span>
      <kbd
        aria-hidden="true"
        className={cn(
          'absolute top-1 right-1 hidden size-4 items-center justify-center rounded border font-sans text-[0.5625rem] leading-none font-bold sm:size-5 sm:text-[0.625rem] pointer-fine:inline-flex',
          live
            ? tone === 'velvet'
              ? 'border-cream/40 text-cream/80'
              : 'border-ink/30 text-ink/70'
            : 'border-gold-300/40 text-gold-200/80',
        )}
      >
        {ACTION_KEYS[type]}
      </kbd>
    </button>
  );
}

const BAR: readonly BetType[] = ['chaal', 'raise', 'show', 'pack'];

export function ActionBar({
  actions,
  prices,
  hints,
  busy,
  describe,
  flash,
  onPress,
}: {
  actions: Record<BetType, ActionState>;
  prices: Record<BetType, Price>;
  hints: Record<BetType, ReactNode>;
  busy: boolean;
  describe: ActionButtonProps['describe'];
  flash: TeenPattiMoveType | null;
  onPress: (type: TeenPattiMoveType) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-2 pt-1">
      <div
        role="group"
        aria-label={t('teenPatti.actions.label')}
        data-testid="tp-actions"
        className="grid grid-cols-4 gap-1.5 sm:gap-3"
      >
        {BAR.map((type) => (
          <ActionButton
            key={type}
            type={type}
            state={actions[type]}
            busy={busy}
            describe={describe}
            price={type === 'pack' ? undefined : prices[type]}
            hint={hints[type]}
            flash={flash === type}
            onPress={onPress}
            tone={type === 'pack' ? 'velvet' : 'gold'}
          />
        ))}
      </div>
      <p
        data-testid="tp-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{t('teenPatti.actions.keys')}:</span>
        {(['see', ...BAR] as TeenPattiMoveType[]).map((type) => (
          <span key={type} className="inline-flex items-center gap-1">
            <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
              {ACTION_KEYS[type]}
            </kbd>
            {t(LABELS[type])}
          </span>
        ))}
        <span className="inline-flex items-center gap-1">
          <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
            ← →
          </kbd>
          {t('teenPatti.actions.arrows')}
        </span>
      </p>
    </div>
  );
}
