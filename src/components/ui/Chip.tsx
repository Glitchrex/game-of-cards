'use client';
import { type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from './cn';

export interface ChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-pressed' | 'onChange'
> {
  /** Toggle state, exposed as aria-pressed. */
  selected: boolean;
  /** Called with the next state when the chip is activated. */
  onSelectedChange?: (next: boolean) => void;
  icon?: ReactNode;
  /** Optional count shown at the end (e.g. number of matching games). */
  count?: number;
  size?: 'sm' | 'md';
  ref?: Ref<HTMLButtonElement>;
}

/** Toggle chip for filters. Selected = gold fill. */
export function Chip({
  selected,
  onSelectedChange,
  icon,
  count,
  size = 'md',
  className,
  children,
  onClick,
  type = 'button',
  ref,
  ...rest
}: ChipProps) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-pressed={selected}
      onClick={(e) => {
        onClick?.(e);
        if (!e.defaultPrevented) onSelectedChange?.(!selected);
      }}
      className={cn(
        'ease-snap relative inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold whitespace-nowrap transition-[background-color,border-color,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50',
        // The small chip looks 36 px tall but its invisible hit area is 44 px.
        size === 'sm'
          ? "min-h-9 px-3 text-[0.8125rem] before:absolute before:inset-x-0 before:-inset-y-1 before:content-['']"
          : 'min-h-11 px-4 text-sm',
        selected
          ? 'border-gold-200 bg-gold-300 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.55),0_4px_14px_-6px_rgb(236_193_83/0.8)]'
          : 'border-felt-500 bg-felt-800/80 text-cream hover:border-gold-300/60 hover:text-gold-100',
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="inline-flex">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
      {count !== undefined ? (
        <span
          className={cn(
            'tabular rounded-full px-1.5 text-xs leading-5',
            selected ? 'bg-ink/15 text-ink' : 'bg-felt-950/60 text-mist',
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}
