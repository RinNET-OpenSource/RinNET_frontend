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

const fakeAccount = { accessToken: 'fixture-access-token', refreshToken: 'fixture-refresh-token', tokenType: 'Bearer' };
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

const joinedCircle = {
  circleId: 77,
  circleClass: 4,
  circleName: 'Fixture Circle',
  isPlace: false,
  placeId: 291,
  isPublic: true,
  aggrDate: '2026-09-02',
  circleCode: 'FIXTURE77',
  comment: 'Fixture circle comment\nSecond line',
  isAllowAnyoneJoin: false,
};

const userCircleInfo = {
  joinedCircle,
  circleChallenge: {
    circleId: 77,
    musicId: 1,
    updateDate: '2026-09-02 07:00:00',
    rewardStatus: true,
    achievement: 8_123_450,
  },
  userCircleData: { id: 1, circleId: 77, lastLoginDate: '2026-09-02 20:30:00' },
  userCirclePointData: {
    id: 1,
    circleId: 77,
    userName: 'Fixture Owner',
    aggrDate: '2026-09-02',
    point: 12_345,
    recordDate: '2026-09-02',
    rewardGet: true,
  },
  userCirclePointRankingResult: {
    id: 1,
    circleId: 77,
    aggrDate: '2026-09-01',
    circleName: 'Fixture Circle',
    lastMonthCircleRank: 12,
    lastMonthPoint: 98_765,
  },
  userCircleChallenge: {
    circleId: 77,
    updateDate: '2026-09-02 20:30:00',
    achievement: 1_009_500,
    musicId: 1,
    rewardGet: true,
  },
  isCircleOwner: true,
};

function musicDetail(id: number, diff: number, levelDecimal: number) {
  return {
    id,
    tapCount: 100,
    holdCount: 20,
    breakCount: 5,
    slideCount: 30,
    touchCount: 10,
    levelDecimal,
    noteDesigner: 'Fixture Designer',
    utageComment: '',
    utageKanji: '',
    tsuikaVersion: 0,
    diff,
  };
}

const challengeMusic = {
  musicId: 1,
  name: 'Fixture Challenge Song',
  artistName: 'Fixture Artist',
  sortName: 'FIXTURE CHALLENGE SONG',
  genreId: 105,
  romVersion: 3000,
  addVersion: 23,
  details: [
    musicDetail(10, 0, 30),
    musicDetail(11, 1, 70),
    musicDetail(12, 2, 105),
    musicDetail(13, 3, 132),
    musicDetail(14, 4, 140),
    null,
  ],
};

function pointData(index: number) {
  return {
    id: index,
    circleId: 77,
    userName: `Member ${index}`,
    aggrDate: '2026-09-02',
    point: 2000 + index,
    recordDate: '2026-09-02',
    rewardGet: index % 2 === 0,
  };
}

function member(index: number) {
  return {
    userCode: `MEMBER-${index}`,
    userProfile: { userName: `Fixture Member ${index}`, playerRating: 14000 + index },
    userCircleData: { id: index, circleId: 77, lastLoginDate: `2026-09-0${Math.min(index, 9)} 12:00:00` },
    userCirclePointData: pointData(index),
    userCircleChallenge: {
      circleId: 77,
      updateDate: '2026-09-02',
      achievement: 900_000 + index * 1000,
      musicId: 1,
      rewardGet: false,
    },
  };
}

const memberPages = [[member(1), member(2)], [member(11), member(12)]];
const joinRequests = [
  {
    userCode: 'REQUEST-1',
    requestTime: '2026-09-02 18:00:00',
    userProfile: {
      userName: 'Fixture Applicant',
      playerRating: 13500,
      classRank: 8,
      gradeRank: 10,
      lastPlayDate: '2026-09-02 17:30:00',
    },
  },
];

const publicCirclePages = [
  [
    { ...joinedCircle, circleId: 101, circleName: 'Public Alpha', placeId: 100, circleClass: 2, comment: 'Alpha comment' },
    { ...joinedCircle, circleId: 102, circleName: 'Public Beta', placeId: 200, circleClass: 3, comment: 'Beta comment' },
  ],
  [{ ...joinedCircle, circleId: 111, circleName: 'Public Page Two', placeId: 300, circleClass: 4, comment: 'Page two' }],
];

