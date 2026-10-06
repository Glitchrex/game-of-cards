'use client';
/** Password form → adminLogin (POST /api/admin/login). */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { AlertIcon, InfoIcon, TicketIcon } from '@/components/ui/icons';
import { adminLogin } from '@/lib/api-client';
import { t } from '@/lib/i18n';

export interface AdminLoginProps {
  onSuccess: () => void;
  /** The server says admin is disabled after all (503). */
  onDisabled: () => void;
  /** Informational notice shown above the form, e.g. "session ended". */
  notice?: string | null;
}

export function AdminLogin({ onSuccess, onDisabled, notice }: AdminLoginProps) {
  const [password, setPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!password) {
      setFieldError(t('admin.login.required'));
      inputRef.current?.focus();
      return;
    }
    setFieldError(null);
    setSubmitting(true);
    const res = await adminLogin(password);
    setSubmitting(false);
    if (res.ok) {
      setPassword('');
      onSuccess();
      return;
    }
    if (res.status === 503) {
      onDisabled();
      return;
    }
    setError(res.error);
    inputRef.current?.select();
    inputRef.current?.focus();
  };

  return (
    <section
      aria-labelledby="admin-login-heading"
      className="panel relative mx-auto max-w-md overflow-hidden p-6 sm:p-8"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,var(--color-gold-300),transparent)]"
      />
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="border-gold-300/40 bg-felt-950/60 text-gold-200 inline-flex size-12 shrink-0 items-center justify-center rounded-xl border"
        >
          <TicketIcon size={24} />
        </span>
        <div>
          <h2
            id="admin-login-heading"
            className="font-display text-gold-100 text-2xl leading-tight font-bold"
          >
            {t('admin.login.title')}
          </h2>
          <p className="text-mist mt-1 text-sm leading-relaxed">{t('admin.login.body')}</p>
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="border-gold-300/30 bg-felt-950/50 text-cream mt-5 flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm"
        >
          <InfoIcon size={18} className="text-gold-300 mt-px shrink-0" />
          <span>{notice}</span>
        </p>
      ) : null}

      <form
        noValidate
        onSubmit={onSubmit}
        aria-labelledby="admin-login-heading"
        aria-busy={submitting || undefined}
        className="mt-5 flex flex-col gap-4"
        data-testid="admin-login-form"
      >
        <TextField
          ref={inputRef}
          type="password"
          name="password"
          label={t('admin.login.password')}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (fieldError) setFieldError(null);
          }}
          autoComplete="current-password"
          maxLength={200}
          required
          error={fieldError}
          data-testid="admin-password"
        />
        {error ? (
          <p
            role="alert"
            className="border-velvet-400/60 bg-velvet-700/60 text-cream flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm font-semibold"
            data-testid="admin-login-error"
          >
            <AlertIcon size={18} className="text-velvet-300 mt-px shrink-0" />
            <span>{error}</span>
          </p>
        ) : null}
        <Button
          type="submit"
          size="lg"
          fullWidth
          loading={submitting}
          loadingLabel={t('admin.login.checking')}
          data-testid="admin-login"
        >
          {t('admin.login.submit')}
        </Button>
      </form>
    </section>
  );
}
