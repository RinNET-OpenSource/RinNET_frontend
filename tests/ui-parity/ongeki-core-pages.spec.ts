import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
  type TestInfo,
} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const READY_TIMEOUT_MS = 30_000;
const STABILITY_DELAY_MS = 400;
const themes = ['light', 'dark'] as const;
const mutatingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const requiredStores = ['ongekiCard', 'ongekiMusic', 'ongekiTrophy'] as const;
const requiredCatalogPaths = new Set([
  '/api/game/ongeki/data/cardList',
  '/api/game/ongeki/data/musicList',
  '/api/game/ongeki/data/trophyList',
]);

const username = process.env.UI_TEST_USERNAME;
const password = process.env.UI_TEST_PASSWORD;
const credentials = username && password ? { username, password } : null;

interface SignInResponse {
  data?: unknown;
  status?: {
    code?: number;
  };
}

interface AuthAccount {
  accessToken?: string;
  tokenType?: string;
}

interface CurrentUser {
  cards?: Array<{ default?: boolean }>;
  defaultCard?: { default?: boolean };
  [key: string]: unknown;
}

interface UserResponse {
  data?: CurrentUser;
  status?: {
    code?: number;
  };
}

interface DbVersionResponse {
  version?: {
    major?: number;
  };
}

interface CachedResponse {
  body: Buffer;
  contentType?: string;
  status: number;
}

interface PageDefinition {
  name: 'profile' | 'battle' | 'rating';
  path: string;
  readySelectors: string[];
  diagnosticSelectors: string[];
}

interface ComparisonResult {
  diffRatio: number;
  mismatchedPixels: number;
  outputDir: string;
  page: string;
  theme: (typeof themes)[number];
}

const pages: PageDefinition[] = [
  {
    name: 'profile',
    path: '/ongeki/profile',
    readySelectors: ['.user-data-container', '.trophy', '.chara-container', '.profile-table tbody tr'],
    diagnosticSelectors: [
      'main',
      '.content',
      '.user-data-container',
      '.trophy-bg',
      '.level-bg',
      '.name-bg',
      '.user-icon-border',
      '.rank-bg',
      '.rank',
      '.rating-header',
      '.rating',
      '.chara-container',
      '.chara-back',
      '.profile-table',
    ],
  },
  {
    name: 'battle',
    path: '/ongeki/battle',
    readySelectors: ['h1.page-heading', '.alert.alert-info', 'h2', '.card.mb-4', '.rating-card'],
    diagnosticSelectors: [
      'main',
      '.content',
      'h1.page-heading',
      '.alert.alert-info',
      '.card.mb-4',
      'h2',
      '.row.g-2',
      '.rating-card',
      '.rating-card .hstack',
      '.jacket',
      '.rating-card .card-body',
      '.rating-card .badge',
    ],
  },
  {
    name: 'rating',
    path: '/ongeki/rating',
    readySelectors: ['h1.page-heading', 'h2', '.badge.bg-primary', '.rating-card'],
    diagnosticSelectors: [
      'main',
      '.content',
      'h1.page-heading',
      'h2',
      '.badge.bg-primary',
      '.row.g-1',
      '.rating-card',
      '.rating-card .hstack',
      '.new-jacket',
      '.rating-card .card-body',
      '.rating-card .card-footer',
      '.honor',
      '.honor-badge',
      '.honor-star',
    ],
  },
];

const requestedPage = process.env.UI_PARITY_PAGE;
const requestedTheme = process.env.UI_PARITY_THEME;
const selectedPages = requestedPage ? pages.filter((page) => page.name === requestedPage) : pages;
const selectedThemes = requestedTheme
  ? themes.filter((theme) => theme === requestedTheme)
  : themes;

const getCache = new Map<string, Promise<CachedResponse>>();

function apiCacheKey(rawUrl: string): string {
  const url = new URL(rawUrl);
  const entries = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) =>
    leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
  );
  const search = new URLSearchParams(entries).toString();
  return url.pathname + (search ? `?${search}` : '');
}

async function cachedApiResponse(route: Route): Promise<CachedResponse> {
  const key = apiCacheKey(route.request().url());
  let responsePromise = getCache.get(key);
  if (!responsePromise) {
    responsePromise = (async () => {
      const response = await route.fetch();
      return {
        body: await response.body(),
        contentType: response.headers()['content-type'],
        status: response.status(),
      };
    })();
    getCache.set(key, responsePromise);
  }

  try {
    return await responsePromise;
  } catch (error) {
    if (getCache.get(key) === responsePromise) getCache.delete(key);
    throw error;
  }
}

