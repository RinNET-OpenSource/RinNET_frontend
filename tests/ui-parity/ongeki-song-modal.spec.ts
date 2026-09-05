import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const DB_VERSION = 6;

const fixtureAccount = {
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
  tokenType: 'Bearer',
};

const fixtureUser = {
  id: 1,
  username: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.invalid',
  roles: [],
  games: ['ongeki'],
  cards: [
    {
      id: 1,
      extId: 10000001,
      luid: 'fixture-card',
      default: true,
    },
  ],
  defaultCard: {
    id: 1,
    extId: 10000001,
    luid: 'fixture-card',
    default: true,
  },
};

const fixtureMusic = {
  id: 4,
  name: 'Fixture Song',
  sortName: 'FIXTURE SONG',
  artistName: 'Fixture Artist',
  genre: 'POPS＆ANIME',
  bossCardId: 100,
  bossLevel: 1,
  level0: '4,0',
  level1: '8,0',
  level2: '11,7',
  level3: '13,7',
  level4: '0,0',
};

const fixtureCard = {
  id: 100,
  name: 'Fixture Card',
  nickName: 'Fixture',
  attribute: 'FIRE',
  charaId: 200,
  school: 'Fixture School',
  gakunen: '1',
  rarity: 'SSR',
  levelParam: '1,1,1,1',
  skillId: 0,
  choKaikaSkillId: 0,
  cardNumber: 'F-100',
  version: '1',
};

const fixtureSongData = [0, 1, 2, 3].map((level) => ({
  musicId: fixtureMusic.id,
  level,
  playCount: level + 1,
  techScoreMax: 1_000_000 + level * 1_000,
  techScoreRank: 1,
  battleScoreMax: 0,
  battleScoreRank: 0,
  platinumScoreMax: 0,
  maxComboCount: 0,
  maxOverKill: 0,
  maxTeamOverKill: 0,
  clearStatus: 0,
  storyWatched: false,
  isFullBell: false,
  isFullCombo: false,
  isAllBreake: false,
  isLock: false,
  ranking: { rank: level + 1, playedCount: 10 },
}));

const fixtureRanking = [
  { username: 'RANK ONE', score: 1_010_000 },
  { username: 'RANK TWO', score: 1_000_000 },
];

