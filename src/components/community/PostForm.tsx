'use client';
/**
 * "New post" form for the Community Board → createPost (POST /api/posts).
 * Validates on the client with the limits from docs/API.md, shows the
 * server's field errors inline and its general errors (e.g. 429) in an alert.
 */
import { useEffect, useReducer, useRef, useState, type FormEvent, type Ref } from 'react';
import { Button } from '@/components/ui/Button';
import { Select, TextArea, TextField } from '@/components/ui/Field';
import { focusFirstInvalid } from '@/components/ui/forms';
import { AlertIcon } from '@/components/ui/icons';
import { toast } from '@/components/ui/Toast';
import { createPost, POST_TYPES, type Post, type PostType } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { playSound } from '@/lib/sound';
import { Honeypot } from './Honeypot';
import { postTypeLabel } from './PostBadges';
import {
  emptyPostDraft,
  pickFieldErrors,
  POST_FIELDS,
  POST_LIMITS,
  validatePostDraft,
  type PostDraft,
  type PostErrors,
  type PostField,
} from './validation';

export interface PostFormProps {
  /** Called with the stored post after a successful submit. */
  onCreated: (post: Post) => void;
  /** Ref to the title input (e.g. so an empty state can focus it). */
  titleRef?: Ref<HTMLInputElement>;
  /** id of the visible heading that names the form. */
  labelledBy?: string;
}

export function PostForm({ onCreated, titleRef, labelledBy }: PostFormProps) {
  const [draft, setDraft] = useState<PostDraft>(() => emptyPostDraft());
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<PostErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  /** Fields to focus once their error messages are rendered (so they get announced). */
  const pendingFocus = useRef<PostField[] | null>(null);
  const [focusTick, requestFocus] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!pendingFocus.current) return;
    focusFirstInvalid(formRef.current, pendingFocus.current);
    pendingFocus.current = null;
  }, [focusTick]);

  const errors: PostErrors = { ...serverErrors, ...(attempted ? validatePostDraft(draft) : {}) };

  const set = <K extends keyof PostDraft>(key: K, value: PostDraft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in serverErrors) {
      setServerErrors((e) => {
        const next = { ...e };
        delete next[key as PostField];
        return next;
      });
    }
  };

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting) return;
    setAttempted(true);
    setServerError(null);
    setServerErrors({});
    const found = validatePostDraft(draft);
    const invalid = POST_FIELDS.filter((f) => found[f]);
    if (invalid.length) {
      pendingFocus.current = invalid;
      requestFocus();
      playSound('error');
      return;
    }

    setSubmitting(true);
    const name = draft.name.trim();
    const email = draft.email.trim();
    const res = await createPost({
      type: draft.type,
      title: draft.title.trim(),
      body: draft.body.trim(),
      ...(name ? { name } : {}),
      ...(email ? { email } : {}),
      website: draft.website,
    });
    setSubmitting(false);

    if (res.ok) {
      setAttempted(false);
      // Keep type, name and email for the next idea; clear the post itself.
      setDraft((d) => ({ ...d, title: '', body: '', website: '' }));
      playSound('chip');
      toast(t('community.form.posted'));
      onCreated(res.data.post);
      return;
    }

    setServerError(res.error);
    const mapped = pickFieldErrors(POST_FIELDS, res.fieldErrors);
    setServerErrors(mapped);
    const invalidOnServer = POST_FIELDS.filter((f) => mapped[f]);
    if (invalidOnServer.length) {
      pendingFocus.current = invalidOnServer;
      requestFocus();
    }
    playSound('error');
  };

  const typeOptions = POST_TYPES.map((value: PostType) => ({
    value,
    label: postTypeLabel(value),
  }));

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      aria-labelledby={labelledBy}
      aria-busy={submitting || undefined}
      className="relative flex flex-col gap-4"
      data-testid="post-form"
    >
      <Select
        name="type"
        label={t('community.form.type')}
        options={typeOptions}
        value={draft.type}
        onChange={(e) => set('type', e.target.value as PostType)}
        error={errors.type}
        data-testid="post-type-select"
      />
      <TextField
        ref={titleRef}
        name="title"
        label={t('community.form.title')}
        hint={t('community.form.titleHint')}
        value={draft.title}
        onChange={(e) => set('title', e.target.value)}
        maxLength={POST_LIMITS.title.max}
        showCount
        required
        autoComplete="off"
        error={errors.title}
        data-testid="post-title-input"
      />
      <TextArea
        name="body"
        label={t('community.form.description')}
        hint={t('community.form.descriptionHint')}
        value={draft.body}
        onChange={(e) => set('body', e.target.value)}
        maxLength={POST_LIMITS.body.max}
        showCount
        required
        rows={5}
        error={errors.body}
        data-testid="post-body-input"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <TextField
          name="name"
          label={t('community.form.name')}
          hint={t('community.form.nameHint')}
          optional
          value={draft.name}
          onChange={(e) => set('name', e.target.value)}
          maxLength={POST_LIMITS.name.max}
          autoComplete="nickname"
          error={errors.name}
          data-testid="post-name-input"
        />
        <TextField
          name="email"
          type="email"
          inputMode="email"
          label={t('community.form.email')}
          hint={t('community.form.emailHint')}
          optional
          value={draft.email}
          onChange={(e) => set('email', e.target.value)}
          maxLength={POST_LIMITS.email.max}
          autoComplete="email"
          error={errors.email}
          data-testid="post-email-input"
        />
      </div>

      <Honeypot value={draft.website} onChange={(v) => set('website', v)} testId="post-honeypot" />

      {serverError ? (
        <p
          role="alert"
          className="border-velvet-400/60 bg-velvet-700/60 text-cream flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm font-semibold"
          data-testid="post-error"
        >
          <AlertIcon size={18} className="text-velvet-300 mt-px shrink-0" />
          <span>{serverError}</span>
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        fullWidth
        loading={submitting}
        loadingLabel={t('community.form.sending')}
        data-testid="post-submit"
      >
        {t('community.form.submit')}
      </Button>
    </form>
  );
}