async function installReadOnlyNetwork(
  context: BrowserContext,
  blockedMutations: Set<string>,
) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());

    if (mutatingMethods.has(method)) {
      if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet')) {
        blockedMutations.add(`${method} ${url.pathname}`);
      }
      await route.abort('blockedbyclient');
      return;
    }

    if (method !== 'GET' || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    if (url.pathname.includes('/api/game/') && url.pathname.includes('/data/')) {
      if (!requiredCatalogPaths.has(url.pathname)) {
        await route.fulfill({ body: '[]', contentType: 'application/json', status: 200 });
        return;
      }
    }

    const cached = await cachedApiResponse(route);
    await route.fulfill({
      body: cached.body,
      headers: cached.contentType ? { 'content-type': cached.contentType } : undefined,
      status: cached.status,
    });
  });
}

async function waitForRequiredCatalogs(page: Page) {
  await page.waitForFunction(
    async (stores) => {
      const openDatabase = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('Aqua');
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });

      try {
        const database = await openDatabase();
        try {
          if (!stores.every((store) => database.objectStoreNames.contains(store))) return false;
          const counts = await Promise.all(
            stores.map(
              (store) =>
                new Promise<number>((resolve, reject) => {
                  const request = database.transaction(store, 'readonly').objectStore(store).count();
                  request.onsuccess = () => resolve(request.result);
                  request.onerror = () => reject(request.error);
                }),
            ),
          );
          return counts.every((count) => count > 0);
        } finally {
          database.close();
        }
      } catch {
        return false;
      }
    },
    requiredStores,
    { timeout: READY_TIMEOUT_MS },
  );
}

async function warmReadOnlyData(page: Page, origin: string) {
  await page.goto(`${origin}/not-found`, { waitUntil: 'domcontentloaded' });
  await page.locator('.not-found').waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await waitForRequiredCatalogs(page);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: READY_TIMEOUT_MS });
}

async function navigateWithinApp(page: Page, origin: string, routePath: string) {
  await page.evaluate((nextPath) => {
    history.pushState({}, '', nextPath);
    window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
  }, routePath);
  await page.waitForURL(`${origin}${routePath}`, { timeout: READY_TIMEOUT_MS });
}

async function waitForVisibleAssets(page: Page) {
  await page.evaluate(async () => {
    const timeoutMs = 10_000;
    const isVisible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom >= 0 && rect.right >= 0 && rect.top <= innerHeight && rect.left <= innerWidth;
    };
    const waitForImage = async (image: HTMLImageElement) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timeoutId);
            image.removeEventListener('load', finish);
            image.removeEventListener('error', finish);
            resolve();
          };
          const timeoutId = window.setTimeout(finish, timeoutMs);
          image.addEventListener('load', finish, { once: true });
          image.addEventListener('error', finish, { once: true });
        });
      }
      await image.decode().catch(() => undefined);
    };
    const backgroundUrls = new Set<string>();
    for (const element of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (!isVisible(element)) continue;
      const style = getComputedStyle(element);
      for (const value of [
        style.backgroundImage,
        style.maskImage,
        style.getPropertyValue('-webkit-mask-image'),
      ]) {
        for (const match of value.matchAll(/url\(["']?(.*?)["']?\)/g)) {
          if (match[1]) backgroundUrls.add(match[1]);
        }
      }
    }

    await document.fonts.ready;
    await Promise.all([
      ...Array.from(document.images).filter(isVisible).map(waitForImage),
      ...Array.from(backgroundUrls, async (url) => {
        const image = new Image();
        image.src = url;
        await waitForImage(image);
      }),
    ]);
  });
}

async function pageSignature(page: Page) {
  return page.locator('main').evaluate((content) => {
    const rect = content.getBoundingClientRect();
    return {
      cardCount: content.querySelectorAll('.card').length,
      descendantCount: content.querySelectorAll('*').length,
      headingCount: content.querySelectorAll('h1, h2').length,
      height: Math.round(rect.height * 100) / 100,
      imageCount: content.querySelectorAll('img').length,
      textLength: (content.textContent ?? '').replace(/\s+/g, ' ').trim().length,
      width: Math.round(rect.width * 100) / 100,
    };
  });
}

async function waitForStablePage(page: Page, definition: PageDefinition) {
  let previous = await pageSignature(page);
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.waitForTimeout(STABILITY_DELAY_MS);
    const current = await pageSignature(page);
    if (JSON.stringify(current) === JSON.stringify(previous)) return;
    previous = current;
  }
  throw new Error(`${definition.name} ${new URL(page.url()).port}: DOM did not stabilize`);
}

