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
  luid: 'fixture-maimai-card',
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
  games: ['maimai2'],
  cards: [fixtureCard],
  defaultCard: fixtureCard,
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
];

const recentRows = [
  {
    orderId: 1,
    playlogId: 101,
    version: 3000,
    placeId: 1,
    placeName: 'Fixture Arcade',
    loginDate: 0,
    playDate: '2026-08-31T12:00:00+08:00',
    userPlayDate: '2026-08-31T12:00:00+08:00',
    type: 1,
    musicId: 1,
    level: 3,
    trackNo: 1,
    vsMode: 0,
    vsUserName: '',
    vsStatus: 0,
    vsUserRating: 0,
    vsUserAchievement: 0,
    vsUserGradeRank: 0,
    vsRank: 0,
    playerNum: 1,
    playedUserId1: 0,
    playedUserName1: '',
    playedMusicLevel1: 0,
    playedUserId2: 0,
    playedUserName2: '',
    playedMusicLevel2: 0,
    playedUserId3: 0,
    playedUserName3: '',
    playedMusicLevel3: 0,
    achievement: 1_009_500,
    deluxscore: 1_650,
    scoreRank: 13,
    maxCombo: 558,
    totalCombo: 567,
    maxSync: 0,
    totalSync: 0,
    tapCriticalPerfect: 350,
    tapPerfect: 7,
    tapGreat: 2,
    tapGood: 1,
    tapMiss: 0,
    holdCriticalPerfect: 62,
    holdPerfect: 2,
    holdGreat: 1,
    holdGood: 0,
    holdMiss: 0,
    slideCriticalPerfect: 105,
    slidePerfect: 3,
    slideGreat: 2,
    slideGood: 0,
    slideMiss: 0,
    touchCriticalPerfect: 19,
    touchPerfect: 1,
    touchGreat: 0,
    touchGood: 0,
    touchMiss: 0,
    breakCriticalPerfect: 11,
    breakPerfect: 1,
    breakGreat: 0,
    breakGood: 0,
    breakMiss: 0,
    isTap: true,
    isHold: true,
    isSlide: true,
    isTouch: true,
    isBreak: true,
    isCriticalDisp: true,
    isFastLateDisp: true,
    fastCount: 3,
    lateCount: 7,
    isAchieveNewRecord: true,
    isDeluxscoreNewRecord: false,
    comboStatus: 3,
    syncStatus: 0,
    isClear: true,
    beforeRating: 14500,
    afterRating: 14512,
  },
  {
    orderId: 2,
    playlogId: 102,
    version: 3000,
    placeId: 1,
    placeName: 'Fixture Arcade',
    loginDate: 0,
    playDate: '2026-08-30T09:30:00+08:00',
    userPlayDate: '2026-08-30T09:30:00+08:00',
    type: 1,
    musicId: 10002,
    level: 2,
    trackNo: 2,
    vsMode: 1,
    vsUserName: 'PLAYER TWO',
    vsStatus: 1,
    vsUserRating: 14000,
    vsUserAchievement: 990000,
    vsUserGradeRank: 1,
    vsRank: 1,
    playerNum: 2,
    playedUserId1: 2,
    playedUserName1: 'PLAYER TWO',
    playedMusicLevel1: 2,
    playedUserId2: 0,
    playedUserName2: '',
    playedMusicLevel2: 0,
    playedUserId3: 0,
    playedUserName3: '',
    playedMusicLevel3: 0,
    achievement: 987_654,
    deluxscore: 980,
    scoreRank: 9,
    maxCombo: 320,
    totalCombo: 341,
    maxSync: 310,
    totalSync: 341,
    tapCriticalPerfect: 205,
    tapPerfect: 10,
    tapGreat: 4,
    tapGood: 1,
    tapMiss: 0,
    holdCriticalPerfect: 37,
    holdPerfect: 2,
    holdGreat: 1,
    holdGood: 0,
    holdMiss: 0,
    slideCriticalPerfect: 55,
    slidePerfect: 3,
    slideGreat: 2,
    slideGood: 0,
    slideMiss: 0,
    touchCriticalPerfect: 13,
    touchPerfect: 1,
    touchGreat: 0,
    touchGood: 0,
    touchMiss: 0,
    breakCriticalPerfect: 9,
    breakPerfect: 1,
    breakGreat: 0,
    breakGood: 0,
    breakMiss: 0,
    isTap: true,
    isHold: true,
    isSlide: true,
    isTouch: true,
    isBreak: true,
    isCriticalDisp: true,
    isFastLateDisp: true,
    fastCount: 12,
    lateCount: 18,
    isAchieveNewRecord: false,
    isDeluxscoreNewRecord: false,
    comboStatus: 0,
    syncStatus: 2,
    isClear: true,
    beforeRating: 14000,
    afterRating: 14003,
  },
];

