import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const DB_VERSION = 6;
const themes = ['light', 'dark'] as const;

const fakeAccount = {
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
  tokenType: 'Bearer',
};

const fixtureCard = {
  id: 1,
  extId: 10000001,
  luid: 'fixture-chuni-card',
  default: true,
  registerTime: '2026-01-01T00:00:00+08:00',
  accessTime: '2026-01-01T00:00:00+08:00',
  cardExternalList: [],
};

const fakeUser = {
  id: 1,
  username: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.invalid',
  roles: [],
  games: ['chusan'],
  cards: [fixtureCard],
  defaultCard: fixtureCard,
  keychips: [],
  userTrustKeychips: [],
  oauth2s: [],
};

function level(enable: boolean, value: number, decimal: number) {
  return { enable, level: value, levelDecimal: decimal, diff: value * 10 + decimal };
}

const musicCatalog = [
  {
    musicId: 1,
    name: 'Fixture Alpha',
    sotrName: 'FIXTURE ALPHA',
    artistName: 'Artist One',
    genre: 'ORIGINAL',
    releaseVersion: 'v2 2.30.00',
    levels: {
      0: level(true, 3, 0),
      1: level(true, 7, 5),
      2: level(true, 11, 2),
      3: level(true, 14, 7),
      4: level(true, 15, 0),
      5: level(false, 0, 0),
    },
  },
  {
    musicId: 2,
    name: 'Fixture Beta',
    sotrName: 'FIXTURE BETA',
    artistName: 'Artist Two',
    genre: 'POPS_ANIME',
    releaseVersion: 'v2 2.25.00',
    levels: {
      0: level(true, 2, 0),
      1: level(true, 6, 0),
      2: level(true, 10, 5),
      3: level(true, 13, 4),
      4: level(false, 0, 0),
      5: level(false, 0, 0),
    },
  },
  {
    musicId: 3,
    name: 'Fixture Gamma',
    sotrName: 'FIXTURE GAMMA',
    artistName: 'Artist Three',
    genre: 'GEKICHUMA',
    releaseVersion: 'v2 2.20.00',
    levels: {
      0: level(true, 4, 0),
      1: level(true, 8, 3),
      2: level(true, 12, 0),
      3: level(true, 14, 3),
      4: level(false, 0, 0),
      5: level(false, 0, 0),
    },
  },
];

const songRecords = [0, 1, 2, 3, 4].map((difficulty) => ({
  musicId: 1,
  level: difficulty,
  playCount: difficulty + 1,
  scoreMax: 1_005_000 + difficulty * 1_000,
  missCount: 0,
  maxComboCount: 500 + difficulty,
  isFullCombo: true,
  isAllJustice: difficulty >= 3,
  isSuccess: 1,
  fullChain: 0,
  maxChain: 0,
  scoreRank: 13,
  isLock: false,
  theoryCount: 0,
  ext1: 0,
  ranking: { rank: difficulty + 1, playedCount: 42 },
}));

const ranking = [
  { username: 'RANK ONE', score: 1_010_000 },
  { username: 'RANK TWO', score: 1_009_500 },
  { username: 'RANK THREE', score: 1_009_000 },
  { username: 'RANK FOUR', score: 1_008_000 },
];

