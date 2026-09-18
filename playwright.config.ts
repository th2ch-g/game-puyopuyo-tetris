import { defineConfig, devices } from '@playwright/test';

const webkit = process.env.PLAYWRIGHT_BROWSER === 'webkit';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: 'list',
  use: {
    actionTimeout: 15_000,
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: webkit ? {} : { channel: process.env.PLAYWRIGHT_CHANNEL },
  },
  projects: [
    {
      name: webkit ? 'webkit' : 'chromium',
      use: { ...devices[webkit ? 'Desktop Safari' : 'Desktop Chrome'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run preview -- --port 4173',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
      },
});
