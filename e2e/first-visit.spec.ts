/**
 * Definition of Done: a brand-new visitor goes from the landing page, through the Card
 * Basics primer and a coached practice hand, to their first completed Blackjack hand for
 * pretend Jeet — and the wallet settles correctly.
 */
import { expect, test, type Page } from '@playwright/test';
import {
  expectWalletBalance,
  overlayKind,
  overlayNet,
  readStore,
  walletBalance,
  type WalletSnapshot,
} from './helpers';

test.use({ actionTimeout: 15_000 });

/** Steps through every primer screen, doing each screen's interactive bit, then finishes. */
async function completePrimer(page: Page) {
  const next = page.getByTestId('primer-next');
  const primer = page.getByTestId('primer');

  // 1. Meet the deck: tap the deck to spread it out.
  await expect(page.getByRole('heading', { name: 'Meet the deck' })).toBeVisible();
  await page.getByTestId('primer-deck').click();
  await expect(primer.getByText('Ta-da! 52 cards: 4 families of 13 cards each.')).toBeVisible();
  await next.click();

  // 2. Four suits: tap each one.
  await expect(page.getByRole('heading', { name: 'Four suits' })).toBeVisible();
  const suits = primer.getByRole('list', { name: 'The four suits' });
  for (const name of ['Spades', 'Hearts', 'Diamonds', 'Clubs']) {
    await suits.getByRole('button', { name, exact: true }).click();
  }
  await expect(primer.getByText('You know all 4 suits!')).toBeVisible();
  await next.click();

  // 3. Ranks: put 3, 6, 9, King of Clubs in order.
  await expect(page.getByRole('heading', { name: 'Ranks: who beats whom' })).toBeVisible();
  const pool = page.getByTestId('ranks-pool');
  for (const card of ['Three of Clubs', 'Six of Clubs', 'Nine of Clubs', 'King of Clubs']) {
    await pool.getByRole('button', { name: new RegExp(`^${card}`) }).click();
  }
  await expect(primer.getByText('Perfect order! 3, 6, 9, then the King.')).toBeVisible();
  await next.click();

  // 4. Face cards: turn all three over.
  await expect(page.getByRole('heading', { name: 'Face cards' })).toBeVisible();
  for (const i of [0, 1, 2]) await page.getByTestId(`face-card-${i}`).click();
  await expect(primer.getByText(/All 3 royals met!/)).toBeVisible();
  await next.click();

  // 5. Your hand: peek, then pick a card.
  await expect(page.getByRole('heading', { name: 'Your hand' })).toBeVisible();
  await primer.getByRole('button', { name: 'Peek at my cards' }).click();
  await expect(
    primer.getByText('Only you can see these. Your opponent just sees the backs.'),
  ).toBeVisible();
  await page.getByTestId('primer-my-hand').getByRole('button').first().click();
  await expect(primer.getByText(/^You picked the /)).toBeVisible();
  await next.click();

  // 6. A trick: the 10 of Hearts wins.
  await expect(page.getByRole('heading', { name: 'A trick' })).toBeVisible();
  await page.getByTestId('trick-card-2').click();
  await expect(primer.getByText(/^Yes! The 10 of Hearts is the highest Heart/)).toBeVisible();
  await next.click();

  // 7. Trump: the little 2 of Spades wins.
  await expect(page.getByRole('heading', { name: 'Trump' })).toBeVisible();
  await page.getByTestId('trump-card-2').click();
  await expect(primer.getByText(/^Right! Even the little 2 of Spades wins/)).toBeVisible();
  await next.click();

  // 8. Melds: J-Q-K of Clubs is the run.
  await expect(page.getByRole('heading', { name: 'Melds: sets and runs' })).toBeVisible();
  await primer.getByRole('button', { name: /^Group 2:/ }).click();
  await expect(primer.getByText(/^Yes! Jack, Queen, King of Clubs is a run/)).toBeVisible();
  await next.click();

  // Done screen → "Let's play" continues to the coached Blackjack hand.
  await expect(page.getByRole('heading', { name: "You're ready!" })).toBeVisible();
  await expect(next).toHaveText(/Let's play/);
  await next.click();
}

test('@mobile first visit → primer → coached practice → first Blackjack hand for Jeet', async ({
  page,
}) => {
  test.setTimeout(120_000);

  // Landing: the marquee wordmark and the pretend-money promise.
  await page.goto('/');
  const home = page.getByRole('banner').getByRole('link', { name: 'Game of Cards — home' });
  await expect(home).toBeVisible();
  await expect(home.locator('svg').first()).toBeVisible();
  await expect(
    page.getByText('You start with 1,000 Jeet — pretend coins, no real money, ever.'),
  ).toBeVisible();
  await expect(page.getByTestId('pretend-money-notice')).toHaveText(
    'Jeet is pretend money for learning. No real money, ever.',
  );
  expect(await walletBalance(page)).toBe(1000);

  // Start learning → the primer.
  await page.getByTestId('cta-start').click();
  await expect(page).toHaveURL(/\/basics\?next=/);
  await completePrimer(page);
  const settings = await readStore<{ primerSeen: boolean }>(page, 'settings');
  expect(settings?.primerSeen).toBe(true);

  // The coached practice hand: follow the coach's advice.
  await expect(page).toHaveURL(/\/games\/blackjack\/try$/);
  const practice = page.getByTestId('practice-hand');
  await expect(practice).toHaveAttribute('data-state', 'playing');
  await expect(page.getByTestId('practice-intro')).toBeVisible();
  await page.getByTestId('coach-hint').click();
  await expect(page.getByTestId('coach-hint-text')).toBeVisible();
  // Hard 13 against a dealer 6: the coach says stand (the dealer then busts).
  const pick = page.locator('[data-testid^="bj-"][data-suggested]');
  await expect(pick).toHaveAttribute('data-testid', 'bj-stand');
  await pick.click();
  await expect(page.getByTestId('practice-summary')).toBeVisible({ timeout: 30_000 });
  await expect(practice).toHaveAttribute('data-state', 'over');
  await expect(page.getByTestId('practice-result')).not.toBeEmpty();
  // Practice never touches the wallet.
  expect(await walletBalance(page)).toBe(1000);

  // Play for Jeet → bet panel → stake → Deal.
  await page.getByRole('link', { name: 'Play for Jeet' }).click();
  await expect(page).toHaveURL(/\/games\/blackjack\/play$/);
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  const stake = 25;
  await page.getByTestId(`stake-${stake}`).click();
  await expect(page.getByTestId(`stake-${stake}`)).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('play-table')).toBeVisible();
  // The stake leaves the wallet at the deal and is held while the hand is played (a
  // natural Blackjack can settle straight away, so check the ledger for the escrow).
  await expect
    .poll(async () => (await readStore<WalletSnapshot>(page, 'wallet'))?.ledger.at(-1))
    .toMatchObject({ amount: -stake, reason: 'bet' });

  // Simple strategy: hit below 17, otherwise stand, until the hand is over. Each move waits
  // for the table to react (a new card, or the turn passing) before the next decision.
  const overlay = page
    .getByTestId('celebration')
    .or(page.getByTestId('roast'))
    .or(page.getByTestId('push-overlay'));
  const total = page.getByTestId('bj-player-total');
  const myTurn = page.locator('[data-testid="bj-stand"][data-legal]:not([aria-disabled])');
  const myCards = page.getByTestId('bj-hand-0').locator('[data-card]');
  for (let i = 0; i < 12; i++) {
    await expect(overlay.or(myTurn).first()).toBeVisible({ timeout: 30_000 });
    if (await overlay.isVisible()) break;
    const value = Number(await total.getAttribute('data-total'));
    if (value < 17) {
      const cards = await myCards.count();
      await page.getByTestId('bj-hit').click();
      await expect
        .poll(async () => (await overlay.isVisible()) || (await myCards.count()) > cards)
        .toBe(true);
    } else {
      await page.getByTestId('bj-stand').click();
      await expect
        .poll(async () => (await overlay.isVisible()) || !(await myTurn.isVisible()))
        .toBe(true);
    }
  }

  const kind = await overlayKind(page);
  const net = await overlayNet(page, kind);
  if (kind === 'celebration') {
    // An ordinary win pays 1:1, a natural Blackjack 3:2.
    expect([stake, Math.round(stake * 1.5)]).toContain(net);
    await expect(page.getByTestId('win-title')).not.toBeEmpty();
  } else if (kind === 'roast') {
    expect(net).toBe(-stake);
    await expect(page.getByTestId('roast-text')).not.toBeEmpty();
  } else {
    expect(net).toBe(0);
  }
  await expectWalletBalance(page, 1000 + net);
  const wallet = await readStore<WalletSnapshot>(page, 'wallet');
  expect(wallet?.balance).toBe(1000 + net);
  // Newest first: the bet, then whatever came back (nothing for a loss).
  const expected: [string, number][] =
    kind === 'celebration'
      ? [
          ['payout', stake + net],
          ['bet', -stake],
        ]
      : kind === 'push-overlay'
        ? [
            ['refund', stake],
            ['bet', -stake],
          ]
        : [['bet', -stake]];
  expect(wallet?.ledger.map((e) => [e.reason, e.amount])).toEqual(expected);
});
