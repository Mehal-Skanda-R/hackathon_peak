import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser',
  timeout: 60_000,
  workers: 1,
  use: {
    browserName: 'chromium', baseURL: 'http://127.0.0.1:5174', headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
  },
});
