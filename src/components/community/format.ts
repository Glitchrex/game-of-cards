/**
 * Small, pure formatting helpers shared by the Community Board and the admin
 * view: relative/absolute dates, excerpts and singular/plural labels.
 */
import { t, type TKey } from '@/lib/i18n';

const rtf =
  typeof Intl !== 'undefined' && 'RelativeTimeFormat' in Intl
    ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
    : null;

const absoluteFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
});

const absoluteTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'UTC',
  timeZoneName: 'short',
});

function toMs(iso: string): number | null {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Deterministic calendar date ("5 Oct 2026", in UTC) — identical on the server
 * and in every browser, so it is safe to render before hydration.
 */
export function absoluteDate(iso: string): string {
  const ms = toMs(iso);
  return ms === null ? iso : absoluteFormat.format(ms);
}

/** Calendar date and time in UTC, e.g. for a `title` tooltip. */
export function absoluteDateTime(iso: string): string {
  const ms = toMs(iso);
  return ms === null ? iso : absoluteTimeFormat.format(ms);
}

const MINUTE = 60;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;
const MONTH = 30 * DAY;
const YEAR = 365 * DAY;

/** "just now" · "5 minutes ago" · "yesterday" · "3 weeks ago" · "last year". */
export function relativeTime(iso: string, now: number): string {
  const ms = toMs(iso);
  if (ms === null) return iso;
  // Small clock skew between server and browser must never read "in 2 minutes".
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (!rtf) return absoluteDate(iso);
  if (s < 45) return t('community.time.justNow');
  if (s < HOUR) return rtf.format(-Math.max(1, Math.round(s / MINUTE)), 'minute');
  if (s < DAY) return rtf.format(-Math.round(s / HOUR), 'hour');
  if (s < WEEK) return rtf.format(-Math.round(s / DAY), 'day');
  if (s < MONTH) return rtf.format(-Math.round(s / WEEK), 'week');
  if (s < YEAR) return rtf.format(-Math.max(1, Math.round(s / MONTH)), 'month');
  return rtf.format(-Math.round(s / YEAR), 'year');
}

/**
 * First `max` characters of `text` on a single line, cut at a word boundary
 * with an ellipsis when shortened.
 */
export function excerpt(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  // Already on a word boundary? Keep the whole last word.
  const space = flat.charAt(max) === ' ' ? max : cut.lastIndexOf(' ');
  const base = space > max * 0.6 ? cut.slice(0, space) : cut;
  return `${base.replace(/[\s.,;:!?–—-]+$/u, '')}…`;
}

/** Picks the singular or plural dictionary entry and fills in `{count}`. */
export function plural(count: number, one: TKey, many: TKey): string {
  return count === 1 ? t(one) : t(many, { count: count.toLocaleString('en-US') });
}

/** "teen-patti" → "Teen Patti" (fallback when no catalog name is known). */
export function prettySlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
