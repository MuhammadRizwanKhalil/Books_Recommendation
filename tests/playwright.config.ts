import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: '../playwright-report' }], ['list']],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    cwd: '../app',
    reuseExistingServer: true,
    timeout: 120_000,
    url: 'http://127.0.0.1:4173',
  },

  use: {
    baseURL: process.env.BASE_URL || process.env.TEST_BASE_URL || 'http://127.0.0.1:4173',
    storageState: './fixtures/storage/e2e-no-analytics.json',
    extraHTTPHeaders: {
      DNT: '1',
      'X-E2E-Test': '1',
    },
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'] },
    },
  ],
});
