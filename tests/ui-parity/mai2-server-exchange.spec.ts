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
  id: 2,
  extId: 20000001,
  luid: 'fixture-mai2-card',
  default: true,
  registerTime: '2026-01-01T00:00:00+08:00',
  accessTime: '2026-08-31T12:00:00+08:00',
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

const pointData = { availablePoints: 500, totalPoints: 2_400 };

const missions = [
  {
    rewardType: 1,
    rewardTypeRelatedId: 1,
    missionTitle: '每日游玩任务',
    missionDescription: '在任意模式完成一次游玩。',
    rewardDescription: '任务点数 50',
    refreshCycle: 'EveryDay',
    conditionProgresses: [
      { current: 1, total: 1, isDone: true, description: '完成一次游玩' },
    ],
  },
  {
    rewardType: 1,
    rewardTypeRelatedId: 2,
    missionTitle: '每日乐曲任务',
    missionDescription: '游玩指定数量的不同乐曲。',
    rewardDescription: '任务点数 80',
    refreshCycle: 'EveryDay',
    conditionProgresses: [
      { current: 3, total: 5, isDone: false, description: '游玩不同乐曲' },
    ],
  },
  {
    rewardType: 1,
    rewardTypeRelatedId: 3,
    missionTitle: '每周累计任务',
    missionDescription: '本周累计完成十次游玩。',
    rewardDescription: '任务点数 200',
    refreshCycle: 'EveryWeek',
    conditionProgresses: [
      { current: 7, total: 10, isDone: false, description: '累计游玩次数' },
      { current: 0, total: 1, isDone: false, description: '完成一次多人游戏' },
    ],
  },
] as const;

const pointLogs = Array.from({ length: 23 }, (_, index) => ({
  reason: `Fixture point change ${index + 1}`,
  changedAmount: index % 3 === 0 ? 50 : index % 3 === 1 ? -20 : 0,
  recordDate: `2026-08-${String(31 - index).padStart(2, '0')}T${String(12 - (index % 8)).padStart(2, '0')}:34:56+08:00`,
}));

const exchangeItems = [
  {
    id: 1,
    itemType: 'Icon',
    itemId: 1,
    name: '可兑换头像',
    description: '一个可安全预览的测试头像。\n不会写入真实账户。',
    itemCount: 1,
    exchangedCount: 3,
    stockCount: -1,
    costPoints: 100,
    limitCount: 3,
    enable: true,
  },
  {
    id: 2,
    itemType: 'Plate',
    itemId: 1,
    name: '高价姓名框',
    description: '点数不足时应禁用兑换。',
    itemCount: 1,
    exchangedCount: 0,
    stockCount: 100,
    costPoints: 600,
    limitCount: -1,
    enable: true,
  },
  {
    id: 3,
    itemType: 'Title',
    itemId: 1,
    name: '尚未开放称号',
    description: '未开放商品。',
    itemCount: 1,
    exchangedCount: 0,
    stockCount: -1,
    costPoints: 10,
    limitCount: -1,
    enable: false,
  },
  {
    id: 4,
    itemType: 'Present',
    itemId: 1,
    name: '售罄礼物',
    description: '库存已经全部兑换。',
    itemCount: 5,
    exchangedCount: 10,
    stockCount: 10,
    costPoints: 20,
    limitCount: -1,
    enable: true,
  },
  {
    id: 5,
    itemType: 'Character',
    itemId: 1,
    name: '限购角色',
    description: '已达到个人兑换上限。',
    itemCount: 1,
    exchangedCount: 1,
    stockCount: 10,
    costPoints: 100,
    limitCount: 1,
    enable: true,
  },
  ...Array.from({ length: 18 }, (_, index) => ({
    id: index + 6,
    itemType: 'Icon' as const,
    itemId: index + 2,
    name: `分页头像 ${index + 2}`,
    description: '用于验证兑换商品分页。',
    itemCount: 1,
    exchangedCount: 0,
    stockCount: -1,
    costPoints: 50,
    limitCount: -1,
    enable: true,
  })),
];

const userExchangeItems = [
  { id: 1, exchangedTotalCount: 1, exchangedItemDataId: 1 },
  { id: 2, exchangedTotalCount: 1, exchangedItemDataId: 5 },
];

interface CapturedWrite {
  body: Record<string, unknown>;
  method: string;
  origin: string;
  path: string;
}

