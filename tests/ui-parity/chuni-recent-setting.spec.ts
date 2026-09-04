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
];

const recentRows = [
  {
    playDate: '2026-08-31T12:00:00+08:00',
    userPlayDate: '2026-08-31T12:00:00+08:00',
    musicId: 1,
    level: 3,
    customId: 0,
    playedCustom1: 0,
    playedCustom2: 0,
    playedCustom3: 0,
    track: 1,
    score: 1_009_500,
    rank: 13,
    maxCombo: 1234,
    maxChain: 0,
    rateTap: 9988,
    rateHold: 9977,
    rateSlide: 9966,
    rateAir: 9955,
    rateFlick: 9944,
    judgeGuilty: 1,
    judgeAttack: 2,
    judgeJustice: 3,
    judgeCritical: 900,
    judgeHeaven: 20,
    playerRating: 1600,
    fullChainKind: 0,
    characterId: 1,
    skillId: 1,
    playKind: 0,
    skillLevel: 1,
    skillEffect: 0,
    isNewRecord: true,
    isFullCombo: true,
    isAllJustice: true,
    isClear: true,
  },
  {
    playDate: '2026-08-30T09:30:00+08:00',
    userPlayDate: '2026-08-30T09:30:00+08:00',
    musicId: 2,
    level: 2,
    customId: 0,
    playedCustom1: 0,
    playedCustom2: 0,
    playedCustom3: 0,
    track: 2,
    score: 987_654,
    rank: 8,
    maxCombo: 765,
    maxChain: 0,
    rateTap: 9555,
    rateHold: 9444,
    rateSlide: 9333,
    rateAir: 9222,
    rateFlick: 9111,
    judgeGuilty: 10,
    judgeAttack: 20,
    judgeJustice: 30,
    judgeCritical: 700,
    judgeHeaven: 0,
    playerRating: 1400,
    fullChainKind: 0,
    characterId: 2,
    skillId: 2,
    playKind: 0,
    skillLevel: 1,
    skillEffect: 0,
    isNewRecord: false,
    isFullCombo: false,
    isAllJustice: false,
    isClear: true,
  },
];

const songRecords = [
  {
    musicId: 1,
    level: 3,
    playCount: 4,
    scoreMax: 1_009_500,
    missCount: 1,
    maxComboCount: 1234,
    isFullCombo: true,
    isAllJustice: true,
    isSuccess: 1,
    fullChain: 0,
    maxChain: 0,
    scoreRank: 13,
    isLock: false,
    theoryCount: 0,
    ext1: 0,
    ranking: { rank: 2, playedCount: 12 },
  },
];

const scoreRanking = [
  { username: 'Fixture Rival A', score: 1_010_000 },
  { username: 'Fixture User', score: 1_009_500 },
  { username: 'Fixture Rival B', score: 1_008_000 },
];

const profile = {
  userName: 'ＣＨＵＮＩ ＴＥＳＴ',
  level: 48,
  reincarnationNum: 1,
  exp: 0,
  point: 1234,
  totalPoint: 567890,
  playCount: 321,
  multiPlayCount: 0,
  multiWinCount: 0,
  requestResCount: 0,
  acceptResCount: 0,
  successResCount: 0,
  playerRating: 1523,
  highestRating: 1588,
  nameplateId: 1,
  frameId: 1,
  characterId: 1,
  charaIllustId: 1,
  trophyId: 1,
  trophyIdSub1: 0,
  trophyIdSub2: 0,
  playedTutorialBit: 0,
  firstTutorialCancelNum: 0,
  masterTutorialCancelNum: 0,
  totalRepertoireCount: 0,
  totalMapNum: 0,
  totalHiScore: 0,
  totalBasicHighScore: 0,
  totalAdvancedHighScore: 0,
  totalExpertHighScore: 0,
  totalMasterHighScore: 0,
  totalUltimaHighScore: 0,
  friendCount: 0,
  firstGameId: '',
  firstRomVersion: '2.30.00',
  lastRomVersion: '2.30.00',
  firstDataVersion: '2.30.00',
  lastDataVersion: '2.30.00',
  firstPlayDate: '2026-01-01T00:00:00+08:00',
  lastPlayDate: '2026-08-31T12:00:00+08:00',
  courseClass: 0,
  overPowerPoint: 0,
  overPowerRate: 0,
  mapIconId: 1,
  voiceId: 1,
  stageId: 1,
  avatarWear: 0,
  avatarHead: 0,
  avatarFace: 0,
  avatarSkin: 0,
  avatarItem: 0,
  avatarFront: 0,
  avatarBack: 0,
};

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
    } else if (url.pathname === '/api/game/chuni/v2/data/music') {
      body = musicCatalog;
    } else if (url.pathname === '/api/game/chuni/v2/recent') {
      body = { content: recentRows, page: 0, totalElements: recentRows.length, totalPages: 1 };
    } else if (url.pathname === '/api/game/chuni/v2/song/1') {
      body = songRecords;
    } else if (url.pathname === '/api/game/chuni/v2/musicScoreRanking') {
      body = scoreRanking;
    } else if (url.pathname === '/api/game/chuni/v2/profile') {
      body = profile;
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
    { account: fakeAccount, user: fakeUser, selectedTheme: theme, origins: [LEGACY_ORIGIN, REACT_ORIGIN], dbVersion: DB_VERSION },
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

async function settle(page: Page, selector: string, count: number) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator(selector)).toHaveCount(count, { timeout: 30_000 });
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
    window.scrollTo(0, 0);
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
  ]);
  expect(ratio, `${label} visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

test.describe('Chunithm v2 recent and settings parity', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of themes) {
    test(`recent and settings match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
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
        oldPage.goto(`${LEGACY_ORIGIN}/chuni/v2/recent`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/chuni/v2/recent`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForCatalog(oldPage), waitForCatalog(newPage)]);
      await Promise.all([
        oldPage.reload({ waitUntil: 'domcontentloaded' }),
        newPage.reload({ waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settle(oldPage, '.this-page > .card', recentRows.length), settle(newPage, '.this-page > .card', recentRows.length)]);
      const [oldRecent, newRecent] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldRecent, newRecent, testInfo, `recent-${theme}`);

      for (const page of [oldPage, newPage]) {
        await page.locator('.this-page > .card').first().locator('.card-footer .text-primary').click();
      }
      await Promise.all([
        oldPage.getByRole('dialog').waitFor({ state: 'visible' }),
        newPage.getByRole('dialog').waitFor({ state: 'visible' }),
      ]);
      await expect(oldPage).toHaveURL(`${LEGACY_ORIGIN}/chuni/v2/recent`);
      await expect(newPage).toHaveURL(`${REACT_ORIGIN}/chuni/v2/recent`);
      await Promise.all([
        oldPage.getByRole('dialog').locator('td:visible', { hasText: 'Fixture Rival A' }).first().waitFor(),
        newPage.getByRole('dialog').locator('td:visible', { hasText: 'Fixture Rival A' }).first().waitFor(),
      ]);
      const [oldRecentDetail, newRecentDetail] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldRecentDetail, newRecentDetail, testInfo, `recent-detail-${theme}`);

      await Promise.all([
        oldPage.goto(`${LEGACY_ORIGIN}/chuni/v2/setting`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/chuni/v2/setting`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settle(oldPage, '.version-box > .card', 2), settle(newPage, '.version-box > .card', 2)]);
      const [oldSetting, newSetting] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldSetting, newSetting, testInfo, `setting-${theme}`);
      expect(blockedBusinessWrites, 'No Portal business write may be attempted').toEqual([]);
      await context.close();
    });
  }
});