const songRecords = [
  { musicId: 1, level: 0, playCount: 2, achievement: 1005000, comboStatus: 1, syncStatus: 1, deluxscoreMax: 530, scoreRank: 8, extNum1: 0 },
  { musicId: 1, level: 1, playCount: 3, achievement: 1007500, comboStatus: 2, syncStatus: 2, deluxscoreMax: 790, scoreRank: 9, extNum1: 0 },
  { musicId: 1, level: 2, playCount: 4, achievement: 1009000, comboStatus: 3, syncStatus: 3, deluxscoreMax: 1170, scoreRank: 11, extNum1: 0 },
  { musicId: 1, level: 3, playCount: 5, achievement: 1010000, comboStatus: 4, syncStatus: 4, deluxscoreMax: 1680, scoreRank: 13, extNum1: 0 },
  { musicId: 1, level: 4, playCount: 1, achievement: 1002500, comboStatus: 0, syncStatus: 0, deluxscoreMax: 1900, scoreRank: 10, extNum1: 0 },
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
    const isBusinessApi = isPortal && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));
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
      body = { data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' }, status: { code: 92001 } };
    } else if (url.pathname === '/api/user/me') {
      body = { data: fakeUser, status: { code: 92001 } };
    } else if (url.pathname === '/api/static/dbVersion') {
      body = { state: 'Success', version: { major: DB_VERSION } };
    } else if (url.pathname === '/api/game/maimai2/data/musicList') {
      body = musicCatalog;
    } else if (url.pathname === '/api/game/maimai2/recent') {
      body = { content: recentRows, page: 0, totalElements: recentRows.length, totalPages: 1 };
    } else if (url.pathname === '/api/game/maimai2/rating') {
      body = { data: '1:3:3000:1009500,10002:2:2000:995000' };
    } else if (url.pathname === '/api/game/maimai2/new_rating') {
      body = { data: '1:4:3000:1005000,10002:3:2000:1000000' };
    } else if (url.pathname === '/api/game/maimai2/song/1') {
      body = songRecords;
    } else if (url.pathname === '/api/game/maimai2/song/10002') {
      body = songRecords.map((item) => ({ ...item, musicId: 10002 })).filter((item) => item.level < 4);
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

async function settle(page: Page, selector: string, count: number) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator(selector)).toHaveCount(count, { timeout: 30_000 });
  await expect(page.locator('.placeholder')).toHaveCount(0);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: 30_000 },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
    window.scrollTo(0, 0);
  });
}

async function settleSongDetail(page: Page, legacy: boolean) {
  const root = page.locator(legacy ? '.offcanvas.show' : '.maimai2-song-detail');
  await root.waitFor({ state: 'visible', timeout: 30_000 });
  await expect(root.locator('section > .card')).toHaveCount(5, { timeout: 30_000 });
  await expect(root.locator('.tab-pane.show.active > table tbody tr')).toHaveCount(ranking.length, { timeout: 30_000 });
  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete && image.naturalWidth > 0),
    undefined,
    { timeout: 30_000 },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
  });
}