interface FixtureAudit {
  blockedWrites: string[];
  gets: string[];
  writes: CapturedWrite[];
}

function normalizedRequestBody(request: import('@playwright/test').Request): Record<string, unknown> {
  const raw = request.postData() ?? '';
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

function exchangeTypeValue(type: string): number {
  return {
    Plate: 1,
    Title: 2,
    Icon: 3,
    Present: 4,
    Character: 9,
    Partner: 10,
    Frame: 11,
    Ticket: 12,
    Mile: 13,
    KaleidxScopeKey: 15,
    DXPass: 901,
  }[type] ?? 0;
}

async function installFixtureApi(context: BrowserContext): Promise<FixtureAudit> {
  const audit: FixtureAudit = { blockedWrites: [], gets: [], writes: [] };

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;
    const isBusiness = isPortal && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));

    if (isBusiness && method !== 'GET') {
      if (method !== 'POST' || url.pathname !== '/api/game/maimai2/exchangeItem') {
        audit.blockedWrites.push(`${method} ${url.pathname}`);
        await route.abort('blockedbyclient');
        return;
      }
      const body = normalizedRequestBody(request);
      audit.writes.push({ body, method, origin: url.origin, path: url.pathname });
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: true, status: { code: 92001, message: 'OK' } }),
      });
      return;
    }

    if (!isPortal || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    audit.gets.push(`${url.origin}${url.pathname}?${url.searchParams.toString()}`);
    let body: unknown;
    if (url.pathname === '/api/account/status') {
      body = { data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' }, status: { code: 92001 } };
    } else if (url.pathname === '/api/user/me') {
      body = { data: fakeUser, status: { code: 92001 } };
    } else if (url.pathname === '/api/static/dbVersion') {
      body = { state: 'Success', version: { major: DB_VERSION } };
    } else if (url.pathname === '/api/game/maimai2/userServerMissionInfo') {
      body = { data: { serverMissionUserInfos: missions }, status: { code: 92001, message: 'OK' } };
    } else if (url.pathname === '/api/game/maimai2/userServerMissionPointInfo') {
      const page = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 10);
      body = {
        data: {
          userPointData: pointData,
          filterPointChangelogs: pointLogs.slice(page * size, page * size + size),
          changelogTotalCount: pointLogs.length,
        },
        status: { code: 92001, message: 'OK' },
      };
    } else if (url.pathname === '/api/game/maimai2/exchangeItemDataList') {
      const page = Number(url.searchParams.get('page') ?? 0);
      const size = Number(url.searchParams.get('size') ?? 20);
      const onlyEnable = url.searchParams.get('onlyEnable') !== 'false';
      const type = Number(url.searchParams.get('filterItemType') ?? 0);
      const search = (url.searchParams.get('searchPattern') ?? '').toLowerCase();
      const filtered = exchangeItems.filter((item) => {
        if (onlyEnable && !item.enable) return false;
        if (type && exchangeTypeValue(item.itemType) !== type) return false;
        return !search || item.name.toLowerCase().includes(search) || item.description.toLowerCase().includes(search);
      });
      body = {
        data: {
          filterExchangeItemDataList: filtered.slice(page * size, page * size + size),
          filterListTotalCount: filtered.length,
        },
        status: { code: 92001, message: 'OK' },
      };
    } else if (url.pathname === '/api/game/maimai2/userExchangeItemDataInfo') {
      body = {
        data: {
          exchangeItemDataList: userExchangeItems,
          filterExchangeItemChangelogList: [],
          changelogTotalCount: 0,
        },
        status: { code: 92001, message: 'OK' },
      };
    } else if (/^\/api\/game\/.*\/data\//.test(url.pathname)) {
      body = [];
    } else {
      body = { data: null, status: { code: 92001, message: 'OK' } };
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  return audit;
}

async function installStorage(
  context: BrowserContext,
  colorTheme: 'light' | 'dark',
  themeFamily: 'legacy' | 'modern' = 'legacy',
) {
  await context.addInitScript(
    ({ account, user, selectedColor, selectedFamily, origins, dbVersion }) => {
      if (!origins.includes(window.location.origin)) return;
      localStorage.setItem('currentAccount', JSON.stringify(account));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('lang', 'zh');
      localStorage.setItem('colorTheme', selectedColor);
      localStorage.setItem('themeFamily', selectedFamily);
      localStorage.setItem('dbVersion', String(dbVersion));
      Math.random = () => 0.5;
    },
    {
      account: fakeAccount,
      user: fakeUser,
      selectedColor: colorTheme,
      selectedFamily: themeFamily,
      origins: [LEGACY_ORIGIN, REACT_ORIGIN],
      dbVersion: DB_VERSION,
    },
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
            const done = () => {
              window.clearTimeout(timeout);
              image.removeEventListener('load', done);
              image.removeEventListener('error', done);
              resolve();
            };
            const timeout = window.setTimeout(done, 5_000);
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      }),
    );
  });
  await page.mouse.move(0, 0);
}