async function settleCorePage(page: Page, definition: PageDefinition) {
  await page.waitForLoadState('domcontentloaded');
  const root = page.locator('main');
  try {
    await root.waitFor({ state: 'attached', timeout: READY_TIMEOUT_MS });
  } catch {
    throw new Error(`${definition.name} ${new URL(page.url()).port}: missing main root`);
  }
  for (const selector of definition.readySelectors) {
    try {
      await root.locator(selector).first().waitFor({ state: 'attached', timeout: READY_TIMEOUT_MS });
    } catch {
      throw new Error(`${definition.name} ${new URL(page.url()).port}: missing ${selector}`);
    }
  }
  await expect(root.locator('.placeholder')).toHaveCount(0, { timeout: READY_TIMEOUT_MS });
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: READY_TIMEOUT_MS });
  await waitForVisibleAssets(page);
  await page.evaluate(() => window.scrollTo(0, 0));
  await waitForStablePage(page, definition);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0);
}

async function captureDiagnostics(page: Page, selectors: string[]) {
  return page.evaluate((requestedSelectors) => {
    const round = (value: number) => Math.round(value * 100) / 100;
    return Object.fromEntries(
      requestedSelectors.map((selector) => {
        const matches = Array.from(document.querySelectorAll<HTMLElement>(selector));
        const element = matches.find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          const style = getComputedStyle(candidate);
          return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        });
        if (!element) return [selector, { count: matches.length, visible: false }];

        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return [
          selector,
          {
            count: matches.length,
            rect: {
              bottom: round(rect.bottom),
              height: round(rect.height),
              left: round(rect.left),
              right: round(rect.right),
              top: round(rect.top),
              width: round(rect.width),
            },
            style: {
              alignItems: style.alignItems,
              aspectRatio: style.aspectRatio,
              backgroundColor: style.backgroundColor,
              borderBottomWidth: style.borderBottomWidth,
              borderLeftWidth: style.borderLeftWidth,
              borderRadius: style.borderRadius,
              borderRightWidth: style.borderRightWidth,
              borderTopWidth: style.borderTopWidth,
              boxSizing: style.boxSizing,
              color: style.color,
              columnGap: style.columnGap,
              display: style.display,
              flexDirection: style.flexDirection,
              fontFamily: style.fontFamily,
              fontSize: style.fontSize,
              fontWeight: style.fontWeight,
              gridTemplateColumns: style.gridTemplateColumns,
              justifyContent: style.justifyContent,
              lineHeight: style.lineHeight,
              marginBottom: style.marginBottom,
              marginLeft: style.marginLeft,
              marginRight: style.marginRight,
              marginTop: style.marginTop,
              maxWidth: style.maxWidth,
              minWidth: style.minWidth,
              objectFit: style.objectFit,
              overflow: style.overflow,
              paddingBottom: style.paddingBottom,
              paddingLeft: style.paddingLeft,
              paddingRight: style.paddingRight,
              paddingTop: style.paddingTop,
              position: style.position,
              rowGap: style.rowGap,
              transform: style.transform,
              width: style.width,
              zIndex: style.zIndex,
            },
            visible: true,
          },
        ];
      }),
    );
  }, selectors);
}

async function saveComparison(
  oldPage: Page,
  newPage: Page,
  definition: PageDefinition,
  theme: (typeof themes)[number],
  testInfo: TestInfo,
): Promise<ComparisonResult> {
  const [oldBuffer, newBuffer, oldDiagnostics, newDiagnostics] = await Promise.all([
    oldPage.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false }),
    newPage.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false }),
    captureDiagnostics(oldPage, definition.diagnosticSelectors),
    captureDiagnostics(newPage, definition.diagnosticSelectors),
  ]);
  const oldImage = PNG.sync.read(oldBuffer);
  const newImage = PNG.sync.read(newBuffer);
  expect(
    { height: newImage.height, width: newImage.width },
    `${definition.name}/${theme} screenshots must have identical dimensions`,
  ).toEqual({ height: oldImage.height, width: oldImage.width });

  const diff = new PNG({ height: oldImage.height, width: oldImage.width });
  const mismatchedPixels = pixelmatch(
    oldImage.data,
    newImage.data,
    diff.data,
    oldImage.width,
    oldImage.height,
    { includeAA: false, threshold: 0.1 },
  );
  const diffRatio = mismatchedPixels / (oldImage.width * oldImage.height);
  const outputDir = path.join(testInfo.outputDir, definition.name, theme);
  const oldPath = path.join(outputDir, 'old.png');
  const newPath = path.join(outputDir, 'new.png');
  const diffPath = path.join(outputDir, 'diff.png');
  const comparisonPath = path.join(outputDir, 'comparison.json');
  const comparison = {
    diffRatio,
    mismatchedPixels,
    new: newDiagnostics,
    old: oldDiagnostics,
    page: definition.name,
    theme,
    totalPixels: oldImage.width * oldImage.height,
  };

  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(oldPath, oldBuffer),
    fs.writeFile(newPath, newBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
    fs.writeFile(comparisonPath, JSON.stringify(comparison, null, 2)),
  ]);
  await Promise.all([
    testInfo.attach(`${definition.name}-${theme}-old`, { path: oldPath, contentType: 'image/png' }),
    testInfo.attach(`${definition.name}-${theme}-new`, { path: newPath, contentType: 'image/png' }),
    testInfo.attach(`${definition.name}-${theme}-diff`, { path: diffPath, contentType: 'image/png' }),
    testInfo.attach(`${definition.name}-${theme}-comparison`, {
      path: comparisonPath,
      contentType: 'application/json',
    }),
  ]);

  return { diffRatio, mismatchedPixels, outputDir, page: definition.name, theme };
}

