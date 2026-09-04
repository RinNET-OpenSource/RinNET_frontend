import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const DB_VERSION = 6;
const themes = ['light', 'dark'] as const;

const fixtureAccount = {
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
  tokenType: 'Bearer',
};

const fixtureCard = {
  id: 1,
  extId: 10000001,
  luid: '01234567890123456789',
  default: true,
  registerTime: '2026-01-01T00:00:00+08:00',
  accessTime: '2026-01-01T00:00:00+08:00',
  cardExternalList: [{ id: 11, luid: '98765432109876543210' }],
};

const fixtureUser = {
  id: 1,
  username: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.invalid',
  roles: [],
  games: ['ongeki', 'maimai2', 'chusan'],
  cards: [fixtureCard],
  defaultCard: fixtureCard,
  keychips: [],
  userTrustKeychips: [],
  oauth2s: [],
};

interface SecondaryRoute {
  name: string;
  path: string;
  ready: { count: number; selector: string };
  responses: Record<string, unknown>;
}

const chuniProfile = {
  userName: 'ＣＨＵＮＩ ＴＥＳＴ',
  level: 48,
  reincarnationNum: 1,
  point: 1234,
  totalPoint: 567890,
  playCount: 321,
  playerRating: 1523,
  highestRating: 1588,
  lastRomVersion: '2.30.00',
  lastPlayDate: '2026-08-31T20:15:30+08:00',
  overPowerPoint: 123456,
  overPowerRate: 9876,
};

const ratingItems = [
  {
    musicId: 1,
    musicName: 'Sample Music One',
    artistName: 'Artist One',
    level: 3,
    score: 1009000,
    ratingBase: 1450,
    rating: 1580,
  },
  {
    musicId: 2,
    musicName: 'Sample Music Two',
    artistName: 'Artist Two',
    level: 2,
    score: 1007500,
    ratingBase: 1320,
    rating: 1465,
  },
];

const ongekiProfile = {
  userName: 'ＦＩＸＴＵＲＥ',
  level: 75,
  reincarnationNum: 2,
  lastPlayDate: '2026-08-31T20:15:30+08:00',
  lastDataVersion: '1.45.00',
  lastRomVersion: '1.45.00',
  exp: 12345,
  point: 6789,
  totalPoint: 987654,
  playCount: 432,
  jewelCount: 12,
  totalJewelCount: 345,
  medalCount: 67,
  playerRating: 1588,
  highestRating: 1612,
  battlePoint: 12345,
  nameplateId: 1,
  trophyId: 1,
  cardId: 100001,
  characterId: 1,
};

const ownKeychip = {
  id: 7,
  keychipId: 'A39E01A0001',
  placeName: 'Fixture Cabinet',
  whiteListed: true,
  user: { id: 1, name: 'Fixture User' },
  gameVersions: [
    {
      game: 'CHUSAN',
      observed: { romVersion: '2.50.01', dataVersion: '2.50.00' },
      manual: { romVersion: '2.40.01', dataVersion: '2.40.00' },
      effective: { romVersion: '2.40.01', dataVersion: '2.40.00' },
      source: { romVersion: 'MANUAL', dataVersion: 'MANUAL' },
    },
    {
      game: 'ONGEKI',
      observed: { romVersion: '1.45.00', dataVersion: '1.45.00' },
      manual: { romVersion: null, dataVersion: null },
      effective: { romVersion: '1.45.00', dataVersion: '1.45.00' },
      source: { romVersion: 'OBSERVED', dataVersion: 'OBSERVED' },
    },
  ],
};

const trustedKeychip = {
  id: 8,
  keychipId: 'A39E01A0002',
  placeName: 'Trusted Cabinet',
  whiteListed: false,
  user: { id: 2, name: 'Trusted Owner' },
};

