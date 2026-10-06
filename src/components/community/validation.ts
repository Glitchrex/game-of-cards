/**
 * Client-side validation for the Community Board forms. Limits mirror
 * docs/API.md; the server re-validates everything.
 */
import { emailError, lengthError } from '@/components/ui/forms';
import { POST_TYPES, type PostType } from '@/lib/api-client';
import { t } from '@/lib/i18n';

export const POST_LIMITS = {
  title: { min: 3, max: 120 },
  body: { min: 10, max: 2000 },
  name: { max: 60 },
  email: { max: 120 },
} as const;

export const COMMENT_LIMITS = {
  body: { min: 2, max: 1000 },
  name: { max: 60 },
} as const;

export interface PostDraft {
  type: PostType;
  title: string;
  body: string;
  name: string;
  email: string;
  /** Honeypot — people never see or fill it. */
  website: string;
}

export type PostField = 'type' | 'title' | 'body' | 'name' | 'email';
export type PostErrors = Partial<Record<PostField, string>>;
export const POST_FIELDS: readonly PostField[] = ['type', 'title', 'body', 'name', 'email'];

export const emptyPostDraft = (type: PostType = 'feature'): PostDraft => ({
  type,
  title: '',
  body: '',
  name: '',
  email: '',
  website: '',
});

export function validatePostDraft(d: PostDraft): PostErrors {
  const errors: PostErrors = {};
  if (!POST_TYPES.includes(d.type)) {
    errors.type = t('common.validation.required', { field: t('community.form.type') });
  }
  const title = lengthError(t('community.form.title'), d.title, POST_LIMITS.title);
  if (title) errors.title = title;
  const body = lengthError(t('community.form.description'), d.body, POST_LIMITS.body);
  if (body) errors.body = body;
  const name = lengthError(t('community.form.name'), d.name, {
    max: POST_LIMITS.name.max,
    required: false,
  });
  if (name) errors.name = name;
  const email = emailError(t('community.form.email'), d.email, { required: false });
  if (email) errors.email = email;
  return errors;
}

export interface CommentDraft {
  body: string;
  name: string;
  /** Honeypot. */
  website: string;
}

export type CommentField = 'body' | 'name';
export type CommentErrors = Partial<Record<CommentField, string>>;
export const COMMENT_FIELDS: readonly CommentField[] = ['body', 'name'];

export const emptyCommentDraft = (name = ''): CommentDraft => ({ body: '', name, website: '' });

export function validateCommentDraft(d: CommentDraft): CommentErrors {
  const errors: CommentErrors = {};
  const body = lengthError(t('community.commentForm.body'), d.body, COMMENT_LIMITS.body);
  if (body) errors.body = body;
  const name = lengthError(t('community.commentForm.name'), d.name, {
    max: COMMENT_LIMITS.name.max,
    required: false,
  });
  if (name) errors.name = name;
  return errors;
}

/** Keeps only the server field errors this form knows how to show inline. */
export function pickFieldErrors<F extends string>(
  fields: readonly F[],
  fieldErrors: Record<string, string> | undefined,
): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  if (!fieldErrors) return out;
  for (const f of fields) {
    const msg = fieldErrors[f];
    if (msg) out[f] = msg;
  }
  return out;
}
