import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'off',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    channel: 'chrome',
  },
  webServer: [
    {
      command: 'pnpm --filter backend run start',
      url: 'http://localhost:3000/api/me',
      reuseExistingServer: true,
      timeout: 180_000,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter frontend run dev',
      url: 'http://localhost:5173/login.html',
      reuseExistingServer: true,
      timeout: 120_000,
      cwd: '../..',
    },
  ],
});
