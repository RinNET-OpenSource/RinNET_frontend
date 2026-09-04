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

const chuniProfile = {
  userName: 'FIXTURE SELF',
  level: 42,
  reincarnationNum: 1,
  exp: 0,
  point: 1234,
  totalPoint: 5678,
  playCount: 99,
  multiPlayCount: 0,
  multiWinCount: 0,
  requestResCount: 0,
  acceptResCount: 0,
  successResCount: 0,
  playerRating: 1523,
  highestRating: 1588,
  nameplateId: 1,
  frameId: 1,
  characterId: 10,
  trophyId: 1,
  trophyIdSub1: 2,
  trophyIdSub2: 3,
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
  friendCount: 2,
  firstGameId: 'fixture',
  firstRomVersion: '2.00.00',
  lastRomVersion: '2.50.00',
  firstDataVersion: '2.00.00',
  lastDataVersion: '2.50.00',
  firstPlayDate: '2025-01-01T00:00:00+08:00',
  lastPlayDate: '2026-01-02T03:04:05+08:00',
  courseClass: 0,
  overPowerPoint: 123456,
  overPowerRate: 9876,
  mapIconId: 1,
  voiceId: 1,
  stageId: 1,
  avatarWear: 101,
  avatarHead: 201,
  avatarFace: 301,
  avatarSkin: 401,
  avatarItem: 501,
  avatarFront: 601,
  avatarBack: 701,
};

const friends = [
  {
    rivalName: 'RIVAL ONE',
    rivalId: '10000011',
    playerRating: 1498,
    characterId: 10,
    overPowerRate: 9632,
    isFavorite: true,
    reincarnationNum: 1,
    level: 35,
  },
  {
    rivalName: 'RIVAL TWO',
    rivalId: '10000012',
    playerRating: 1455,
    characterId: 20,
    overPowerRate: 9410,
    isFavorite: false,
    reincarnationNum: 0,
    level: 88,
  },
];

const nameplates = [
  { id: 1, name: 'Fixture Nameplate' },
  { id: 2, name: 'Second Nameplate' },
];
const trophies = [
  { id: 1, name: 'Fixture Trophy' },
  { id: 2, name: 'Fixture Sub Trophy 1' },
  { id: 3, name: 'Fixture Sub Trophy 2' },
];
const mapIcons = [
  { id: 1, name: 'Fixture Map Icon' },
  { id: 2, name: 'Second Map Icon' },
];
const systemVoices = [
  { id: 1, name: 'Fixture System Voice' },
  { id: 2, name: 'Second System Voice' },
];
const stages = [
  { id: 1, name: 'Fixture Stage' },
  { id: 2, name: 'Second Stage' },
];
const avatarAccessories = [
  { id: 101, name: 'Fixture Wear', category: 1 },
  { id: 102, name: 'Second Wear', category: 1 },
  { id: 201, name: 'Fixture Head', category: 2 },
  { id: 301, name: 'Fixture Face', category: 3 },
  { id: 501, name: 'Fixture Item', category: 5 },
  { id: 701, name: 'Fixture Back', category: 7 },
];
const symbolChats = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  name: `Fixture Chat ${index + 1}`,
  sortName: `FIXTURE CHAT ${index + 1}`,
  text: index % 2 === 0 ? `CHAT ${index + 1}` : `HELLO\n${index + 1}`,
  balloonId: index + 1,
  sceneIds: [1, 2, 3, 4, 5],
}));
const equippedChats = Array.from({ length: 20 }, (_, index) => ({
  sceneId: Math.floor(index / 4) + 1,
  orderId: index % 4,
  symbolChatId: (index % symbolChats.length) + 1,
}));

const catalogFixtures: Record<string, unknown[]> = {
  '/api/game/chuni/v2/data/nameplate': nameplates,
  '/api/game/chuni/v2/data/trophy': trophies,
  '/api/game/chuni/v2/data/mapicon': mapIcons,
  '/api/game/chuni/v2/data/sysvoice': systemVoices,
  '/api/game/chuni/v2/data/stage': stages,
  '/api/game/chuni/v2/data/avatar': avatarAccessories,
  '/api/game/chuni/v2/data/symbolChatInfo': symbolChats,
};

