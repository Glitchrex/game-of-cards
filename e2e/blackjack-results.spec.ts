/**
 * Blackjack results on curated seeds (src/games/blackjack/seeds.ts): a win earns a filmy
 * title (credited, shelved, shareable, never the same twice in a row), a loss earns a roast
 * with a tip, and a whole hand can be played with the keyboard alone.
 */
import { expect, test, type Page } from '@playwright/test';
import { roasts, titles } from '../content/titles';
import {
  expectWalletBalance,
  overlayNet,
  playRealGameWithCoach,
  readStore,
  type StatsSnapshot,
  type WalletSnapshot,
} from './helpers';

const SEEDS = { naturalWin: 10, dealerBlackjack: 3, bustOnHit: 4 } as const;
const TITLE_TEXTS = new Set(titles.map((x) => x.text));
const ROAST_TEXTS = new Set(roasts.map((x) => x.text));

test.use({ actionTimeout: 15_000 });

async function dealNatural(page: Page, stake: number) {
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  await page.getByTestId(`stake-${stake}`).click();
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('celebration')).toBeVisible({ timeout: 20_000 });
}

test('a win shows a title, credits Jeet, lands on the awards shelf and can be shared', async ({
  page,
}) => {
  // No Web Share API: sharing falls back to downloading the poster.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'share', { value: undefined, configurable: true });
    Object.defineProperty(Navigator.prototype, 'canShare', {
      value: undefined,
      configurable: true,
    });
  });
  await page.goto(`/games/blackjack/play?seed=${SEEDS.naturalWin}`);
  await expectWalletBalance(page, 1000);

  // A natural Blackjack on a 10 stake pays 3:2 → +15.
  const stake = 10;
  const net = Math.round(stake * 1.5);
  await dealNatural(page, stake);
  const first = (await page.getByTestId('win-title').textContent())?.trim() ?? '';
  expect(TITLE_TEXTS.has(first), `"${first}" is a title from content/titles.ts`).toBe(true);
  await expect(page.getByTestId('celebration-jeet')).toHaveAttribute('data-amount', String(net));
  await expect(page.getByTestId('bj-badge-blackjack')).toBeAttached();
  await expectWalletBalance(page, 1000 + net);

  // Share → the poster is downloaded (PNG) and a toast confirms it.
  const download = page.waitForEvent('download');
  await page.getByTestId('share-button').click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^game-of-cards-.+\.png$/);
  await expect(page.getByTestId('toast').filter({ hasText: 'Poster saved' })).toBeVisible();

  // Play again on the same seed: another win, but never the same title back-to-back.
  await page.getByTestId('play-again').click();
  await dealNatural(page, stake);
  const second = (await page.getByTestId('win-title').textContent())?.trim() ?? '';
  expect(TITLE_TEXTS.has(second)).toBe(true);
  expect(second).not.toBe(first);
  await expectWalletBalance(page, 1000 + 2 * net);

  const stats = await readStore<StatsSnapshot>(page, 'stats');
  expect(stats?.wins).toBe(2);
  expect(stats?.awards.map((a) => a.text)).toEqual([second, first]);

  // Both awards are on the shelf, newest first.
  await page.goto('/stats');
  const shelf = page.getByTestId('awards-shelf');
  await expect(shelf).toBeVisible();
  await expect(shelf.getByTestId('award-0')).toContainText(second);
  await expect(shelf.getByTestId('award-1')).toContainText(first);
  await expect(page.getByTestId('stats-balance')).toContainText('1,030');
});