async function settleServerMissions(page: Page) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('.mission-card')).toHaveCount(missions.length, { timeout: 30_000 });
  await expect(page.locator('.changelog-table-container tbody tr')).toHaveCount(10, { timeout: 30_000 });
  await expect(page.locator('.available-points')).toHaveText('500');
  await settleImages(page);
  windowScrollTop(page);
}

async function settlePointExchanges(page: Page) {
  await page.getByRole('heading', { name: '任务点数兑换 - 舞萌DX' }).waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('.exchange-card')).toHaveCount(20, { timeout: 30_000 });
  await expect(page.getByText('我的可用任务点数:').locator('span')).toHaveText('500');
  await settleImages(page);
  windowScrollTop(page);
}

function windowScrollTop(page: Page) {
  void page.evaluate(() => window.scrollTo(0, 0));
}

async function compare(
  legacyBuffer: Buffer,
  reactBuffer: Buffer,
  testInfo: TestInfo,
  label: string,
) {
  const legacy = PNG.sync.read(legacyBuffer);
  const react = PNG.sync.read(reactBuffer);
  expect({ width: react.width, height: react.height }).toEqual({ width: legacy.width, height: legacy.height });
  const diff = new PNG({ width: legacy.width, height: legacy.height });
  const mismatchedPixels = pixelmatch(legacy.data, react.data, diff.data, legacy.width, legacy.height, {
    includeAA: false,
    threshold: 0.1,
  });
  const ratio = mismatchedPixels / (legacy.width * legacy.height);
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  const legacyPath = path.join(testInfo.outputDir, `${label}-legacy.png`);
  const reactPath = path.join(testInfo.outputDir, `${label}-react.png`);
  const diffPath = path.join(testInfo.outputDir, `${label}-diff.png`);
  await Promise.all([
    fs.writeFile(legacyPath, legacyBuffer),
    fs.writeFile(reactPath, reactBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
  ]);
  expect(ratio, `${label} visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

async function openPair(context: BrowserContext, pathName: string) {
  const legacy = await context.newPage();
  const react = await context.newPage();
  await Promise.all([
    legacy.goto(`${LEGACY_ORIGIN}${pathName}`, { waitUntil: 'domcontentloaded' }),
    react.goto(`${REACT_ORIGIN}${pathName}`, { waitUntil: 'domcontentloaded' }),
  ]);
  return { legacy, react };
}

test.describe('Mai2 server missions and point exchanges parity', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const theme of themes) {
    test(`default pages match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
        viewport: { width: 1280, height: 720 },
      });
      const audit = await installFixtureApi(context);
      await installStorage(context, theme);

      const serverPages = await openPair(context, '/mai2/servermissions');
      await Promise.all([settleServerMissions(serverPages.legacy), settleServerMissions(serverPages.react)]);
      const [legacyServer, reactServer] = await Promise.all([
        serverPages.legacy.screenshot({ animations: 'disabled', caret: 'hide' }),
        serverPages.react.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(legacyServer, reactServer, testInfo, `server-missions-${theme}`);
      await Promise.all([serverPages.legacy.close(), serverPages.react.close()]);

      const exchangePages = await openPair(context, '/mai2/pointexchanges');
      await Promise.all([settlePointExchanges(exchangePages.legacy), settlePointExchanges(exchangePages.react)]);
      const [legacyExchange, reactExchange] = await Promise.all([
        exchangePages.legacy.screenshot({ animations: 'disabled', caret: 'hide' }),
        exchangePages.react.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(legacyExchange, reactExchange, testInfo, `point-exchanges-${theme}`);

      expect(audit.writes).toEqual([]);
      expect(audit.blockedWrites).toEqual([]);
      await context.close();
    });
  }

  test('filters, changelog pagination, exchange panel, and safe confirmation match', async ({ browser }, testInfo) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(context);
    await installStorage(context, 'light');

    const serverPages = await openPair(context, '/mai2/servermissions');
    await Promise.all([settleServerMissions(serverPages.legacy), settleServerMissions(serverPages.react)]);
    for (const page of [serverPages.legacy, serverPages.react]) {
      await page.locator('label[for="hideCompleted"]').click();
      await expect(page.locator('.mission-card')).toHaveCount(2);
      await page.getByText('下一页', { exact: true }).click();
      await expect(page.locator('.changelog-table-container tbody tr').first()).toContainText('Fixture point change 11');
      await page.getByRole('button', { name: '兑换', exact: true }).click();
      const dialog = page.getByRole('dialog').first();
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.exchange-card')).toHaveCount(20, { timeout: 30_000 });
      await settleImages(page);
    }
    const [legacyOuter, reactOuter] = await Promise.all([
      serverPages.legacy.getByRole('dialog').first().locator('.modal-content').screenshot({ animations: 'disabled', caret: 'hide' }),
      serverPages.react.getByRole('dialog').first().locator('.modal-content').screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await compare(legacyOuter, reactOuter, testInfo, 'server-exchange-modal');
    for (const page of [serverPages.legacy, serverPages.react]) {
      await page.getByRole('dialog').first().getByRole('button', { name: '关闭', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await Promise.all([serverPages.legacy.close(), serverPages.react.close()]);

    const exchangePages = await openPair(context, '/mai2/pointexchanges');
    await Promise.all([settlePointExchanges(exchangePages.legacy), settlePointExchanges(exchangePages.react)]);
    for (const page of [exchangePages.legacy, exchangePages.react]) {
      await page.locator('select').selectOption({ label: '头像' });
      await expect(page.locator('.exchange-card')).toHaveCount(19);
      await page.locator('input[placeholder]').fill('可兑换头像');
      await page.locator('input[placeholder]').press('Enter');
      await expect(page.locator('.exchange-card')).toHaveCount(1);
      await page.locator('input[placeholder]').fill('');
      await page.locator('select').selectOption({ label: '全部类型' });
      await expect(page.locator('.exchange-card')).toHaveCount(20);
      await page.locator('.pagination').getByText('2', { exact: true }).click();
      await expect(page.locator('.exchange-card')).toHaveCount(2);
      await page.locator('.pagination').getByText('1', { exact: true }).click();
      await expect(page.locator('.exchange-card').first()).toContainText('可兑换头像');
      await page.locator('.exchange-card').first().getByRole('button', { name: '兑换', exact: true }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText('确认使用 100 任务点数兑换此物品吗？');
    }
    const [legacyConfirm, reactConfirm] = await Promise.all([
      exchangePages.legacy.getByRole('dialog').locator('.modal-content').screenshot({ animations: 'disabled', caret: 'hide' }),
      exchangePages.react.getByRole('dialog').locator('.modal-content').screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await compare(legacyConfirm, reactConfirm, testInfo, 'exchange-confirm-modal');
    for (const page of [exchangePages.legacy, exchangePages.react]) {
      await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await page.locator('.exchange-card').first().getByRole('button', { name: '兑换', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: '确认兑换', exact: true }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }

    await expect.poll(() => audit.writes.length).toBe(2);
    expect(audit.writes.map((write) => ({
      aimeId: String(write.body.aimeId),
      exchangeId: Number(write.body.exchangeId),
    }))).toEqual([
      { aimeId: '20000001', exchangeId: 1 },
      { aimeId: '20000001', exchangeId: 1 },
    ]);
    expect(audit.blockedWrites).toEqual([]);
    await context.close();
  });

  test('modern theme smoke renders both pages and a safe modal', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(context);
    await installStorage(context, 'light', 'modern');
    const page = await context.newPage();
    await page.goto(`${REACT_ORIGIN}/mai2/servermissions`, { waitUntil: 'domcontentloaded' });
    await settleServerMissions(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'modern');
    await page.getByRole('button', { name: '兑换', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
    await page.goto(`${REACT_ORIGIN}/mai2/pointexchanges`, { waitUntil: 'domcontentloaded' });
    await settlePointExchanges(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'modern');
    await page.locator('.exchange-card').first().getByRole('button', { name: '兑换', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('确认兑换');
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    expect(audit.writes).toEqual([]);
    expect(audit.blockedWrites).toEqual([]);
    await context.close();
  });
});
