import { expect, test, type BrowserContext, type Locator, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const DB_VERSION = 6;
const PAGE_SIZE = 12;
const themes = ['light', 'dark'] as const;
const IMPERSONATED_ACCOUNT_KEY = 'impersonatedAccount';

const fakeAccount = {
  accessToken: 'fixture-admin-access',
  refreshToken: 'fixture-admin-refresh',
  tokenType: 'Bearer',
};

const adminCard = {
  id: 1,
  extId: 10000001,
  luid: '01234567890123456789',
  default: true,
  registerTime: '2026-01-01T00:00:00+08:00',
  accessTime: '2026-08-31T12:00:00+08:00',
  cardExternalList: [],
};

const fakeAdmin = {
  id: 1,
  username: 'admin-fixture',
  name: 'Fixture Admin',
  email: 'admin@example.invalid',
  roles: [{ id: 1, name: 'ROLE_ADMIN' }, { id: 2, name: 'ROLE_USER' }],
  games: [],
  cards: [adminCard],
  defaultCard: adminCard,
  keychips: [],
  userTrustKeychips: [],
  oauth2s: [],
};

const users = Array.from({ length: 13 }, (_, index) => {
  const number = index + 1;
  const card = {
    id: number + 10,
    extId: 20000000 + number,
    luid: `300000000000000000${String(number).padStart(2, '0')}`,
    default: number === 1,
    registerTime: '2025-01-01T00:00:00+08:00',
    accessTime: '2026-08-31T12:00:00+08:00',
    cardExternalList: number === 1 ? [{ id: 501, luid: '40000000000000000001' }] : [],
  };
  return {
    user: {
      id: 100 + number,
      username: `fixture-user-${String(number).padStart(2, '0')}`,
      name: `测试用户 ${number}`,
      email: `fixture${number}@example.invalid`,
      roles: number === 2 ? [] : [{ id: 2, name: 'ROLE_USER' }],
      games: ['chusan', 'ongeki', 'maimai2'],
      cards: [card],
      defaultCard: card,
      keychips: [],
      userTrustKeychips: [],
      oauth2s: number === 1 ? [{ id: 701, provider: 'github', email: 'linked@example.invalid' }] : [],
    },
    gameProfiles: [{
      card,
      chusan: { userName: `CHUNI USER ${number}`, playerRating: 1523, banState: 0 },
      ongeki: { userName: `ONGEKI USER ${number}`, playerRating: 1478, banStatus: 1 },
      maimai2: { userName: `MAI USER ${number}`, playerRating: 14567, banState: 0 },
    }],
  };
});

const keychips = Array.from({ length: 13 }, (_, index) => ({
  id: index + 1,
  keychipId: `A39E01A${String(index + 1).padStart(4, '0')}`,
  user: index % 3 === 0 ? { name: `店铺用户 ${index + 1}` } : null,
  placeName: `Fixture Arcade ${index + 1}`,
  whiteListed: index % 2 === 0,
}));

const support = {
  account: {
    username: 'fixture-user-01',
    joinedAt: '2026-02-03T10:25:00+08:00',
    cards: [{
      extId: 20000001,
      defaultCard: true,
      externalLuids: ['40000000000000000001'],
    }],
  },
  totpEnabled: true,
  passkeys: [{ id: 801, nick: 'Fixture Passkey' }],
  oauthIdentities: [{ id: 901, provider: 'discord', email: 'oauth@example.invalid' }],
  eulaStatus: { currentVersion: 3, acceptedVersion: 2, required: true },
};

const eula = {
  current: {
    version: 3,
    title: 'RinNET 用户协议 v3',
    content: '# 当前协议\n\n这是已经发布的内容。',
  },
  draft: {
    version: 4,
    title: 'RinNET 用户协议 v4 草稿',
    content: '## 欢迎使用 RinNET\n\n- 请妥善保管账户\n- 请遵守服务规则\n\n**Fixture preview**',
  },
};

interface CapturedWrite {
  body: Record<string, unknown>;
  method: string;
  origin: string;
  path: string;
  query: Record<string, string>;
}

interface CapturedRequest {
  authorization: string | null;
  method: string;
  origin: string;
  path: string;
  query: Record<string, string>;
}

interface Audit {
  blockedWrites: string[];
  requests: CapturedRequest[];
  writes: CapturedWrite[];
}

interface FixtureApiOptions {
  loginAsDelayMs?: number;
  loginAsResponse?: (ordinal: number) => typeof fakeAccount;
}

function requestBody(request: import('@playwright/test').Request): Record<string, unknown> {
  const raw = request.postData() ?? '';
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
}

function filteredUsers(url: URL) {
  const pattern = (url.searchParams.get('pattern') ?? '').toLowerCase();
  const field = url.searchParams.get('field') ?? 'all';
  const filtered = users.filter((item) => {
    if (!pattern) return true;
    const values: Record<string, string> = {
      username: item.user.username,
      name: item.user.name,
      email: item.user.email,
      game: item.gameProfiles.map((profile) => [profile.chusan?.userName, profile.ongeki?.userName, profile.maimai2?.userName].join(' ')).join(' '),
      card: item.gameProfiles.map((profile) => profile.card.luid).join(' '),
      extId: item.gameProfiles.map((profile) => String(profile.card.extId)).join(' '),
    };
    return field === 'all'
      ? Object.values(values).some((value) => value.toLowerCase().includes(pattern))
      : (values[field] ?? '').toLowerCase().includes(pattern);
  });
  const page = Number(url.searchParams.get('page') ?? 0);
  return {
    content: filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    totalElements: filtered.length,
  };
}

function filteredKeychips(url: URL) {
  const pattern = (url.searchParams.get('pattern') ?? '').toLowerCase();
  const filtered = keychips.filter((item) => !pattern || item.keychipId.toLowerCase().includes(pattern));
  const page = Number(url.searchParams.get('page') ?? 0);
  return {
    content: filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    totalElements: filtered.length,
  };
}

async function installFixtureApi(
  context: BrowserContext,
  allowedWrites: ReadonlySet<string> = new Set(),
  options: FixtureApiOptions = {},
): Promise<Audit> {
  const audit: Audit = { blockedWrites: [], requests: [], writes: [] };
  let loginAsOrdinal = 0;
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;
    const isBusiness = isPortal && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));

    if (isBusiness) {
      audit.requests.push({
        authorization: request.headers().authorization ?? null,
        method,
        origin: url.origin,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
      });
    }

    if (isBusiness && method !== 'GET') {
      const signature = `${method} ${url.pathname}`;
      if (!allowedWrites.has(signature)) {
        audit.blockedWrites.push(signature);
        await route.abort('blockedbyclient');
        return;
      }
      audit.writes.push({
        body: requestBody(request),
        method,
        origin: url.origin,
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
      });
      let data: unknown = true;
      if (url.pathname.includes('/loginas/')) {
        loginAsOrdinal += 1;
        if (options.loginAsDelayMs) {
          await new Promise((resolve) => setTimeout(resolve, options.loginAsDelayMs));
        }
        data = options.loginAsResponse?.(loginAsOrdinal)
          ?? { accessToken: 'fixture-target-access', refreshToken: 'fixture-target-refresh', tokenType: 'Bearer' };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data, status: { code: 92001, message: 'Fixture write accepted' } }),
      });
      return;
    }

    if (!isPortal || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    let body: unknown;
    if (url.pathname === '/api/account/status') {
      body = { data: { banned: false, eulaRequired: false, acceptedEulaVersion: 3, appeal: '' }, status: { code: 92001 } };
    } else if (url.pathname === '/api/user/me') {
      const authorization = request.headers().authorization ?? '';
      const user = authorization.startsWith('Bearer fixture-target-access')
        ? users[0].user
        : authorization === 'Bearer fixture-user-access'
          ? users[2].user
          : fakeAdmin;
      body = { data: user, status: { code: 92001 } };
    } else if (url.pathname === '/api/static/dbVersion') {
      body = { state: 'Success', version: { major: DB_VERSION } };
    } else if (url.pathname === '/api/admin/advancedUserSearch') {
      body = { data: filteredUsers(url), status: { code: 92001, message: 'OK' } };
    } else if (url.pathname === '/api/admin/keychip') {
      body = { data: filteredKeychips(url), status: { code: 92001, message: 'OK' } };
    } else if (/^\/api\/admin\/accounts\/[^/]+$/.test(url.pathname)) {
      const username = decodeURIComponent(url.pathname.split('/').at(-1) ?? 'fixture-user-01');
      body = { data: { ...support, account: { ...support.account, username } }, status: { code: 22001, message: 'OK' } };
    } else if (url.pathname === '/api/admin/eula') {
      body = { data: eula, status: { code: 92001, message: 'OK' } };
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
  themeFamily: 'legacy' | 'liquefy' = 'legacy',
  overrides: { account?: unknown; user?: unknown } = {},
) {
  await context.addInitScript(
    ({ account, user, color, family, origins, dbVersion }) => {
      if (!origins.includes(window.location.origin)) return;
      localStorage.setItem('currentAccount', JSON.stringify(account));
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('lang', 'zh');
      localStorage.setItem('colorTheme', color);
      localStorage.setItem('themeFamily', family);
      localStorage.setItem('dbVersion', String(dbVersion));
      Math.random = () => 0.5;
    },
    {
      account: overrides.account ?? fakeAccount,
      user: overrides.user ?? fakeAdmin,
      color: colorTheme,
      family: themeFamily,
      origins: [LEGACY_ORIGIN, REACT_ORIGIN],
      dbVersion: DB_VERSION,
    },
  );
}

async function openPair(context: BrowserContext) {
  const legacy = await context.newPage();
  const react = await context.newPage();
  await Promise.all([
    legacy.goto(`${LEGACY_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' }),
    react.goto(`${REACT_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' }),
  ]);
  return { legacy, react };
}

async function settleUsers(page: Page) {
  await page.getByRole('heading', { name: '管理员' }).waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('.row-cols-xl-3 .card-btn')).toHaveCount(PAGE_SIZE, { timeout: 30_000 });
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.mouse.move(0, 0);
}

async function openFirstUserDetail(page: Page): Promise<Locator> {
  await settleUsers(page);
  await page.locator('.row-cols-xl-3 .card-btn').first().click();
  const detail = page.getByRole('dialog').first();
  await expect(detail).toContainText('Fixture Passkey');
  return detail;
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
  const mismatched = pixelmatch(legacy.data, react.data, diff.data, legacy.width, legacy.height, {
    includeAA: false,
    threshold: 0.1,
  });
  const ratio = mismatched / (legacy.width * legacy.height);
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(testInfo.outputDir, `${label}-legacy.png`), legacyBuffer),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-react.png`), reactBuffer),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-diff.png`), PNG.sync.write(diff)),
  ]);
  expect(ratio, `${label} visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

test.describe('Admin page parity and safety', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const theme of themes) {
    test(`default user search matches Angular in ${theme} mode`, async ({ browser }, testInfo) => {
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
      const pages = await openPair(context);
      await Promise.all([settleUsers(pages.legacy), settleUsers(pages.react)]);
      const [legacy, react] = await Promise.all([
        pages.legacy.screenshot({ animations: 'disabled', caret: 'hide' }),
        pages.react.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(legacy, react, testInfo, `admin-users-${theme}`);

      for (const page of [pages.legacy, pages.react]) {
        await page.getByRole('button', { name: '创建用户', exact: true }).click();
        await expect(page.getByRole('dialog')).toBeVisible();
      }
      const [legacyCreate, reactCreate] = await Promise.all([
        pages.legacy.getByRole('dialog').screenshot({ animations: 'disabled', caret: 'hide' }),
        pages.react.getByRole('dialog').screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(legacyCreate, reactCreate, testInfo, `admin-create-user-${theme}`);
      for (const page of [pages.legacy, pages.react]) {
        await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
      }
      expect(audit.writes).toEqual([]);
      expect(audit.blockedWrites).toEqual([]);
      await context.close();
    });
  }

  test('pagination, search, support details, raw JSON, and confirmation guards match', async ({ browser }, testInfo) => {
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
    const pages = await openPair(context);
    await Promise.all([settleUsers(pages.legacy), settleUsers(pages.react)]);

    for (const page of [pages.legacy, pages.react]) {
      await page.locator('.pagination').first().getByText('2', { exact: true }).click();
      await expect(page.locator('.row-cols-xl-3 .card-btn')).toHaveCount(1);
      await expect(page.locator('.row-cols-xl-3 .card-btn')).toContainText('fixture-user-13');
      await page.locator('select').first().selectOption('username');
      await page.getByPlaceholder('搜索内容').fill('fixture-user-01');
      await page.getByRole('button', { name: '搜索', exact: true }).click();
      await expect(page.locator('.row-cols-xl-3 .card-btn')).toHaveCount(1);
      await page.locator('.row-cols-xl-3 .card-btn').click();
      const detail = page.getByRole('dialog').first();
      await expect(detail).toBeVisible();
      await expect(detail).toContainText('2026-02-03 10:25');
      await expect(detail).toContainText('Fixture Passkey');
    }

    const [legacyDetail, reactDetail] = await Promise.all([
      pages.legacy.getByRole('dialog').first().screenshot({ animations: 'disabled', caret: 'hide' }),
      pages.react.getByRole('dialog').first().screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await compare(legacyDetail, reactDetail, testInfo, 'admin-user-detail');

    for (const page of [pages.legacy, pages.react]) {
      page.once('dialog', (dialog) => dialog.dismiss());
      await page.getByRole('dialog').getByRole('button', { name: '封禁账户' }).click();
      page.once('dialog', (dialog) => dialog.dismiss());
      await page.getByRole('dialog').getByRole('button', { name: '删除存档' }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: '原始 JSON', exact: true }).click();
      await expect(page.locator('[role="dialog"]:visible')).toHaveCount(2);
      await expect(page.locator('[role="dialog"]:visible').last().locator('.json-view')).toContainText('fixture-user-01');
    }
    const [legacyRaw, reactRaw] = await Promise.all([
      pages.legacy.locator('[role="dialog"]:visible').last().screenshot({ animations: 'disabled', caret: 'hide' }),
      pages.react.locator('[role="dialog"]:visible').last().screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await compare(legacyRaw, reactRaw, testInfo, 'admin-raw-json');

    for (const page of [pages.legacy, pages.react]) {
      await page.locator('[role="dialog"]:visible').last().getByRole('button', { name: 'Close' }).click();
    }
    expect(audit.writes).toEqual([]);
    expect(audit.blockedWrites).toEqual([]);
    await context.close();
  });

  test('Keychip and safe EULA preview match without writes', async ({ browser }, testInfo) => {
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
    const pages = await openPair(context);
    await Promise.all([settleUsers(pages.legacy), settleUsers(pages.react)]);

    for (const page of [pages.legacy, pages.react]) {
      await page.getByRole('button', { name: 'Keychip', exact: true }).click();
      await expect(page.locator('tbody tr')).toHaveCount(PAGE_SIZE);
    }
    const [legacyKeychip, reactKeychip] = await Promise.all([
      pages.legacy.screenshot({ animations: 'disabled', caret: 'hide' }),
      pages.react.screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await compare(legacyKeychip, reactKeychip, testInfo, 'admin-keychip');

    for (const page of [pages.legacy, pages.react]) {
      await page.locator('.pagination').getByText('2', { exact: true }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await page.getByPlaceholder('按 Keychip ID 搜索').fill('A39E01A0001');
      await page.getByRole('button', { name: '搜索', exact: true }).click();
      await expect(page.locator('tbody tr')).toHaveCount(1);
      await page.getByRole('button', { name: 'EULA', exact: true }).click();
      await expect(page.getByText('当前已发布版本 3')).toBeVisible();
      await expect(page.locator('article')).toContainText('欢迎使用 RinNET');
    }
    const [legacyEula, reactEula] = await Promise.all([
      pages.legacy.screenshot({ animations: 'disabled', caret: 'hide' }),
      pages.react.screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await compare(legacyEula, reactEula, testInfo, 'admin-eula');

    for (const page of [pages.legacy, pages.react]) {
      await page.locator('textarea').fill('## 安全预览\n\n<script>window.__unsafe = true</script>\n\n**保留内容**');
      await expect(page.locator('article')).toContainText('保留内容');
      await expect(page.locator('article script')).toHaveCount(0);
      expect(await page.evaluate(() => (window as Window & { __unsafe?: boolean }).__unsafe)).not.toBe(true);
    }
    expect(audit.writes).toEqual([]);
    expect(audit.blockedWrites).toEqual([]);
    await context.close();
  });

  test('mocked Admin writes preserve payloads and isolate impersonated user state', async ({ browser }) => {
    const allowedWrites = new Set([
      'POST /api/admin/createUser',
      'POST /api/admin/keychip',
      'POST /api/admin/keychip/toggleWhiteList',
      'PUT /api/admin/eula/draft',
      'POST /api/admin/users/loginas/fixture-user-01',
      'POST /api/auth/signout',
    ]);
    const context = await browser.newContext({
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(context, allowedWrites);
    await installStorage(context, 'light');
    const page = await context.newPage();
    await page.goto(`${REACT_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' });
    await settleUsers(page);

    await page.getByRole('button', { name: '创建用户', exact: true }).click();
    await page.getByPlaceholder('登录名').fill('new-user');
    await page.getByPlaceholder('昵称').fill('新用户');
    await page.getByPlaceholder('电子邮箱').fill('new@example.invalid');
    await page.getByPlaceholder('密码').fill('fixture-password');
    await page.getByRole('dialog').getByRole('button', { name: '创建', exact: true }).click();
    await expect.poll(() => audit.writes.some((write) => write.path === '/api/admin/createUser')).toBe(true);

    await page.getByRole('button', { name: 'Keychip', exact: true }).click();
    await page.getByPlaceholder('Keychip ID', { exact: true }).fill('A39E01AF9999');
    await page.getByPlaceholder('店铺名 (可选)').fill('Fixture Place');
    await page.getByRole('button', { name: '添加', exact: true }).click();
    await expect.poll(() => audit.writes.some((write) => write.path === '/api/admin/keychip')).toBe(true);
    await page.getByRole('button', { name: '切换白名单' }).first().click();
    await expect.poll(() => audit.writes.some((write) => write.path.endsWith('/toggleWhiteList'))).toBe(true);

    await page.getByRole('button', { name: 'EULA', exact: true }).click();
    await expect(page.getByText('当前已发布版本 3')).toBeVisible();
    await page.locator('textarea').fill('# Updated draft');
    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    await expect.poll(() => audit.writes.some((write) => write.path === '/api/admin/eula/draft')).toBe(true);

    await page.getByRole('button', { name: '用户', exact: true }).click();
    await page.locator('.row-cols-xl-3 .card-btn').first().click();
    const detail = page.getByRole('dialog');
    await expect(detail).toContainText('Fixture Passkey');

    for (const buttonName of ['封禁账户', '撤销全部会话', '重置两步验证', '删除 Passkey：Fixture Passkey', '解绑 discord：oauth@example.invalid', '设为默认', '按 ExtId 解绑', '删除 40000000000000000001']) {
      page.once('dialog', (dialog) => dialog.dismiss());
      await detail.getByRole('button', { name: buttonName, exact: true }).click();
    }
    page.once('dialog', (dialog) => dialog.dismiss('wrong-ext-id'));
    await detail.getByRole('button', { name: '删除存档' }).first().click();

    await detail.getByRole('button', { name: '夺舍', exact: true }).click();
    const impersonationDialog = page.getByRole('dialog').last();
    await expect(impersonationDialog).toContainText('正在以 fixture-user-01 的身份操作');
    const impersonationFrame = impersonationDialog.locator('iframe.impersonation-frame');
    await expect(impersonationFrame).toHaveAttribute('src', /\?imp=/);
    await expect.poll(async () => {
      try {
        const handle = await impersonationFrame.elementHandle();
        const frame = await handle?.contentFrame();
        return await frame?.evaluate(() => sessionStorage.getItem('impersonatedAccount')) ?? null;
      } catch {
        return null;
      }
    }, { timeout: 15_000 }).not.toBeNull();
    await expect.poll(async () => {
      try {
        const handle = await impersonationFrame.elementHandle();
        const frame = await handle?.contentFrame();
        const raw = frame ? await frame.evaluate(() => sessionStorage.getItem('impersonatedAccount')) : null;
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    }, { timeout: 15_000 }).toMatchObject({
      accessToken: 'fixture-target-access',
      refreshToken: 'fixture-target-refresh',
      tokenType: 'Bearer',
    });
    await expect.poll(
      () => audit.requests.some((request) => request.path === '/api/user/me' && request.authorization === 'Bearer fixture-target-access'),
      { timeout: 15_000 },
    ).toBe(true);
    expect.soft(JSON.parse(await page.evaluate(() => localStorage.getItem('currentUser')) ?? 'null')?.username).toBe(fakeAdmin.username);
    await impersonationDialog.getByRole('button', { name: '返回管理员账户' }).click();
    await expect(page.getByText('正在以 fixture-user-01 的身份操作')).toHaveCount(0);
    await expect.poll(() => audit.writes.some((write) => write.path === '/api/auth/signout')).toBe(true);
    expect.soft(JSON.parse(await page.evaluate(() => localStorage.getItem('currentUser')) ?? 'null')?.username).toBe(fakeAdmin.username);

    const writes = audit.writes.map((write) => ({ method: write.method, path: write.path, body: write.body }));
    expect(writes).toEqual(expect.arrayContaining([
      { method: 'POST', path: '/api/admin/createUser', body: { userName: 'new-user', name: '新用户', email: 'new@example.invalid', password: 'fixture-password' } },
      { method: 'POST', path: '/api/admin/keychip', body: { keychipId: 'A39E01AF9999', placeName: 'Fixture Place' } },
      { method: 'POST', path: '/api/admin/keychip/toggleWhiteList', body: { keychipId: 'A39E01A0001' } },
      { method: 'PUT', path: '/api/admin/eula/draft', body: { title: 'RinNET 用户协议 v4 草稿', content: '# Updated draft' } },
      { method: 'POST', path: '/api/admin/users/loginas/fixture-user-01', body: {} },
      { method: 'POST', path: '/api/auth/signout', body: { refreshToken: 'fixture-target-refresh' } },
    ]));
    expect(audit.blockedWrites).toEqual([]);
    await context.close();
  });

  test('a new impersonation never sends credentials from a stale iframe session', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(context, new Set([
      'POST /api/admin/users/loginas/fixture-user-01',
      'POST /api/auth/signout',
    ]));
    await installStorage(context, 'light');
    await context.addInitScript(
      ({ origin, accountKey, account }) => {
        if (
          window.location.origin !== origin
          || window === window.top
          || !new URLSearchParams(window.location.search).has('imp')
          || sessionStorage.getItem('__fixtureStaleImpersonationSeeded')
        ) return;
        sessionStorage.setItem('__fixtureStaleImpersonationSeeded', 'true');
        sessionStorage.setItem(accountKey, JSON.stringify(account));
      },
      {
        origin: REACT_ORIGIN,
        accountKey: IMPERSONATED_ACCOUNT_KEY,
        account: { accessToken: 'fixture-stale-access', refreshToken: 'fixture-stale-refresh', tokenType: 'Bearer' },
      },
    );
    const page = await context.newPage();
    try {
      await page.goto(`${REACT_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' });
      const detail = await openFirstUserDetail(page);
      await detail.getByRole('button', { name: '夺舍', exact: true }).click();
      const impersonationDialog = page.locator('[role="dialog"]:visible').last();
      await expect(impersonationDialog).toContainText('正在以 fixture-user-01 的身份操作');
      await expect.poll(
        () => audit.requests.some((request) => request.authorization === 'Bearer fixture-target-access'),
        { timeout: 15_000 },
      ).toBe(true);

      expect(audit.requests.filter((request) => request.authorization === 'Bearer fixture-stale-access')).toEqual([]);
      await impersonationDialog.getByRole('button', { name: '返回管理员账户' }).click();
      await expect.poll(() => audit.writes.filter((write) => write.path === '/api/auth/signout')).toHaveLength(1);
      expect(audit.blockedWrites).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('impersonation is single-flight and moves focus into the fullscreen dialog', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(
      context,
      new Set([
        'POST /api/admin/users/loginas/fixture-user-01',
        'POST /api/auth/signout',
      ]),
      {
        loginAsDelayMs: 150,
        loginAsResponse: (ordinal) => ({
          accessToken: `fixture-target-access-${ordinal}`,
          refreshToken: `fixture-target-refresh-${ordinal}`,
          tokenType: 'Bearer',
        }),
      },
    );
    await installStorage(context, 'light');
    const page = await context.newPage();
    try {
      await page.goto(`${REACT_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' });
      const detail = await openFirstUserDetail(page);
      const loginAsButton = detail.getByRole('button', { name: '夺舍', exact: true });
      await loginAsButton.click();
      await page.keyboard.press('Enter');

      const impersonationDialog = page.locator('[role="dialog"]:visible').last();
      await expect(impersonationDialog).toContainText('正在以 fixture-user-01 的身份操作');
      const returnButton = impersonationDialog.getByRole('button', { name: '返回管理员账户' });
      await expect.soft(returnButton).toBeFocused();
      await returnButton.click();
      await expect.poll(() => audit.writes.filter((write) => write.path === '/api/auth/signout')).toHaveLength(1);

      const loginAsWrites = audit.writes.filter((write) => write.path.includes('/loginas/'));
      const signoutWrites = audit.writes.filter((write) => write.path === '/api/auth/signout');
      expect(loginAsWrites).toHaveLength(1);
      expect(signoutWrites).toHaveLength(1);
      expect(signoutWrites[0]?.body.refreshToken).toMatch(/^fixture-target-refresh-[12]$/);
      expect(audit.blockedWrites).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('Admin entry and dialogs animate while impersonation has no header-to-frame gap', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(context, new Set([
      'POST /api/admin/users/loginas/fixture-user-01',
      'POST /api/auth/signout',
    ]));
    await installStorage(context, 'light');
    const page = await context.newPage();
    try {
      await page.goto(`${REACT_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' });
      await settleUsers(page);

      await expect(page.locator('.admin-page')).toHaveCSS('animation-name', /admin-page-enter/);

      const detail = await openFirstUserDetail(page);
      await expect(detail).toHaveCSS('animation-name', /admin-dialog-content-in/);
      await expect(page.locator('.admin-dialog-overlay')).toHaveCSS('animation-name', /admin-dialog-overlay-in/);

      await detail.getByRole('button', { name: '夺舍', exact: true }).click();
      const impersonationDialog = page.locator('[role="dialog"]:visible').last();
      const iframe = impersonationDialog.locator('iframe.impersonation-frame');
      await expect(iframe).toBeVisible();
      await expect(impersonationDialog).toHaveCSS('animation-name', /admin-impersonation-dialog-in/);

      const layout = await iframe.evaluate((element) => {
        const body = element.parentElement;
        const main = body?.parentElement;
        const header = main?.querySelector<HTMLElement>('.modal-header');
        return {
          frameTop: element.getBoundingClientRect().top,
          headerBottom: header?.getBoundingClientRect().bottom ?? Number.NaN,
          bodyMarginTop: body ? Number.parseFloat(getComputedStyle(body).marginTop) : Number.NaN,
        };
      });
      expect(layout.bodyMarginTop).toBe(0);
      expect(layout.frameTop - layout.headerBottom).toBeLessThanOrEqual(1);

      await impersonationDialog.getByRole('button', { name: '返回管理员账户' }).click();
      await expect(page.locator('.admin-impersonation-dialog')).toHaveCSS(
        'animation-name',
        /admin-impersonation-dialog-out/,
      );
      await expect.poll(() => audit.writes.filter((write) => write.path === '/api/auth/signout')).toHaveLength(1);
      await detail.getByRole('button', { name: 'Close' }).click();
      await expect(page.locator('.admin-dialog-content')).toHaveCSS(
        'animation-name',
        /admin-dialog-content-out/,
      );
      expect(audit.blockedWrites).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('leaving Admin through a route change tears down storage and revokes its session', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(context, new Set([
      'POST /api/admin/users/loginas/fixture-user-01',
      'POST /api/auth/signout',
    ]));
    await installStorage(context, 'light');
    const page = await context.newPage();
    try {
      await page.goto(`${REACT_ORIGIN}/contributors`, { waitUntil: 'domcontentloaded' });
      await page.goto(`${REACT_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' });
      const detail = await openFirstUserDetail(page);
      await detail.getByRole('button', { name: '夺舍', exact: true }).click();
      const impersonationDialog = page.locator('[role="dialog"]:visible').last();
      const iframe = impersonationDialog.locator('iframe.impersonation-frame');
      await expect(iframe).toHaveAttribute('src', /\?imp=/);
      // The child redirects from ?imp= to / after accepting the grant, so
      // reacquire its execution context on every poll instead of retaining a
      // frame handle across that navigation.
      await expect.poll(async () => {
        try {
          const handle = await iframe.elementHandle();
          const frame = await handle?.contentFrame();
          return frame ? await frame.evaluate((key) => sessionStorage.getItem(key), IMPERSONATED_ACCOUNT_KEY) : null;
        } catch {
          return null;
        }
      }, { timeout: 15_000 }).not.toBeNull();

      // The fullscreen dialog intentionally intercepts pointer input, so use
      // the browser's public history seam to exercise the React route unmount.
      await page.evaluate((path) => {
        window.history.pushState({}, '', path);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }, '/contributors');
      await expect(page).toHaveURL(`${REACT_ORIGIN}/contributors`);
      const storageAfterLeave = await page.evaluate(() => ({
        account: sessionStorage.getItem('impersonatedAccount'),
        currentAccount: localStorage.getItem('currentAccount'),
        currentUser: JSON.parse(localStorage.getItem('currentUser') ?? 'null')?.username ?? null,
      }));
      expect.soft(storageAfterLeave.account).toBeNull();
      expect.soft(JSON.parse(storageAfterLeave.currentAccount ?? 'null')?.accessToken).toBe(fakeAccount.accessToken);
      expect.soft(storageAfterLeave.currentUser).toBe(fakeAdmin.username);
      await expect.poll(
        () => audit.writes.filter((write) => write.path === '/api/auth/signout'),
        { timeout: 2_000 },
      ).toHaveLength(1);
      expect(audit.writes.filter((write) => write.path === '/api/auth/signout').map((write) => write.body)).toEqual([
        { refreshToken: 'fixture-target-refresh' },
      ]);
      expect(audit.blockedWrites).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('a signed-in non-admin cannot mount Admin or call Admin APIs', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(context);
    await installStorage(context, 'light', 'legacy', {
      account: { accessToken: 'fixture-user-access', refreshToken: 'fixture-user-refresh', tokenType: 'Bearer' },
      user: users[2].user,
    });
    const page = await context.newPage();
    try {
      await page.goto(`${REACT_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' });
      await expect.poll(
        () => audit.requests.some((request) => request.path === '/api/user/me' && request.authorization === 'Bearer fixture-user-access'),
        { timeout: 15_000 },
      ).toBe(true);
      await page.waitForTimeout(100);

      await expect.soft(page.getByRole('heading', { name: '管理员' })).toHaveCount(0);
      expect(audit.requests.filter((request) => request.path.startsWith('/api/admin/'))).toEqual([]);
      expect(audit.blockedWrites).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test('liquefy theme smoke renders Admin sections and dialogs without writes', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'dark',
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const audit = await installFixtureApi(context);
    await installStorage(context, 'dark', 'liquefy');
    const page = await context.newPage();
    await page.goto(`${REACT_ORIGIN}/admin`, { waitUntil: 'domcontentloaded' });
    await settleUsers(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
    await page.locator('.row-cols-xl-3 .card-btn').first().click();
    await expect(page.getByRole('dialog')).toContainText('卡片与游戏档案');
    await page.getByRole('dialog').getByRole('button', { name: '原始 JSON' }).click();
    await expect(page.locator('[role="dialog"]:visible')).toHaveCount(2);
    await page.locator('[role="dialog"]:visible').last().getByRole('button', { name: 'Close' }).click();
    await page.locator('[role="dialog"]:visible').getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: 'Keychip', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(PAGE_SIZE);
    await page.getByRole('button', { name: 'EULA', exact: true }).click();
    await expect(page.locator('article')).toContainText('欢迎使用 RinNET');
    expect(audit.writes).toEqual([]);
    expect(audit.blockedWrites).toEqual([]);
    await context.close();
  });
});
