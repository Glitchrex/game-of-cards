'use client';
/**
 * Feedback form → POST /api/posts (shows up on the public Community Board).
 * Client-side validation mirrors docs/API.md; the server re-validates.
 */
import {
  useEffect,
  useId,
  useReducer,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react';
import { Button } from '@/components/ui/Button';
import { Select, TextArea, TextField } from '@/components/ui/Field';
import { emailError, focusFirstInvalid, lengthError, postJson } from '@/components/ui/forms';
import { AlertIcon, CheckIcon } from '@/components/ui/icons';
import { toast } from '@/components/ui/Toast';
import { t } from '@/lib/i18n';
import { playSound } from '@/lib/sound';
import { FEEDBACK_TYPES, type FeedbackDraft, type FeedbackType } from './feedback-draft';

export { emptyFeedbackDraft, FEEDBACK_TYPES } from './feedback-draft';
export type { FeedbackDraft, FeedbackType } from './feedback-draft';

/** Limits from docs/API.md. */
export const FEEDBACK_LIMITS = {
  title: { min: 3, max: 120 },
  body: { min: 10, max: 2000 },
  name: { max: 60 },
  email: { max: 120 },
} as const;

type FieldName = 'type' | 'title' | 'body' | 'name' | 'email';
export type FeedbackErrors = Partial<Record<FieldName, string>>;

const FIELD_ORDER: FieldName[] = ['type', 'title', 'body', 'name', 'email'];

export function validateFeedback(d: FeedbackDraft): FeedbackErrors {
  const errors: FeedbackErrors = {};
  if (!FEEDBACK_TYPES.includes(d.type)) {
    errors.type = t('common.validation.required', { field: t('contact.feedback.type') });
  }
  const title = lengthError(t('contact.feedback.titleLabel'), d.title, FEEDBACK_LIMITS.title);
  if (title) errors.title = title;
  const body = lengthError(t('contact.feedback.description'), d.body, FEEDBACK_LIMITS.body);
  if (body) errors.body = body;
  const name = lengthError(t('contact.feedback.name'), d.name, {
    max: FEEDBACK_LIMITS.name.max,
    required: false,
  });
  if (name) errors.name = name;
  const email = emailError(t('contact.feedback.email'), d.email, { required: false });
  if (email) errors.email = email;
  return errors;
}

export interface FeedbackFormProps {
  draft: FeedbackDraft;
  onDraftChange: (draft: FeedbackDraft) => void;
  /** Called after a successful post (the draft should be reset by the owner). */
  onPosted?: () => void;
  /** Close the surrounding sheet. */
  onDone?: () => void;
  firstFieldRef?: RefObject<HTMLSelectElement | null>;
}

export function FeedbackForm({
  draft,
  onDraftChange,
  onPosted,
  onDone,
  firstFieldRef,
}: FeedbackFormProps) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<FeedbackErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const successRef = useRef<HTMLHeadingElement>(null);
  /** Fields to focus once their error messages have rendered (so they're announced). */
  const pendingFocus = useRef<FieldName[] | null>(null);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const honeypotId = useId();

  useEffect(() => {
    if (status === 'success') successRef.current?.focus();
  }, [status]);

  useEffect(() => {
    if (!pendingFocus.current) return;
    focusFirstInvalid(formRef.current, pendingFocus.current);
    pendingFocus.current = null;
  });

  const clientErrors = attempted ? validateFeedback(draft) : {};
  const errors: FeedbackErrors = { ...serverErrors, ...clientErrors };

  const set = <K extends keyof FeedbackDraft>(key: K, value: FeedbackDraft[K]) => {
    onDraftChange({ ...draft, [key]: value });
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
    const found = validateFeedback(draft);
    const invalid = FIELD_ORDER.filter((f) => found[f]);
    if (invalid.length) {
      pendingFocus.current = invalid;
      rerender();
      return;
    }
    setStatus('submitting');
    const name = draft.name.trim();
    const email = draft.email.trim();
    const res = await postJson<{ post?: { id: number } }>('/api/posts', {
      type: draft.type,
      title: draft.title.trim(),
      body: draft.body.trim(),
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      website: draft.website,
    });
    if (res.ok) {
      setStatus('success');
      setAttempted(false);
      playSound('chip');
      toast(t('contact.feedback.toast'));
      onPosted?.();
      return;
    }
    setStatus('idle');
    setServerError(res.error);
    const mapped: FeedbackErrors = {};
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
      <div className="flex flex-col items-start gap-4 py-2" data-testid="feedback-success">
        <span
          aria-hidden="true"
          className="border-gold-200 text-ink inline-flex size-14 items-center justify-center rounded-full border bg-[linear-gradient(180deg,var(--color-gold-200),var(--color-gold-400))] shadow-[0_0_30px_-4px_rgb(245_215_122/0.7)]"
        >
          <CheckIcon size={28} />
        </span>
        <h3
          ref={successRef}
          tabIndex={-1}
          className="font-display text-gold-100 text-2xl font-bold outline-none"
        >
          {t('contact.feedback.successTitle')}
        </h3>
        <p className="text-mist">{t('contact.feedback.successBody')}</p>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button href="/community" onClick={onDone}>
            {t('contact.feedback.viewBoard')}
          </Button>
          <Button variant="ghost" onClick={() => setStatus('idle')}>
            {t('contact.feedback.another')}
          </Button>
        </div>
      </div>
    );
  }

  const typeOptions = FEEDBACK_TYPES.map((value) => ({
    value,
    label: t(`contact.feedback.types.${value}`),
  }));

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      className="relative flex flex-col gap-4"
      aria-busy={status === 'submitting' || undefined}
      data-testid="feedback-form"
    >
      <Select
        ref={firstFieldRef}
        name="type"
        label={t('contact.feedback.type')}
        options={typeOptions}
        value={draft.type}
        onChange={(e) => set('type', e.target.value as FeedbackType)}
        error={errors.type}
      />
      <TextField
        name="title"
        label={t('contact.feedback.titleLabel')}
        hint={t('contact.feedback.titleHint')}
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
        maxLength={FEEDBACK_LIMITS.title.max}
        showCount
        required
        autoComplete="off"
        error={errors.title}
      />
      <TextArea
        name="body"
        label={t('contact.feedback.description')}
        hint={t('contact.feedback.descriptionHint')}
        value={draft.body}
        onChange={(e) => set('body', e.target.value)}
        maxLength={FEEDBACK_LIMITS.body.max}
        showCount
        required
        rows={5}
        error={errors.body}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          name="name"
          label={t('contact.feedback.name')}
          hint={t('contact.feedback.nameHint')}
          optional
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={FEEDBACK_LIMITS.name.max}
          autoComplete="nickname"
          error={errors.name}
        />
        <TextField
          name="email"
          type="email"
          inputMode="email"
          label={t('contact.feedback.email')}
          hint={t('contact.feedback.emailHint')}
          optional
          value={draft.email}
          onChange={(e) => set('email', e.target.value)}
          maxLength={FEEDBACK_LIMITS.email.max}
          autoComplete="email"
          error={errors.email}
        />
      </div>

      {/* Honeypot: hidden from people and assistive tech, irresistible to bots. */}
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
          data-testid="feedback-honeypot"
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
        fullWidth
        loading={status === 'submitting'}
        loadingLabel={t('contact.feedback.sending')}
      >
        {t('contact.feedback.submit')}
      </Button>
    </form>
  );
}
