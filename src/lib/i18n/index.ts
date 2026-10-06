/**
 * i18n entry point. UI strings are grouped in namespaces under ./en/*.ts.
 * To add Hindi later: create ./hi/*.ts with the same keys, add it to
 * `dictionaries`, and let the user pick a locale in settings.
 *
 * Usage:  t('nav.games')  ·  t('wallet.balance', { amount: 1000 })
 */
import { en } from './en';
import { type enGames } from './en/games';

/** Every key `t()` accepts: the core dictionary plus the per-game namespaces. */
export type Dictionary = typeof en & typeof enGames;
export const dictionaries = { en } as const;
export type Locale = keyof typeof dictionaries;

/**
 * Namespaces registered at runtime (per locale) by the code that needs them — each Tier 1
 * game registers its own strings (see src/games/<slug>/i18n.ts), so they only ship with
 * that game instead of with every page.
 */
const registered: Record<Locale, Record<string, unknown>> = { en: {} };

export function registerMessages(namespaces: Partial<typeof enGames>, locale: Locale = 'en') {
  Object.assign(registered[locale], namespaces);
}

type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];
export type TKey = Leaves<Dictionary>;

let currentLocale: Locale = 'en';
export function setLocale(l: Locale) {
  currentLocale = l;
}

const PLACEHOLDER_RE = /\{([A-Za-z0-9_]+)\}/g;

/**
 * Translate `key` (falling back to the key itself when it is missing) and fill in
 * `{name}` placeholders from `vars` in a single pass — substituted values are never
 * re-scanned, so user text such as a name containing "{amount}" is shown verbatim.
 * Placeholders without a matching var are left untouched.
 */
export function t(key: TKey, vars?: Record<string, string | number>, locale?: Locale): string {
  const loc = locale ?? currentLocale;
  const dict = dictionaries[loc] as unknown as Record<string, unknown>;
  const extra = registered[loc];
  let node: unknown = dict;
  const parts = String(key).split('.');
  const ns = parts[0] ?? '';
  if (!Object.hasOwn(dict, ns) && Object.hasOwn(extra, ns)) node = extra;
  for (const part of parts) {
    node =
      node !== null && typeof node === 'object' && Object.hasOwn(node, part)
        ? (node as Record<string, unknown>)[part]
        : undefined;
  }
  const out = typeof node === 'string' ? node : key;
  if (!vars) return out;
  return out.replace(PLACEHOLDER_RE, (match, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : match,
  );
}
