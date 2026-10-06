import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://127.0.0.1:${PORT}`;
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], viewport: { width: 375, height: 812 } },
      grep: /@mobile/,
    },
  ],
  webServer: {
    command: `rm -f data/e2e.db data/e2e.db-* && npm run build && npx next start -p ${PORT} -H 127.0.0.1`,
    url: baseURL,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI && !!process.env.E2E_REUSE,
    env: {
      DATABASE_URL: 'file:./data/e2e.db',
      ADMIN_PASSWORD: 'e2e-admin-password',
      APP_SECRET: 'e2e-secret-e2e-secret-e2e-secret',
      NEXT_PUBLIC_SITE_URL: baseURL,
      RATE_LIMIT_PER_MINUTE: '1000',
      E2E: '1',
    },
  },
});