test('a loss shows a roast with a tip, and Rematch returns to the bet panel', async ({ page }) => {
  await page.goto(`/games/blackjack/play?seed=${SEEDS.dealerBlackjack}`);
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  await page.getByTestId('stake-50').click();
  await page.getByTestId('deal-button').click();

  const roast = page.getByTestId('roast');
  await expect(roast).toBeVisible({ timeout: 20_000 });
  const text = (await page.getByTestId('roast-text').textContent())?.trim() ?? '';
  expect(ROAST_TEXTS.has(text), `"${text}" is a roast from content/titles.ts`).toBe(true);
  const tip = page.getByTestId('roast-tip');
  await expect(tip).toBeVisible();
  expect(((await tip.textContent()) ?? '').replace(/^Tip/, '').trim().length).toBeGreaterThan(10);
  await expect(page.getByTestId('roast-jeet')).toContainText('−50');
  await expectWalletBalance(page, 950);

  await page.getByTestId('rematch-button').click();
  await expect(roast).toBeHidden();
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  await expect(page.getByTestId('game-shell')).toHaveAttribute('data-phase', 'bet');
  await expect(page.getByTestId('deal-button')).toBeFocused();

  const stats = await readStore<StatsSnapshot>(page, 'stats');
  expect(stats).toMatchObject({ played: 1, losses: 1, wins: 0 });
});

/** Presses Tab until the element with `testId` has focus. */
async function tabTo(page: Page, testId: string, max = 60) {
  for (let i = 0; i < max; i++) {
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    if (focused === testId) return;
  }
  throw new Error(`Could not reach ${testId} with Tab`);
}

test('a whole Blackjack hand can be played with the keyboard only', async ({ page }) => {
  await page.goto(`/games/blackjack/play?seed=${SEEDS.bustOnHit}`);
  await expect(page.getByTestId('bet-panel')).toBeVisible();

  // Pick the 25 chip and deal with Tab + Enter.
  await tabTo(page, 'stake-25');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('stake-25')).toHaveAttribute('aria-pressed', 'true');
  await tabTo(page, 'deal-button');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('play-table')).toBeVisible();
  await expectWalletBalance(page, 975);

  // Hard 16: H hits (the shortcut works anywhere on the page) and the 10 busts.
  await expect(page.getByTestId('bj-hit')).toHaveAttribute('data-legal', 'true');
  await expect(page.getByTestId('bj-hit')).not.toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByTestId('bj-player-total')).toHaveAttribute('data-total', '16');
  await page.keyboard.press('h');
  await expect(page.getByTestId('bj-player-total')).toHaveAttribute('data-bust', /.*/);

  // The roast opens with focus on Rematch; Enter goes back to the bet panel.
  await expect(page.getByTestId('roast')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('rematch-button')).toBeFocused();
  await expectWalletBalance(page, 975);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  await expect(page.getByTestId('deal-button')).toBeFocused();

  // Deal again with Enter, then stand with S: same deal, so the dealer plays it out.
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('play-table')).toBeVisible();
  await expect(page.getByTestId('bj-stand')).not.toHaveAttribute('aria-disabled', 'true');
  await page.keyboard.press('s');
  await expect(
    page
      .getByTestId('celebration')
      .or(page.getByTestId('roast'))
      .or(page.getByTestId('push-overlay')),
  ).toBeVisible({ timeout: 20_000 });
  // Escape closes the overlay and the hand-over bar keeps a keyboard path to play again.
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('play-again-bar')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bet-panel')).toBeVisible();
});

test('@mobile the coach can play a real hand: a push returns the whole bet', async ({ page }) => {
  // Seed 8: 20 against a dealer 4 + 6. The coach stands and the dealer also makes 20.
  await page.goto('/games/blackjack/play?seed=8');
  await expectWalletBalance(page, 1000);
  const kind = await playRealGameWithCoach(page, { stake: 50 });
  expect(kind).toBe('push-overlay');
  expect(await overlayNet(page, kind)).toBe(0);
  await expect(page.getByTestId('push-title')).toHaveText('It’s a push — your Jeet is back');
  await expectWalletBalance(page, 1000);
  const wallet = await readStore<WalletSnapshot>(page, 'wallet');
  expect(wallet?.ledger.map((e) => [e.reason, e.amount])).toEqual([
    ['refund', 50],
    ['bet', -50],
  ]);
  await page.getByTestId('play-again').click();
  await expect(page.getByTestId('bet-panel')).toBeVisible();
});