const announcements = [
  {
    id: 1,
    title: 'Fixture General Notice',
    content: 'Fixture **general** content.',
    expirationDate: '2026-12-31T23:59:59+08:00',
    updatedAt: '2026-08-31T20:15:30+08:00',
    status: 'ACTIVE',
    type: 'GENERAL',
    priority: 2,
    translations: [
      { language: 'zh', translatedTitle: '测试一般公告', translatedContent: '测试一般公告内容。' },
      { language: 'en', translatedTitle: 'Fixture General Notice', translatedContent: 'Fixture general content.' },
    ],
  },
  {
    id: 2,
    title: 'Fixture Maintenance Notice',
    content: 'Fixture maintenance content.',
    expirationDate: '2026-12-31T23:59:59+08:00',
    updatedAt: '2026-08-30T12:34:56+08:00',
    status: 'ACTIVE',
    type: 'MAINTENANCE',
    priority: 0,
    translations: [
      { language: 'zh', translatedTitle: '测试维护公告', translatedContent: '测试维护公告内容。' },
      { language: 'en', translatedTitle: 'Fixture Maintenance Notice', translatedContent: 'Fixture maintenance content.' },
    ],
  },
];

const ongekiSelf = {
  rivalUserId: 10000001,
  rivalUserName: 'FIXTURE SELF',
  rivalNowRating: 1588,
  rivalHighestRating: 1612,
  rivalCardId: 100001,
  lastPlayDate: '2026-08-31T20:15:30+08:00',
  reincarnationNum: 2,
  rivalBattleScore: 12345,
  level: 75,
};

const ongekiRivals = [
  {
    rivalUserId: 10000011,
    rivalUserName: 'RIVAL ONE',
    rivalNowRating: 1540,
    rivalHighestRating: 1570,
    rivalCardId: 100002,
    lastPlayDate: '2026-08-30T12:34:56+08:00',
    reincarnationNum: 1,
    rivalBattleScore: 11000,
    level: 62,
  },
  {
    rivalUserId: 10000012,
    rivalUserName: 'RIVAL TWO',
    rivalNowRating: 1498,
    rivalHighestRating: 1520,
    rivalCardId: 100003,
    lastPlayDate: '2026-08-29T08:00:00+08:00',
    reincarnationNum: 0,
    rivalBattleScore: 9800,
    level: 55,
  },
];

