/**
 * The Community Board: posting (with validation), upvotes (one per browser, persisted),
 * comments, type filters, sorting, the floating Feedback button, and moderation in /admin.
 * Titles carry a random suffix so tests running in parallel never see each other's posts.
 */
import { expect, test, type Page } from '@playwright/test';
import { uniqueSuffix } from './helpers';

test.use({ actionTimeout: 15_000 });

const ADMIN_PASSWORD = 'e2e-admin-password';

type PostType = 'feature' | 'bug' | 'game' | 'general';

/** Fills and submits the /community form; returns the new post's id. */
async function createPost(page: Page, title: string, type: PostType = 'feature'): Promise<number> {
  const form = page.getByTestId('post-form');
  await form.getByTestId('post-type-select').selectOption(type);
  await form.getByTestId('post-title-input').fill(title);
  await form
    .getByTestId('post-body-input')
    .fill(`Written by the end-to-end suite for "${title}". Please ignore.`);
  await form.getByTestId('post-submit').click();
  const card = postCard(page, title);
  await expect(card).toBeVisible();
  return postId(page, title);
}

function postCard(page: Page, title: string) {
  return page.locator('[data-testid^="post-card-"]').filter({ hasText: title });
}

async function postId(page: Page, title: string): Promise<number> {
  const testId = await postCard(page, title).getAttribute('data-testid');
  const id = Number(testId?.replace('post-card-', ''));
  expect(Number.isInteger(id) && id > 0, `post id for "${title}"`).toBe(true);
  return id;
}

/** Index of each post id in the rendered list (top = 0). */
async function listOrder(page: Page): Promise<number[]> {
  const ids = await page
    .getByTestId('post-list')
    .locator('[data-testid^="post-card-"]')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-testid')?.slice(10))));
  return ids;
}

async function openBoard(page: Page) {
  await page.goto('/community');
  await expect(page.getByTestId('post-form')).toBeVisible();
  await expect(page.getByTestId('post-list')).not.toHaveAttribute('aria-busy', 'true');
}