async function compare(oldBuffer: Buffer, newBuffer: Buffer, testInfo: TestInfo, label: string) {
  const oldImage = PNG.sync.read(oldBuffer);
  const newImage = PNG.sync.read(newBuffer);
  expect({ width: newImage.width, height: newImage.height }).toEqual({ width: oldImage.width, height: oldImage.height });
  const diff = new PNG({ width: oldImage.width, height: oldImage.height });
  const mismatchedPixels = pixelmatch(oldImage.data, newImage.data, diff.data, oldImage.width, oldImage.height, {
    includeAA: false,
    threshold: 0.1,
  });
  const ratio = mismatchedPixels / (oldImage.width * oldImage.height);
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  const oldPath = path.join(testInfo.outputDir, `${label}-old.png`);
  const newPath = path.join(testInfo.outputDir, `${label}-new.png`);
  const diffPath = path.join(testInfo.outputDir, `${label}-diff.png`);
  await Promise.all([
    fs.writeFile(oldPath, oldBuffer),
    fs.writeFile(newPath, newBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-comparison.json`), JSON.stringify({ ratio, mismatchedPixels }, null, 2)),
  ]);
  expect(ratio, `${label} visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

async function openPair(context: BrowserContext, route: string) {
  const oldPage = await context.newPage();
  const newPage = await context.newPage();
  await Promise.all([
    oldPage.goto(`${LEGACY_ORIGIN}${route}`, { waitUntil: 'domcontentloaded' }),
    newPage.goto(`${REACT_ORIGIN}${route}`, { waitUntil: 'domcontentloaded' }),
  ]);
  await Promise.all([waitForCatalog(oldPage), waitForCatalog(newPage)]);
  await Promise.all([
    oldPage.reload({ waitUntil: 'domcontentloaded' }),
    newPage.reload({ waitUntil: 'domcontentloaded' }),
  ]);
  return { oldPage, newPage };
}

test.describe('Maimai2 recent and rating visual parity', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of themes) {
    test(`recent default and expanded detail match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
        viewport: { width: 1280, height: 720 },
      });
      const blockedBusinessWrites = await installFixtureApi(context);
      await installFixtureStorage(context, theme);
      const { oldPage, newPage } = await openPair(context, '/mai2/recent');
      await Promise.all([settle(oldPage, '.record > .card', recentRows.length), settle(newPage, '.record > .card', recentRows.length)]);

      const [oldDefault, newDefault] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldDefault, newDefault, testInfo, `recent-${theme}-default`);

      // The current Angular build also ships Tailwind's `.collapse { visibility: collapse }`,
      // which masks ng-bootstrap's intended expanded state. Normalize only that collision so
      // the screenshot can compare the component's actual detail layout.
      await oldPage.addStyleTag({
        content: '.record .collapse.show { display: block !important; visibility: visible !important; }',
      });
      await Promise.all([
        oldPage.getByRole('button', { name: '详细信息' }).first().click(),
        newPage.getByRole('button', { name: '详细信息' }).first().click(),
      ]);
      await Promise.all([
        oldPage.locator('.record > .card').first().locator('.collapse.show').waitFor(),
        newPage.locator('.record > .card').first().locator('.collapse.show').waitFor(),
      ]);
      const [oldExpanded, newExpanded] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldExpanded, newExpanded, testInfo, `recent-${theme}-expanded`);

      await Promise.all([
        oldPage.getByRole('button', { name: '乐曲数据' }).first().click(),
        newPage.getByRole('button', { name: '乐曲数据' }).first().click(),
      ]);
      await Promise.all([settleSongDetail(oldPage, true), settleSongDetail(newPage, false)]);
      expect(blockedBusinessWrites, 'Recent interactions must stay read-only').toEqual([]);
      await context.close();
    });

    test(`rating default and song detail match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
        viewport: { width: 1280, height: 720 },
      });
      const blockedBusinessWrites = await installFixtureApi(context);
      await installFixtureStorage(context, theme);
      const { oldPage, newPage } = await openPair(context, '/mai2/rating');
      await Promise.all([settle(oldPage, '.rating-card', 4), settle(newPage, '.rating-card', 4)]);

      const [oldDefault, newDefault] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldDefault, newDefault, testInfo, `rating-${theme}-default`);

      await Promise.all([
        oldPage.locator('.rating-card').first().click(),
        newPage.locator('.rating-card').first().click(),
      ]);
      await Promise.all([settleSongDetail(oldPage, true), settleSongDetail(newPage, false)]);
      const [oldDetail, newDetail] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldDetail, newDetail, testInfo, `rating-${theme}-detail`);
      expect(blockedBusinessWrites, 'Rating interactions must stay read-only').toEqual([]);
      await context.close();
    });
  }

  test('Liquefy theme keeps both pages and their read-only interactions functional', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const blockedBusinessWrites = await installFixtureApi(context);
    await installFixtureStorage(context, 'light', 'liquefy');
    const page = await context.newPage();

    await page.goto(`${REACT_ORIGIN}/mai2/recent`, { waitUntil: 'domcontentloaded' });
    await waitForCatalog(page);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page, '.record > .card', recentRows.length);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
    const rankBadge = page.locator('.record > .card').first().locator('.recent-rank-icon');
    await expect(rankBadge).toHaveCSS('bottom', '5.6px');
    await expect(rankBadge).toHaveCSS('right', '5.6px');
    await page.getByRole('button', { name: '详细信息' }).first().click();
    await expect(page.locator('.record > .card').first().locator('.collapse')).toHaveClass(/show/);

    await page.goto(`${REACT_ORIGIN}/mai2/rating`, { waitUntil: 'domcontentloaded' });
    await settle(page, '.rating-card', 4);
    await page.locator('.rating-card').first().click();
    await settleSongDetail(page, false);
    await page.locator('.maimai2-song-detail .btn-close').click();
    const songDetailSheet = page.locator('.maimai2-song-detail');
    await expect(songDetailSheet).toHaveCount(0, { timeout: 1_000 });
    expect(blockedBusinessWrites, 'Liquefy-theme interactions must stay read-only').toEqual([]);
    await context.close();
  });
});
