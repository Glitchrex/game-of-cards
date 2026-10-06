/**
 * Definition-of-Done screenshots (`npm run screenshots`): every key page at a 375 × 812
 * phone viewport (the "mobile" project) and a 1280 × 800 desktop viewport (the "desktop"
 * project), saved to docs/screenshots/<name>-<mobile|desktop>.png. Each shot also asserts
 * the page is healthy: its key element is visible, nothing overflows horizontally and the
 * console stayed free of errors. Runs with reduced motion so the UI is settled.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { isMobile, writeStore } from './helpers';

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../docs/screenshots');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? 'e2e-admin-password';

test.use({ contextOptions: { reducedMotion: 'reduce' }, actionTimeout: 15_000 });
test.beforeAll(() => mkdirSync(OUT_DIR, { recursive: true }));

/** Console errors and uncaught exceptions seen by the page since `watchConsole`. */
function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

/** Waits for fonts, network and any finite animations to settle. */
async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          document
            .getAnimations()
            .filter((a) => a.playState === 'running')
            .every((a) => a.effect?.getComputedTiming().endTime === Infinity),
        ),
      { timeout: 10_000 },
    )
    .toBe(true);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const { scrollWidth, innerWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(scrollWidth, 'page must not scroll sideways').toBeLessThanOrEqual(innerWidth);
}

/**
 * Asserts the page is healthy, then saves the viewport screenshot (plus a full-page one
 * when `full` is set and this is the phone project).
 */
async function shoot(
  page: Page,
  errors: string[],
  name: string,
  key: Locator,
  { full = false }: { full?: boolean } = {},
): Promise<void> {
  await expect(key).toBeVisible();
  await settle(page);
  await expect(key).toBeVisible();
  await expectNoHorizontalOverflow(page);
  const form = isMobile(page) ? 'mobile' : 'desktop';
  const opts = { animations: 'disabled', caret: 'hide' } as const;
  await page.screenshot({ ...opts, path: path.join(OUT_DIR, `${name}-${form}.png`) });
  if (full && form === 'mobile') {
    // Below-the-fold sections use `content-visibility: auto` and are not painted outside
    // the viewport; force them on so the full-page capture shows the whole page.
    // The fixed Feedback pill would otherwise be painted once, mid-page.
    await page.addStyleTag({
      content:
        '* { content-visibility: visible !important; } [data-testid="feedback-button"] { visibility: hidden; }',
    });
    await settle(page);
    await expectNoHorizontalOverflow(page);
    await page.screenshot({
      ...opts,
      fullPage: true,
      path: path.join(OUT_DIR, `${name}-${form}-full.png`),
    });
  }
  expect(errors, 'no console errors').toEqual([]);
}

/** Opens /games/<slug>/play (fast bots), places the default bet and deals. */
async function dealTable(page: Page, slug: string, seed = 1): Promise<void> {
  await page.goto(`/games/${slug}/play?seed=${seed}`);
  await writeStore(page, 'settings', { botSpeed: 'fast' });
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('play-table')).toBeVisible();
}

/** Deals Blackjack seed 10 (a natural) on a 10 stake: the win celebration opens. */
async function dealNaturalWin(page: Page): Promise<void> {
  await page.goto('/games/blackjack/play?seed=10');
  await expect(page.getByTestId('bet-panel')).toBeVisible();
  await page.getByTestId('stake-10').click();
  await page.getByTestId('deal-button').click();
  await expect(page.getByTestId('celebration')).toBeVisible({ timeout: 20_000 });
}

interface Shot {
  name: string;
  run: (page: Page) => Promise<Locator>;
  full?: boolean;
}

