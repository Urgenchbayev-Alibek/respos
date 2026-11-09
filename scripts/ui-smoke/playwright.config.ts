import { defineConfig, devices } from '@playwright/test';
import { ADMIN_URL } from './support/env';

/**
 * Browser smoke against REAL running servers (no mocks): API :5080, admin :5173, landing :5174.
 * Sequential on purpose: refresh tokens rotate (reuse => family revoked) and sessions are chained
 * between tests through `.auth/<role>.json` (see support/session.ts).
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: ADMIN_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    locale: 'ru-RU',
    timezoneId: 'Asia/Tashkent',
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
