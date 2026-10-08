/**
 * Learning paths: the catalog (search + filters), game hubs, the Blackjack lesson (buttons,
 * arrow keys, glossary popovers), the quiz, every Tier 2 scripted example, the
 * "Pick a game for me" dialog, and the Journey page reflecting progress.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import blackjack from '../content/games/blackjack';
import {
  allGameSlugs,
  playPracticeWithCoach,
  readStore,
  tier1Slugs,
  tier2Slugs,
  writeStore,
  type ProgressSnapshot,
} from './helpers';

test.use({ actionTimeout: 15_000 });

const TIER1 = tier1Slugs();
const TIER2 = tier2Slugs();

/** Slugs whose content file declares the given origin region. */
function slugsInRegion(region: string): string[] {
  return allGameSlugs().filter((slug) =>
    readFileSync(path.join('content/games', `${slug}.ts`), 'utf8').includes(`region: '${region}'`),
  );
}

const gameCards = (page: Page) => page.locator('ul [data-testid^="game-card-"]');

async function shownSlugs(page: Page): Promise<string[]> {
  return (
    await gameCards(page).evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid')?.replace('game-card-', '') ?? ''),
    )
  ).sort();
}

/** On phones the filter panel is collapsed behind a toggle. */
async function openFilters(page: Page) {
  const toggle = page.getByTestId('catalog-filters-toggle');
  if ((await toggle.isVisible()) && (await toggle.getAttribute('aria-expanded')) === 'false') {
    await toggle.click();
  }
}

test('the content has 12 playable (Tier 1) and 19 learn-only (Tier 2) games', () => {
  expect(TIER1).toHaveLength(12);
  expect(TIER2).toHaveLength(19);
});

