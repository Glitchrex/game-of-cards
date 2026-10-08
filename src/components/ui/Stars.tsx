'use client';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '@/lib/i18n';
import { cn } from './cn';
import { StarIcon } from './icons';

export type StarsSize = 'sm' | 'md' | 'lg';

interface StarsCommon {
  size?: StarsSize;
  className?: string;
}

export interface StarsInputProps extends StarsCommon {
  readOnly?: false;
  /** Selected rating 1–5, or null when nothing is chosen yet. */
  value: number | null;
  onChange: (value: number) => void;
  /** Accessible name of the radiogroup, e.g. "Rate this lesson". */
  label: string;
  disabled?: boolean;
  /** id of a visible element that labels the group (takes precedence over `label`). */
  labelledBy?: string;
}

export interface StarsDisplayProps extends StarsCommon {
  readOnly: true;
  /** Rating 0–5; fractions are drawn as partial stars (e.g. 4.3 average). */
  value: number;
  /** Override the accessible text (default "Rated 4.3 out of 5"). */
  label?: string;
}

export type StarsProps = StarsInputProps | StarsDisplayProps;

const px: Record<StarsSize, number> = { sm: 16, md: 28, lg: 36 };
const STARS = [1, 2, 3, 4, 5] as const;

/**
 * 1–5 star rating. Interactive mode is an ARIA radiogroup with roving focus
 * (← → ↑ ↓ Home End); `readOnly` renders an image with a text alternative.
 */
export function Stars(props: StarsProps) {
  if (props.readOnly) return <StarsDisplay {...props} />;
  return <StarsInput {...props} />;
}

function StarsDisplay({ value, label, size = 'sm', className }: StarsDisplayProps) {
  const v = Math.max(0, Math.min(5, value));
  const rounded = Math.round(v * 10) / 10;
  const s = px[size];
  return (
    <span
      role="img"
      aria-label={label ?? t('common.stars.rated', { value: rounded })}
      className={cn('inline-flex items-center gap-0.5', className)}
    >
      {STARS.map((n) => {
        const fill = Math.max(0, Math.min(1, v - (n - 1)));
        return (
          <span key={n} className="relative inline-flex" style={{ width: s, height: s }}>
            <StarIcon size={s} className="text-felt-400" />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <StarIcon
                size={s}
                className="text-gold-300 drop-shadow-[0_0_4px_rgb(245_215_122/0.5)]"
              />
            </span>
          </span>
        );
      })}
    </span>
  );
}

function StarsInput({
  value,
  onChange,
  label,
  labelledBy,
  disabled = false,
  size = 'md',
  className,
}: StarsInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  const groupId = useId();
  const tabStop = value ?? 1;
  const shown = hover ?? value ?? 0;
  const s = px[size];

  const choose = (n: number) => {
    if (disabled) return;
    onChange(n);
    refs.current[n - 1]?.focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, n: number) => {
    let next: number | null = null;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        next = n === 5 ? 1 : n + 1;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        next = n === 1 ? 5 : n - 1;
        break;
      case 'Home':
        next = 1;
        break;
      case 'End':
        next = 5;
        break;
      case ' ':
      case 'Enter':
        next = n;
        break;
      default:
        return;
    }
    e.preventDefault();
    choose(next);
  };

  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-disabled={disabled || undefined}
      className={cn('inline-flex items-center', disabled && 'opacity-50', className)}
      onPointerLeave={() => setHover(null)}
    >
      {STARS.map((n) => {
        const active = n <= shown;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n - 1] = el;
            }}
            id={`${groupId}-${n}`}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={t('common.stars.option', { n })}
            tabIndex={n === tabStop ? 0 : -1}
            disabled={disabled}
            onClick={() => choose(n)}
            onKeyDown={(e) => onKeyDown(e, n)}
            onPointerEnter={() => setHover(n)}
            className="group/star ease-snap inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-transform duration-150 hover:scale-110 active:scale-95"
          >
            <StarIcon
              size={s}
              className={cn(
                'transition-[color,filter] duration-150',
                active
                  ? 'text-gold-300 drop-shadow-[0_0_6px_rgb(245_215_122/0.55)]'
                  : 'text-felt-400 group-hover/star:text-gold-300/60',
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
