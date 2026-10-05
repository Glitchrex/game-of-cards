/**
 * Typed browser-side helpers for the Community Board, contact form, lesson
 * ratings and admin API (see docs/API.md).
 *
 * Every helper resolves to a discriminated union and never throws — not on
 * HTTP errors, not on network failures:
 *
 *   const res = await createPost({ type: 'bug', title, body });
 *   if (res.ok) toast(res.data.post.title);
 *   else showErrors(res.error, res.fieldErrors);
 *
 * This module is isomorphic and side-effect free: the server imports its
 * constants and types too, so it must never import server-only code.
 */

/* ------------------------------------------------------------------ types */

export const POST_TYPES = ['feature', 'bug', 'game', 'general'] as const;
export type PostType = (typeof POST_TYPES)[number];

export const POST_STATUSES = ['open', 'planned', 'in-progress', 'done'] as const;
export type PostStatus = (typeof POST_STATUSES)[number];

export const POST_SORTS = ['new', 'top'] as const;
export type PostSort = (typeof POST_SORTS)[number];

export const POST_TYPE_LABELS: Record<PostType, string> = {
  feature: 'Feature request',
  bug: 'Bug',
  game: 'Game request',
  general: 'General feedback',
};

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  open: 'Open',
  planned: 'Planned',
  'in-progress': 'In progress',
  done: 'Done',
};

export interface Post {
  id: number;
  type: PostType;
  title: string;
  body: string;
  authorName: string | null;
  status: PostStatus;
  upvotes: number;
  commentCount: number;
  /** ISO 8601 timestamp (UTC). */
  createdAt: string;
  /** Present only when a voter token was supplied with the request. */
  hasVoted?: boolean;
}

export interface Comment {
  id: number;
  postId: number;
  body: string;
  authorName: string | null;
  /** ISO 8601 timestamp (UTC). */
  createdAt: string;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string;
  message: string;
  read: boolean;
  /** ISO 8601 timestamp (UTC). */
  createdAt: string;
}

export interface Rating {
  id: number;
  gameSlug: string;
  stars: number;
  comment: string | null;
  /** ISO 8601 timestamp (UTC). */
  createdAt: string;
}

/** Admin-only view of a post (includes the optional author email). */
export interface AdminPost extends Post {
  authorEmail: string | null;
}

/** Admin-only view of a comment (includes the parent post's title). */
export interface AdminComment extends Comment {
  postTitle: string;
}

export interface RatingSummary {
  gameSlug: string;
  count: number;
  /** Mean stars, rounded to two decimals. */
  average: number;
}

export interface AdminOverview {
  posts: AdminPost[];
  comments: AdminComment[];
  messages: ContactMessage[];
  ratings: Rating[];
  ratingSummary: RatingSummary[];
}

export interface VoteResult {
  upvotes: number;
  hasVoted: boolean;
}

export interface AdminSession {
  authenticated: boolean;
  enabled: boolean;
}

/* ----------------------------------------------------------------- inputs */

export interface CreatePostInput {
  type: PostType;
  title: string;
  body: string;
  name?: string;
  email?: string;
  /** Honeypot — always leave empty (render it hidden from humans). */
  website?: string;
}

export interface AddCommentInput {
  body: string;
  name?: string;
  /** Honeypot — always leave empty. */
  website?: string;
}

export interface ContactInput {
  name: string;
  email: string;
  message: string;
  /** Honeypot — always leave empty. */
  website?: string;
}

export interface RatingInput {
  gameSlug: string;
  stars: number;
  comment?: string;
  /** Honeypot — always leave empty. */
  website?: string;
}

export interface ListPostsParams {
  sort?: PostSort;
  type?: PostType | 'all';
  /** Browser voter token; when given every post carries `hasVoted`. */
  voter?: string | null;
}

/* ----------------------------------------------------------------- result */

export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = {
  ok: false;
  /** HTTP status, or 0 when the request never reached the server. */
  status: number;
  error: string;
  fieldErrors?: Record<string, string>;
};
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

export interface RequestOptions {
  signal?: AbortSignal;
}

const NETWORK_ERROR = 'Network error — check your connection and try again.';
const GENERIC_ERROR = 'Something went wrong. Please try again.';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFieldErrors(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, message] of Object.entries(value)) {
    if (typeof message === 'string') out[key] = message;
  }
  return Object.keys(out).length ? out : undefined;
}

