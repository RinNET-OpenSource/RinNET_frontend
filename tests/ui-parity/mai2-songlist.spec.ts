import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const DB_VERSION = 6;
const PAGE_SIZE = 20;
const themes = ['light', 'dark'] as const;

const fakeAccount = {
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
  tokenType: 'Bearer',
};

const fakeUser = {
  id: 1,
  username: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.invalid',
  roles: [],
  games: ['maimai2'],
  cards: [
    {
      id: 1,
      extId: 10000001,
      luid: 'fixture-card',
      default: true,
      registerTime: '2026-01-01T00:00:00+08:00',
      accessTime: '2026-01-01T00:00:00+08:00',
      cardExternalList: [],
    },
  ],
  defaultCard: {
    id: 1,
    extId: 10000001,
    luid: 'fixture-card',
    default: true,
    registerTime: '2026-01-01T00:00:00+08:00',
    accessTime: '2026-01-01T00:00:00+08:00',
    cardExternalList: [],
  },
  keychips: [],
  userTrustKeychips: [],
  oauth2s: [],
};

function detail(
  id: number,
  levelDecimal: number,
  counts: [number, number, number, number, number],
  noteDesigner: string,
) {
  return {
    id,
    tapCount: counts[0],
    holdCount: counts[1],
    breakCount: counts[2],
    slideCount: counts[3],
    touchCount: counts[4],
    levelDecimal,
    noteDesigner,
    utageComment: '',
    utageKanji: '',
    tsuikaVersion: 0,
    diff: levelDecimal,
  };
}

const musicCatalog = [
  {
    musicId: 1,
    name: 'Fixture Alpha',
    artistName: 'Artist One',
    sortName: 'FIXTURE ALPHA',
    genreId: 105,
    romVersion: 3000,
    addVersion: 23,
    details: [
      detail(10, 30, [120, 20, 4, 30, 10], 'Designer BA'),
      detail(11, 70, [180, 30, 6, 45, 12], 'Designer AD'),
      detail(12, 105, [260, 45, 8, 75, 15], 'Designer EX'),
      detail(13, 132, [360, 65, 12, 110, 20], 'Designer MA'),
      detail(14, 140, [420, 75, 14, 130, 24], 'Designer Re:M'),
      null,
    ],
  },
  {
    musicId: 10002,
    name: 'Fixture Beta DX',
    artistName: 'Artist Two',
    sortName: 'FIXTURE BETA DX',
    genreId: 101,
    romVersion: 2000,
    addVersion: 20,
    details: [
      detail(20, 40, [100, 20, 4, 20, 8], 'Beta BA'),
      detail(21, 75, [150, 25, 5, 35, 10], 'Beta AD'),
      detail(22, 110, [220, 40, 7, 60, 14], 'Beta EX'),
      detail(23, 135, [340, 55, 10, 95, 18], 'Beta MA'),
      null,
      null,
    ],
  },
  {
    musicId: 100003,
    name: '宴星 Fixture Utage',
    artistName: 'Artist Three',
    sortName: 'FIXTURE UTAGE',
    genreId: 107,
    romVersion: 1000,
    addVersion: 19,
    details: [
      {
        ...detail(30, 142, [500, 80, 15, 150, 30], 'Utage Designer'),
        utageComment: 'Fixture comment',
        utageKanji: '星',
      },
      null,
      null,
      null,
      null,
      null,
    ],
  },
  ...Array.from({ length: 20 }, (_, index) => ({
    musicId: 20_000 + index,
    name: `Fixture Extra ${String(index + 1).padStart(2, '0')}`,
    artistName: 'Fixture Catalog Artist',
    sortName: `FIXTURE EXTRA ${String(index + 1).padStart(2, '0')}`,
    genreId: 104,
    romVersion: 900 - index,
    addVersion: index % 24,
    details: [
      detail(100 + index * 10, 40, [100, 20, 4, 20, 8], 'Extra BA'),
      detail(101 + index * 10, 75, [150, 25, 5, 35, 10], 'Extra AD'),
      detail(102 + index * 10, 110, [220, 40, 7, 60, 14], 'Extra EX'),
      detail(103 + index * 10, 135, [340, 55, 10, 95, 18], 'Extra MA'),
      null,
      null,
    ],
  })),
];

const songRecords = [
  {
    musicId: 1,
    level: 0,
    playCount: 2,
    achievement: 1005000,
    comboStatus: 1,
    syncStatus: 1,
    deluxscoreMax: 530,
    scoreRank: 8,
    extNum1: 0,
  },
  {
    musicId: 1,
    level: 1,
    playCount: 3,
    achievement: 1007500,
    comboStatus: 2,
    syncStatus: 2,
    deluxscoreMax: 790,
    scoreRank: 9,
    extNum1: 0,
  },
  {
    musicId: 1,
    level: 2,
    playCount: 4,
    achievement: 1009000,
    comboStatus: 3,
    syncStatus: 3,
    deluxscoreMax: 1170,
    scoreRank: 11,
    extNum1: 0,
  },
  {
    musicId: 1,
    level: 3,
    playCount: 5,
    achievement: 1010000,
    comboStatus: 4,
    syncStatus: 4,
    deluxscoreMax: 1680,
    scoreRank: 13,
    extNum1: 0,
  },
  {
    musicId: 1,
    level: 4,
    playCount: 1,
    achievement: 1002500,
    comboStatus: 0,
    syncStatus: 0,
    deluxscoreMax: 1900,
    scoreRank: 10,
    extNum1: 0,
  },
];

