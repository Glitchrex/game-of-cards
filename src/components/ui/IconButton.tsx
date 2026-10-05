'use client';
import { type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { cn } from './cn';

export type IconButtonVariant = 'ghost' | 'outline' | 'solid';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  /** Accessible name — required because the button has no visible text. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
  /** Small dot/badge rendered at the top-right corner. */
  badge?: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

const variants: Record<IconButtonVariant, string> = {
  ghost: 'text-cream hover:bg-white/[0.08] hover:text-gold-200',
  outline:
    'border border-gold-300/35 bg-felt-950/30 text-gold-200 hover:border-gold-300/80 hover:bg-gold-300/10',
  solid: 'bg-felt-700 text-cream hover:bg-felt-600',
};

/** Round 44×44 icon-only button with a required accessible label. */
export function IconButton({
  label,
  icon,
  variant = 'ghost',
  badge,
  className,
  type = 'button',
  ref,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-label={label}
      className={cn(
        'ease-snap aria-[pressed=true]:text-gold-200 relative inline-flex size-11 shrink-0 items-center justify-center rounded-full transition-[background-color,color,border-color,transform] duration-150 active:scale-95 disabled:pointer-events-none disabled:opacity-50',
        variants[variant],
        className,
      )}
    >
      <span aria-hidden="true" className="inline-flex">
        {icon}
      </span>
      {badge ? <span className="absolute -top-0.5 -right-0.5">{badge}</span> : null}
    </button>
  );
}