async function installFixtureApi(context: BrowserContext) {
  const blockedBusinessWrites: string[] = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;
    const isBusinessApi =
      isPortal && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));

    if (request.method() !== 'GET' && isBusinessApi) {
      blockedBusinessWrites.push(`${request.method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }

    if (!isPortal || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    let body: unknown;
    if (url.pathname === '/api/account/status') {
      body = {
        data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' },
        status: { code: 92001 },
      };
    } else if (url.pathname === '/api/user/me') {
      body = { data: fakeUser, status: { code: 92001 } };
    } else if (url.pathname === '/api/static/dbVersion') {
      body = { state: 'Success', version: { major: DB_VERSION } };
    } else if (url.pathname === '/api/game/chuni/v2/data/music') {
      body = musicCatalog;
    } else if (url.pathname === '/api/game/chuni/v2/song/1') {
      body = songRecords;
    } else if (url.pathname === '/api/game/chuni/v2/musicScoreRanking') {
      body = ranking;
    } else if (/^\/api\/game\/.*\/data\//.test(url.pathname)) {
      body = [];
    } else {
      body = { data: null, status: { code: 92001 } };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  return blockedBusinessWrites;
}

async function installFixtureStorage(context: BrowserContext, theme: 'light' | 'dark') {
  await context.addInitScript(
    ({ account, user, selectedTheme, origins, dbVersion }) => {
      if (!origins.includes(window.location.origin)) return;
      localStorage.setItem('currentAccount', JSON.stringify(account));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('lang', 'zh');
      localStorage.setItem('colorTheme', selectedTheme);
      localStorage.setItem('themeFamily', 'legacy');
      localStorage.setItem('dbVersion', String(dbVersion));
    },
    {
      account: fakeAccount,
      user: fakeUser,
      selectedTheme: theme,
      origins: [LEGACY_ORIGIN, REACT_ORIGIN],
      dbVersion: DB_VERSION,
    },
  );
}

async function waitForCatalog(page: Page) {
  await page.waitForFunction(
    async (expected) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('Aqua');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      if (!database.objectStoreNames.contains('chusanMusic')) {
        database.close();
        return false;
      }
      const count = await new Promise<number>((resolve, reject) => {
        const request = database.transaction('chusanMusic').objectStore('chusanMusic').count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      database.close();
      return count === expected;
    },
    musicCatalog.length,
    { timeout: 30_000 },
  );
}

async function settleList(page: Page) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('.card-btn.card')).toHaveCount(musicCatalog.length, { timeout: 30_000 });
  await expect(page.locator('.placeholder')).toHaveCount(0);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
    window.scrollTo(0, 0);
  });
}

async function settleDetail(page: Page, legacy: boolean) {
  const root = page.locator(
    legacy ? '.offcanvas.show' : '.chuni-v2-song-score-ranking-panel[data-state="open"]',
  );
  await root.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(root.locator('section > .card')).toHaveCount(5, { timeout: 30_000 });
  await expect(root.locator('.tab-pane.show.active > table tbody tr')).toHaveCount(ranking.length, {
    timeout: 30_000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
  });
}

async function saveComparison(
  oldBuffer: Buffer,
  newBuffer: Buffer,
  testInfo: TestInfo,
  label: string,
) {
  const oldImage = PNG.sync.read(oldBuffer);
  const newImage = PNG.sync.read(newBuffer);
  expect({ width: newImage.width, height: newImage.height }).toEqual({
    width: oldImage.width,
    height: oldImage.height,
  });

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
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  const oldPath = path.join(testInfo.outputDir, `${label}-old.png`);
  const newPath = path.join(testInfo.outputDir, `${label}-new.png`);
  const diffPath = path.join(testInfo.outputDir, `${label}-diff.png`);
  await Promise.all([
    fs.writeFile(oldPath, oldBuffer),
    fs.writeFile(newPath, newBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
  ]);
  await testInfo.attach(`${label}-old`, { path: oldPath, contentType: 'image/png' });
  await testInfo.attach(`${label}-new`, { path: newPath, contentType: 'image/png' });
  await testInfo.attach(`${label}-diff`, { path: diffPath, contentType: 'image/png' });
  expect(
    diffRatio,
    `${label} visual difference ${(diffRatio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`,
  ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

test.describe('Chunithm v2 song pages visual parity', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of themes) {
    test(`list and read-only ranking match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
        viewport: { width: 1280, height: 720 },
      });
      const blockedBusinessWrites = await installFixtureApi(context);
      await installFixtureStorage(context, theme);

      const oldPage = await context.newPage();
      const newPage = await context.newPage();
      await Promise.all([
        oldPage.goto(`${LEGACY_ORIGIN}/chuni/v2/song`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/chuni/v2/song`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForCatalog(oldPage), waitForCatalog(newPage)]);
      await Promise.all([
        oldPage.reload({ waitUntil: 'domcontentloaded' }),
        newPage.reload({ waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settleList(oldPage), settleList(newPage)]);
      expect(blockedBusinessWrites, 'No Portal business write may be attempted').toEqual([]);

      const [oldList, newList] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldList, newList, testInfo, 'list');

      await Promise.all([
        oldPage.locator('.card-btn.card').first().click(),
        newPage.locator('.card-btn.card').first().click(),
      ]);
      await Promise.all([settleDetail(oldPage, true), settleDetail(newPage, false)]);
      expect(blockedBusinessWrites, 'Ranking interaction must remain read-only').toEqual([]);

      const [oldDetail, newDetail] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldDetail, newDetail, testInfo, 'ranking');

      const oldRoot = oldPage.locator('.offcanvas.show');
      const newRoot = newPage.locator('.chuni-v2-song-score-ranking-panel[data-state="open"]');
      await Promise.all([
        oldRoot.getByRole('tab', { name: 'BA', exact: true }).click(),
        newRoot.getByRole('tab', { name: 'BA', exact: true }).click(),
      ]);
      await Promise.all([
        expect(oldRoot.getByRole('tab', { name: 'BA', exact: true })).toHaveClass(/active/),
        expect(newRoot.getByRole('tab', { name: 'BA', exact: true })).toHaveClass(/active/),
      ]);
      expect(blockedBusinessWrites, 'Difficulty-tab interaction must remain read-only').toEqual([]);
      await context.close();
    });
  }

  test('React filters the catalog without a business write', async ({ browser }) => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      viewport: { width: 1280, height: 720 },
    });
    const blockedBusinessWrites = await installFixtureApi(context);
    await installFixtureStorage(context, 'light');
    const page = await context.newPage();
    await page.goto(`${REACT_ORIGIN}/chuni/v2/song`, { waitUntil: 'domcontentloaded' });
    await waitForCatalog(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settleList(page);
    await page.getByText('显示过滤', { exact: true }).click();
    await expect(page.locator('#filterCollapse')).toBeVisible();
    await page.getByPlaceholder('ID, 曲名, 作者').fill('Beta');
    await expect(page.locator('.card-btn.card')).toHaveCount(1);
    expect(blockedBusinessWrites, 'Filtering must remain local and read-only').toEqual([]);
    await context.close();
  });

  test('direct ranking route opens the requested chart without a write', async ({ browser }) => {
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      viewport: { width: 1280, height: 720 },
    });
    const blockedBusinessWrites = await installFixtureApi(context);
    await installFixtureStorage(context, 'light');
    const page = await context.newPage();
    await page.goto(`${REACT_ORIGIN}/chuni/v2/song`, { waitUntil: 'domcontentloaded' });
    await waitForCatalog(page);
    await page.goto(`${REACT_ORIGIN}/chuni/v2/song/ranking/1/2`, { waitUntil: 'domcontentloaded' });
    const root = page.locator('.chuni-v2-song-score-ranking-panel[data-state="open"]');
    await root.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(root.getByRole('tab', { name: 'EX', exact: true })).toHaveClass(/active/);
    expect(blockedBusinessWrites, 'Direct ranking route must remain read-only').toEqual([]);
    await context.close();
  });
});
