/**
 * i18n entry point. UI strings are grouped in namespaces under ./en/*.ts.
 * To add Hindi later: create ./hi/*.ts with the same keys, add it to
 * `dictionaries`, and let the user pick a locale in settings.
 *
 * Usage:  t('nav.games')  ·  t('wallet.balance', { amount: 1000 })
 */
import { en } from './en';

export type Dictionary = typeof en;
export const dictionaries = { en } as const;
export type Locale = keyof typeof dictionaries;

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
  const dict = dictionaries[locale ?? currentLocale] as unknown as Record<string, unknown>;
  let node: unknown = dict;
  for (const part of String(key).split('.')) {
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