test('@mobile catalog: search, region filter, playable toggle and reset', async ({ page }) => {
  const all = allGameSlugs();
  await page.goto('/games');
  await expect(gameCards(page)).toHaveCount(all.length);

  // Search.
  await page.getByTestId('catalog-search').fill('Teen Patti');
  await expect.poll(() => shownSlugs(page)).toEqual(['teen-patti']);
  await page.getByTestId('catalog-search').fill('');
  await expect(gameCards(page)).toHaveCount(all.length);

  // Region: South Asia shows exactly the South Asian games (Teen Patti, Andar Bahar…).
  await openFilters(page);
  const southAsia = slugsInRegion('south-asia').sort();
  expect(southAsia).toEqual(expect.arrayContaining(['teen-patti', 'andar-bahar']));
  await page.getByRole('button', { name: /^South Asia/ }).click();
  await expect(page.getByRole('button', { name: /^South Asia/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect.poll(() => shownSlugs(page)).toEqual(southAsia);
  await expect(page.getByTestId('catalog-count')).toContainText(String(southAsia.length));

  // Reset, then "Playable vs bot" shows exactly the 12 Tier 1 games.
  await page.getByTestId('catalog-reset').click();
  await expect(gameCards(page)).toHaveCount(all.length);
  await openFilters(page);
  const playable = page.getByRole('switch', { name: 'Playable vs bot' });
  await playable.click();
  await expect(playable).toHaveAttribute('aria-checked', 'true');
  await expect(gameCards(page)).toHaveCount(12);
  expect(await shownSlugs(page)).toEqual(TIER1);

  // Game cards lead to the hub.
  await page.getByTestId('game-card-blackjack').getByRole('link').first().click();
  await expect(page).toHaveURL(/\/games\/blackjack$/);
  await expect(page.getByTestId('game-hub')).toBeVisible();
});

test('game hubs link to every step (learn, try, play for Tier 1; no play for Tier 2)', async ({
  page,
}) => {
  await page.goto('/games/blackjack');
  for (const step of ['learn', 'try', 'play', 'quiz']) {
    await expect(page.getByTestId(`hub-${step}`)).toHaveAttribute(
      'href',
      `/games/blackjack/${step}`,
    );
  }
  const tier2 = TIER2[0]!;
  await page.goto(`/games/${tier2}`);
  await expect(page.getByTestId('game-hub')).toBeVisible();
  for (const step of ['learn', 'try', 'quiz']) {
    await expect(page.getByTestId(`hub-${step}`)).toHaveAttribute(
      'href',
      `/games/${tier2}/${step}`,
    );
  }
  await expect(page.getByTestId('hub-play')).toHaveCount(0);
  await page.getByTestId('hub-start').click();
  await expect(page).toHaveURL(new RegExp(`/games/${tier2}/learn$`));
  await expect(page.getByTestId('lesson-next')).toBeVisible();
});

test('@mobile Blackjack lesson: Next / arrow keys to the end, a glossary popover, and the Journey', async ({
  page,
}) => {
  await page.goto('/journey');
  await expect(page.getByTestId('journey-node-blackjack')).toHaveAttribute(
    'data-status',
    'not-started',
  );

  await page.goto('/games/blackjack/learn');
  const progress = page.getByTestId('lesson-progress');
  const total = Number(await progress.getAttribute('data-total'));
  expect(total).toBe(blackjack.lesson.length);
  await expect(progress).toHaveAttribute('data-step', '1');

  // Arrow keys move between steps (focus on the page, not a widget).
  await page.getByRole('heading', { level: 1 }).first().click();
  await page.keyboard.press('ArrowRight');
  await expect(progress).toHaveAttribute('data-step', '2');
  await page.keyboard.press('ArrowLeft');
  await expect(progress).toHaveAttribute('data-step', '1');

  // A glossary term opens a definition popover (find the first step that has one).
  let opened = false;
  for (let step = 1; step <= total && !opened; step++) {
    const term = page.locator('[data-glossary-term] button').first();
    if ((await term.count()) > 0 && (await term.isVisible())) {
      await term.click();
      await expect(term).toHaveAttribute('aria-expanded', 'true');
      const panelId = await term.getAttribute('aria-controls');
      expect(panelId).toBeTruthy();
      await expect(page.locator(`[id="${panelId}"]`)).toBeVisible();
      await expect(page.locator(`[id="${panelId}"]`)).not.toBeEmpty();
      await page.keyboard.press('Escape');
      await expect(term).toHaveAttribute('aria-expanded', 'false');
      opened = true;
    } else {
      await page.getByTestId('lesson-next').click();
      await expect(progress).toHaveAttribute('data-step', String(step + 1));
    }
  }
  expect(opened, 'some lesson step has a glossary term').toBe(true);

  // Next all the way to the end.
  for (let i = 0; i < total + 2 && (await page.getByTestId('lesson-next').isVisible()); i++) {
    await page.getByTestId('lesson-next').click();
  }
  await expect(progress).toHaveAttribute('data-step', String(total));
  await expect(page.getByTestId('lesson-next')).toHaveCount(0);
  await expect(page.getByTestId('lesson-try')).toBeVisible();
  const saved = await readStore<ProgressSnapshot>(page, 'progress');
  expect(saved?.games.blackjack).toMatchObject({ lessonDone: true, started: true });

  // The Journey now shows Blackjack as "learning".
  await page.goto('/journey');
  await expect(page.getByTestId('journey-node-blackjack')).toHaveAttribute(
    'data-status',
    'learning',
  );
});

test('@mobile Blackjack quiz: answer all five questions and see the score', async ({ page }) => {
  await page.goto('/games/blackjack/quiz');
  const questions = blackjack.quiz;
  expect(questions).toHaveLength(5);
  for (const [i, q] of questions.entries()) {
    await expect(
      page.getByRole('heading', { level: 2 }).filter({ hasText: q.question }),
    ).toBeVisible();
    // Answer the first question wrong on purpose, the rest right.
    const pick = i === 0 ? (q.answer + 1) % q.options.length : q.answer;
    await page.getByTestId(`quiz-option-${pick}`).click();
    await expect(page.getByTestId(`quiz-option-${q.answer}`)).toHaveAttribute(
      'data-state',
      'correct',
    );
    if (i === 0) {
      await expect(page.getByTestId(`quiz-option-${pick}`)).toHaveAttribute('data-state', 'wrong');
    }
    await page.getByTestId('quiz-next').click();
  }
  await expect(page.getByTestId('quiz-score')).toHaveText('4/5');
  await expect(page.getByTestId('quiz-best')).toContainText('4');
  const saved = await readStore<ProgressSnapshot>(page, 'progress');
  expect(saved?.games.blackjack?.quizBest).toBe(4);
});

/** Plays a Tier 2 scripted example to its outro. */
async function completeExample(page: Page, slug: string) {
  await page.goto(`/games/${slug}/try`);
  const outro = page.getByTestId('example-outro');
  const progress = page.getByTestId('example-progress');
  const total = Number(await progress.getAttribute('data-total'));
  expect(total).toBeGreaterThan(0);
  // Intro → first step.
  await page.getByRole('button', { name: 'Deal me in' }).click();

  for (let n = 1; n <= total; n++) {
    // Steps cross-fade: wait until step n has replaced the previous one.
    await expect(
      page.getByRole('heading', { level: 2, name: new RegExp(`^Step ${n} of ${total}\\b`) }),
    ).toBeVisible();
    await expect(progress).toHaveAttribute('data-step', String(n));
    const options = page.locator('[data-testid^="example-option-"]');
    const solved = page.locator('[data-testid^="example-option-"][data-state="solved"]');
    const count = await options.count();
    if (count > 0) {
      // A decision: Continue only appears once it is solved.
      await expect(page.getByTestId('example-must-choose')).toBeVisible();
      for (let k = 0; k < count && (await solved.count()) === 0; k++) {
        const option = page.getByTestId(`example-option-${k}`);
        if ((await option.getAttribute('data-state')) === 'idle') await option.click();
      }
      await expect(solved).toHaveCount(1);
      await expect(page.locator('[data-testid^="example-option-"][data-state="idle"]')).toHaveCount(
        0,
      );
    }
    await page.getByTestId('example-continue').click();
  }
  await expect(outro).toBeVisible();
  await expect(page.getByTestId('example-quiz')).toHaveAttribute('href', `/games/${slug}/quiz`);
  const saved = await readStore<ProgressSnapshot>(page, 'progress');
  expect(saved?.games[slug]?.exampleDone, `${slug} example marked done`).toBe(true);
}

test.describe('every Tier 2 scripted example can be completed', () => {
  for (const slug of TIER2) {
    test(`${slug} /try example reaches the outro`, async ({ page }) => {
      await completeExample(page, slug);
    });
  }
});

test('@mobile "Pick a game for me" answers three questions and links to a real game', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByTestId('cta-pick').click();
  const dialog = page.getByTestId('pick-dialog');
  await expect(dialog).toHaveAttribute('data-step', 'players');
  await page.getByTestId('pick-answer-two').click();
  await expect(dialog).toHaveAttribute('data-step', 'mood');
  await page.getByTestId('pick-answer-chill').click();
  await expect(dialog).toHaveAttribute('data-step', 'time');
  await page.getByTestId('pick-answer-quick').click();
  await expect(dialog).toHaveAttribute('data-step', 'result');

  const result = page.getByTestId('pick-result');
  await expect(result).toBeVisible();
  const slug = (await result.getAttribute('data-slug')) ?? '';
  expect(allGameSlugs()).toContain(slug);
  await page.getByTestId('pick-learn').click();
  await expect(page).toHaveURL(new RegExp(`/games/${slug}/learn$`));
  await expect(page.getByTestId('lesson-progress')).toBeVisible();
});

test.describe('every Tier 1 coached practice hand can be played to the end', () => {
  for (const slug of TIER1) {
    test(`${slug} /try practice hand reaches the summary`, async ({ page }) => {
      test.setTimeout(180_000);
      await page.goto(`/games/${slug}/try`);
      // Fast bots keep the suite quick; the coach plays every one of the learner's moves.
      await writeStore(page, 'settings', { botSpeed: 'fast' });
      await expect(page.getByTestId('practice-hand')).toHaveAttribute('data-state', 'playing');
      await expect(page.getByTestId('practice-ribbon')).toBeVisible();
      await playPracticeWithCoach(page, 150_000);
      await expect(page.getByTestId('practice-hand')).toHaveAttribute('data-state', 'over');
      await expect(page.getByTestId('practice-result')).not.toBeEmpty();
      await expect(page.getByRole('link', { name: 'Play for Jeet' })).toHaveAttribute(
        'href',
        `/games/${slug}/play`,
      );
      const saved = await readStore<ProgressSnapshot>(page, 'progress');
      expect(saved?.games[slug]?.exampleDone).toBe(true);
      // Practice never touches the wallet.
      expect((await readStore<{ balance: number }>(page, 'wallet'))?.balance ?? 1000).toBe(1000);
    });
  }
});
