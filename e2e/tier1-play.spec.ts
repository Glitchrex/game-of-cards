/**
 * Every Tier 1 game's real-money-free play page (/games/<slug>/play) loads, deals for Jeet
 * and finishes a whole bot-assisted game: the coach plays the learner's moves ("Play it for
 * me"), the bots play theirs, and the wallet settles to exactly what the result screen says.
 */
import { expect, test } from '@playwright/test';
import {
  expectWalletBalance,
  overlayNet,
  playRealGameWithCoach,
  readStore,
  tier1Slugs,
  writeStore,
  type StatsSnapshot,
  type WalletSnapshot,
} from './helpers';

test.use({ actionTimeout: 15_000 });

test.describe('every Tier 1 play page completes a bot-assisted game for Jeet', () => {
  for (const slug of tier1Slugs()) {
    test(`${slug} /play: deal, coach plays to the end, wallet settles`, async ({ page }) => {
      test.setTimeout(240_000);
      await page.goto(`/games/${slug}/play?seed=1`);
      await writeStore(page, 'settings', { botSpeed: 'fast' });
      await expectWalletBalance(page, 1000);
      await expect(page.getByTestId('game-shell')).toHaveAttribute('data-phase', 'bet');

      const kind = await playRealGameWithCoach(page, { timeoutMs: 200_000 });
      const net = await overlayNet(page, kind);
      if (kind === 'celebration') {
        expect(net).toBeGreaterThan(0);
        await expect(page.getByTestId('win-title')).not.toBeEmpty();
      } else if (kind === 'roast') {
        expect(net).toBeLessThan(0);
        await expect(page.getByTestId('roast-text')).not.toBeEmpty();
      } else {
        expect(net).toBe(0);
      }
      await expectWalletBalance(page, 1000 + net);

      const wallet = await readStore<WalletSnapshot>(page, 'wallet');
      expect(wallet?.balance).toBe(1000 + net);
      expect(wallet?.ledger.every((e) => e.gameSlug === slug)).toBe(true);
      expect(wallet?.ledger.at(-1)).toMatchObject({ reason: 'bet' });
      const stats = await readStore<StatsSnapshot>(page, 'stats');
      expect(stats?.played).toBe(1);
    });
  }
});
