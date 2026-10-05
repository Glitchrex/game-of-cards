'use client';
/** Contact form → POST /api/contact (see docs/API.md for limits). */
import { useEffect, useId, useReducer, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { emailError, focusFirstInvalid, lengthError, postJson } from '@/components/ui/forms';
import { AlertIcon, CheckIcon } from '@/components/ui/icons';
import { t } from '@/lib/i18n';
import { playSound } from '@/lib/sound';

export const CONTACT_LIMITS = {
  name: { min: 1, max: 60 },
  email: { max: 120 },
  message: { min: 10, max: 3000 },
} as const;

export interface ContactDraft {
  name: string;
  email: string;
  message: string;
  /** Honeypot. */
  website: string;
}

type FieldName = 'name' | 'email' | 'message';
export type ContactErrors = Partial<Record<FieldName, string>>;
const FIELD_ORDER: FieldName[] = ['name', 'email', 'message'];

const empty = (): ContactDraft => ({ name: '', email: '', message: '', website: '' });

export function validateContact(d: ContactDraft): ContactErrors {
  const errors: ContactErrors = {};
  const name = lengthError(t('contact.form.name'), d.name, CONTACT_LIMITS.name);
  if (name) errors.name = name;
  const email = emailError(t('contact.form.email'), d.email, { required: true });
  if (email) errors.email = email;
  const message = lengthError(t('contact.form.message'), d.message, CONTACT_LIMITS.message);
  if (message) errors.message = message;
  return errors;
}

export function ContactForm() {
  const [draft, setDraft] = useState<ContactDraft>(empty);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<ContactErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const restoreFocus = useRef(false);
  /** Fields to focus once their error messages have rendered (so they're announced). */
  const pendingFocus = useRef<FieldName[] | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const honeypotId = useId();

  useEffect(() => {
    if (!pendingFocus.current) return;
    focusFirstInvalid(formRef.current, pendingFocus.current);
    pendingFocus.current = null;
  });

  useEffect(() => {
    if (status === 'success') successRef.current?.focus();
    else if (restoreFocus.current) {
      restoreFocus.current = false;
      firstFieldRef.current?.focus();
    }
  }, [status]);

  const errors: ContactErrors = { ...serverErrors, ...(attempted ? validateContact(draft) : {}) };

  const set = <K extends keyof ContactDraft>(key: K, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in serverErrors) {
      setServerErrors((e) => {
        const next = { ...e };
        delete next[key as FieldName];
        return next;
      });
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setAttempted(true);
    setServerError(null);
    setServerErrors({});
    const found = validateContact(draft);
    const invalid = FIELD_ORDER.filter((f) => found[f]);
    if (invalid.length) {
      pendingFocus.current = invalid;
      rerender();
      return;
    }
    setStatus('submitting');
    const res = await postJson<{ ok: true }>('/api/contact', {
      name: draft.name.trim(),
      email: draft.email.trim(),
      message: draft.message.trim(),
      website: draft.website,
    });
    if (res.ok) {
      setStatus('success');
      setAttempted(false);
      setDraft(empty());
      playSound('coin');
      return;
    }
    setStatus('idle');
    setServerError(res.error);
    const mapped: ContactErrors = {};
    for (const f of FIELD_ORDER) {
      const msg = res.fieldErrors[f];
      if (msg) mapped[f] = msg;
    }
    setServerErrors(mapped);
    const invalidOnServer = FIELD_ORDER.filter((f) => mapped[f]);
    if (invalidOnServer.length) {
      pendingFocus.current = invalidOnServer;
      rerender();
    }
  };

  if (status === 'success') {
    return (
      <div
        className="border-gold-300/40 flex flex-col items-start gap-4 rounded-2xl border bg-[radial-gradient(120%_100%_at_0%_0%,rgb(245_215_122/0.14),transparent_60%)] p-5"
        data-testid="contact-success"
      >
        <span
          aria-hidden="true"
          className="text-ink inline-flex size-12 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))] shadow-[0_0_26px_-4px_rgb(245_215_122/0.7)]"
        >
          <CheckIcon size={24} />
        </span>
        <h3
          ref={successRef}
          tabIndex={-1}
          className="font-display text-gold-100 text-xl leading-snug font-bold outline-none sm:text-2xl"
        >
          {t('contact.form.success')}
        </h3>
        <p className="text-mist text-sm">{t('contact.form.successHint')}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            restoreFocus.current = true;
            setStatus('idle');
          }}
        >
          {t('contact.form.another')}
        </Button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="relative flex flex-col gap-4"
      aria-busy={status === 'submitting' || undefined}
      data-testid="contact-form"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          ref={firstFieldRef}
          name="name"
          label={t('contact.form.name')}
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={CONTACT_LIMITS.name.max}
          autoComplete="name"
          required
          error={errors.name}
        />
        <TextField
          name="email"
          type="email"
          inputMode="email"
          label={t('contact.form.email')}
          hint={t('contact.form.emailHint')}
          value={draft.email}
          onChange={(e) => set('email', e.target.value)}
          maxLength={CONTACT_LIMITS.email.max}
          autoComplete="email"
          required
          error={errors.email}
        />
      </div>
      <TextArea
        name="message"
        label={t('contact.form.message')}
        hint={t('contact.form.messageHint')}
        value={draft.message}
        onChange={(e) => set('message', e.target.value)}
        maxLength={CONTACT_LIMITS.message.max}
        showCount
        rows={6}
        required
        error={errors.message}
      />

      {/* Honeypot: hidden from people and assistive tech. */}
      <div aria-hidden="true" className="absolute top-auto -left-[10000px] size-px overflow-hidden">
        <label htmlFor={honeypotId}>{t('contact.form.honeypot')}</label>
        <input
          id={honeypotId}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={draft.website}
          onChange={(e) => set('website', e.target.value)}
          data-testid="contact-honeypot"
        />
      </div>

      {serverError ? (
        <p
          role="alert"
          className="border-velvet-400/60 bg-velvet-700/60 text-cream flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm font-semibold"
        >
          <AlertIcon size={18} className="text-velvet-300 mt-px shrink-0" />
          <span>{serverError}</span>
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto sm:self-start"
        loading={status === 'submitting'}
        loadingLabel={t('contact.form.sending')}
      >
        {t('contact.form.submit')}
      </Button>
    </form>
  );
}