const SHOTS: Shot[] = [
  {
    name: 'landing',
    full: true,
    run: async (page) => {
      await page.goto('/');
      return page.getByTestId('cta-start');
    },
  },
  {
    name: 'basics',
    run: async (page) => {
      await page.goto('/basics');
      return page.getByTestId('primer-next');
    },
  },
  {
    name: 'catalog',
    run: async (page) => {
      await page.goto('/games');
      return page.getByTestId('game-card-blackjack');
    },
  },
  {
    name: 'blackjack-hub',
    run: async (page) => {
      await page.goto('/games/blackjack');
      return page.getByTestId('game-hub');
    },
  },
  {
    name: 'blackjack-learn',
    run: async (page) => {
      await page.goto('/games/blackjack/learn');
      return page.getByTestId('lesson-next');
    },
  },
  {
    name: 'blackjack-try',
    run: async (page) => {
      await page.goto('/games/blackjack/try');
      await expect(page.getByTestId('practice-hand')).toHaveAttribute('data-state', 'playing');
      await page.getByTestId('coach-hint').click();
      const hint = page.getByTestId('coach-hint-text');
      await expect(hint).toBeVisible();
      // Phones: the coach sits below the table — scroll so the hint ends the viewport,
      // keeping the action buttons above it in view.
      if (isMobile(page)) await hint.evaluate((el) => el.scrollIntoView({ block: 'end' }));
      return hint;
    },
  },
  {
    name: 'blackjack-bet',
    run: async (page) => {
      await page.goto('/games/blackjack/play?seed=4');
      return page.getByTestId('bet-panel');
    },
  },
  {
    name: 'blackjack-table',
    run: async (page) => {
      // Seed 4: a hard 16 against the dealer — the hand waits on Hit or Stand.
      await page.goto('/games/blackjack/play?seed=4');
      await page.getByTestId('stake-25').click();
      await page.getByTestId('deal-button').click();
      await expect(page.getByTestId('bj-hit')).not.toHaveAttribute('aria-disabled', 'true');
      return page.getByTestId('bj-board');
    },
  },
  {
    name: 'blackjack-win',
    run: async (page) => {
      await dealNaturalWin(page);
      return page.getByTestId('win-title');
    },
  },
  {
    name: 'blackjack-roast',
    run: async (page) => {
      await page.goto('/games/blackjack/play?seed=3');
      await page.getByTestId('stake-50').click();
      await page.getByTestId('deal-button').click();
      await expect(page.getByTestId('roast')).toBeVisible({ timeout: 20_000 });
      return page.getByTestId('roast-text');
    },
  },
  {
    name: 'hearts-table',
    run: async (page) => {
      await dealTable(page, 'hearts');
      return page.getByTestId('hearts-board');
    },
  },
  {
    name: 'klondike-table',
    run: async (page) => {
      await dealTable(page, 'klondike');
      return page.getByTestId('klondike-board');
    },
  },
  {
    name: 'teen-patti-table',
    run: async (page) => {
      await dealTable(page, 'teen-patti');
      return page.getByTestId('tp-board');
    },
  },
  {
    name: 'texas-holdem-table',
    run: async (page) => {
      await dealTable(page, 'texas-holdem');
      return page.getByTestId('holdem-table');
    },
  },
  {
    name: 'scopa-try',
    run: async (page) => {
      await page.goto('/games/scopa/try');
      await page.getByRole('button', { name: 'Deal me in' }).click();
      await expect(page.getByTestId('example-progress')).toHaveAttribute('data-step', '1');
      return page.getByTestId('example-scene');
    },
  },
  {
    name: 'quiz',
    run: async (page) => {
      await page.goto('/games/blackjack/quiz');
      await page.getByTestId('quiz-option-0').click();
      return page.getByTestId('quiz-next');
    },
  },
  {
    name: 'community',
    run: async (page) => {
      await page.goto('/community');
      const list = page.getByTestId('post-list');
      await expect(list).not.toHaveAttribute('aria-busy', 'true');
      return list;
    },
  },
  {
    name: 'contact',
    run: async (page) => {
      await page.goto('/contact');
      return page.getByTestId('contact-form');
    },
  },
  {
    name: 'stats',
    run: async (page) => {
      await dealNaturalWin(page);
      await page.goto('/stats');
      const shelf = page.getByTestId('awards-shelf');
      await expect(shelf.getByTestId('award-0')).toBeVisible();
      // The shelf sits below the wallet and career numbers: frame the shot on it.
      await shelf.evaluate((el) => el.scrollIntoView({ block: 'start' }));
      await page.evaluate(() => window.scrollBy(0, -88));
      return shelf;
    },
  },
  {
    name: 'journey',
    run: async (page) => {
      await page.goto('/journey');
      return page.getByTestId('journey-map');
    },
  },
  {
    name: 'admin',
    run: async (page) => {
      await page.goto('/admin');
      await page.getByTestId('admin-password').fill(ADMIN_PASSWORD);
      await page.getByTestId('admin-login').click();
      const dashboard = page.getByTestId('admin-dashboard');
      await expect(dashboard).toBeVisible();
      await expect(page.getByTestId('admin-stats')).toBeVisible();
      return dashboard;
    },
  },
];

for (const shot of SHOTS) {
  // Tagged @mobile so it runs in both projects (desktop runs everything).
  test(`@mobile screenshot: ${shot.name}`, async ({ page }) => {
    test.setTimeout(90_000);
    const errors = watchConsole(page);
    const key = await shot.run(page);
    await expect(page.getByTestId('wallet-pill')).toBeVisible();
    await shoot(page, errors, shot.name, key, { full: shot.full });
  });
}
