import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const themes = ['light', 'dark'] as const;

const username = process.env.UI_TEST_USERNAME;
const password = process.env.UI_TEST_PASSWORD;
const credentials = username && password ? { username, password } : null;

const maimai2ProfileFixture = {
  userName: 'ＭＡＩ２ ＴＥＳＴ',
  iconId: 1,
  plateId: 2,
  titleId: 3,
  partnerId: 4,
  frameId: 5,
  selectMapId: 6,
  totalAwake: 321,
  gradeRating: 1,
  musicRating: 2,
  playerRating: 12345,
  highestRating: 13000,
  gradeRank: 1,
  classRank: 25,
  courseRank: 14,
  charaSlot: '',
  charaLockSlot: '',
  playCount: 456,
  eventWatchedDate: '2026-08-30T09:30:00+08:00',
  lastRomVersion: '1.55.00',
  lastDataVersion: '1.55.00',
  lastPlayDate: '2026-08-31T20:15:30+08:00',
  playVsCount: 0,
  playSyncCount: 0,
  winCount: 0,
  helpCount: 0,
  comboCount: 0,
  totalDeluxscore: 0,
  totalBasicDeluxscore: 0,
  totalAdvancedDeluxscore: 0,
  totalExpertDeluxscore: 0,
  totalMasterDeluxscore: 0,
  totalReMasterDeluxscore: 0,
  totalSync: 0,
  totalBasicSync: 0,
  totalAdvancedSync: 0,
  totalExpertSync: 0,
  totalMasterSync: 0,
  totalReMasterSync: 0,
  totalAchievement: 0,
  totalBasicAchievement: 0,
  totalAdvancedAchievement: 0,
  totalExpertAchievement: 0,
  totalMasterAchievement: 0,
  totalReMasterAchievement: 0,
};

const chuniProfileFixture = {
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
  frameId: 2,
  characterId: 3,
  trophyId: 4,
  trophyIdSub1: 0,
  trophyIdSub2: 0,
  playedTutorialBit: 0,
  firstTutorialCancelNum: 0,
  masterTutorialCancelNum: 0,
  totalRepertoireCount: 0,
  totalMapNum: 0,
  totalHiScore: 987654321,
  totalBasicHighScore: 111111,
  totalAdvancedHighScore: 222222,
  totalExpertHighScore: 333333,
  totalMasterHighScore: 444444,
  totalUltimaHighScore: 555555,
  friendCount: 0,
  firstGameId: '',
  firstRomVersion: '2.30.00',
  lastRomVersion: '2.30.00',
  firstDataVersion: '2.30.00',
  lastDataVersion: '2.30.00',
  firstPlayDate: '2026-08-01T10:00:00+08:00',
  lastPlayDate: '2026-08-31T20:15:30+08:00',
  courseClass: 14,
  overPowerPoint: 123456,
  overPowerRate: 9876,
  mapIconId: 0,
  voiceId: 0,
  stageId: 0,
  avatarWear: 0,
  avatarHead: 0,
  avatarFace: 0,
  avatarSkin: 0,
  avatarItem: 0,
  avatarFront: 0,
  avatarBack: 0,
};

interface ProfileRoute {
  apiPath: string;
  fixture: object;
  name: 'maimai2-profile' | 'chuni-profile';
  path: '/mai2/profile' | '/chuni/v2/profile';
  readyText: string;
  tableCount: number;
}

const profileRoutes: readonly ProfileRoute[] = [
  {
    apiPath: '/api/game/maimai2/profile',
    fixture: maimai2ProfileFixture,
    name: 'maimai2-profile',
    path: '/mai2/profile',
    readyText: maimai2ProfileFixture.userName,
    tableCount: 1,
  },
  {
    apiPath: '/api/game/chuni/v2/profile',
    fixture: chuniProfileFixture,
    name: 'chuni-profile',
    path: '/chuni/v2/profile',
    readyText: chuniProfileFixture.userName,
    tableCount: 2,
  },
];

interface SignInResponse {
  data?: unknown;
  status?: { code?: number };
}

interface AuthAccount {
  accessToken: string;
  tokenType: string;
}

interface UserResponse {
  data?: unknown;
  status?: { code?: number };
}

interface TestUser {
  cards?: Array<{ default?: boolean }>;
  defaultCard?: unknown;
  [key: string]: unknown;
}

interface DbVersionResponse {
  version?: { major?: number };
}

async function settlePage(page: Page, route: ProfileRoute) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 10_000 });
  await page.getByText(route.readyText, { exact: true }).waitFor({
    state: 'visible',
    timeout: 10_000,
  });
  await expect(page.locator('.card .table')).toHaveCount(route.tableCount);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
    window.scrollTo(0, 0);
  });
}

async function compareScreenshots(oldBuffer: Buffer, newBuffer: Buffer, testInfo: TestInfo) {
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

test.describe('newly migrated profile-page visual parity', () => {
  test.describe.configure({ timeout: 60_000 });
  test.skip(credentials === null, 'Set UI_TEST_USERNAME and UI_TEST_PASSWORD to run authenticated parity.');

  let account: unknown;
  let currentUser: unknown;
  let databaseVersion = 0;

  test.beforeAll(async ({ request }) => {
    if (!credentials) return;
    const [signIn, version] = await Promise.all([
      request.post(`${REACT_ORIGIN}/api/auth/signin`, {
        data: { usernameOrEmail: credentials.username, password: credentials.password },
      }),
      request.get(`${REACT_ORIGIN}/api/static/dbVersion`),
    ]);

    const signInBody = (await signIn.json()) as SignInResponse;
    const versionBody = (await version.json()) as DbVersionResponse;
    expect(signInBody.status?.code).toBe(92001);
    expect(signInBody.data).toBeTruthy();
    expect(versionBody.version?.major).toBeGreaterThan(0);
    account = signInBody.data;
    databaseVersion = versionBody.version?.major ?? 0;

    const authenticatedAccount = account as AuthAccount;
    const userResponse = await request.get(`${REACT_ORIGIN}/api/user/me`, {
      headers: {
        Authorization: `${authenticatedAccount.tokenType} ${authenticatedAccount.accessToken}`,
      },
    });
    const userBody = (await userResponse.json()) as UserResponse;
    expect(userBody.status?.code).toBe(92001);
    expect(userBody.data).toBeTruthy();
    const rawUser = userBody.data as TestUser;
    currentUser = {
      ...rawUser,
      defaultCard: rawUser.cards?.find((card) => card.default) ?? rawUser.defaultCard,
    };
  });

  for (const route of profileRoutes) {
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

      await context.route('**/*', async (browserRoute) => {
        const request = browserRoute.request();
        const url = new URL(request.url());
        const isPortalBusinessRequest =
          [LEGACY_ORIGIN, REACT_ORIGIN].includes(url.origin) &&
          (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));
        if (request.method() !== 'GET' && isPortalBusinessRequest) {
          await browserRoute.abort('blockedbyclient');
          return;
        }

        if (url.pathname.endsWith(route.apiPath)) {
          await browserRoute.fulfill({
            body: JSON.stringify(route.fixture),
            contentType: 'application/json',
            status: 200,
          });
          return;
        }
        if (/\/api\/game\/.*\/data\//.test(url.pathname)) {
          await browserRoute.fulfill({ body: '[]', contentType: 'application/json', status: 200 });
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
          authenticatedAccount: account,
          authenticatedUser: currentUser,
          selectedTheme: theme,
          selectedDatabaseVersion: databaseVersion,
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

      const [oldBuffer, newBuffer] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compareScreenshots(oldBuffer, newBuffer, testInfo);
      await context.close();
      });
    }
  }
});