async function installFixtureApi(context: BrowserContext) {
  const blockedWrites: string[] = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;

    if (!isPortal || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    if (request.method() !== 'GET') {
      blockedWrites.push(`${request.method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }

    let body: unknown;
    if (url.pathname === '/api/account/status') {
      body = {
        data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' },
        status: { code: 92001 },
      };
    } else if (url.pathname === '/api/user/me') {
      body = { data: fixtureUser, status: { code: 92001 } };
    } else if (url.pathname === '/api/static/dbVersion') {
      body = { state: 'Success', version: { major: DB_VERSION } };
    } else if (url.pathname === '/api/game/ongeki/data/musicList') {
      body = [fixtureMusic];
    } else if (url.pathname === '/api/game/ongeki/data/cardList') {
      body = [fixtureCard];
    } else if (url.pathname === '/api/game/ongeki/data/charaList') {
      body = [{ id: 200, name: 'Fixture Character', cv: 'Fixture CV', modelId: 0 }];
    } else if (url.pathname === '/api/game/ongeki/song/4') {
      body = fixtureSongData;
    } else if (url.pathname === '/api/game/ongeki/musicScoreRanking') {
      body = fixtureRanking;
    } else if (/^\/api\/game\/.*\/data\//.test(url.pathname)) {
      body = [];
    } else {
      body = { data: null, status: { code: 92001 } };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });

  return blockedWrites;
}

async function installFixtureStorage(context: BrowserContext) {
  await context.addInitScript(
    ({ account, user, origins, dbVersion }) => {
      if (!origins.includes(window.location.origin)) return;
      localStorage.setItem('currentAccount', JSON.stringify(account));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('lang', 'zh');
      localStorage.setItem('colorTheme', 'light');
      localStorage.setItem('themeFamily', 'legacy');
      localStorage.setItem('dbVersion', String(dbVersion));
    },
    {
      account: fixtureAccount,
      user: fixtureUser,
      origins: [LEGACY_ORIGIN, REACT_ORIGIN],
      dbVersion: DB_VERSION,
    },
  );
}

async function waitForCatalog(page: Page) {
  await page.waitForFunction(
    async () => {
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('Aqua');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      if (!database.objectStoreNames.contains('ongekiMusic')) {
        database.close();
        return false;
      }
      const count = await new Promise<number>((resolve, reject) => {
        const request = database.transaction('ongekiMusic').objectStore('ongekiMusic').count();
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      database.close();
      return count === 1;
    },
    undefined,
    { polling: 100, timeout: 30_000 },
  );
}

async function openSongDetail(page: Page, origin: string, legacy: boolean) {
  await page.goto(`${origin}/ongeki/song`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('.card-btn.card').first().waitFor({ state: 'visible', timeout: 30_000 });
  await page.locator('.card-btn.card').first().click();
  const root = page.locator(legacy ? '.compat-offcanvas' : '.ongeki-song-score-ranking');
  await root.waitFor({ state: 'visible', timeout: 30_000 });
  await root.locator('.btn-close').waitFor({ state: 'visible', timeout: 30_000 });
  return root;
}

async function sheetGeometry(page: Page, legacy: boolean) {
  return page.evaluate((isLegacy) => {
    const content = document.querySelector(
      isLegacy ? '.compat-offcanvas' : '.ongeki-song-score-ranking',
    );
    const close = content?.querySelector('.btn-close');
    if (!(content instanceof HTMLElement) || !(close instanceof HTMLElement)) return null;
    const contentRect = content.getBoundingClientRect();
    const closeRect = close.getBoundingClientRect();
    return {
      rightInset: Math.round((contentRect.right - closeRect.right) * 100) / 100,
      topInset: Math.round((closeRect.top - contentRect.top) * 100) / 100,
      closeWidth: Math.round(closeRect.width * 100) / 100,
    };
  }, legacy);
}

test.describe('Ongeki song detail Sheet lifecycle', () => {
  test.describe.configure({ timeout: 120_000 });

  test('keeps the close control inset and animates the Sheet out', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const blockedWrites = await installFixtureApi(context);
    await installFixtureStorage(context);

    const oldPage = await context.newPage();
    const newPage = await context.newPage();
    try {
      await Promise.all([
        oldPage.goto(`${LEGACY_ORIGIN}/ongeki/song`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/ongeki/song`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([waitForCatalog(oldPage), waitForCatalog(newPage)]);
      await Promise.all([
        oldPage.reload({ waitUntil: 'domcontentloaded' }),
        newPage.reload({ waitUntil: 'domcontentloaded' }),
      ]);

      const [oldRoot, newRoot] = await Promise.all([
        openSongDetail(oldPage, LEGACY_ORIGIN, true),
        openSongDetail(newPage, REACT_ORIGIN, false),
      ]);
      const [oldGeometry, newGeometry] = await Promise.all([
        sheetGeometry(oldPage, true),
        sheetGeometry(newPage, false),
      ]);
      expect(oldGeometry).not.toBeNull();
      expect(newGeometry).not.toBeNull();
      expect(newGeometry!.rightInset).toBeGreaterThanOrEqual(15);
      expect(newGeometry!.topInset).toBeGreaterThanOrEqual(15);

      await newRoot.locator('.btn-close').click();
      await expect(newRoot).toHaveCount(1);
      await newPage.waitForTimeout(100);
      await expect(newRoot).toHaveCount(1);
      await expect(newRoot).toHaveCount(0, { timeout: 1_000 });
      expect(blockedWrites, 'Sheet interaction must remain read-only').toEqual([]);
    } finally {
      await context.close();
    }
  });
});
