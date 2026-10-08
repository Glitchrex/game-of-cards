'use client';
import {
  useId,
  useState,
  type ChangeEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { t } from '@/lib/i18n';
import { cn } from './cn';
import { AlertIcon, ChevronDownIcon } from './icons';

interface FieldOwnProps {
  /** Visible label (required — every field is labelled). */
  label: ReactNode;
  /** Helper text under the field. */
  hint?: ReactNode;
  /** Error message; marks the field aria-invalid and is announced via aria-describedby. */
  error?: string | null;
  /** Adds an "(optional)" tag next to the label. */
  optional?: boolean;
  /** Show a "12/120" counter (requires maxLength). */
  showCount?: boolean;
  /** Class for the outer wrapper. */
  containerClassName?: string;
}

const controlBase =
  'block w-full rounded-md border bg-felt-950/55 px-3.5 text-base text-cream shadow-[inset_0_1px_3px_rgb(0_0_0/0.45)] transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-mist/70 hover:border-gold-300/60 focus:border-gold-300 focus:bg-felt-950/75 disabled:opacity-60';

const controlState = (error?: string | null) =>
  // felt-400 keeps the field outline ≥ 3:1 against panels and dialogs (WCAG 1.4.11).
  error ? 'border-velvet-400 focus:border-velvet-300' : 'border-felt-400';

function useFieldIds(id: string | undefined) {
  const auto = useId();
  const base = id ?? auto;
  return { id: base, hint: `${base}-hint`, error: `${base}-error`, count: `${base}-count` };
}

function describedBy(
  ids: ReturnType<typeof useFieldIds>,
  opts: { hint: boolean; error: boolean; count: boolean; extra?: string },
) {
  return (
    [
      opts.error ? ids.error : null,
      opts.hint ? ids.hint : null,
      opts.count ? ids.count : null,
      opts.extra ?? null,
    ]
      .filter(Boolean)
      .join(' ') || undefined
  );
}

function FieldShell({
  ids,
  label,
  hint,
  error,
  optional,
  count,
  containerClassName,
  children,
}: {
  ids: ReturnType<typeof useFieldIds>;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  count?: { value: number; max: number };
  containerClassName?: string;
  children: ReactNode;
}) {
  const near = count ? count.value >= count.max * 0.9 : false;
  return (
    <div className={cn('flex flex-col gap-1.5', containerClassName)}>
      <label
        htmlFor={ids.id}
        className="text-cream flex items-baseline gap-2 text-sm font-semibold"
      >
        <span>{label}</span>
        {optional ? (
          <span className="text-mist text-xs font-medium">({t('common.optional')})</span>
        ) : null}
      </label>
      {children}
      {error || hint || count ? (
        <div className="flex items-start justify-between gap-3 text-[0.8125rem] leading-snug">
          <div className="min-w-0 flex-1">
            {error ? (
              <p id={ids.error} className="text-velvet-300 flex items-start gap-1.5 font-medium">
                <AlertIcon size={16} className="mt-px shrink-0" />
                <span>{error}</span>
              </p>
            ) : null}
            {hint ? (
              <p id={ids.hint} className={cn('text-mist', error && 'mt-1')}>
                {hint}
              </p>
            ) : null}
          </div>
          {count ? (
            <p
              id={ids.count}
              className={cn('tabular shrink-0', near ? 'text-gold-300' : 'text-mist')}
            >
              <span aria-hidden="true">
                {t('common.charCount', { count: count.value, max: count.max })}
              </span>
              <span className="sr-only">
                {t('common.charCountLabel', { count: count.value, max: count.max })}
              </span>
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function useLength(value: unknown, defaultValue: unknown) {
  const controlled = value !== undefined;
  const [len, setLen] = useState(() => String(defaultValue ?? '').length);
  return {
    length: controlled ? String(value ?? '').length : len,
    track: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!controlled) setLen(e.target.value.length);
    },
  };
}

export type TextFieldProps = FieldOwnProps &
  Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & { ref?: Ref<HTMLInputElement> };

/** Labelled text input with hint, error and optional character counter. */
export function TextField({
  label,
  hint,
  error,
  optional,
  showCount,
  containerClassName,
  className,
  id,
  maxLength,
  value,
  defaultValue,
  onChange,
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: TextFieldProps) {
  const ids = useFieldIds(id);
  const { length, track } = useLength(value, defaultValue);
  const counting = Boolean(showCount && maxLength);
  return (
    <FieldShell
      ids={ids}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      count={counting && maxLength ? { value: length, max: maxLength } : undefined}
      containerClassName={containerClassName}
    >
      <input
        {...rest}
        ref={ref}
        id={ids.id}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, {
          hint: Boolean(hint),
          error: Boolean(error),
          count: counting,
          extra: extraDescribedBy,
        })}
        onChange={(e) => {
          track(e);
          onChange?.(e);
        }}
        className={cn(controlBase, controlState(error), 'min-h-12 py-2.5', className)}
      />
    </FieldShell>
  );
}

export type TextAreaProps = FieldOwnProps &
  TextareaHTMLAttributes<HTMLTextAreaElement> & { ref?: Ref<HTMLTextAreaElement> };

/** Labelled multi-line input with hint, error and optional character counter. */
export function TextArea({
  label,
  hint,
  error,
  optional,
  showCount,
  containerClassName,
  className,
  id,
  maxLength,
  value,
  defaultValue,
  onChange,
  rows = 4,
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: TextAreaProps) {
  const ids = useFieldIds(id);
  const { length, track } = useLength(value, defaultValue);
  const counting = Boolean(showCount && maxLength);
  return (
    <FieldShell
      ids={ids}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      count={counting && maxLength ? { value: length, max: maxLength } : undefined}
      containerClassName={containerClassName}
    >
      <textarea
        {...rest}
        ref={ref}
        id={ids.id}
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, {
          hint: Boolean(hint),
          error: Boolean(error),
          count: counting,
          extra: extraDescribedBy,
        })}
        onChange={(e) => {
          track(e);
          onChange?.(e);
        }}
        className={cn(
          controlBase,
          controlState(error),
          'min-h-28 resize-y py-3 leading-relaxed',
          className,
        )}
      />
    </FieldShell>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export type SelectProps = Omit<FieldOwnProps, 'showCount'> &
  Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children'> & {
    options: ReadonlyArray<SelectOption>;
    /** Adds a disabled first option, e.g. "Choose one…". */
    placeholder?: string;
    ref?: Ref<HTMLSelectElement>;
  };

/** Labelled native <select> with a custom chevron, hint and error. */
export function Select({
  label,
  hint,
  error,
  optional,
  containerClassName,
  className,
  id,
  options,
  placeholder,
  ref,
  'aria-describedby': extraDescribedBy,
  ...rest
}: SelectProps) {
  const ids = useFieldIds(id);
  return (
    <FieldShell
      ids={ids}
      label={label}
      hint={hint}
      error={error}
      optional={optional}
      containerClassName={containerClassName}
    >
      <div className="relative">
        <select
          {...rest}
          ref={ref}
          id={ids.id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, {
            hint: Boolean(hint),
            error: Boolean(error),
            count: false,
            extra: extraDescribedBy,
          })}
          className={cn(
            controlBase,
            controlState(error),
            'min-h-12 cursor-pointer appearance-none py-2.5 pr-11',
            className,
          )}
        >
          {placeholder ? (
            <option value="" disabled>
              {placeholder}
            </option>
          ) : null}
          {options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          size={18}
          className="text-gold-300 pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2"
        />
      </div>
    </FieldShell>
  );
}
