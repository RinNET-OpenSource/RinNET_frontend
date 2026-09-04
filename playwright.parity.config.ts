import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/ui-parity',
  outputDir: './test-results/ui-parity',
  fullyParallel: false,
  workers: 1,
  reporter: [['line']],
  expect: {
    timeout: 5_000,
  },
  use: {
    channel: 'chrome',
    deviceScaleFactor: 1,
    headless: true,
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
    serviceWorkers: 'block',
    timezoneId: 'Asia/Hong_Kong',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'npm run parity:legacy-server',
      url: 'https://portal.naominet.live:4201/',
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command:
        'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5173 --strictPort',
      url: 'https://portal.naominet.live:5173/',
      ignoreHTTPSErrors: true,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