const currentFesta = {
  name: 'Fixture Festa',
  collaboration: 0,
  seasonNum: 1,
  festaTitle: 'Red VS Blue VS Green',
  festaSide01: '红队',
  festaSide02: '蓝队',
  festaSide03: '绿队',
  musicClearPoint: 10,
  rallyPoint1st: 30,
  rallyPoint2nd: 20,
  rallyPoint3rd: 10,
  bonusPoint2p: 5,
  daliyBonus: 100,
  rewardBorder: 5000,
  rewardType: 1,
  rewardId: 1,
  openEventId: '260827',
  resultEventId: '260910',
  themeInfoFile: '',
  rewardInfoFile: '',
  netOpenName: '',
  releaseTagName: 'PRiSM PLUS',
  finalResultFile: '',
  rightFile: '',
  priority: 1,
  dataName: '',
  festaPhaseState: 'started',
};

const resultFesta = {
  ...currentFesta,
  name: 'Fixture Previous Festa',
  festaTitle: 'Previous Result',
  openEventId: '260730',
  resultEventId: '260813',
  festaPhaseState: 'finished',
};

const currentSideData = [
  { festaSideId: 1, rankInPlace: 1, advantagePercent: 46 },
  { festaSideId: 2, rankInPlace: 2, advantagePercent: 34 },
  { festaSideId: 3, rankInPlace: 3, advantagePercent: 20 },
];

const gameFestaInfo = {
  gameFesta: currentFesta,
  gameFestaData: {
    eventId: 260827,
    isRallyPeriod: true,
    isCircleJoinNotAllowed: false,
    jackingFestaSideId: 1,
    festaSideDataList: currentSideData,
  },
  gameRsultFesta: resultFesta,
  gameResultFestaData: {
    eventId: 260730,
    resultFestaSideDataList: currentSideData.map((side) => ({ ...side, rank: side.rankInPlace })),
  },
};

const currentUserFestaInfo = {
  circle: joinedCircle,
  circleFestaData: {
    circleId: 77,
    eventId: 260827,
    festaSideId: 1,
    placeId: 291,
    totalPoint: 123456,
    circleName: 'Fixture Circle',
  },
  userFestaData: {
    eventId: 260827,
    circleId: 77,
    festaSideId: 1,
    circleTotalFestaPoint: 123456,
    currentTotalFestaPoint: 4321,
    circleRankInFestaSide: 2,
    circleRecordDate: '2026-09-02',
    isDailyBonus: true,
    participationRewardGet: false,
    receivedRewardBorder: 679,
    circleName: 'Fixture Circle',
    placeId: 291,
  },
  userResultFestaData: null,
};

const resultUserFestaInfo = {
  ...currentUserFestaInfo,
  circleFestaData: { ...currentUserFestaInfo.circleFestaData, eventId: 260730, totalPoint: 98765 },
  userFestaData: { ...currentUserFestaInfo.userFestaData, eventId: 260730, currentTotalFestaPoint: 3456 },
  userResultFestaData: {
    eventId: 260813,
    circleId: 77,
    circleName: 'Fixture Circle',
    festaSideId: 2,
    circleRankInFestaSide: 3,
    receivedRewardBorder: 0,
    circleTotalFestaPoint: 98765,
    resultRewardGet: 1,
  },
};

const sameRanks = [
  { circleFestaData: { circleId: 1, eventId: 260827, festaSideId: 1, placeId: 291, totalPoint: 150000, circleName: 'Circle One' }, rank: 1 },
  { circleFestaData: { circleId: 2, eventId: 260827, festaSideId: 1, placeId: 291, totalPoint: 125000, circleName: 'Circle Two' }, rank: 2 },
  { circleFestaData: { circleId: 3, eventId: 260827, festaSideId: 1, placeId: 291, totalPoint: 100000, circleName: 'Circle Three' }, rank: 3 },
];
const allRanks = sameRanks.map((item, index) => ({
  circleFestaData: { ...item.circleFestaData, circleId: item.circleFestaData.circleId + 10, festaSideId: index + 1 },
  rank: item.rank,
}));

