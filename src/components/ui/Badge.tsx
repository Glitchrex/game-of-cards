import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from './cn';

export type BadgeTone = 'gold' | 'felt' | 'velvet' | 'mist' | 'ivory' | 'outline';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  size?: BadgeSize;
  /** Leading icon (decorative). */
  icon?: ReactNode;
  /** Soft pulsing glow to draw attention (disabled by reduced-motion CSS). */
  pulse?: boolean;
  children: ReactNode;
}

const tones: Record<BadgeTone, string> = {
  gold: 'bg-gold-300 text-ink border-gold-200/60',
  felt: 'bg-felt-600 text-cream border-felt-400/60',
  velvet: 'bg-velvet-600 text-cream border-velvet-400/60',
  mist: 'bg-felt-800 text-mist border-mist/30',
  ivory: 'bg-parchment text-ink border-white/40',
  outline: 'bg-transparent text-gold-200 border-gold-300/50',
};

const pulseTones: Record<BadgeTone, string> = {
  gold: 'bg-gold-300',
  felt: 'bg-felt-400',
  velvet: 'bg-velvet-400',
  mist: 'bg-mist',
  ivory: 'bg-parchment',
  outline: 'bg-gold-300',
};

const sizes: Record<BadgeSize, string> = {
  sm: 'h-5 gap-1 px-1.5 text-[0.6875rem]',
  md: 'h-6 gap-1.5 px-2.5 text-xs',
};

/** Small status label: "Planned", "Tier 1", "Udhaar"… */
export function Badge({
  tone = 'gold',
  size = 'md',
  icon,
  pulse = false,
  className,
  children,
  ...rest
}: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border leading-none font-bold tracking-wide whitespace-nowrap uppercase',
        tones[tone],
        sizes[size],
        className,
      )}
    >
      {pulse ? (
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-0 animate-ping rounded-full opacity-40 [animation-duration:1.8s]',
            pulseTones[tone],
          )}
        />
      ) : null}
      {icon ? (
        <span aria-hidden="true" className="relative inline-flex">
          {icon}
        </span>
      ) : null}
      <span className="relative">{children}</span>
    </span>
  );
}
