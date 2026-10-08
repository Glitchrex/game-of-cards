'use client';
import { useId } from 'react';
import { t } from '@/lib/i18n';

export interface HoneypotProps {
  value: string;
  onChange: (value: string) => void;
  testId?: string;
}

/**
 * The `website` honeypot: off-screen, out of the tab order and hidden from
 * assistive tech — only bots fill it in (the server then fakes a success).
 */
export function Honeypot({ value, onChange, testId }: HoneypotProps) {
  const id = useId();
  return (
    <div aria-hidden="true" className="absolute top-auto -left-[10000px] size-px overflow-hidden">
      <label htmlFor={id}>{t('community.form.honeypot')}</label>
      <input
        id={id}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
      />
    </div>
  );
}