const routes: readonly SecondaryRoute[] = [
  {
    name: 'profile',
    path: '/profile',
    ready: { count: 4, selector: 'h2' },
    responses: {
      '/api/user/totp': { data: { enabled: false, recoveryCodesRemaining: 0 }, status: { code: 92001 } },
      '/api/user/webauthn': { data: [], status: { code: 92001 } },
    },
  },
  {
    name: 'cards',
    path: '/cards',
    ready: { count: 2, selector: 'main .row.px-2.mb-3 .card' },
    responses: {},
  },
  {
    name: 'keychip',
    path: '/keychip',
    ready: { count: 2, selector: '.keychip-card-header' },
    responses: {
      '/api/user/keychip': { data: [ownKeychip], status: { code: 92001 } },
      '/api/user/keychip/trustKeychip': {
        data: [{ id: 1, userId: 1, keychip: trustedKeychip }],
        status: { code: 92001 },
      },
    },
  },
  {
    name: 'importer',
    path: '/import',
    ready: { count: 3, selector: 'input[type="file"]' },
    responses: {},
  },
  {
    name: 'announcements',
    path: '/announcements',
    ready: { count: 2, selector: '.list-group-item.card-btn' },
    responses: {
      '/api/user/announcement/': {
        data: { content: announcements, page: 0, totalElements: 2, totalPages: 1 },
        status: { code: 92001 },
      },
    },
  },
  {
    name: 'ongeki-rival',
    path: '/ongeki/rival',
    ready: { count: 3, selector: 'main .card.mb-3' },
    responses: {
      '/api/game/ongeki/rival': ongekiRivals,
      '/api/game/ongeki/rival/10000001': ongekiSelf,
    },
  },
  {
    name: 'ongeki-setting',
    path: '/ongeki/settings',
    ready: { count: 2, selector: 'main .card.mb-3' },
    responses: {
      '/api/game/ongeki/profile': ongekiProfile,
    },
  },
  {
    name: 'maimai2-photos',
    path: '/mai2/photos',
    ready: { count: 2, selector: '.container .card-img-top' },
    responses: {
      '/api/game/maimai2/recentPhoto': {
        content: [
          {
            divLength: 0,
            fileName: '/assets/icons/turtle-512x512.png',
            placeId: 1,
            uploadDate: '2026-08-30T12:34:56+08:00',
            playlogId: 1001,
            trackNo: 1,
          },
          {
            divLength: 0,
            fileName: '/assets/icons/turtle-384x384.png',
            placeId: 1,
            uploadDate: '2026-08-31T20:15:30+08:00',
            playlogId: 1002,
            trackNo: 2,
          },
        ],
        page: 0,
        totalElements: 2,
        totalPages: 1,
      },
    },
  },
  {
    name: 'maimai2-dxpass',
    path: '/mai2/dxpass',
    ready: { count: 6, selector: '.container .card > img' },
    responses: {
      '/api/game/maimai2/dxpass': {
        content: [
          {
            cardId: 1,
            cardTypeId: 4,
            charaId: 1,
            mapId: 1,
            startDate: '2026-08-01T10:00:00+08:00',
            endDate: '2099-12-31T23:59:00+08:00',
          },
          {
            cardId: 2,
            cardTypeId: 2,
            charaId: 2,
            mapId: 2,
            startDate: '2025-01-01T10:00:00+08:00',
            endDate: '2025-02-01T10:00:00+08:00',
          },
        ],
        page: 0,
        totalElements: 2,
        totalPages: 1,
      },
      '/api/game/maimai2/getCardType': { data: 4, status: { code: 92001 } },
    },
  },
  {
    name: 'chuni-user-ranking',
    path: '/chuni/v2/userRanking',
    ready: { count: 4, selector: '.ranking-row' },
    responses: {
      '/api/game/chuni/v2/data/userRatingRanking': {
        data: [
          { characterId: 1, highestRating: 1612, nowRating: 1598, userName: 'RANK ONE' },
          { characterId: 2, highestRating: 1580, nowRating: 1555, userName: 'RANK TWO' },
          { characterId: 3, highestRating: 1540, nowRating: 1512, userName: 'RANK THREE' },
          { characterId: 4, highestRating: 1500, nowRating: 1490, userName: 'RANK FOUR' },
        ],
      },
    },
  },
  {
    name: 'chuni-rating',
    path: '/chuni/v2/rating',
    ready: { count: 4, selector: '.rating-card' },
    responses: {
      '/api/game/chuni/v2/profile': chuniProfile,
      '/api/game/chuni/v2/verse-rating': {
        new: ratingItems,
        old: ratingItems.map((item, index) => ({ ...item, musicId: item.musicId + 10, rating: item.rating - index * 5 })),
      },
    },
  },
];

async function settlePage(page: Page, route: SecondaryRoute) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator(route.ready.selector)).toHaveCount(route.ready.count, { timeout: 30_000 });
  await expect(page.locator('.placeholder')).toHaveCount(0, { timeout: 30_000 });
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

