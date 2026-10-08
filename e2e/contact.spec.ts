/**
 * /contact: the creator's GitHub and email (mailto + copy to clipboard), and the contact
 * form, whose message then shows up in the admin Messages tab.
 */
import { expect, test } from '@playwright/test';
import { uniqueSuffix } from './helpers';

test.use({ actionTimeout: 15_000 });

const EMAIL = 'shikharpratap7@gmail.com';

test('@mobile GitHub and email links, and Copy email puts the address on the clipboard', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/contact');

  const main = page.getByRole('main');
  const github = main.getByRole('link', { name: 'GitHub profile (opens in a new tab)' });
  await expect(github).toBeVisible();
  await expect(github).toHaveAttribute('href', 'https://github.com/Glitchrex');
  await expect(github).toHaveAttribute('target', '_blank');
  await expect(github).toHaveAttribute('rel', /\bnoopener\b/);

  const email = page.getByTestId('contact-email');
  await expect(email).toHaveAttribute('href', `mailto:${EMAIL}`);
  await expect(email).toContainText(EMAIL);

  await page.evaluate(() => navigator.clipboard.writeText(''));
  await page.getByTestId('copy-email').click();
  await expect(page.getByTestId('toast').filter({ hasText: 'Email copied!' })).toBeVisible();
  await expect(page.getByTestId('copy-email')).toHaveText(/Copied!/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(EMAIL);
});

test('the contact form sends a message that the admin can read', async ({ page }) => {
  await page.goto('/contact');
  const form = page.getByTestId('contact-form');
  const name = `E2E Tester ${uniqueSuffix()}`;
  const message = `Hello from the end-to-end suite! Reference ${uniqueSuffix()}.`;

  // Too short a message is explained first.
  await form.getByLabel('Your name').fill(name);
  await form.getByLabel('Your email').fill('e2e.tester@example.com');
  await form.getByLabel('Message').fill('Hi');
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(form.getByLabel('Message')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByTestId('contact-success')).toHaveCount(0);

  await form.getByLabel('Message').fill(message);
  await form.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByTestId('contact-success')).toBeVisible();
  await expect(page.getByTestId('contact-success')).toContainText(
    "Message sent! I'll get back to you soon.",
  );

  await page.goto('/admin');
  await page.getByTestId('admin-password').fill('e2e-admin-password');
  await page.getByTestId('admin-login').click();
  await expect(page.getByTestId('admin-dashboard')).toBeVisible();
  await page.getByTestId('admin-tab-messages').click();
  const row = page.locator('[data-testid^="admin-message-"]').filter({ hasText: message });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(name);
  await expect(row).toContainText('e2e.tester@example.com');
  await expect(row).toHaveAttribute('data-read', 'false');
});