const ranking = [
  { username: 'RANK ONE', score: 1010000 },
  { username: 'RANK TWO', score: 1009500 },
  { username: 'RANK THREE', score: 1009000 },
  { username: 'RANK FOUR', score: 1008000 },
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
    } else if (url.pathname === '/api/game/maimai2/data/musicList') {
      body = musicCatalog;
    } else if (url.pathname === '/api/game/maimai2/song/1') {
      body = songRecords;
    } else if (url.pathname === '/api/game/maimai2/musicScoreRanking') {
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

async function installFixtureStorage(
  context: BrowserContext,
  theme: 'light' | 'dark',
  family: 'legacy' | 'liquefy' = 'legacy',
) {
  await context.addInitScript(
    ({ account, user, selectedTheme, selectedFamily, origins, dbVersion }) => {
      if (!origins.includes(window.location.origin)) return;
      localStorage.setItem('currentAccount', JSON.stringify(account));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('lang', 'zh');
      localStorage.setItem('colorTheme', selectedTheme);
      localStorage.setItem('themeFamily', selectedFamily);
      localStorage.setItem('dbVersion', String(dbVersion));
    },
    {
      account: fakeAccount,
      user: fakeUser,
      selectedTheme: theme,
      selectedFamily: family,
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
      if (!database.objectStoreNames.contains('maimai2Music')) {
        database.close();
        return false;
      }
      const count = await new Promise<number>((resolve, reject) => {
        const request = database.transaction('maimai2Music').objectStore('maimai2Music').count();
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
  await expect(page.locator('.card-btn.card')).toHaveCount(
    Math.min(PAGE_SIZE, musicCatalog.length),
    { timeout: 30_000 },
  );
  await expect(page.locator('.placeholder')).toHaveCount(0);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            const finish = () => {
              clearTimeout(timeout);
              resolve();
            };
            const timeout = window.setTimeout(finish, 5_000);
            image.addEventListener('load', finish, { once: true });
            image.addEventListener('error', finish, { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      }),
    );
    window.scrollTo(0, 0);
  });
}

async function settleDetail(page: Page, legacy: boolean) {
  const root = page.locator(legacy ? '.offcanvas.show' : '.maimai2-song-detail');
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

test.describe('Maimai2 song list visual parity', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of themes) {
    test(`list and read-only detail match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
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
        oldPage.goto(`${LEGACY_ORIGIN}/mai2/songlist`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/mai2/songlist`, { waitUntil: 'domcontentloaded' }),
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

      for (const page of [oldPage, newPage]) {
        await page.getByPlaceholder('搜索').fill('Beta');
        await expect(page.locator('.card-btn.card')).toHaveCount(1);
        await page.getByPlaceholder('搜索').fill('');
        await expect(page.locator('.card-btn.card')).toHaveCount(PAGE_SIZE);
        await page.locator('.pagination').first().getByText('2', { exact: true }).click();
        await expect(page.locator('.card-btn.card')).toHaveCount(musicCatalog.length - PAGE_SIZE);
        await page.locator('.pagination').first().getByText('1', { exact: true }).click();
        await expect(page.locator('.card-btn.card')).toHaveCount(PAGE_SIZE);
      }

      await Promise.all([
        oldPage.locator('.card-btn.card').first().click(),
        newPage.locator('.card-btn.card').first().click(),
      ]);
      await Promise.all([settleDetail(oldPage, true), settleDetail(newPage, false)]);
      expect(blockedBusinessWrites, 'Detail interaction must remain read-only').toEqual([]);

      const [oldDetail, newDetail] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldDetail, newDetail, testInfo, 'detail');

      const oldDetailRoot = oldPage.locator('.offcanvas.show');
      const newDetailRoot = newPage.locator('.maimai2-song-detail');
      await Promise.all([
        oldDetailRoot.getByRole('tab', { name: 'BA', exact: true }).click(),
        newDetailRoot.getByRole('tab', { name: 'BA', exact: true }).click(),
      ]);
      await Promise.all([
        expect(oldDetailRoot.getByRole('tab', { name: 'BA', exact: true })).toHaveClass(/active/),
        expect(newDetailRoot.getByRole('tab', { name: 'BA', exact: true })).toHaveClass(/active/),
      ]);
      await oldDetailRoot.locator('#nav-ba.show.active').waitFor({ state: 'visible' });
      await oldPage.waitForTimeout(200);
      await Promise.all(
        [oldDetailRoot, newDetailRoot].map((root) =>
          root.locator('.offcanvas-body').evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          }),
        ),
      );
      await oldPage.waitForTimeout(50);
      const [oldDetailLower, newDetailLower] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldDetailLower, newDetailLower, testInfo, 'detail-lower');
      expect(blockedBusinessWrites, 'Difficulty-tab interaction must remain read-only').toEqual([]);
      await context.close();
    });
  }

  test('Liquefy theme keeps the song browser and detail interaction functional', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const blockedBusinessWrites = await installFixtureApi(context);
    await installFixtureStorage(context, 'light', 'liquefy');
    const page = await context.newPage();
    await page.goto(`${REACT_ORIGIN}/mai2/songlist`, { waitUntil: 'domcontentloaded' });
    await waitForCatalog(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settleList(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');

    await page.getByRole('button', { name: '流派' }).click();
    await page.getByRole('button', { name: '版本' }).click();
    await expect(page.locator('#collapseOne')).toHaveClass(/show/);
    await expect(page.locator('#collapseTwo')).toHaveClass(/show/);

    await page.locator('.card-btn.card').first().click();
    await settleDetail(page, false);
    await page.locator('.maimai2-song-detail .btn-close').click();
    await expect(page.locator('.maimai2-song-detail')).toHaveCount(0);
    expect(blockedBusinessWrites, 'Liquefy-theme interactions must remain read-only').toEqual([]);
    await context.close();
  });
});