async function saveComparison(oldBuffer: Buffer, newBuffer: Buffer, testInfo: TestInfo) {
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
  const oldPath = path.join(testInfo.outputDir, 'old.png');
  const newPath = path.join(testInfo.outputDir, 'new.png');
  const diffPath = path.join(testInfo.outputDir, 'diff.png');
  await Promise.all([
    fs.writeFile(oldPath, oldBuffer),
    fs.writeFile(newPath, newBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
  ]);

  expect(
    diffRatio,
    `Visual difference ${(diffRatio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`,
  ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

test.describe('newly migrated secondary-page visual parity', () => {
  test.describe.configure({ timeout: 90_000 });

  for (const route of routes) {
    for (const theme of themes) {
      test(`${route.name} matches the Angular baseline in ${theme} mode`, async ({ browser }, testInfo) => {
        const context = await browser.newContext({
          colorScheme: theme,
          deviceScaleFactor: 1,
          ignoreHTTPSErrors: true,
          locale: 'zh-CN',
          serviceWorkers: 'block',
          timezoneId: 'Asia/Hong_Kong',
          viewport: { width: 1280, height: 720 },
        });
        const blockedBusinessWrites: string[] = [];
        const unexpectedBusinessGets: string[] = [];

        await context.route('**/*', async (browserRoute) => {
          const request = browserRoute.request();
          const url = new URL(request.url());
          const isPortalBusinessRequest =
            [LEGACY_ORIGIN, REACT_ORIGIN].includes(url.origin) &&
            (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));
          if (request.method() !== 'GET' && isPortalBusinessRequest) {
            blockedBusinessWrites.push(`${request.method()} ${url.pathname}`);
            await browserRoute.abort('blockedbyclient');
            return;
          }

          if (url.pathname === '/api/account/status') {
            await browserRoute.fulfill({
              body: JSON.stringify({
                data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' },
                status: { code: 92001 },
              }),
              contentType: 'application/json',
              status: 200,
            });
            return;
          }
          if (url.pathname === '/api/user/me') {
            await browserRoute.fulfill({
              body: JSON.stringify({ data: fixtureUser, status: { code: 92001 } }),
              contentType: 'application/json',
              status: 200,
            });
            return;
          }
          if (url.pathname === '/api/static/dbVersion') {
            await browserRoute.fulfill({
              body: JSON.stringify({ state: 'Success', version: { major: DB_VERSION } }),
              contentType: 'application/json',
              status: 200,
            });
            return;
          }
          if (Object.hasOwn(route.responses, url.pathname)) {
            await browserRoute.fulfill({
              body: JSON.stringify(route.responses[url.pathname]),
              contentType: 'application/json',
              status: 200,
            });
            return;
          }
          if (/\/api\/game\/.*\/data\//.test(url.pathname)) {
            await browserRoute.fulfill({ body: '[]', contentType: 'application/json', status: 200 });
            return;
          }
          if (isPortalBusinessRequest) {
            unexpectedBusinessGets.push(`${request.method()} ${url.pathname}`);
            await browserRoute.fulfill({
              body: JSON.stringify({ data: null, status: { code: 92001 } }),
              contentType: 'application/json',
              status: 200,
            });
            return;
          }
          await browserRoute.continue();
        });

        await context.addInitScript(
          ({ authenticatedAccount, authenticatedUser, selectedTheme, selectedDatabaseVersion, origins }) => {
            if (!origins.includes(window.location.origin)) return;
            localStorage.setItem('currentAccount', JSON.stringify(authenticatedAccount));
            localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
            localStorage.setItem('lang', 'zh');
            localStorage.setItem('colorTheme', selectedTheme);
            localStorage.setItem('themeFamily', 'legacy');
            localStorage.setItem('dbVersion', String(selectedDatabaseVersion));
          },
          {
            authenticatedAccount: fixtureAccount,
            authenticatedUser: fixtureUser,
            selectedTheme: theme,
            selectedDatabaseVersion: DB_VERSION,
            origins: [LEGACY_ORIGIN, REACT_ORIGIN],
          },
        );

        const oldPage = await context.newPage();
        const newPage = await context.newPage();
        await Promise.all([
          oldPage.goto(`${LEGACY_ORIGIN}${route.path}`, { waitUntil: 'domcontentloaded' }),
          newPage.goto(`${REACT_ORIGIN}${route.path}`, { waitUntil: 'domcontentloaded' }),
        ]);
        await Promise.all([settlePage(oldPage, route), settlePage(newPage, route)]);
        expect(blockedBusinessWrites, 'No page may attempt a business write during visual parity').toEqual([]);
        expect(unexpectedBusinessGets, 'Every business GET must be explicitly fixture-backed').toEqual([]);

        const [oldBuffer, newBuffer] = await Promise.all([
          oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
          newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        ]);
        await saveComparison(oldBuffer, newBuffer, testInfo);
        await context.close();
      });
    }
  }
});