async function request<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  url: string,
  body?: unknown,
  options?: RequestOptions,
): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers:
        body === undefined
          ? { accept: 'application/json' }
          : {
              accept: 'application/json',
              'content-type': 'application/json',
            },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: options?.signal,
    });
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'AbortError';
    return { ok: false, status: 0, error: aborted ? 'Request cancelled.' : NETWORK_ERROR };
  }

  let payload: unknown = null;
  try {
    const text = await res.text();
    payload = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    payload = null;
  }

  if (res.ok) {
    // Every endpoint answers success with a JSON object; anything else (an
    // HTML page from a proxy, an empty body) would crash the caller later.
    if (isRecord(payload)) return { ok: true, data: payload as T };
    return { ok: false, status: res.status, error: GENERIC_ERROR };
  }

  const error =
    isRecord(payload) && typeof payload.error === 'string' && payload.error
      ? payload.error
      : GENERIC_ERROR;
  const fieldErrors = isRecord(payload) ? readFieldErrors(payload.fieldErrors) : undefined;
  return fieldErrors
    ? { ok: false, status: res.status, error, fieldErrors }
    : { ok: false, status: res.status, error };
}

function query(params: Record<string, string | null | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

const id = (value: number) => encodeURIComponent(String(value));

/* ----------------------------------------------------------------- public */

export function listPosts(
  params: ListPostsParams = {},
  options?: RequestOptions,
): Promise<ApiResult<{ posts: Post[] }>> {
  const type = params.type && params.type !== 'all' ? params.type : undefined;
  return request(
    'GET',
    `/api/posts${query({ sort: params.sort, type, voter: params.voter })}`,
    undefined,
    options,
  );
}

export function createPost(input: CreatePostInput): Promise<ApiResult<{ post: Post }>> {
  return request('POST', '/api/posts', input);
}

export function getPost(
  postId: number,
  voter?: string | null,
  options?: RequestOptions,
): Promise<ApiResult<{ post: Post; comments: Comment[] }>> {
  return request('GET', `/api/posts/${id(postId)}${query({ voter })}`, undefined, options);
}

export function toggleVote(postId: number, voterToken: string): Promise<ApiResult<VoteResult>> {
  return request('POST', `/api/posts/${id(postId)}/vote`, { voterToken });
}

export function addComment(
  postId: number,
  input: AddCommentInput,
): Promise<ApiResult<{ comment: Comment }>> {
  return request('POST', `/api/posts/${id(postId)}/comments`, input);
}

export function sendContact(input: ContactInput): Promise<ApiResult<{ ok: true }>> {
  return request('POST', '/api/contact', input);
}

export function sendRating(input: RatingInput): Promise<ApiResult<{ ok: true }>> {
  return request('POST', '/api/ratings', input);
}

/* ------------------------------------------------------------------ admin */

export function adminSession(options?: RequestOptions): Promise<ApiResult<AdminSession>> {
  return request('GET', '/api/admin/session', undefined, options);
}

export function adminLogin(password: string): Promise<ApiResult<{ ok: true }>> {
  return request('POST', '/api/admin/login', { password });
}

export function adminLogout(): Promise<ApiResult<{ ok: true }>> {
  return request('POST', '/api/admin/logout');
}

export function adminOverview(options?: RequestOptions): Promise<ApiResult<AdminOverview>> {
  return request('GET', '/api/admin/overview', undefined, options);
}

export function adminSetPostStatus(
  postId: number,
  status: PostStatus,
): Promise<ApiResult<{ post: AdminPost }>> {
  return request('PATCH', `/api/admin/posts/${id(postId)}`, { status });
}

export function adminDeletePost(postId: number): Promise<ApiResult<{ ok: true }>> {
  return request('DELETE', `/api/admin/posts/${id(postId)}`);
}

export function adminDeleteComment(commentId: number): Promise<ApiResult<{ ok: true }>> {
  return request('DELETE', `/api/admin/comments/${id(commentId)}`);
}

export function adminSetMessageRead(
  messageId: number,
  read: boolean,
): Promise<ApiResult<{ ok: true }>> {
  return request('PATCH', `/api/admin/messages/${id(messageId)}`, { read });
}

export function adminDeleteMessage(messageId: number): Promise<ApiResult<{ ok: true }>> {
  return request('DELETE', `/api/admin/messages/${id(messageId)}`);
}
