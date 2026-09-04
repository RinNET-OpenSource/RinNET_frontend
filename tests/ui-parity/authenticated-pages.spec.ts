import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const DASHBOARD_READY_TIMEOUT_MS = 60_000;
const VISUAL_STABILITY_DELAY_MS = 300;
const themes = ['light', 'dark'] as const;

const username = process.env.UI_TEST_USERNAME;
const password = process.env.UI_TEST_PASSWORD;
const credentials = username && password ? { username, password } : null;

interface SignInResponse {
  data?: unknown;
  status?: {
    code?: number;
  };
}

interface DbVersionResponse {
  version?: {
    major?: number;
  };
}

function dashboardRoot(page: Page) {
  return page.locator('h1.page-heading').locator('..');
}

async function dashboardSnapshot(page: Page) {
  return dashboardRoot(page).evaluate((content) => ({
    height: Math.round(content.getBoundingClientRect().height),
    images: Array.from(content.querySelectorAll('img'), (image) => ({
      complete: image.complete,
      height: image.naturalHeight,
      src: image.currentSrc,
      width: image.naturalWidth,
    })),
    placeholders: content.querySelectorAll('.placeholder').length,
    text: (content.textContent ?? '').replace(/\s+/g, ' ').trim(),
  }));
}

async function dashboardRect(page: Page) {
  return dashboardRoot(page).evaluate((content) => {
    const rect = content.getBoundingClientRect();
    return {
      height: Math.round(rect.height * 100) / 100,
      width: Math.round(rect.width * 100) / 100,
      x: Math.round(rect.x * 100) / 100,
      y: Math.round(rect.y * 100) / 100,
    };
  });
}

async function settlePage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('h1.page-heading').waitFor({ state: 'visible' });

  const dashboard = dashboardRoot(page);
  await expect(dashboard.locator('h3')).toHaveCount(3, { timeout: DASHBOARD_READY_TIMEOUT_MS });
  await expect(dashboard.locator('.list-group-item')).toHaveCount(2, {
    timeout: DASHBOARD_READY_TIMEOUT_MS,
  });
  await expect(dashboard.locator('.placeholder')).toHaveCount(0, {
    timeout: DASHBOARD_READY_TIMEOUT_MS,
  });
  await dashboard.locator('h3 + code').waitFor({
    state: 'visible',
    timeout: DASHBOARD_READY_TIMEOUT_MS,
  });
  await dashboard.locator('.profile-table').first().waitFor({
    state: 'visible',
    timeout: DASHBOARD_READY_TIMEOUT_MS,
  });
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, {
    timeout: DASHBOARD_READY_TIMEOUT_MS,
  });
  await expect(dashboard.locator('.col-lg-4 .spinner-border')).toHaveCount(0, {
    timeout: DASHBOARD_READY_TIMEOUT_MS,
  });

  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            const finish = () => {
              window.clearTimeout(timeoutId);
              image.removeEventListener('load', finish);
              image.removeEventListener('error', finish);
              resolve();
            };
            const timeoutId = window.setTimeout(finish, 5_000);
            image.addEventListener('load', finish, { once: true });
            image.addEventListener('error', finish, { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      }),
    );
    window.scrollTo(0, 0);
  });

  const before = await dashboardSnapshot(page);
  await page.waitForTimeout(VISUAL_STABILITY_DELAY_MS);
  const after = await dashboardSnapshot(page);
  expect(after, 'Dashboard content must remain stable before capture').toEqual(before);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0);
  await expect(dashboard.locator('.placeholder')).toHaveCount(0);
}