async function saveReadinessFailure(
  oldPage: Page,
  newPage: Page,
  definition: PageDefinition,
  theme: (typeof themes)[number],
  message: string,
  testInfo: TestInfo,
) {
  const outputDir = path.join(testInfo.outputDir, definition.name, theme);
  const oldPath = path.join(outputDir, 'old-error.png');
  const newPath = path.join(outputDir, 'new-error.png');
  const diagnosticsPath = path.join(outputDir, 'readiness-error.json');
  const [oldBuffer, newBuffer, oldDiagnostics, newDiagnostics] = await Promise.all([
    oldPage.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false }),
    newPage.screenshot({ animations: 'disabled', caret: 'hide', fullPage: false }),
    captureDiagnostics(oldPage, definition.diagnosticSelectors),
    captureDiagnostics(newPage, definition.diagnosticSelectors),
  ]);
  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(oldPath, oldBuffer),
    fs.writeFile(newPath, newBuffer),
    fs.writeFile(
      diagnosticsPath,
      JSON.stringify(
        {
          message,
          new: { diagnostics: newDiagnostics, path: new URL(newPage.url()).pathname },
          old: { diagnostics: oldDiagnostics, path: new URL(oldPage.url()).pathname },
          page: definition.name,
          theme,
        },
        null,
        2,
      ),
    ),
  ]);
  await Promise.all([
    testInfo.attach(`${definition.name}-${theme}-old-error`, { path: oldPath, contentType: 'image/png' }),
    testInfo.attach(`${definition.name}-${theme}-new-error`, { path: newPath, contentType: 'image/png' }),
    testInfo.attach(`${definition.name}-${theme}-readiness-error`, {
      path: diagnosticsPath,
      contentType: 'application/json',
    }),
  ]);
}

