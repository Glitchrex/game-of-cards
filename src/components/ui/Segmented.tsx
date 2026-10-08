'use client';
import { useId, type ReactNode } from 'react';
import { cn } from './cn';

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
}

export interface SegmentedProps<V extends string> {
  legend: ReactNode;
  hint?: ReactNode;
  value: V;
  onValueChange: (value: V) => void;
  options: ReadonlyArray<SegmentedOption<V>>;
  /** Radio group name (auto-generated when omitted). */
  name?: string;
  className?: string;
}

/**
 * Segmented control built on native radio inputs inside a fieldset, so arrow
 * keys, labels and form semantics all work out of the box.
 */
export function Segmented<V extends string>({
  legend,
  hint,
  value,
  onValueChange,
  options,
  name,
  className,
}: SegmentedProps<V>) {
  const auto = useId();
  const groupName = name ?? auto;
  const hintId = `${groupName}-hint`;
  return (
    <fieldset className={cn('min-w-0', className)} aria-describedby={hint ? hintId : undefined}>
      <legend className="text-cream text-sm font-semibold">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-mist mt-0.5 text-[0.8125rem] leading-snug">
          {hint}
        </p>
      ) : null}
      <div className="border-gold-300/20 bg-felt-950/55 mt-2 grid auto-cols-fr grid-flow-col gap-1 rounded-xl border p-1">
        {options.map((o) => {
          const checked = o.value === value;
          return (
            <label
              key={o.value}
              className={cn(
                'relative flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-2 text-center text-sm font-semibold transition-[background-color,color,box-shadow] duration-150',
                'has-[input:focus-visible]:outline-gold-300 has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2',
                checked
                  ? 'text-ink bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))] shadow-[inset_0_1px_0_rgb(255_255_255/0.5)]'
                  : 'text-mist hover:text-cream hover:bg-white/[0.05]',
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={o.value}
                checked={checked}
                onChange={() => onValueChange(o.value)}
                className="sr-only"
              />
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
