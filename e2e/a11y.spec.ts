/**
 * Automated accessibility audit (axe-core, WCAG 2 A + AA) of the main pages: no serious or
 * critical violations. Runs with reduced motion so axe sees settled content rather than
 * elements caught mid-fade.
 */
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

test.use({ contextOptions: { reducedMotion: 'reduce' }, actionTimeout: 15_000 });

const PAGES: { url: string; ready: (page: Page) => Promise<void> }[] = [
  { url: '/', ready: (p) => expect(p.getByTestId('cta-start')).toBeVisible() },
  { url: '/games', ready: (p) => expect(p.getByTestId('game-card-blackjack')).toBeVisible() },
  { url: '/games/blackjack', ready: (p) => expect(p.getByTestId('game-hub')).toBeVisible() },
  {
    url: '/games/blackjack/learn',
    ready: (p) => expect(p.getByTestId('lesson-next')).toBeVisible(),
  },
  {
    url: '/games/blackjack/play',
    ready: (p) => expect(p.getByTestId('bet-panel')).toBeVisible(),
  },
  {
    url: '/community',
    ready: (p) => expect(p.getByTestId('post-list')).not.toHaveAttribute('aria-busy', 'true'),
  },
  { url: '/contact', ready: (p) => expect(p.getByTestId('contact-form')).toBeVisible() },
  { url: '/stats', ready: (p) => expect(p.getByTestId('awards-shelf')).toBeVisible() },
  { url: '/journey', ready: (p) => expect(p.getByTestId('journey-map')).toBeVisible() },
  { url: '/basics', ready: (p) => expect(p.getByTestId('primer-next')).toBeVisible() },
];

for (const { url, ready } of PAGES) {
  test(`@mobile axe: ${url} has no serious or critical WCAG 2 A/AA violations`, async ({
    page,
  }) => {
    await page.goto(url);
    await expect(page.getByTestId('wallet-pill')).toBeVisible();
    await ready(page);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const blocking = results.violations
      .filter((v) => v.impact === 'serious' || v.impact === 'critical')
      .map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 5).map((n) => ({ target: n.target, summary: n.failureSummary })),
      }));
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}
