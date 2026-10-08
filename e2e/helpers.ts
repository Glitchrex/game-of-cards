/**
 * Shared Playwright helpers. Every test gets a brand-new browser context from Playwright,
 * so localStorage starts empty (a first-time visitor) unless a test seeds it.
 */
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, type Locator, type Page } from '@playwright/test';

/** The persisted Zustand stores (src/store/*). Each is saved as `{ state, version }`. */
export const STORE_KEYS = {
  wallet: 'goc:wallet',
  stats: 'goc:stats',
  progress: 'goc:progress',
  settings: 'goc:settings',
} as const;
export type StoreName = keyof typeof STORE_KEYS;

export interface WalletSnapshot {
  balance: number;
  lastUdhaarAt: number | null;
  ledger: { at: number; amount: number; reason: string; gameSlug?: string }[];
}

export interface StatsSnapshot {
  played: number;
  wins: number;
  losses: number;
  pushes: number;
  awards: { id: string; titleId: string; text: string; gameSlug: string; jeet: number }[];
  lastTitleId: string | null;
  lastRoastId: string | null;
  [key: string]: unknown;
}

export interface ProgressSnapshot {
  games: Record<
    string,
    {
      lessonDone: boolean;
      exampleDone: boolean;
      quizBest: number | null;
      wins: number;
      started: boolean;
    }
  >;
}

/** Brand-new visitor: clears the persisted stores (contexts start empty; this is a guard). */
export async function freshVisit(page: Page, url = '/'): Promise<void> {
  await page.goto(url);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
}

/** Reads a persisted store's `state` (null when the store was never written). */
export async function readStore<T = unknown>(page: Page, store: StoreName): Promise<T | null> {
  const raw = await page.evaluate((key) => window.localStorage.getItem(key), STORE_KEYS[store]);
  if (!raw) return null;
  return (JSON.parse(raw) as { state: T }).state;
}

/**
 * Writes a persisted store's `state` (merged over what is stored now) and reloads, so the
 * app rehydrates from it. The page must already be on the site's origin.
 */
export async function writeStore(
  page: Page,
  store: StoreName,
  patch: Record<string, unknown>,
  { reload = true }: { reload?: boolean } = {},
): Promise<void> {
  await page.evaluate(
    ([key, value]) => {
      const raw = window.localStorage.getItem(key);
      const current = raw
        ? (JSON.parse(raw) as { state: Record<string, unknown>; version: number })
        : { state: {}, version: 1 };
      window.localStorage.setItem(
        key,
        JSON.stringify({ state: { ...current.state, ...value }, version: current.version ?? 1 }),
      );
    },
    [STORE_KEYS[store], patch] as const,
  );
  if (reload) await page.reload();
}

/** The header wallet pill (rendered once the stores have hydrated). */
export function walletPill(page: Page): Locator {
  return page.getByTestId('wallet-pill');
}

/** The balance shown by the header wallet pill ("Wallet: 1,000 Jeet"). */
export async function walletBalance(page: Page): Promise<number> {
  const pill = walletPill(page);
  await expect(pill).toBeVisible();
  const label = (await pill.getAttribute('aria-label')) ?? '';
  const match = /Wallet: ([\d,]+) Jeet/.exec(label);
  if (!match?.[1]) throw new Error(`Unexpected wallet label: "${label}"`);
  return Number(match[1].replace(/,/g, ''));
}

/** Waits until the header pill shows `amount`. */
export async function expectWalletBalance(page: Page, amount: number): Promise<void> {
  await expect
    .poll(() => walletBalance(page), { message: `wallet balance should be ${amount}` })
    .toBe(amount);
}

/** The three result overlays the play shell can open. */
export function resultOverlay(page: Page): Locator {
  return page
    .getByTestId('celebration')
    .or(page.getByTestId('roast'))
    .or(page.getByTestId('push-overlay'));
}

export type OverlayKind = 'celebration' | 'roast' | 'push-overlay';

