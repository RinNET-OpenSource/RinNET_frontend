import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/features',
  outputDir: './test-results/features',
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  expect: {
    timeout: 5_000,
  },
  use: {
    baseURL: 'https://localhost:5174',
    channel: 'chrome',
    deviceScaleFactor: 1,
    headless: true,
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
    serviceWorkers: 'block',
    timezoneId: 'Asia/Shanghai',
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort',
    url: 'https://localhost:5174/',
    ignoreHTTPSErrors: true,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