test('@mobile post with validation, upvote once per browser, and comment', async ({ page }) => {
  await openBoard(page);

  // Validation: too-short title and empty description are explained inline; nothing is sent.
  const form = page.getByTestId('post-form');
  await form.getByTestId('post-title-input').fill('ab');
  await form.getByTestId('post-submit').click();
  await expect(form.getByTestId('post-title-input')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByText('Title needs at least 3 characters.')).toBeVisible();
  await expect(form.getByTestId('post-body-input')).toHaveAttribute('aria-invalid', 'true');
  await expect(form.getByTestId('post-title-input')).toBeFocused();

  // A valid post appears at the top of the board.
  const title = `E2E idea ${uniqueSuffix()}`;
  const id = await createPost(page, title);
  expect((await listOrder(page))[0]).toBe(id);
  await expect(form.getByTestId('post-title-input')).toHaveValue('');
  const card = page.getByTestId(`post-card-${id}`);
  await expect(card).toHaveAttribute('data-status', 'open');
  await expect(card).toContainText('No comments yet');

  // Upvote: toggles on, survives a reload, and a second click takes the vote back.
  const upvote = page.getByTestId(`upvote-${id}`);
  await expect(upvote).toHaveAttribute('data-count', '0');
  await upvote.click();
  await expect(upvote).toHaveAttribute('data-voted', 'true');
  await expect(upvote).toHaveAttribute('data-count', '1');
  await expect(upvote).not.toHaveAttribute('aria-busy', 'true');
  await page.reload();
  await expect(upvote).toHaveAttribute('data-voted', 'true');
  await expect(upvote).toHaveAttribute('data-count', '1');
  await expect(upvote).toHaveAttribute('aria-pressed', 'true');
  await upvote.click();
  await expect(upvote).toHaveAttribute('data-voted', 'false');
  await expect(upvote).toHaveAttribute('data-count', '0');
  await expect(upvote).not.toHaveAttribute('aria-busy', 'true');
  await page.reload();
  await expect(upvote).toHaveAttribute('data-voted', 'false');
  await expect(upvote).toHaveAttribute('data-count', '0');

  // Open the post and comment on it.
  await card.getByRole('link', { name: title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/community/${id}$`));
  const detail = page.getByTestId('post-detail');
  await expect(detail.getByRole('heading', { level: 1 })).toHaveText(title);
  await expect(detail).toContainText('No comments yet');
  const comment = `Great idea — seconded (${uniqueSuffix()})`;
  await page.getByTestId('comment-input').fill(comment);
  await page.getByTestId('comment-submit').click();
  await expect(page.getByTestId('comment-list')).toContainText(comment);
  await expect(detail).toContainText('1 comment');

  // The board shows the new comment count too.
  await page.getByTestId('back-to-board').click();
  await expect(page.getByTestId(`post-card-${id}`)).toContainText('1 comment');
});

test('filter by type and sort Newest vs Most upvoted', async ({ page }) => {
  await openBoard(page);
  const suffix = uniqueSuffix();
  const older = `E2E popular ${suffix}`;
  const newer = `E2E bug report ${suffix}`;
  const olderId = await createPost(page, older, 'feature');
  const newerId = await createPost(page, newer, 'bug');
  await page.getByTestId(`upvote-${olderId}`).click();
  await expect(page.getByTestId(`upvote-${olderId}`)).toHaveAttribute('data-count', '1');
  await expect(page.getByTestId(`upvote-${olderId}`)).not.toHaveAttribute('aria-busy', 'true');

  // Filter: only bugs.
  await page.getByTestId('filter-bug').click();
  await expect(page.getByTestId('filter-bug')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId(`post-card-${newerId}`)).toBeVisible();
  await expect(page.getByTestId(`post-card-${olderId}`)).toHaveCount(0);
  const types = await page
    .getByTestId('post-list')
    .locator('[data-testid^="post-card-"]')
    .evaluateAll((els) => els.map((el) => el.getAttribute('data-post-type')));
  expect(types.length).toBeGreaterThan(0);
  expect(new Set(types)).toEqual(new Set(['bug']));
  await page.getByTestId('filter-all').click();
  await expect(page.getByTestId(`post-card-${olderId}`)).toBeVisible();

  // Newest first: the bug report (posted second) is above the popular post.
  await page.getByTestId('sort-new').click();
  await expect(page.getByTestId('sort-new')).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => {
      const order = await listOrder(page);
      return order.indexOf(newerId) < order.indexOf(olderId) && order.indexOf(newerId) >= 0;
    })
    .toBe(true);

  // Most upvoted: the upvoted post moves above the newer one with no votes.
  await page.getByTestId('sort-top').click();
  await expect(page.getByTestId('sort-top')).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(async () => {
      const order = await listOrder(page);
      return order.indexOf(olderId) < order.indexOf(newerId) && order.indexOf(olderId) >= 0;
    })
    .toBe(true);
  const counts = await page
    .getByTestId('post-list')
    .locator('[data-testid^="upvote-"]')
    .evaluateAll((els) => els.map((el) => Number(el.getAttribute('data-count'))));
  expect(counts).toEqual([...counts].sort((a, b) => b - a));
});

test('@mobile the floating Feedback button posts to the board from any page', async ({ page }) => {
  await page.goto('/games');
  await page.getByTestId('feedback-button').click();
  const form = page.getByTestId('feedback-form');
  await expect(form).toBeVisible();
  const title = `E2E feedback ${uniqueSuffix()}`;
  await form.getByLabel('Type').selectOption('general');
  await form.getByLabel('Title').fill(title);
  await form.getByLabel('Description').fill('Sent from the floating Feedback button on /games.');
  await form.getByRole('button', { name: 'Post feedback' }).click();
  await expect(page.getByTestId('feedback-success')).toBeVisible();

  await page.goto('/community');
  const card = postCard(page, title);
  await expect(card).toBeVisible();
  await expect(card).toHaveAttribute('data-post-type', 'general');
});

test('admin: wrong password, then moderate a post (status → Planned, then delete)', async ({
  page,
}) => {
  await openBoard(page);
  const title = `E2E moderation ${uniqueSuffix()}`;
  const id = await createPost(page, title, 'game');

  await page.goto('/admin');
  await page.getByTestId('admin-password').fill('definitely-not-the-password');
  await page.getByTestId('admin-login').click();
  await expect(page.getByTestId('admin-login-error')).toBeVisible();
  await expect(page.getByTestId('admin-dashboard')).toHaveCount(0);

  await page.getByTestId('admin-password').fill(ADMIN_PASSWORD);
  await page.getByTestId('admin-login').click();
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();

  const row = page.getByTestId(`admin-post-${id}`);
  await expect(row).toContainText(title);
  await page.getByTestId(`admin-status-${id}`).selectOption('planned');
  await expect(page.getByTestId(`admin-status-${id}`)).toHaveValue('planned');
  await expect(page.getByTestId(`admin-status-${id}`)).toBeEnabled();

  await page.goto('/community');
  const card = page.getByTestId(`post-card-${id}`);
  await expect(card).toHaveAttribute('data-status', 'planned');
  await expect(card.locator('[data-status="planned"]')).toHaveText(/Planned/);

  // Delete it: gone from the board (and its page).
  await page.goto('/admin');
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();
  await page.getByTestId(`admin-delete-${id}`).click();
  await page.getByTestId('admin-confirm-delete').click();
  await expect(page.getByTestId(`admin-post-${id}`)).toHaveCount(0);

  await openBoard(page);
  await expect(
    page.getByTestId('post-list').locator('[data-testid^="post-card-"]').first(),
  ).toBeVisible();
  await expect(page.getByTestId(`post-card-${id}`)).toHaveCount(0);
  await page.goto(`/community/${id}`);
  await expect(page.getByTestId('post-not-found')).toBeVisible();
});
