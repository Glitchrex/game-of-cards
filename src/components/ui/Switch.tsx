'use client';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
  id?: string;
  className?: string;
}

/** On/off switch (role="switch") with a visible label and optional hint. */
export function Switch({
  checked,
  onCheckedChange,
  label,
  hint,
  disabled = false,
  id,
  className,
}: SwitchProps) {
  const auto = useId();
  const switchId = id ?? auto;
  const hintId = `${switchId}-hint`;
  return (
    <div className={cn('flex items-center justify-between gap-4', className)}>
      <div className="min-w-0">
        <label htmlFor={switchId} className="text-cream cursor-pointer text-sm font-semibold">
          {label}
        </label>
        {hint ? (
          <p id={hintId} className="text-mist mt-0.5 text-[0.8125rem] leading-snug">
            {hint}
          </p>
        ) : null}
      </div>
      <button
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className="group/switch relative inline-flex h-11 w-[3.75rem] shrink-0 items-center justify-center rounded-full disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={cn(
            'absolute inset-x-1 inset-y-2 rounded-full border transition-colors duration-200',
            checked
              ? 'border-gold-200 bg-[linear-gradient(180deg,var(--color-gold-300),var(--color-gold-500))]'
              : 'border-felt-400/70 bg-felt-950/70',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'ease-snap absolute top-1/2 left-2 size-5 -translate-y-1/2 rounded-full shadow-[0_2px_4px_rgb(0_0_0/0.45)] transition-transform duration-200',
            checked ? 'bg-ivory translate-x-6' : 'bg-mist translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