async function installFixtureApi(context: BrowserContext) {
  const blockedStateChanges: string[] = [];
  const observedReads: string[] = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;
    const isBusinessApi = isPortal && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));
    const stateChangingGet = url.pathname === '/api/game/maimai2/voteSide';
    if (isBusinessApi && (request.method() !== 'GET' || stateChangingGet)) {
      blockedStateChanges.push(`${request.method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    if (!isPortal || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    observedReads.push(`${url.pathname}?${url.searchParams.toString()}`);

    let body: unknown;
    if (url.pathname === '/api/account/status') {
      body = { data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' }, status: { code: 92001 } };
    } else if (url.pathname === '/api/user/me') {
      body = { data: fakeUser, status: { code: 92001 } };
    } else if (url.pathname === '/api/static/dbVersion') {
      body = { state: 'Success', version: { major: DB_VERSION } };
    } else if (url.pathname === '/api/game/maimai2/userCircleInfo') {
      body = { data: userCircleInfo, status: { code: 92001 } };
    } else if (url.pathname === '/api/game/maimai2/data/music') {
      body = challengeMusic;
    } else if (url.pathname === '/api/game/maimai2/circle') {
      const page = Number(url.searchParams.get('page') ?? 0);
      body = { content: publicCirclePages[page] ?? [], page, totalElements: 12, totalPages: 2 };
    } else if (url.pathname === '/api/game/maimai2/circleMemberUser') {
      const page = Number(url.searchParams.get('page') ?? 0);
      body = { content: memberPages[page] ?? [], page, totalElements: 12, totalPages: 2 };
    } else if (url.pathname === '/api/game/maimai2/requestJoinCircleList') {
      body = { content: joinRequests, page: 0, totalElements: joinRequests.length, totalPages: 1 };
    } else if (url.pathname === '/api/game/maimai2/gameFestaInfo') {
      body = { data: gameFestaInfo, status: { code: 92001 } };
    } else if (url.pathname === '/api/game/maimai2/userFestaInfo') {
      body = {
        data: url.searchParams.get('relativeEventId') === resultFesta.openEventId
          ? resultUserFestaInfo
          : currentUserFestaInfo,
        status: { code: 92001 },
      };
    } else if (url.pathname === '/api/game/maimai2/rankFestaCircles') {
      const sameSide = url.searchParams.get('filterFestaSideId') !== '-1';
      body = { content: sameSide ? sameRanks : allRanks, page: 0, totalElements: 3, totalPages: 1 };
    } else if (/^\/api\/game\/.*\/data\//.test(url.pathname)) {
      body = [];
    } else {
      body = { data: null, status: { code: 92001 } };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  return { blockedStateChanges, observedReads };
}

async function installStorage(context: BrowserContext, theme: 'light' | 'dark', family: 'legacy' | 'modern' = 'legacy') {
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

async function settle(page: Page, marker: string) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByText(marker, { exact: false }).first().waitFor({ state: 'visible', timeout: 30_000 });
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
  await Promise.all([
    fs.writeFile(path.join(testInfo.outputDir, `${label}-old.png`), oldBuffer),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-new.png`), newBuffer),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-diff.png`), PNG.sync.write(diff)),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-comparison.json`), JSON.stringify({ ratio, mismatchedPixels }, null, 2)),
  ]);
  expect(ratio, `${label} visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

async function openPair(context: BrowserContext, route: string, marker: string) {
  const oldPage = await context.newPage();
  const newPage = await context.newPage();
  await Promise.all([
    oldPage.goto(`${LEGACY_ORIGIN}${route}`, { waitUntil: 'domcontentloaded' }),
    newPage.goto(`${REACT_ORIGIN}${route}`, { waitUntil: 'domcontentloaded' }),
  ]);
  await Promise.all([settle(oldPage, marker), settle(newPage, marker)]);
  return { oldPage, newPage };
}

test.describe('Maimai2 Circle and Festa parity', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of themes) {
    test(`Circle default and editor match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
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
      const audit = await installFixtureApi(context);
      await installStorage(context, theme);
      const { oldPage, newPage } = await openPair(context, '/mai2/circle', 'Fixture Circle');
      const [oldDefault, newDefault] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldDefault, newDefault, testInfo, `circle-${theme}-default`);

      await Promise.all([
        oldPage.getByRole('button', { name: '编辑圈子' }).click(),
        newPage.getByRole('button', { name: '编辑圈子' }).click(),
      ]);
      await Promise.all([
        oldPage.locator('ngb-modal-window').waitFor({ state: 'visible' }),
        newPage.locator('.maimai2-circle-dialog').waitFor({ state: 'visible' }),
      ]);
      await Promise.all([
        oldPage.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()),
        newPage.evaluate(() => (document.activeElement as HTMLElement | null)?.blur()),
      ]);
      const [oldModal, newModal] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldModal, newModal, testInfo, `circle-${theme}-editor`);

      await Promise.all([
        oldPage.getByRole('button', { name: '取消' }).click(),
        newPage.getByRole('button', { name: '取消' }).click(),
      ]);
      const oldManagement = oldPage.getByRole('heading', { name: '管理圈子' }).locator('..');
      const newManagement = newPage.getByRole('heading', { name: '管理圈子' }).locator('..');
      await Promise.all([
        oldManagement.locator('.pagination').first().locator('.page-item').last().locator('a').click(),
        newManagement.locator('.pagination').first().locator('.page-item').last().locator('a').click(),
      ]);
      await Promise.all([
        oldPage.getByText('Fixture Member 11').waitFor(),
        newPage.getByText('Fixture Member 11').waitFor(),
      ]);
      expect(audit.observedReads.some((entry) => entry.includes('/circleMemberUser') && entry.includes('page=1'))).toBeTruthy();
      expect(audit.blockedStateChanges, 'Circle regression must not attempt a state change').toEqual([]);
      await context.close();
    });

    test(`Festa current and result sections match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
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
      const audit = await installFixtureApi(context);
      await installStorage(context, theme);
      const { oldPage, newPage } = await openPair(context, '/mai2/festa', 'Fixture Festa');
      const [oldDefault, newDefault] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldDefault, newDefault, testInfo, `festa-${theme}-default`);

      const oldCurrent = oldPage.getByRole('heading', { name: /当前进行的Festa活动/ });
      const newCurrent = newPage.getByRole('heading', { name: /当前进行的Festa活动/ });
      await Promise.all([
        oldCurrent.getByRole('checkbox', { name: '全服' }).first().check(),
        newCurrent.getByRole('checkbox', { name: '全服' }).first().check(),
      ]);
      await Promise.all([
        expect(oldCurrent.getByText('Circle One #291')).toBeVisible(),
        expect(newCurrent.getByText('Circle One #291')).toBeVisible(),
      ]);
      const [oldGlobal, newGlobal] = await Promise.all([
        oldCurrent.screenshot({ animations: 'disabled', caret: 'hide' }),
        newCurrent.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldGlobal, newGlobal, testInfo, `festa-${theme}-global-ranking`);
      expect(audit.observedReads.some((entry) => entry.includes('/rankFestaCircles') && entry.includes('placeId=-1'))).toBeTruthy();
      expect(audit.blockedStateChanges, 'Festa regression must not attempt voting or another state change').toEqual([]);
      await context.close();
    });
  }

  test('Modern theme keeps Circle and Festa read-only interactions functional', async ({ browser }) => {
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
    const audit = await installFixtureApi(context);
    await installStorage(context, 'light', 'modern');
    const page = await context.newPage();

    await page.goto(`${REACT_ORIGIN}/mai2/circle`, { waitUntil: 'domcontentloaded' });
    await settle(page, 'Fixture Circle');
    await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'modern');
    await page.getByRole('button', { name: '编辑圈子' }).click();
    await expect(page.locator('#circleNameInput')).toHaveValue('Fixture Circle');
    await page.getByRole('button', { name: '取消' }).click();

    await page.goto(`${REACT_ORIGIN}/mai2/festa`, { waitUntil: 'domcontentloaded' });
    await settle(page, 'Fixture Festa');
    await page.getByRole('checkbox', { name: '全服' }).first().check();
    await expect(page.getByText('Circle One #291')).toBeVisible();
    expect(audit.blockedStateChanges, 'Modern smoke must stay read-only').toEqual([]);
    await context.close();
  });
});
