/** Where the primer sends people when there is no (safe) ?next= target. */
export const DEFAULT_NEXT = '/games';

/**
 * Returns `raw` only if it is a safe, same-site path: it must start with a single
 * "/" (not "//" or "/\", which browsers treat as another host) and contain no
 * backslashes or control characters. Anything else falls back to /games.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_NEXT;
  const value = raw.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return DEFAULT_NEXT;
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || value[i] === '\\') return DEFAULT_NEXT;
  }
  try {
    const base = 'https://game-of-cards.invalid';
    if (new URL(value, base).origin !== base) return DEFAULT_NEXT;
  } catch {
    return DEFAULT_NEXT;
  }
  return value;
}
