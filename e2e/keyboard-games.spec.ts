/**
 * Keyboard-only play (docs/PLAN.md §11): a whole Hearts hand and a Klondike game are played
 * with Tab / arrows / Enter and each game's shortcuts — no mouse at any point. (Blackjack's
 * keyboard-only hand lives in blackjack-results.spec.ts.)
 */
import { expect, test, type Page } from '@playwright/test';
import {
  expectWalletBalance,
  overlayKind,
  overlayNet,
  readStore,
  resultOverlay,
  writeStore,
  type WalletSnapshot,
} from './helpers';

test.use({ actionTimeout: 15_000 });

/** The data-testid of the focused element (or of its closest ancestor that has one). */
function focusedTestId(page: Page): Promise<string | null> {
  return page.evaluate(
    () => document.activeElement?.closest('[data-testid]')?.getAttribute('data-testid') ?? null,
  );
}

/** Presses Tab until focus is inside the element with `testId`. */
async function tabInto(page: Page, testId: string, max = 80) {
  for (let i = 0; i < max; i++) {
    const inside = await page.evaluate(
      (id) => !!document.activeElement?.closest(`[data-testid="${id}"]`),
      testId,
    );
    if (inside) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`Could not reach ${testId} with Tab`);
}

/** Tab to the stake chip, Enter; Tab to Deal, Enter. */
async function dealWithKeyboard(page: Page, stake: number) {
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  await tabInto(page, `stake-${stake}`);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId(`stake-${stake}`)).toHaveAttribute('aria-pressed', 'true');
  await tabInto(page, 'deal-button');
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('play-table')).toBeVisible();
  await expectWalletBalance(page, 1000 - stake);
}

/** Index of the focused card within a Hand (data-hand-index), or -1. */
function focusedCardIndex(page: Page): Promise<number> {
  return page.evaluate(() => {
    const holder = document.activeElement?.closest<HTMLElement>('[data-hand-index]');
    return holder ? Number(holder.dataset.handIndex) : -1;
  });
}

/** Moves the hand's roving focus to card `target` with ←/→ (focus must already be in it). */
async function arrowToCard(page: Page, target: number) {
  for (let guard = 0; guard < 20; guard++) {
    const at = await focusedCardIndex(page);
    expect(at, 'focus is on a card in the hand').toBeGreaterThanOrEqual(0);
    if (at === target) return;
    await page.keyboard.press(at < target ? 'ArrowRight' : 'ArrowLeft');
  }
  throw new Error(`Could not arrow to card ${target}`);
}

test('a whole Hearts hand can be played with the keyboard only', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/games/hearts/play?seed=3');
  await writeStore(page, 'settings', { botSpeed: 'fast' });
  await dealWithKeyboard(page, 10);

  const hand = page.getByTestId('hearts-hand');
  const cards = hand.locator('[data-card]');

  // The pass: Tab into the hand, pick three cards with Enter / → / Enter / → / Enter, then P.
  await expect(page.getByTestId('hearts-pass-bar')).toBeVisible();
  await expect(cards).toHaveCount(13);
  await tabInto(page, 'hearts-hand');
  await arrowToCard(page, 0);
  for (let i = 0; i < 3; i++) {
    if (i > 0) await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('hearts-pass-count')).toHaveAttribute(
      'data-count',
      String(i + 1),
    );
  }
  await expect(hand.locator('[data-card][aria-pressed="true"]')).toHaveCount(3);
  await page.keyboard.press('p');
  await expect(page.getByTestId('hearts-passed')).toBeVisible();

  // Thirteen tricks: on each turn, arrow to the first legal (not dimmed) card and press Enter.
  const seat = page.getByTestId('hearts-seat-0');
  const myTurn = page.locator(
    '[data-testid="hearts-seat-0"][data-active] [data-testid="hearts-hand"]:not([aria-disabled])',
  );
  const overlay = resultOverlay(page);
  for (let played = 0; played < 13; played++) {
    await expect(myTurn.or(overlay).first()).toBeVisible({ timeout: 60_000 });
    expect(await overlay.isVisible(), 'the hand ended before all 13 cards were played').toBe(false);
    const left = 13 - played;
    await expect(cards).toHaveCount(left);
    const legal = await cards.evaluateAll((els) =>
      els.flatMap((el, i) => (el.hasAttribute('data-dimmed') ? [] : [i])),
    );
    expect(legal.length, 'at least one legal card').toBeGreaterThan(0);
    if (!(await hand.evaluate((el) => el.contains(document.activeElement)))) {
      await tabInto(page, 'hearts-hand');
    }
    await arrowToCard(page, legal[0]!);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('coach-error')).toHaveCount(0);
    if (left > 1) await expect(cards).toHaveCount(left - 1);
  }
  await expect(seat.locator('[data-card]')).toHaveCount(0);

  // The hand is scored and settled.
  const kind = await overlayKind(page);
  const net = await overlayNet(page, kind);
  await expect(page.getByTestId('hearts-scores')).toBeAttached();
  await expectWalletBalance(page, 1000 + net);
  const wallet = await readStore<WalletSnapshot>(page, 'wallet');
  expect(wallet?.ledger.at(-1)).toMatchObject({ reason: 'bet', gameSlug: 'hearts' });
});

