/**
 * Small helpers shared by the site's forms (feedback, contact): a JSON POST
 * wrapper that normalises the API error shape from docs/API.md, and client-side
 * validators that mirror the server limits.
 */
import { t } from '@/lib/i18n';

export interface ApiErrorBody {
  error?: unknown;
  fieldErrors?: unknown;
}

export type PostJsonResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; fieldErrors: Record<string, string> };

function toFieldErrors(v: unknown): Record<string, string> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [k, msg] of Object.entries(v as Record<string, unknown>)) {
    if (typeof msg === 'string' && msg) out[k] = msg;
    else if (Array.isArray(msg) && typeof msg[0] === 'string') out[k] = msg[0];
  }
  return out;
}

/**
 * POST `body` as JSON. Never throws for HTTP or network failures — returns
 * `{ ok: false, error }` with the server's message (or a friendly fallback).
 * Aborts (AbortController) are re-thrown so callers can ignore them.
 */
export async function postJson<T>(
  url: string,
  body: unknown,
  init: { signal?: AbortSignal } = {},
): Promise<PostJsonResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
      signal: init.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    return { ok: false, status: 0, error: t('common.errors.network'), fieldErrors: {} };
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.ok) return { ok: true, status: res.status, data: data as T };
  const b = (data && typeof data === 'object' ? data : {}) as ApiErrorBody;
  return {
    ok: false,
    status: res.status,
    error: typeof b.error === 'string' && b.error ? b.error : t('common.errors.generic'),
    fieldErrors: toFieldErrors(b.fieldErrors),
  };
}

/** Same pattern Zod 4 uses for z.email(), so client and server agree. */
const EMAIL_RE =
  /^(?!\.)(?!.*\.\.)([A-Za-z0-9_'+\-.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9-]*\.)+[A-Za-z]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

/** Length check on the trimmed value; returns a friendly message or null. */
export function lengthError(
  field: string,
  value: string,
  { min = 0, max, required = true }: { min?: number; max: number; required?: boolean },
): string | null {
  const v = value.trim();
  if (!v) return required ? t('common.validation.required', { field }) : null;
  if (v.length < min) return t('common.validation.tooShort', { field, min });
  if (v.length > max) return t('common.validation.tooLong', { field, max });
  return null;
}

/** Optional/required email check (≤ 120 chars). */
export function emailError(
  field: string,
  value: string,
  { required }: { required: boolean },
): string | null {
  const v = value.trim();
  if (!v) return required ? t('common.validation.required', { field }) : null;
  if (v.length > 120) return t('common.validation.tooLong', { field, max: 120 });
  return isValidEmail(v) ? null : t('common.validation.email');
}

/** Focus the first element (in DOM order) of `form` whose name is in `names`. */
export function focusFirstInvalid(form: HTMLFormElement | null, names: string[]): void {
  if (!form || names.length === 0) return;
  const set = new Set(names);
  for (const el of Array.from(form.elements)) {
    const name = (el as HTMLInputElement).name;
    if (name && set.has(name)) {
      (el as HTMLElement).focus();
      return;
    }
  }
}
