import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45000,
  expect: { timeout: 10000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3100',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
  ],
  webServer: process.env.PLAYWRIGHT_EXTERNAL_SERVER
    ? undefined
    : {
        command: 'corepack pnpm exec next dev --port 3100',
        url: 'http://localhost:3100',
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
        env: {
          DATA_MODE: process.env.E2E_DATA_MODE || 'fixture',
          ALLOW_TEST_ORDERS: 'true',
          EMAIL_MODE: 'capture',
          NEXT_PUBLIC_SITE_URL: 'http://localhost:3100',
          FIXTURE_ORDER_FILE: '.data/e2e-orders.json',
        },
      },
});
