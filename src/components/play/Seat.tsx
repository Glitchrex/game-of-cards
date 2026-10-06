'use client';
import { motion } from 'motion/react';
import { useId, type ReactNode } from 'react';
import { type BotPersona } from '@/games/core/module';
import { cn } from '@/components/ui/cn';
import { t } from '@/lib/i18n';
import { useReducedMotionPref } from '@/lib/motion';
import { BotAvatar, type AvatarSize } from './BotAvatar';
import { YOU_PERSONA } from './personas';
import { ThinkingDots } from './ThinkingDots';

export interface SeatProps {
  /** The seat's persona. Omit (or pass YOU_PERSONA) for the learner's own seat. */
  persona?: BotPersona | null;
  /** Override the displayed name (e.g. "Dealer"). */
  label?: string;
  /** It is this seat's turn (gold glow). */
  active: boolean;
  /** The bot in this seat is thinking (dots). */
  thinking: boolean;
  /**
   * Text shown next to the dots while `thinking` (default "Thinking"). A dealer that only
   * follows house rules can say "Playing" instead.
   */
  thinkingLabel?: string;
  /** Their cards / chips / pile. */
  children?: ReactNode;
  /** Optional score / chip count shown as a badge. */
  score?: ReactNode;
  /** Show the persona's one-line tagline (default true for bots). */
  showTagline?: boolean;
  avatarSize?: AvatarSize;
  /** 'row' = avatar beside the name (default); 'column' = stacked, centred. */
  layout?: 'row' | 'column';
  className?: string;
  'data-testid'?: string;
}

/**
 * A place at the table: avatar, name, tagline, optional score and whatever the
 * Board puts in it (cards, chips). The active seat gets a gold turn glow; a
 * thinking bot shows bouncing dots. Rendered as a labelled group.
 */
export function Seat({
  persona,
  label,
  active,
  thinking,
  thinkingLabel,
  children,
  score,
  showTagline,
  avatarSize = 'sm',
  layout = 'row',
  className,
  'data-testid': testId,
}: SeatProps) {
  const reduce = useReducedMotionPref();
  const nameId = useId();
  const who = persona ?? YOU_PERSONA;
  const isYou = !persona || persona === YOU_PERSONA;
  const name = label ?? who.name;
  const tagline = (showTagline ?? !isYou) ? who.tagline : null;
  const status = thinking
    ? (thinkingLabel ?? t('play.seat.thinking'))
    : active
      ? isYou
        ? t('play.seat.yourTurn')
        : t('play.seat.active')
      : null;

  return (
    <div
      role="group"
      aria-labelledby={nameId}
      data-testid={testId ?? 'seat'}
      data-active={active || undefined}
      data-thinking={thinking || undefined}
      className={cn(
        'relative flex min-w-0 flex-col gap-2 rounded-2xl border px-3 py-2.5 transition-[border-color,background-color,box-shadow] duration-200',
        active
          ? 'border-gold-300/80 bg-felt-950/45 shadow-[0_0_0_1px_rgb(245_215_122/0.35),0_0_26px_-4px_rgb(245_215_122/0.55)]'
          : 'border-gold-300/15 bg-felt-950/25',
        className,
      )}
    >
      {active && !reduce ? (
        <motion.span
          aria-hidden="true"
          className="border-gold-200/70 pointer-events-none absolute -inset-px rounded-2xl border"
          animate={{ opacity: [0.25, 0.9, 0.25] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
        />
      ) : null}
      <div
        className={cn(
          'flex min-w-0 gap-2.5',
          layout === 'column' ? 'flex-col items-center text-center' : 'items-center',
        )}
      >
        <BotAvatar
          persona={who}
          size={avatarSize}
          thinking={thinking}
          showDots={false}
          decorative
        />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'flex flex-wrap items-center gap-x-2 gap-y-0.5',
              layout === 'column' && 'justify-center',
            )}
          >
            <span id={nameId} className="text-gold-100 truncate text-sm font-bold">
              {name}
            </span>{' '}
            {score !== undefined && score !== null ? (
              <span className="tabular border-gold-300/40 bg-felt-900/80 text-gold-200 rounded-full border px-2 py-0.5 text-xs font-bold">
                {score}
              </span>
            ) : null}
          </p>
          {tagline ? <p className="text-mist truncate text-xs leading-snug">{tagline}</p> : null}
          {status ? (
            <p
              className={cn(
                'text-gold-300 mt-0.5 flex items-center gap-1.5 text-xs font-semibold',
                layout === 'column' && 'justify-center',
              )}
            >
              <span>{status}</span>
              {thinking ? <ThinkingDots size="sm" /> : null}
            </p>
          ) : null}
        </div>
      </div>
      {children ? <div className="min-w-0">{children}</div> : null}
    </div>
  );
}

export interface TurnIndicatorProps {
  /** It is the learner's turn. */
  yourTurn: boolean;
  /** Name of the bot that is thinking right now (if any). */
  thinkingName?: string | null;
  /**
   * The bot has exactly one move it can make (a dealer drawing to 17, a forced flip), so it
   * "is playing…" rather than "is thinking…".
   */
  forced?: boolean;
  /** The hand has finished. */
  over?: boolean;
  className?: string;
}

/** "Your turn" / "Mona is thinking…" / "Dealer is playing…" / "Hand over" pill above the table. */
export function TurnIndicator({
  yourTurn,
  thinkingName,
  forced = false,
  over,
  className,
}: TurnIndicatorProps) {
  const reduce = useReducedMotionPref();
  const text = over
    ? t('play.turn.over')
    : yourTurn
      ? t('play.turn.you')
      : thinkingName
        ? t(forced ? 'play.turn.playing' : 'play.turn.thinking', { name: thinkingName })
        : null;
  if (!text) return null;
  const mode = over ? 'over' : yourTurn ? 'you' : 'bot';
  return (
    <motion.p
      key={mode + (thinkingName ?? '')}
      data-testid="turn-indicator"
      data-turn={mode}
      initial={reduce ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.25 }}
      className={cn(
        'inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-bold',
        mode === 'you'
          ? 'border-gold-200 bg-gold-300 text-ink shadow-[0_6px_18px_-8px_rgb(245_215_122/0.9)]'
          : mode === 'bot'
            ? 'border-gold-300/40 bg-felt-950/70 text-gold-100'
            : 'border-mist/30 bg-felt-950/60 text-mist',
        className,
      )}
    >
      {mode === 'you' ? (
        <span aria-hidden="true" className="bg-ink/80 size-2 rounded-full" />
      ) : null}
      <span>{text}</span>
      {mode === 'bot' ? <ThinkingDots size="sm" /> : null}
    </motion.p>
  );
}