async function saveComparison(oldBuffer: Buffer, newBuffer: Buffer, testInfo: TestInfo) {
  const oldImage = PNG.sync.read(oldBuffer);
  const newImage = PNG.sync.read(newBuffer);

  expect(
    { width: newImage.width, height: newImage.height },
    'Legacy and React screenshots must have identical dimensions',
  ).toEqual({ width: oldImage.width, height: oldImage.height });

  const diff = new PNG({ width: oldImage.width, height: oldImage.height });
  const mismatchedPixels = pixelmatch(
    oldImage.data,
    newImage.data,
    diff.data,
    oldImage.width,
    oldImage.height,
    { includeAA: false, threshold: 0.1 },
  );
  const diffRatio = mismatchedPixels / (oldImage.width * oldImage.height);

  const oldPath = path.join(testInfo.outputDir, 'old.png');
  const newPath = path.join(testInfo.outputDir, 'new.png');
  const diffPath = path.join(testInfo.outputDir, 'diff.png');
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(oldPath, oldBuffer),
    fs.writeFile(newPath, newBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
  ]);

  await Promise.all([
    testInfo.attach('old', { path: oldPath, contentType: 'image/png' }),
    testInfo.attach('new', { path: newPath, contentType: 'image/png' }),
    testInfo.attach('diff', { path: diffPath, contentType: 'image/png' }),
  ]);

  expect(
    diffRatio,
    `Visual difference ${(diffRatio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`,
  ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

test.describe('authenticated dashboard visual parity', () => {
  test.describe.configure({ timeout: 120_000 });

  test.skip(
    credentials === null,
    'Set UI_TEST_USERNAME and UI_TEST_PASSWORD to run authenticated UI parity tests.',
  );

  let account: unknown;
  let databaseVersion = 0;

  test.beforeAll(async ({ request }) => {
    if (!credentials) return;

    const [response, versionResponse] = await Promise.all([
      request.post(`${REACT_ORIGIN}/api/auth/signin`, {
        data: {
          usernameOrEmail: credentials.username,
          password: credentials.password,
        },
      }),
      request.get(`${REACT_ORIGIN}/api/static/dbVersion`),
    ]);
    expect(response.ok(), 'The React-origin sign-in request must succeed').toBeTruthy();
    expect(versionResponse.ok(), 'The database-version request must succeed').toBeTruthy();

    const signInResponse = (await response.json()) as SignInResponse;
    const dbVersionResponse = (await versionResponse.json()) as DbVersionResponse;
    expect(signInResponse.status?.code, 'The sign-in response must have status code 92001').toBe(92001);
    expect(signInResponse.data, 'The sign-in response must include an account').toBeTruthy();
    expect(dbVersionResponse.version?.major, 'The database version must be available').toBeGreaterThan(0);
    account = signInResponse.data;
    databaseVersion = dbVersionResponse.version?.major ?? 0;
  });

  for (const theme of themes) {
    test(`dashboard matches the Angular baseline in ${theme} mode`, async ({ browser }, testInfo) => {
      expect(account, 'Authenticated account was not initialized').toBeTruthy();

      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
        viewport: { width: 1280, height: 720 },
      });
      const unexpectedBusinessWrites: string[] = [];

      // Dashboard parity does not depend on the large game-catalog payloads. Make
      // both apps reach the same completed preload state quickly and deterministically,
      // while ensuring the real authenticated account cannot issue browser-side writes.
      await context.route('**/*', async (route) => {
        const request = route.request();
        const url = new URL(request.url());
        const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;
        const isBusinessRequest =
          isPortal &&
          (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));

        if (isBusinessRequest && request.method() !== 'GET') {
          unexpectedBusinessWrites.push(`${request.method()} ${url.pathname}`);
          await route.abort('blockedbyclient');
          return;
        }

        if (
          !isPortal ||
          request.method() !== 'GET' ||
          !/^\/api\/game\/.*\/data\//.test(url.pathname)
        ) {
          await route.continue();
          return;
        }

        await route.fulfill({
          body: '[]',
          contentType: 'application/json',
          status: 200,
        });
      });
      await context.addInitScript(
        ({ authenticatedAccount, selectedTheme, allowedOrigins, selectedDatabaseVersion }) => {
          if (!allowedOrigins.includes(window.location.origin)) return;
          localStorage.setItem('currentAccount', JSON.stringify(authenticatedAccount));
          localStorage.setItem('lang', 'zh');
          localStorage.setItem('colorTheme', selectedTheme);
          localStorage.setItem('themeFamily', 'legacy');
          localStorage.setItem('dbVersion', String(selectedDatabaseVersion));
        },
        {
          authenticatedAccount: account,
          selectedTheme: theme,
          allowedOrigins: [LEGACY_ORIGIN, REACT_ORIGIN],
          selectedDatabaseVersion: databaseVersion,
        },
      );

      const oldPage = await context.newPage();
      const newPage = await context.newPage();

      await Promise.all([
        oldPage.goto(`${LEGACY_ORIGIN}/dashboard`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/dashboard`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settlePage(oldPage), settlePage(newPage)]);

      await expect(oldPage).toHaveURL(`${LEGACY_ORIGIN}/dashboard`);
      await expect(newPage).toHaveURL(`${REACT_ORIGIN}/dashboard`);
      expect(
        unexpectedBusinessWrites,
        'Dashboard parity must not attempt browser-side writes with the real account',
      ).toEqual([]);

      const [oldDashboardRect, newDashboardRect] = await Promise.all([
        dashboardRect(oldPage),
        dashboardRect(newPage),
      ]);
      expect(newDashboardRect, 'Dashboard root geometry must match the Angular baseline').toEqual(
        oldDashboardRect,
      );

      const [oldBuffer, newBuffer] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);

      await saveComparison(oldBuffer, newBuffer, testInfo);
      await context.close();
    });
  }
});
