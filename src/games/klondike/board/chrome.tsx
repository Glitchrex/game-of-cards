'use client';
/**
 * Klondike table chrome around the piles: the Vegas readout (cards home, stake back, a
 * break-even marker and the house cashier) and the action bar (Draw · Send home ·
 * Auto-finish · I'm done) with its keyboard legend.
 */
import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { BotAvatar } from '@/components/play/BotAvatar';
import { cn } from '@/components/ui/cn';
import { SparkleIcon } from '@/components/ui/icons';
import { useReducedMotionPref } from '@/lib/motion';
import { BREAK_EVEN_CARDS, CARDS_IN_DECK } from '../engine';
import { PINTO_PROJECTIONIST } from '../personas';
import { stakeBack } from './model';
import { kt, type KlondikeKey } from './strings';

/* -------------------------------------------------------------- readout */

export function Readout({
  home,
  recycles,
  cleared,
}: {
  home: number;
  recycles: number;
  cleared: boolean;
}) {
  const reduced = useReducedMotionPref();
  const back = stakeBack(home);
  const ahead = home >= BREAK_EVEN_CARDS;
  const toGo = BREAK_EVEN_CARDS - home;
  const status = ahead
    ? kt('klondike.readout.statusAhead')
    : toGo === 1
      ? kt('klondike.readout.statusBehindOne')
      : kt('klondike.readout.statusBehind', { n: toGo });
  const pct = (home / CARDS_IN_DECK) * 100;
  const tick = (BREAK_EVEN_CARDS / CARDS_IN_DECK) * 100;
  return (
    <section
      aria-label={kt('klondike.readout.label')}
      data-testid="klondike-readout"
      data-home={home}
      data-ahead={ahead || undefined}
      className="border-gold-300/25 bg-felt-950/45 flex items-center gap-2.5 rounded-2xl border px-2.5 py-2 sm:gap-3 sm:px-3.5"
    >
      <BotAvatar persona={PINTO_PROJECTIONIST} size="sm" decorative />
      <div className="min-w-0 flex-1">
        <p className="sr-only">{kt('klondike.readout.full', { home, n: back, status })}</p>
        <div
          aria-hidden="true"
          className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
        >
          <p className="text-mist text-[0.6875rem] font-semibold tracking-[0.12em] uppercase sm:text-xs">
            {kt('klondike.readout.home')}{' '}
            <span className="text-gold-100 tabular text-sm font-extrabold tracking-normal sm:text-base">
              {kt('klondike.readout.of', { home })}
            </span>
          </p>
          <p className="text-mist text-[0.6875rem] font-semibold tracking-[0.12em] uppercase sm:text-xs">
            {kt('klondike.readout.back')}{' '}
            <span
              className={cn(
                'tabular text-sm font-extrabold tracking-normal sm:text-base',
                ahead ? 'text-gold-200' : 'text-cream',
              )}
            >
              {kt('klondike.readout.times', { n: back })}
            </span>
          </p>
        </div>
        <div aria-hidden="true" className="relative mt-1.5 h-2 rounded-full bg-black/40">
          <motion.span
            className={cn(
              'absolute inset-y-0 left-0 rounded-full',
              cleared
                ? 'bg-[linear-gradient(90deg,var(--color-gold-200),var(--color-gold-400),var(--color-gold-200))]'
                : ahead
                  ? 'bg-[linear-gradient(90deg,var(--color-gold-500),var(--color-gold-300))]'
                  : 'bg-[linear-gradient(90deg,var(--color-felt-500),var(--color-felt-400))]',
            )}
            initial={false}
            animate={{ width: `${pct}%` }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 220, damping: 28 }}
          />
          <span
            className="bg-gold-200 absolute -top-1 -bottom-1 w-0.5 rounded-full"
            style={{ left: `${tick}%` }}
          />
        </div>
        <p
          aria-hidden="true"
          className="text-mist mt-1 flex justify-between gap-2 text-[0.625rem] leading-tight sm:text-[0.6875rem]"
        >
          <span className={cn(ahead && 'text-gold-200 font-semibold')}>
            {ahead ? kt('klondike.readout.ahead') : kt('klondike.readout.breakEven')}
          </span>
          {recycles > 0 ? <span>{kt('klondike.readout.passes', { n: recycles + 1 })}</span> : null}
          <span className="hidden truncate italic sm:inline">
            {kt('klondike.readout.hostSays', { name: PINTO_PROJECTIONIST.name })}
          </span>
        </p>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- action bar */

const ICON = {
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

const ICONS = {
  draw: (
    <svg {...ICON}>
      <rect x={3} y={4} width={9} height={13} rx={1.6} />
      <rect x={12} y={7} width={9} height={13} rx={1.6} />
      <path d="M8 2.5h5" />
    </svg>
  ),
  recycle: (
    <svg {...ICON}>
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v4.5h-4.5" />
    </svg>
  ),
  home: (
    <svg {...ICON}>
      <path d="M12 20V7" />
      <path d="M7 11.5 12 6.5l5 5" />
      <rect x={5} y={2} width={14} height={3} rx={1} />
    </svg>
  ),
  auto: (
    <svg {...ICON}>
      <path d="M5 19 19 5" />
      <path d="M14 5h5v5" />
      <path d="M4.5 9.5 6 6l1.5 3.5L11 11l-3.5 1.5L6 16l-1.5-3.5L1 11Z" strokeWidth={1.4} />
    </svg>
  ),
  resign: (
    <svg {...ICON}>
      <path d="M6 21V4" />
      <path d="M6 4h11l-2.5 4L17 12H6" />
    </svg>
  ),
};

export interface ActionSpec {
  id: 'draw' | 'home' | 'auto' | 'resign';
  testId: string;
  label: string;
  hint: string;
  icon: ReactNode;
  /** Keyboard shortcut (announced with aria-keyshortcuts). */
  shortcut?: string;
  /** A real option right now (otherwise announced as unavailable, but still pressable). */
  available: boolean;
  /** Keep the quiet secondary look even when available ("I'm done" is never pushed). */
  quiet?: boolean;
  glow: boolean;
  suggested: boolean;
  onPress: () => void;
}

export function actionIcon(name: keyof typeof ICONS): ReactNode {
  return ICONS[name];
}

export function ActionBar({
  actions,
  busy,
  busyReason,
}: {
  actions: readonly ActionSpec[];
  busy: boolean;
  busyReason: string;
}) {
  const reduced = useReducedMotionPref();
  const ids = useId();
  const busyId = `${ids}-busy`;
  const unavailableId = `${ids}-unavailable`;
  const suggestedId = `${ids}-suggested`;
  const legend: [string, KlondikeKey][] = [
    ['← →', 'klondike.actions.keyMove'],
    ['Enter', 'klondike.actions.keyPick'],
    ['↑ ↓', 'klondike.actions.keyDepth'],
    ['A', 'klondike.actions.keyHome'],
    ['D', 'klondike.actions.keyDraw'],
    ['Esc', 'klondike.actions.keyCancel'],
  ];
  return (
    <div className="mx-auto flex w-full max-w-[40rem] flex-col gap-2">
      <div
        role="group"
        aria-label={kt('klondike.actions.label')}
        data-testid="klondike-actions"
        className="grid grid-cols-4 gap-1.5 sm:gap-3"
      >
        {actions.map((a) => {
          const unavailable = !busy && !a.available;
          const primary = !busy && a.available && !a.quiet;
          const glow = !busy && a.glow && !a.suggested;
          const suggested = !busy && a.suggested;
          const hintId = `${ids}-${a.id}-hint`;
          const describedBy = [
            hintId,
            busy ? busyId : unavailable ? unavailableId : null,
            suggested ? suggestedId : null,
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={a.id}
              type="button"
              data-testid={a.testId}
              data-available={a.available || undefined}
              data-highlighted={glow || undefined}
              data-suggested={suggested || undefined}
              aria-label={a.label}
              aria-keyshortcuts={a.shortcut}
              aria-disabled={busy || unavailable || undefined}
              aria-describedby={describedBy}
              onClick={a.onPress}
              className={cn(
                'ease-snap relative flex min-h-[3.75rem] min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-center transition-[transform,filter,background-color,border-color,opacity] duration-150 select-none sm:min-h-[4.25rem]',
                busy
                  ? 'border-gold-300/20 bg-felt-950/40 text-gold-200/70 cursor-not-allowed opacity-60'
                  : primary
                    ? 'border-gold-200/70 text-ink bg-[linear-gradient(180deg,var(--color-gold-200)_0%,var(--color-gold-400)_55%,var(--color-gold-500)_100%)] shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_-2px_0_rgb(138_99_18/0.35),0_10px_22px_-12px_rgb(236_193_83/0.9)] hover:brightness-[1.06] active:translate-y-px'
                    : 'border-gold-300/40 bg-felt-950/45 text-gold-200 hover:border-gold-300/70 hover:bg-felt-950/65 active:translate-y-px',
              )}
            >
              {glow ? (
                <span
                  aria-hidden="true"
                  className="shadow-glow pointer-events-none absolute -inset-0.5 rounded-[0.85rem]"
                />
              ) : null}
              {suggested ? (
                <>
                  <motion.span
                    aria-hidden="true"
                    className="pointer-events-none absolute -inset-1 rounded-[0.95rem] shadow-[0_0_0_3px_var(--color-gold-200),0_0_26px_6px_rgb(245_215_122/0.85)]"
                    animate={reduced ? { opacity: 1 } : { opacity: [0.45, 1, 0.45] }}
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
                    {kt('klondike.coach.pick')}
                  </span>
                </>
              ) : null}
              <span aria-hidden="true" className="inline-flex">
                {a.icon}
              </span>
              <span className="text-[0.8125rem] leading-tight font-extrabold sm:text-[0.9375rem]">
                {a.label}
              </span>
              <span
                id={hintId}
                className={cn(
                  'text-[0.5625rem] leading-tight font-semibold sm:text-[0.6875rem]',
                  primary ? 'text-ink/75' : 'text-mist',
                )}
              >
                {a.hint}
              </span>
              {a.shortcut ? (
                <kbd
                  aria-hidden="true"
                  className={cn(
                    'absolute top-1 right-1 hidden size-4 items-center justify-center rounded border font-sans text-[0.5625rem] leading-none font-bold sm:size-5 sm:text-[0.625rem] pointer-fine:inline-flex',
                    primary ? 'border-ink/30 text-ink/70' : 'border-gold-300/40 text-gold-200/80',
                  )}
                >
                  {a.shortcut}
                </kbd>
              ) : null}
            </button>
          );
        })}
      </div>
      <span id={busyId} className="sr-only">
        {busyReason}
      </span>
      <span id={unavailableId} className="sr-only">
        {kt('klondike.actions.unavailable')}
      </span>
      <span id={suggestedId} className="sr-only">
        {kt('klondike.coach.drawPick')}
      </span>
      <p
        data-testid="klondike-keys"
        className="text-mist hidden flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs pointer-fine:flex"
      >
        <span className="font-semibold">{kt('klondike.actions.keys')}:</span>
        {legend.map(([key, what]) => (
          <span key={what} className="inline-flex items-center gap-1">
            <kbd className="border-gold-300/40 text-gold-200 inline-flex min-w-5 items-center justify-center rounded border px-1 font-sans text-[0.6875rem] font-bold">
              {key}
            </kbd>
            {kt(what)}
          </span>
        ))}
      </p>
    </div>
  );
}