const expectedCatalogCounts: Record<string, number> = {
  chusanNamePlate: nameplates.length,
  chusanTrophy: trophies.length,
  chusanMapIcon: mapIcons.length,
  chusanSystemVoice: systemVoices.length,
  chusanStage: stages.length,
  chusanAvatarAcc: avatarAccessories.length,
  chusanSymbolChat: symbolChats.length,
};

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
    } else if (url.pathname === '/api/game/chuni/v2/friend') {
      body = friends;
    } else if (url.pathname === '/api/user/profiles') {
      body = { data: { chusan: chuniProfile }, status: { code: 92001 } };
    } else if (url.pathname === '/api/game/chuni/v2/profile') {
      body = chuniProfile;
    } else if (url.pathname === '/api/game/chuni/v2/profile/symbolChatInfo') {
      body = equippedChats;
    } else if (url.pathname.startsWith('/api/game/chuni/v2/favorite-collection/')) {
      const kind = Number(url.pathname.split('/').at(-1));
      const ids: Record<number, number[]> = { 1: [1, 2], 3: [1], 8: [1, 2], 9: [1], 13: [1, 2] };
      body = (ids[kind] ?? []).map((itemId) => ({ itemKind: kind, itemId }));
    } else if (url.pathname.startsWith('/api/game/chuni/v2/item/')) {
      const kind = Number(url.pathname.split('/').at(-1));
      const source: Record<number, Array<{ id: number; name: string }>> = {
        1: nameplates,
        3: trophies,
        8: mapIcons,
        9: systemVoices,
        13: stages,
      };
      body = (source[kind] ?? []).map((item) => ({
        itemId: item.id,
        itemKind: kind,
        name: item.name,
        stock: 1,
      }));
    } else if (url.pathname in catalogFixtures) {
      body = catalogFixtures[url.pathname];
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

async function waitForCatalogs(page: Page) {
  await page.waitForFunction(
    async (counts) => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('Aqua');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      for (const [store, expected] of Object.entries(counts)) {
        if (!database.objectStoreNames.contains(store)) {
          database.close();
          return false;
        }
        const count = await new Promise<number>((resolve, reject) => {
          const request = database.transaction(store).objectStore(store).count();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        if (count !== expected) {
          database.close();
          return false;
        }
      }
      database.close();
      return true;
    },
    expectedCatalogCounts,
    { timeout: 30_000 },
  );
}

async function settleImages(page: Page) {
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
  });
}

async function settleRival(page: Page) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('main .card:not(.placeholder-wave)')).toHaveCount(3, { timeout: 30_000 });
  await expect(page.locator('.placeholder')).toHaveCount(0, { timeout: 30_000 });
  await settleImages(page);
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function settleUserBox(page: Page) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('.avatarPreview .avatarContainer').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('.item-title')).toHaveCount(33, { timeout: 30_000 });
  await expect(page.locator('.symbol-chat-container')).toHaveCount(20, { timeout: 30_000 });
  await settleImages(page);
  await page.evaluate(() => window.scrollTo(0, 0));
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

