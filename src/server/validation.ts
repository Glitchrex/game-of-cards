/**
 * Zod schemas for every API payload, with the limits from docs/API.md.
 * Strings are trimmed before length checks. Unknown keys (including the
 * `website` honeypot, which route handlers check first) are stripped.
 */
import { z } from 'zod';
import { POST_SORTS, POST_STATUSES, POST_TYPES } from '@/lib/api-client';

export const LIMITS = {
  title: { min: 3, max: 120 },
  postBody: { min: 10, max: 2000 },
  name: { max: 60 },
  email: { max: 120 },
  commentBody: { min: 2, max: 1000 },
  contactMessage: { min: 10, max: 3000 },
  ratingComment: { max: 500 },
  password: { max: 200 },
} as const;

export const GAME_SLUG_PATTERN = /^[a-z0-9-]{2,40}$/;
export const VOTER_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,100}$/;

function requiredText(label: string, min: number, max: number, message?: string) {
  const text =
    message ??
    `${label} must be between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')} characters.`;
  return z.string({ error: text }).trim().min(min, text).max(max, text);
}

function optionalText(label: string, max: number) {
  const message = `${label} can be at most ${max.toLocaleString('en-US')} characters.`;
  return z.string({ error: message }).trim().max(max, message).nullish();
}

const EMAIL_MESSAGE = 'Please enter a valid email address.';
const emailTooLong = `Email can be at most ${LIMITS.email.max} characters.`;

const optionalEmail = z
  .string({ error: EMAIL_MESSAGE })
  .trim()
  .max(LIMITS.email.max, emailTooLong)
  .refine((v) => v === '' || z.regexes.email.test(v), EMAIL_MESSAGE)
  .nullish();

const requiredEmail = z
  .string({ error: EMAIL_MESSAGE })
  .trim()
  .min(1, EMAIL_MESSAGE)
  .max(LIMITS.email.max, emailTooLong)
  .refine((v) => z.regexes.email.test(v), EMAIL_MESSAGE);

export const postTypeSchema = z.enum(POST_TYPES, { error: 'Pick a post type.' });
export const postStatusSchema = z.enum(POST_STATUSES, { error: 'Pick a valid status.' });
export const voterTokenSchema = z
  .string({ error: 'Invalid voter token.' })
  .regex(VOTER_TOKEN_PATTERN, 'Invalid voter token.');

/** POST /api/posts */
export const createPostSchema = z.object({
  type: postTypeSchema,
  title: requiredText('Title', LIMITS.title.min, LIMITS.title.max),
  body: requiredText('Description', LIMITS.postBody.min, LIMITS.postBody.max),
  name: optionalText('Name', LIMITS.name.max),
  email: optionalEmail,
});
export type CreatePostPayload = z.infer<typeof createPostSchema>;

/** POST /api/posts/:id/comments */
export const createCommentSchema = z.object({
  body: requiredText('Comment', LIMITS.commentBody.min, LIMITS.commentBody.max),
  name: optionalText('Name', LIMITS.name.max),
});
export type CreateCommentPayload = z.infer<typeof createCommentSchema>;

/** POST /api/posts/:id/vote */
export const voteSchema = z.object({ voterToken: voterTokenSchema });
export type VotePayload = z.infer<typeof voteSchema>;

/** POST /api/contact */
export const contactSchema = z.object({
  name: requiredText(
    'Name',
    1,
    LIMITS.name.max,
    `Please tell us your name (up to ${LIMITS.name.max} characters).`,
  ),
  email: requiredEmail,
  message: requiredText('Message', LIMITS.contactMessage.min, LIMITS.contactMessage.max),
});
export type ContactPayload = z.infer<typeof contactSchema>;

/** POST /api/ratings */
export const ratingSchema = z.object({
  gameSlug: z.string({ error: 'Unknown game.' }).regex(GAME_SLUG_PATTERN, 'Unknown game.'),
  stars: z
    .int({ error: 'Pick between 1 and 5 stars.' })
    .min(1, 'Pick between 1 and 5 stars.')
    .max(5, 'Pick between 1 and 5 stars.'),
  comment: optionalText('Comment', LIMITS.ratingComment.max),
});
export type RatingPayload = z.infer<typeof ratingSchema>;

/** GET /api/posts query string (empty values count as absent). */
export const listPostsQuerySchema = z.object({
  sort: z.enum(POST_SORTS, { error: 'sort must be "new" or "top".' }).default('new'),
  type: z
    .enum([...POST_TYPES, 'all'] as const, { error: 'Unknown post type.' })
    .optional()
    .transform((v) => (v === 'all' ? undefined : v)),
  voter: voterTokenSchema.optional(),
});
export type ListPostsQuery = z.infer<typeof listPostsQuerySchema>;

/** GET /api/posts/:id query string. */
export const getPostQuerySchema = z.object({ voter: voterTokenSchema.optional() });

/** PATCH /api/admin/posts/:id */
export const adminPostPatchSchema = z.object({ status: postStatusSchema });

/** PATCH /api/admin/messages/:id */
export const adminMessagePatchSchema = z.object({
  read: z.boolean({ error: 'read must be true or false.' }),
});

/** POST /api/admin/login */
export const adminLoginSchema = z.object({
  password: z
    .string({ error: 'Please enter the password.' })
    .min(1, 'Please enter the password.')
    .max(LIMITS.password.max, 'That password is too long.'),
});

/** Reads URLSearchParams into a plain object, dropping empty values. */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of params) {
    if (value !== '') out[key] = value;
  }
  return out;
}

/* ------------------------------------------------------------------ errors */

export interface ValidationFailure {
  error: string;
  fieldErrors: Record<string, string>;
}

export type ValidationResult<T> = { ok: true; data: T } | ({ ok: false } & ValidationFailure);

export const VALIDATION_ERROR = 'Please check the highlighted fields and try again.';

/** First message per top-level field; root-level issues become the main error. */
export function formatZodError(error: z.ZodError): ValidationFailure {
  const fieldErrors: Record<string, string> = {};
  let rootMessage: string | null = null;
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (key === undefined) {
      rootMessage ??= issue.message;
      continue;
    }
    const field = String(key);
    fieldErrors[field] ??= issue.message;
  }
  return { error: rootMessage ?? VALIDATION_ERROR, fieldErrors };
}

export function validate<S extends z.ZodType>(
  schema: S,
  input: unknown,
): ValidationResult<z.output<S>> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, ...formatZodError(result.error) };
}
