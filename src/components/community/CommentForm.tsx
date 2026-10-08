'use client';
/** Add-comment form → addComment (POST /api/posts/:id/comments). */
import { useEffect, useReducer, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { TextArea, TextField } from '@/components/ui/Field';
import { focusFirstInvalid } from '@/components/ui/forms';
import { AlertIcon } from '@/components/ui/icons';
import { toast } from '@/components/ui/Toast';
import { addComment, type Comment } from '@/lib/api-client';
import { t } from '@/lib/i18n';
import { playSound } from '@/lib/sound';
import { Honeypot } from './Honeypot';
import {
  COMMENT_FIELDS,
  COMMENT_LIMITS,
  emptyCommentDraft,
  pickFieldErrors,
  validateCommentDraft,
  type CommentDraft,
  type CommentErrors,
  type CommentField,
} from './validation';

export interface CommentFormProps {
  postId: number;
  /** Called with the stored comment after a successful submit. */
  onAdded: (comment: Comment) => void;
  /** id of the visible heading that names the form. */
  labelledBy?: string;
}

export function CommentForm({ postId, onAdded, labelledBy }: CommentFormProps) {
  const [draft, setDraft] = useState<CommentDraft>(() => emptyCommentDraft());
  const [submitting, setSubmitting] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<CommentErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pendingFocus = useRef<CommentField[] | null>(null);
  const [focusTick, requestFocus] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!pendingFocus.current) return;
    focusFirstInvalid(formRef.current, pendingFocus.current);
    pendingFocus.current = null;
  }, [focusTick]);

  const errors: CommentErrors = {
    ...serverErrors,
    ...(attempted ? validateCommentDraft(draft) : {}),
  };

  const set = <K extends keyof CommentDraft>(key: K, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in serverErrors) {
      setServerErrors((e) => {
        const next = { ...e };
        delete next[key as CommentField];
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
    const found = validateCommentDraft(draft);
    const invalid = COMMENT_FIELDS.filter((f) => found[f]);
    if (invalid.length) {
      pendingFocus.current = invalid;
      requestFocus();
      playSound('error');
      return;
    }

    setSubmitting(true);
    const name = draft.name.trim();
    const res = await addComment(postId, {
      body: draft.body.trim(),
      ...(name ? { name } : {}),
      website: draft.website,
    });
    setSubmitting(false);

    if (res.ok) {
      setAttempted(false);
      setDraft((d) => emptyCommentDraft(d.name));
      playSound('chip');
      toast(t('community.commentForm.posted'));
      onAdded(res.data.comment);
      return;
    }

    setServerError(res.error);
    const mapped = pickFieldErrors(COMMENT_FIELDS, res.fieldErrors);
    setServerErrors(mapped);
    const invalidOnServer = COMMENT_FIELDS.filter((f) => mapped[f]);
    if (invalidOnServer.length) {
      pendingFocus.current = invalidOnServer;
      requestFocus();
    }
    playSound('error');
  };

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={onSubmit}
      aria-labelledby={labelledBy}
      aria-busy={submitting || undefined}
      className="relative flex flex-col gap-4"
      data-testid="comment-form"
    >
      <TextArea
        name="body"
        label={t('community.commentForm.body')}
        hint={t('community.commentForm.bodyHint')}
        value={draft.body}
        onChange={(e) => set('body', e.target.value)}
        maxLength={COMMENT_LIMITS.body.max}
        showCount
        required
        rows={4}
        error={errors.body}
        data-testid="comment-input"
      />
      <TextField
        name="name"
        label={t('community.commentForm.name')}
        hint={t('community.commentForm.nameHint')}
        optional
        value={draft.name}
        onChange={(e) => set('name', e.target.value)}
        maxLength={COMMENT_LIMITS.name.max}
        autoComplete="nickname"
        error={errors.name}
        containerClassName="sm:max-w-sm"
        data-testid="comment-name-input"
      />

      <Honeypot
        value={draft.website}
        onChange={(v) => set('website', v)}
        testId="comment-honeypot"
      />

      {serverError ? (
        <p
          role="alert"
          className="border-velvet-400/60 bg-velvet-700/60 text-cream flex items-start gap-2 rounded-xl border px-3.5 py-3 text-sm font-semibold"
          data-testid="comment-error"
        >
          <AlertIcon size={18} className="text-velvet-300 mt-px shrink-0" />
          <span>{serverError}</span>
        </p>
      ) : null}

      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto sm:self-start"
        loading={submitting}
        loadingLabel={t('community.commentForm.sending')}
        data-testid="comment-submit"
      >
        {t('community.commentForm.submit')}
      </Button>
    </form>
  );
}
