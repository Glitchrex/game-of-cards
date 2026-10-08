import { afterEach, describe, expect, it } from 'vitest';
import { en } from './en';
import { enGames } from './en/games';
import { dictionaries, registerMessages, setLocale, t, type TKey } from './index';

/** Every [path, value] leaf of a nested dictionary. */
function leaves(node: unknown, prefix = ''): [string, unknown][] {
  if (node === null || typeof node !== 'object') return [[prefix, node]];
  return Object.entries(node).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
}

afterEach(() => {
  setLocale('en');
});

describe('t() key lookup', () => {
  it('resolves nested keys to dictionary strings', () => {
    expect(t('common.close')).toBe('Close');
    expect(t('nav.footer.github')).toBe('GitHub');
    expect(t('wallet.udhaar.title')).toBe('Daily Udhaar');
    expect(t('common.errors.network')).toBe(en.common.errors.network);
  });

  it('accepts an explicit locale and the current locale', () => {
    setLocale('en');
    expect(t('common.cancel', undefined, 'en')).toBe('Cancel');
    expect(t('common.cancel')).toBe('Cancel');
    expect(Object.keys(dictionaries)).toEqual(['en']);
  });

  it('falls back to the key when it does not exist', () => {
    // @ts-expect-error — unknown keys are a compile-time error…
    expect(t('common.doesNotExist')).toBe('common.doesNotExist');
    // …and still degrade gracefully at runtime.
    expect(t('nope.missing' as TKey)).toBe('nope.missing');
    expect(t('' as TKey)).toBe('');
  });

  it('falls back to the key when it points at a namespace or goes too deep', () => {
    expect(t('common' as TKey)).toBe('common');
    expect(t('common.errors' as TKey)).toBe('common.errors');
    expect(t('common.close.extra' as TKey)).toBe('common.close.extra');
  });

  it('never resolves inherited object properties', () => {
    for (const key of [
      'constructor',
      'toString',
      'common.toString',
      '__proto__',
      'common.__proto__',
    ]) {
      expect(t(key as TKey)).toBe(key);
    }
  });
});

describe('t() interpolation', () => {
  it('fills in {vars} with strings and numbers (including 0)', () => {
    expect(t('common.charCount', { count: 3, max: 120 })).toBe('3/120');
    expect(t('common.charCount', { count: 0, max: 10 })).toBe('0/10');
    expect(t('wallet.pillLabel', { amount: '1,000' })).toBe('Wallet: 1,000 Jeet');
    expect(t('nav.footer.copyright', { year: 2026, name: 'Game of Cards' })).toBe(
      '© 2026 Game of Cards. Made for curious beginners everywhere.',
    );
  });

  it('replaces every occurrence of a placeholder', () => {
    expect(t('{n} and {n} make {total}' as TKey, { n: 2, total: 4 })).toBe('2 and 2 make 4');
  });

  it('leaves placeholders without a value untouched and ignores extra vars', () => {
    expect(t('common.charCount', { count: 3 })).toBe('3/{max}');
    expect(t('common.charCount')).toBe('{count}/{max}');
    expect(t('common.close', { unused: 'x' })).toBe('Close');
  });

  it('never re-interpolates text that came from a value', () => {
    expect(t('common.charCount', { count: '{max}', max: 5 })).toBe('{max}/5');
    expect(t('wallet.pillLabel', { amount: '{amount}' })).toBe('Wallet: {amount} Jeet');
    expect(t('common.validation.required', { field: '$& $1 {field}' })).toBe(
      '$& $1 {field} is required.',
    );
  });

  it('also interpolates the fallback key', () => {
    expect(t('missing {who}' as TKey, { who: 'key' })).toBe('missing key');
  });
});

describe('per-game namespaces', () => {
  it('resolve once their game registers them', () => {
    registerMessages({ war: enGames.war });
    const [path, value] = leaves(enGames.war)[0] ?? ['', ''];
    expect(t(`war.${path}` as TKey)).toBe(value);
  });

  it('never shadow a core namespace', () => {
    for (const ns of Object.keys(enGames)) expect(Object.keys(en)).not.toContain(ns);
  });
});

describe('English dictionary integrity', () => {
  // Core strings plus every game's strings (registered as the games do at runtime).
  registerMessages(enGames);
  const all = leaves({ ...en, ...enGames });

  it('has at least the core namespaces', () => {
    for (const ns of ['common', 'nav', 'wallet', 'settings', 'contact']) {
      expect(Object.keys(en)).toContain(ns);
    }
  });

  it('every leaf is a non-empty string that t() returns verbatim', () => {
    expect(all.length).toBeGreaterThan(50);
    for (const [path, value] of all) {
      expect(typeof value, path).toBe('string');
      expect((value as string).trim().length, path).toBeGreaterThan(0);
      expect(t(path as TKey)).toBe(value);
    }
  });

  it('every placeholder is a well-formed {identifier}', () => {
    for (const [path, value] of all) {
      const text = String(value);
      const braces = text.match(/[{}]/g) ?? [];
      const placeholders = text.match(/\{[A-Za-z][A-Za-z0-9_]*\}/g) ?? [];
      expect(braces.length, `${path}: "${text}"`).toBe(placeholders.length * 2);
    }
  });
});