test.describe('authenticated Ongeki core page visual parity', () => {
  test.describe.configure({ timeout: 480_000 });
  test.skip(
    credentials === null,
    'Set UI_TEST_USERNAME and UI_TEST_PASSWORD to run authenticated Ongeki parity tests.',
  );

  let account: unknown;
  let currentUser: CurrentUser | undefined;
  let databaseVersion = 0;

  test.beforeAll(async ({ request }) => {
    if (!credentials) return;

    const [signInHttpResponse, versionHttpResponse] = await Promise.all([
      request.post(`${REACT_ORIGIN}/api/auth/signin`, {
        data: {
          usernameOrEmail: credentials.username,
          password: credentials.password,
        },
      }),
      request.get(`${REACT_ORIGIN}/api/static/dbVersion`),
    ]);
    expect(signInHttpResponse.ok(), 'The React-origin sign-in request must succeed').toBeTruthy();
    expect(versionHttpResponse.ok(), 'The database-version request must succeed').toBeTruthy();

    const signInResponse = (await signInHttpResponse.json()) as SignInResponse;
    const versionBody = await versionHttpResponse.body();
    const versionResponse = JSON.parse(versionBody.toString('utf8')) as DbVersionResponse;
    expect(signInResponse.status?.code, 'The sign-in response must have status code 92001').toBe(92001);
    expect(signInResponse.data, 'The sign-in response must include an account').toBeTruthy();
    expect(versionResponse.version?.major, 'The database version must be available').toBeGreaterThan(0);

    const authenticatedAccount = signInResponse.data as AuthAccount;
    expect(authenticatedAccount.tokenType, 'The account token type must be available').toBeTruthy();
    expect(authenticatedAccount.accessToken, 'The account access token must be available').toBeTruthy();
    const userHttpResponse = await request.get(`${REACT_ORIGIN}/api/user/me`, {
      headers: {
        Authorization: `${authenticatedAccount.tokenType} ${authenticatedAccount.accessToken}`,
      },
    });
    expect(userHttpResponse.ok(), 'The current-user request must succeed').toBeTruthy();
    const userBody = await userHttpResponse.body();
    const userResponse = JSON.parse(userBody.toString('utf8')) as UserResponse;
    expect(userResponse.status?.code, 'The current-user response must have status code 92001').toBe(92001);
    expect(userResponse.data, 'The current-user response must include a user').toBeTruthy();
    const user = userResponse.data;
    const defaultCard = user?.cards?.find((card) => card.default);
    if (user && defaultCard) user.defaultCard = defaultCard;

    account = authenticatedAccount;
    currentUser = user;
    databaseVersion = versionResponse.version?.major ?? 0;
    getCache.set(
      '/api/static/dbVersion',
      Promise.resolve({
        body: versionBody,
        contentType: versionHttpResponse.headers()['content-type'],
        status: versionHttpResponse.status(),
      }),
    );
    getCache.set(
      '/api/user/me',
      Promise.resolve({
        body: userBody,
        contentType: userHttpResponse.headers()['content-type'],
        status: userHttpResponse.status(),
      }),
    );
  });

  test.afterAll(() => getCache.clear());

  test('legacy light/dark matches Angular for Ongeki profile, battle, and rating', async ({ browser }, testInfo) => {
    expect(account, 'Authenticated account was not initialized').toBeTruthy();
    expect(currentUser, 'Current user was not initialized').toBeTruthy();
    const results: ComparisonResult[] = [];
    const failures: string[] = [];

    expect(selectedPages.length, 'UI_PARITY_PAGE must name profile, battle, or rating').toBeGreaterThan(0);
    expect(selectedThemes.length, 'UI_PARITY_THEME must name light or dark').toBeGreaterThan(0);

    for (const theme of selectedThemes) {
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
        viewport: { height: 720, width: 1280 },
      });
      const blockedMutations = new Set<string>();
      await installReadOnlyNetwork(context, blockedMutations);
      await context.addInitScript(
        ({ authenticatedAccount, authenticatedUser, selectedDatabaseVersion, selectedTheme, allowedOrigins }) => {
          if (!allowedOrigins.includes(window.location.origin)) return;
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
          selectedDatabaseVersion: databaseVersion,
          selectedTheme: theme,
          allowedOrigins: [LEGACY_ORIGIN, REACT_ORIGIN],
        },
      );

      const oldPage = await context.newPage();
      const newPage = await context.newPage();
      try {
        await Promise.all([
          warmReadOnlyData(oldPage, LEGACY_ORIGIN),
          warmReadOnlyData(newPage, REACT_ORIGIN),
        ]);

        for (const definition of selectedPages) {
          try {
            await Promise.all([
              navigateWithinApp(oldPage, LEGACY_ORIGIN, definition.path),
              navigateWithinApp(newPage, REACT_ORIGIN, definition.path),
            ]);
            await Promise.all([
              settleCorePage(oldPage, definition),
              settleCorePage(newPage, definition),
            ]);
            await expect(oldPage).toHaveURL(`${LEGACY_ORIGIN}${definition.path}`);
            await expect(newPage).toHaveURL(`${REACT_ORIGIN}${definition.path}`);

            const result = await saveComparison(oldPage, newPage, definition, theme, testInfo);
            results.push(result);
            if (result.diffRatio > MAX_DIFF_RATIO) {
              failures.push(
                `${definition.name}/${theme}: ${(result.diffRatio * 100).toFixed(3)}% > ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`,
              );
            }
          } catch (error) {
            const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
            failures.push(`${definition.name}/${theme}: ${message}`);
            await saveReadinessFailure(oldPage, newPage, definition, theme, message, testInfo);
          }
        }

        await newPage.waitForTimeout(100);
        if (blockedMutations.size > 0) {
          failures.push(`${theme}: browser attempted blocked mutations: ${Array.from(blockedMutations).join(', ')}`);
        }
      } finally {
        await context.close();
      }
    }

    const matrixPath = path.join(testInfo.outputDir, 'matrix.json');
    await fs.mkdir(testInfo.outputDir, { recursive: true });
    await fs.writeFile(matrixPath, JSON.stringify({ failures, results }, null, 2));
    await testInfo.attach('matrix', { path: matrixPath, contentType: 'application/json' });

    expect(failures, 'Ongeki visual parity matrix failures').toEqual([]);
  });
});
