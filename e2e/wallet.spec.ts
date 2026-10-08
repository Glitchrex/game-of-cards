/**
 * The Jeet wallet: starting balance, escrow and settlement, persistence, the Daily Udhaar
 * (with its cooldown), the pretend-money notice, and no way to buy or pay for anything.
 */
import { expect, test } from '@playwright/test';
import {
  expectWalletBalance,
  readStore,
  walletBalance,
  walletPill,
  writeStore,
  type WalletSnapshot,
} from './helpers';

test.use({ actionTimeout: 15_000 });

const NOTICE = 'Jeet is pretend money for learning. No real money, ever.';
const MAIN_PAGES = ['/', '/games', '/contact', '/stats'] as const;

test('@mobile starts at 1,000; a bet is escrowed, settles, and the balance survives a reload', async ({
  page,
}) => {
  await page.goto('/games/blackjack/play?seed=4');
  await expectWalletBalance(page, 1000);
  await expect(walletPill(page)).toContainText('1,000');

  // Seed 4: hard 16, and hitting busts. The stake leaves the wallet at the deal…
  await page.getByTestId('stake-100').click();
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('play-table')).toBeVisible();
  await expectWalletBalance(page, 900);
  await page.getByTestId('bj-hit').click();
  // …and a loss keeps it.
  await expect(page.getByTestId('roast')).toBeVisible({ timeout: 20_000 });
  await expectWalletBalance(page, 900);

  // Seed 10: a natural Blackjack — escrow 100, then 100 back plus 150 winnings.
  await page.goto('/games/blackjack/play?seed=10');
  await page.getByTestId('stake-100').click();
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('celebration')).toBeVisible({ timeout: 20_000 });
  await expectWalletBalance(page, 1050);

  const wallet = await readStore<WalletSnapshot>(page, 'wallet');
  expect(wallet?.balance).toBe(1050);
  expect(wallet?.ledger.map((e) => [e.reason, e.amount])).toEqual([
    ['payout', 250],
    ['bet', -100],
    ['bet', -100],
  ]);

  // Persisted: a reload (and another page) shows the same balance.
  await page.reload();
  await expectWalletBalance(page, 1050);
  await page.goto('/stats');
  await expect(page.getByTestId('stats-balance')).toContainText('1,050');
  expect(await walletBalance(page)).toBe(1050);
});

test('@mobile Daily Udhaar: offered when nearly broke, claimed once, then on cooldown', async ({
  page,
}) => {
  await page.goto('/');
  await expectWalletBalance(page, 1000);
  await expect(walletPill(page)).not.toContainText('Udhaar');

  await writeStore(page, 'wallet', { balance: 50, lastUdhaarAt: null });
  await expectWalletBalance(page, 50);
  const pill = walletPill(page);
  await expect(pill).toHaveAttribute('aria-label', 'Wallet: 50 Jeet. Daily Udhaar available');
  await expect(pill).toContainText('Udhaar');

  await pill.click();
  const dialog = page.getByRole('dialog', { name: 'Your Jeet wallet' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('wallet-notice')).toHaveText(NOTICE);
  const offer = dialog.getByTestId('udhaar-offer');
  await expect(offer).toHaveAttribute('data-state', 'ok');
  await offer.getByRole('button', { name: 'Claim 500 Jeet' }).click();

  await expectWalletBalance(page, 550);
  await expect(
    page.getByTestId('toast').filter({ hasText: 'Udhaar granted! +500 Jeet' }),
  ).toBeVisible();
  await expect(offer.getByRole('button', { name: /Claim/ })).toHaveCount(0);
  await expect(pill).not.toContainText('Udhaar');

  const wallet = await readStore<WalletSnapshot>(page, 'wallet');
  expect(wallet?.balance).toBe(550);
  expect(wallet?.lastUdhaarAt).toEqual(expect.any(Number));
  expect(wallet?.ledger[0]).toMatchObject({ reason: 'udhaar', amount: 500 });

  // Broke again the same day: no second udhaar — the dialog shows the cooldown instead.
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await writeStore(page, 'wallet', { balance: 40 });
  await expectWalletBalance(page, 40);
  await expect(pill).toHaveAttribute('aria-label', 'Wallet: 40 Jeet');
  await expect(pill).not.toContainText('Udhaar');
  await pill.click();
  await expect(dialog).toBeVisible();
  await expect(offer).toHaveAttribute('data-state', 'cooldown');
  await expect(offer).toContainText(/Next udhaar in (2[34]h \d+m)/);
  await expect(dialog.getByRole('button', { name: /Claim/ })).toHaveCount(0);
  await expectWalletBalance(page, 40);
});

test('@mobile the pretend-money notice is on every main page, and nothing can be bought', async ({
  page,
}) => {
  const forbidden =
    /\b(buy|purchase|add money|add funds|payment|pay now|checkout|top[ -]?up|deposit|withdraw|cash ?out)\b/i;
  for (const url of MAIN_PAGES) {
    await page.goto(url);
    const notice = page.getByTestId('pretend-money-notice');
    await expect(notice, `notice on ${url}`).toHaveText(NOTICE);
    await notice.scrollIntoViewIfNeeded();
    await expect(notice).toBeVisible();

    const names = await page
      .locator('a, button, [role="button"], [role="link"], input[type="submit"]')
      .evaluateAll((els) =>
        els.map((el) =>
          [el.getAttribute('aria-label'), (el as HTMLElement).innerText, el.getAttribute('href')]
            .filter(Boolean)
            .join(' | '),
        ),
      );
    expect(names.length, `controls found on ${url}`).toBeGreaterThan(5);
    const offending = names.filter((n) => forbidden.test(n));
    expect(offending, `purchase/payment controls on ${url}`).toEqual([]);
  }
});