test.describe('Chunithm v2 rival and user-box visual parity', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const theme of themes) {
    test(`rival default and safe remove modal match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
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
        oldPage.goto(`${LEGACY_ORIGIN}/chuni/v2/rival`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/chuni/v2/rival`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settleRival(oldPage), settleRival(newPage)]);
      expect(blockedBusinessWrites, 'Rival default state must be read-only').toEqual([]);

      const [oldDefault, newDefault] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldDefault, newDefault, testInfo, 'rival-default');

      await Promise.all([
        oldPage.getByText('解除好友', { exact: true }).first().click(),
        newPage.getByText('解除好友', { exact: true }).first().click(),
      ]);
      await Promise.all([
        oldPage.locator('.modal.show').waitFor({ state: 'visible' }),
        newPage.locator('.chuni-v2-rival-remove-modal').waitFor({ state: 'visible' }),
      ]);
      await Promise.all([oldPage.waitForTimeout(350), newPage.waitForTimeout(350)]);
      expect(blockedBusinessWrites, 'Opening remove confirmation must not write').toEqual([]);
      const [oldModal, newModal] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldModal, newModal, testInfo, 'rival-remove-modal');
      await context.close();
    });

    test(`user-box equipment, favorites and item modal match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
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
        oldPage.goto(`${LEGACY_ORIGIN}/chuni/v2/userbox`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/chuni/v2/userbox`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForCatalogs(oldPage), waitForCatalogs(newPage)]);
      await Promise.all([
        oldPage.reload({ waitUntil: 'domcontentloaded' }),
        newPage.reload({ waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settleUserBox(oldPage), settleUserBox(newPage)]);
      expect(blockedBusinessWrites, 'User-box default state must be read-only').toEqual([]);

      const [oldEquip, newEquip] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldEquip, newEquip, testInfo, 'userbox-equip');

      await Promise.all([
        oldPage.getByRole('button', { name: '收藏合集', exact: true }).click(),
        newPage.getByRole('button', { name: '收藏合集', exact: true }).click(),
      ]);
      await Promise.all([
        expect(oldPage.getByText('已选择 2 个').first()).toBeVisible(),
        expect(newPage.getByText('已选择 2 个').first()).toBeVisible(),
        expect(oldPage.getByRole('button', { name: '管理', exact: true })).toHaveCount(5),
        expect(newPage.getByRole('button', { name: '管理', exact: true })).toHaveCount(5),
      ]);
      await settleImages(oldPage);
      await settleImages(newPage);
      const [oldFavorites, newFavorites] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldFavorites, newFavorites, testInfo, 'userbox-favorites');

      await Promise.all([
        oldPage.getByRole('button', { name: '当前装备', exact: true }).click(),
        newPage.getByRole('button', { name: '当前装备', exact: true }).click(),
      ]);
      await Promise.all([
        oldPage.getByRole('button', { name: '更改', exact: true }).first().click(),
        newPage.getByRole('button', { name: '更改', exact: true }).first().click(),
      ]);
      await Promise.all([
        oldPage.locator('.modal.show').waitFor({ state: 'visible' }),
        newPage.locator('.chuni-v2-userbox-item-dialog').waitFor({ state: 'visible' }),
        expect(oldPage.locator('.modal.show .item-card')).toHaveCount(nameplates.length),
        expect(newPage.locator('.chuni-v2-userbox-item-dialog .item-card')).toHaveCount(nameplates.length),
      ]);
      await Promise.all([oldPage.waitForTimeout(350), newPage.waitForTimeout(350)]);
      expect(blockedBusinessWrites, 'Opening item selection must not write').toEqual([]);
      const [oldItemModal, newItemModal] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldItemModal, newItemModal, testInfo, 'userbox-item-modal');

      await Promise.all([
        oldPage.locator('.modal.show .btn-close').click(),
        newPage.locator('.chuni-v2-userbox-item-dialog .btn-close').click(),
      ]);
      await Promise.all([
        oldPage.locator('.modal.show').waitFor({ state: 'hidden' }),
        newPage.locator('.chuni-v2-userbox-item-dialog').waitFor({ state: 'hidden' }),
      ]);
      await Promise.all([oldPage.waitForTimeout(350), newPage.waitForTimeout(350)]);
      const oldChatBody = oldPage.locator('.symbol-chat-container').first().locator('..');
      const newChatBody = newPage.locator('.symbol-chat-container').first().locator('..');
      await Promise.all([
        oldChatBody.getByRole('button', { name: '更改', exact: true }).click(),
        newChatBody.getByRole('button', { name: '更改', exact: true }).click(),
      ]);
      await Promise.all([
        oldPage.locator('.modal.show').waitFor({ state: 'visible' }),
        newPage.locator('.chuni-v2-userbox-symbol-dialog').waitFor({ state: 'visible' }),
        expect(oldPage.locator('.modal.show .item-card')).toHaveCount(symbolChats.length),
        expect(newPage.locator('.chuni-v2-userbox-symbol-dialog .item-card')).toHaveCount(symbolChats.length),
      ]);
      await Promise.all([oldPage.waitForTimeout(350), newPage.waitForTimeout(350)]);
      expect(blockedBusinessWrites, 'Opening symbol-chat selection must not write').toEqual([]);
      const [oldSymbolModal, newSymbolModal] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(oldSymbolModal, newSymbolModal, testInfo, 'userbox-symbol-modal');
      await context.close();
    });
  }
});