/** Which result overlay is showing (waits for one to open). */
export async function overlayKind(page: Page): Promise<OverlayKind> {
  const overlay = resultOverlay(page);
  await expect(overlay).toBeVisible({ timeout: 30_000 });
  const id = await overlay.getAttribute('data-testid');
  if (id !== 'celebration' && id !== 'roast' && id !== 'push-overlay') {
    throw new Error(`Unknown overlay ${id}`);
  }
  return id;
}

/**
 * Presses the coach's "Play it for me" whenever it is offered (bots play in between) until
 * `done` is visible. Each round waits on `done` itself, so it returns as soon as it appears.
 */
async function coachUntil(
  done: Locator,
  autoplay: Locator,
  timeoutMs: number,
  message: string,
): Promise<void> {
  await expect(async () => {
    if (await done.isVisible()) return;
    if (await autoplay.isVisible()) {
      await autoplay.click({ timeout: 2_000 }).catch(() => undefined);
    }
    await expect(done).toBeVisible({ timeout: 300 });
  }, message).toPass({ timeout: timeoutMs, intervals: [0] });
}

/**
 * Plays a coached practice hand (/games/<slug>/try) to the end by pressing "Play it for me"
 * whenever it is offered, waiting through the bots' turns, until the summary appears.
 */
export async function playPracticeWithCoach(page: Page, timeoutMs = 120_000): Promise<void> {
  const summary = page.getByTestId('practice-summary');
  const autoplay = page.getByTestId('coach-autoplay');
  await coachUntil(summary, autoplay, timeoutMs, 'Practice hand did not finish in time');
}

/**
 * Plays a real game on /games/<slug>/play with the coach: Deal → coach on → "Play it for me"
 * until a result overlay opens. Returns which overlay opened.
 */
export async function playRealGameWithCoach(
  page: Page,
  { stake, timeoutMs = 180_000 }: { stake?: number; timeoutMs?: number } = {},
): Promise<OverlayKind> {
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  if (stake !== undefined) await page.getByTestId(`stake-${stake}`).click();
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('play-table')).toBeVisible();
  await page.getByTestId('coach-toggle').click();
  await expect(page.getByTestId('coach-toggle')).toHaveAttribute('aria-pressed', 'true');
  const overlay = resultOverlay(page);
  const autoplay = page.getByTestId('coach-autoplay');
  await coachUntil(overlay, autoplay, timeoutMs, 'Game did not finish in time');
  return overlayKind(page);
}

/** Net Jeet shown on the open result overlay (win: +n, loss: −n, push: 0). */
export async function overlayNet(page: Page, kind: OverlayKind): Promise<number> {
  if (kind === 'celebration') {
    return Number(await page.getByTestId('celebration-jeet').getAttribute('data-amount'));
  }
  if (kind === 'roast') {
    const text = (await page.getByTestId('roast-jeet').textContent()) ?? '';
    const m = /([+−-])\s*([\d,]+)\s*Jeet/.exec(text);
    if (!m?.[2]) throw new Error(`Unexpected roast amount: "${text}"`);
    const n = Number(m[2].replace(/,/g, ''));
    return m[1] === '+' ? n : -n;
  }
  return 0;
}

/** Unique, human-looking suffix for posts/messages, so parallel tests never collide. */
export function uniqueSuffix(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Every game slug with a content file (content/games/<slug>.ts). */
export function allGameSlugs(): string[] {
  return readdirSync(path.join(ROOT, 'content/games'))
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts')
    .map((f) => f.replace(/\.ts$/, ''))
    .sort();
}

/** Tier 1 games: those with src/games/<slug>/index.ts (see CLAUDE.md). */
export function tier1Slugs(): string[] {
  return allGameSlugs().filter((slug) =>
    existsSync(path.join(ROOT, 'src/games', slug, 'index.ts')),
  );
}

/** Tier 2 games: content only (lesson, scripted example, quiz). */
export function tier2Slugs(): string[] {
  const t1 = new Set(tier1Slugs());
  return allGameSlugs().filter((slug) => !t1.has(slug));
}

/** True for the 375 px phone project. */
export function isMobile(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1280) < 640;
}