/** Focuses a Klondike pile by its data-pile id using only the arrow keys (Home = stock). */
async function arrowToPile(page: Page, pile: string) {
  const order = await page
    .locator('[data-pile]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-pile') ?? ''));
  const target = order.indexOf(pile);
  expect(target, `pile ${pile} exists`).toBeGreaterThanOrEqual(0);
  await page.keyboard.press('Home');
  for (let i = 0; i < target; i++) await page.keyboard.press('ArrowRight');
  await expect(page.locator(`[data-pile="${pile}"]`)).toBeFocused();
}

test('a Klondike game can be played with the keyboard only', async ({ page }) => {
  // Seed 249: Aces are face up on columns 4, 5 and 7 (col-3, col-4 and col-6).
  await page.goto('/games/klondike/play?seed=249');
  await dealWithKeyboard(page, 10);
  const readout = page.getByTestId('klondike-readout');
  const board = page.getByTestId('klondike-board');
  await expect(readout).toHaveAttribute('data-home', '0');
  const idle = page.locator('[data-testid="klondike-draw"]:not([aria-disabled])');

  // Tab onto the table, then A sends each focused column's Ace home.
  await tabInto(page, 'klondike-board');
  await expect(page.locator('[data-pile]:focus')).toHaveCount(1);
  for (const [i, pile] of ['col-6', 'col-4', 'col-3'].entries()) {
    await expect(idle).toBeVisible();
    await arrowToPile(page, pile);
    await page.keyboard.press('a');
    await expect(readout).toHaveAttribute('data-home', String(i + 1));
  }
  await expect(page.locator('[data-pile^="f-"] [data-testid^="klondike-card-A"]')).toHaveCount(3);

  // D draws from the stock to the waste.
  await expect(idle).toBeVisible();
  const waste = page.getByTestId('klondike-waste');
  await expect(waste.locator('[data-testid^="klondike-card-"]')).toHaveCount(0);
  await page.keyboard.press('d');
  await expect(waste.locator('[data-testid^="klondike-card-"]')).not.toHaveCount(0);

  // Enter picks up the waste card, Escape puts it back.
  await expect(idle).toBeVisible();
  await arrowToPile(page, 'waste');
  await page.keyboard.press('Enter');
  await expect(board).toHaveAttribute('data-selected', 'true');
  await expect(waste).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(board).not.toHaveAttribute('data-selected');

  // "I'm done": Tab to it, Enter, then confirm in the dialog with the keyboard.
  await tabInto(page, 'klondike-resign');
  await page.keyboard.press('Enter');
  const confirm = page.getByTestId('klondike-resign-confirm');
  await expect(confirm).toBeVisible();
  await tabInto(page, 'klondike-resign-confirm', 10);
  await page.keyboard.press('Enter');

  // Three cards home is not enough to win back the stake: a roast, and the wallet settles.
  const kind = await overlayKind(page);
  const net = await overlayNet(page, kind);
  expect(kind).toBe('roast');
  expect(net).toBeLessThan(0);
  await expectWalletBalance(page, 1000 + net);
  expect(await focusedTestId(page)).toBe('rematch-button');
});
