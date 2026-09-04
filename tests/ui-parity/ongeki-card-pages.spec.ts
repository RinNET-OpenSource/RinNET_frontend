import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const READY_TIMEOUT_MS = 60_000;
const VISUAL_STABILITY_DELAY_MS = 300;
const themes = ['light', 'dark'] as const;
const requiredStores = ['ongekiCard', 'ongekiCharacter', 'ongekiSkill'] as const;

const username = process.env.UI_TEST_USERNAME;
const password = process.env.UI_TEST_PASSWORD;
const credentials = username && password ? { username, password } : null;

interface AuthenticatedAccount {
  accessToken?: string;
  refreshToken?: string;
  tokenType?: string;
}

interface SignInResponse {
  data?: AuthenticatedAccount;
  status?: {
    code?: number;
  };
}

interface UserCard extends Record<string, unknown> {
  default?: boolean;
}

interface CurrentUser extends Record<string, unknown> {
  cards?: UserCard[];
  defaultCard?: UserCard;
}

interface CurrentUserResponse {
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
  headers: Record<string, string>;
  status: number;
}

interface RequestAudit {
  apiGets: Set<string>;
  blockedWrites: string[];
}

type CardRoute = {
  name: 'card' | 'card-gallery';
  path: '/ongeki/card' | '/ongeki/card/gallery';
};

const routes: readonly CardRoute[] = [
  { name: 'card', path: '/ongeki/card' },
  { name: 'card-gallery', path: '/ongeki/card/gallery' },
];

function canonicalApiPath(rawUrl: string): string {
  const url = new URL(rawUrl);
  const params = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => {
    const keyOrder = leftKey.localeCompare(rightKey);
    return keyOrder === 0 ? leftValue.localeCompare(rightValue) : keyOrder;
  });
  const search = new URLSearchParams(params).toString();
  return `${url.pathname}${search ? `?${search}` : ''}`;
}

function safeFulfillHeaders(headers: Record<string, string>): Record<string, string> {
  const result = { ...headers };
  delete result['content-encoding'];
  delete result['content-length'];
  delete result['set-cookie'];
  delete result['transfer-encoding'];
  return result;
}

async function installReadOnlyNetwork(
  context: BrowserContext,
  responseCache: Map<string, Promise<CachedResponse>>,
): Promise<RequestAudit> {
  const protectedOrigins = new Set([LEGACY_ORIGIN, REACT_ORIGIN]);
  const audit: RequestAudit = {
    apiGets: new Set<string>(),
    blockedWrites: [],
  };

  await context.route('**/*', async (route) => {
    const request = route.request();
    const method = request.method().toUpperCase();
    const requestUrl = new URL(request.url());
    const isProtectedBusinessRequest =
      protectedOrigins.has(requestUrl.origin) &&
      (requestUrl.pathname.startsWith('/api/') ||
        requestUrl.pathname.startsWith('/Maimai2Servlet'));

    if (method !== 'GET' && isProtectedBusinessRequest) {
      audit.blockedWrites.push(`${method} ${requestUrl.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }

    if (method !== 'GET') {
      await route.continue();
      return;
    }

    if (!requestUrl.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    const apiPath = canonicalApiPath(request.url());
    audit.apiGets.add(apiPath);
    let cached = responseCache.get(apiPath);
    if (!cached) {
      cached = (async () => {
        const response = await route.fetch({ url: `${REACT_ORIGIN}${apiPath}` });
        return {
          body: await response.body(),
          headers: safeFulfillHeaders(response.headers()),
          status: response.status(),
        };
      })();
      responseCache.set(apiPath, cached);
    }

    const response = await cached;
    await route.fulfill(response);
  });

  return audit;
}

async function settleCardPage(page: Page, route: CardRoute, variant: 'legacy' | 'react') {
  await page.waitForLoadState('domcontentloaded');
  const heading = page.locator('h1.page-heading');
  await heading.waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  const pageRoot = heading.locator('..');

  if (route.name === 'card') {
    await expect(pageRoot.locator('.tab-selector-active'), `${variant} must select deck and deck number`).toHaveCount(2, {
      timeout: READY_TIMEOUT_MS,
    });
    await expect(pageRoot.locator('.deck-row .cards-col'), `${variant} must render three deck cards`).toHaveCount(3, {
      timeout: READY_TIMEOUT_MS,
    });
    await pageRoot.locator('.deck-row .card-container').first().waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    await expect(
      pageRoot.locator('.deck-row .card-container.grayscale'),
      `${variant} deck cards must finish loading catalog metadata`,
    ).toHaveCount(0, { timeout: READY_TIMEOUT_MS });
    await expect(pageRoot.locator('.modal.show')).toHaveCount(0);
  } else {
    await pageRoot.locator('.callout-info').waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
    await expect(pageRoot.locator('.cards-col'), `${variant} must render one 12-card gallery page`).toHaveCount(12, {
      timeout: READY_TIMEOUT_MS,
    });
    await pageRoot.locator('.cards-col .card-container').first().waitFor({
      state: 'visible',
      timeout: READY_TIMEOUT_MS,
    });
    await expect(pageRoot.locator('#filterCollapse'), `${variant} filter panel must start collapsed`).not.toBeVisible();
    await expect(pageRoot.locator('#holoSwitch')).not.toBeChecked();
    await expect(pageRoot.locator('#elementsSwitch')).toBeChecked();
    await expect(pageRoot.locator('.modal.show')).toHaveCount(0);
  }

  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, {
    timeout: READY_TIMEOUT_MS,
  });

  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, async (image) => {
        if (!image.complete) {
          await new Promise<void>((resolve) => {
            const finish = () => {
              window.clearTimeout(timeoutId);
              image.removeEventListener('load', finish);
              image.removeEventListener('error', finish);
              resolve();
            };
            const timeoutId = window.setTimeout(finish, 5_000);
            image.addEventListener('load', finish, { once: true });
            image.addEventListener('error', finish, { once: true });
          });
        }
        await image.decode().catch(() => undefined);
      }),
    );

    const backgroundUrls = new Set<string>();
    for (const element of document.querySelectorAll<HTMLElement>('.content *')) {
      for (const background of [
        getComputedStyle(element).backgroundImage,
        getComputedStyle(element, '::before').backgroundImage,
        getComputedStyle(element, '::after').backgroundImage,
      ]) {
        for (const match of background.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
          backgroundUrls.add(match[1]);
        }
      }
    }
    await Promise.all(
      [...backgroundUrls].map(
        (url) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            const finish = () => {
              window.clearTimeout(timeoutId);
              image.onload = null;
              image.onerror = null;
              resolve();
            };
            const timeoutId = window.setTimeout(finish, 5_000);
            image.onload = finish;
            image.onerror = finish;
            image.src = url;
            if (image.complete) finish();
          }),
      ),
    );
    window.scrollTo(0, 0);
  });

  const before = await capturePageState(page, route);
  await page.waitForTimeout(VISUAL_STABILITY_DELAY_MS);
  const after = await capturePageState(page, route);
  expect(after, `${route.name} must remain stable before capture`).toEqual(before);
}

async function waitForRequiredCatalogs(page: Page) {
  await page.waitForFunction(
    async (stores) => {
      try {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('Aqua');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        try {
          if (stores.some((store) => !database.objectStoreNames.contains(store))) return false;
          const counts = await Promise.all(
            stores.map(
              (store) =>
                new Promise<number>((resolve, reject) => {
                  const request = database.transaction(store, 'readonly').objectStore(store).count();
                  request.onerror = () => reject(request.error);
                  request.onsuccess = () => resolve(request.result);
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
    { polling: 250, timeout: READY_TIMEOUT_MS },
  );
}

async function warmReadOnlyData(page: Page, origin: string) {
  await page.goto(`${origin}/dashboard`, { waitUntil: 'domcontentloaded' });
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await waitForRequiredCatalogs(page);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, {
    timeout: READY_TIMEOUT_MS,
  });
}

async function capturePageState(page: Page, route: CardRoute) {
  return page.locator('h1.page-heading').locator('..').evaluate((root, routeName) => {
    const cardContainers = Array.from(root.querySelectorAll<HTMLElement>('.card-container'));
    return {
      cardBackgrounds: cardContainers.map((card) => getComputedStyle(card).backgroundImage),
      cardCount: root.querySelectorAll('.cards-col').length,
      height: Math.round(root.getBoundingClientRect().height * 100) / 100,
      images: Array.from(root.querySelectorAll('img'), (image) => ({
        complete: image.complete,
        height: image.naturalHeight,
        src: image.currentSrc,
        width: image.naturalWidth,
      })),
      routeName,
      text: (root.textContent ?? '').replace(/\s+/g, ' ').trim(),
    };
  }, route.name);
}

async function captureDiagnostics(page: Page, route: CardRoute) {
  const selectors =
    route.name === 'card'
      ? ['h1', '.row.mb-2', '.tab-selector-active', '.alert-warning', '.deck-row', '.cards-col', '.card-container']
      : ['h1', '.row.mb-2', '.checkbox-label', '.callout-info', '.pagination', '.cards-col', '.card-container'];

  return page.locator('h1.page-heading').locator('..').evaluate((root, selected) => {
    const inspect = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        className: element.getAttribute('class'),
        rect: {
          height: Math.round(rect.height * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          x: Math.round(rect.x * 100) / 100,
          y: Math.round(rect.y * 100) / 100,
        },
        style: {
          backgroundColor: style.backgroundColor,
          display: style.display,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          margin: style.margin,
          padding: style.padding,
        },
        tag: element.tagName.toLowerCase(),
      };
    };

    return Object.fromEntries(
      selected.map((selector) => [
        selector,
        Array.from(root.querySelectorAll(selector), inspect).slice(0, 12),
      ]),
    );
  }, selectors);
}

async function saveComparison(
  legacyBuffer: Buffer,
  reactBuffer: Buffer,
  diagnostics: unknown,
  apiGets: readonly string[],
  testInfo: TestInfo,
) {
  const legacy = PNG.sync.read(legacyBuffer);
  const react = PNG.sync.read(reactBuffer);

  expect(
    { width: react.width, height: react.height },
    'Legacy and React screenshots must have identical dimensions',
  ).toEqual({ width: legacy.width, height: legacy.height });

  const diff = new PNG({ width: legacy.width, height: legacy.height });
  const mismatchedPixels = pixelmatch(
    legacy.data,
    react.data,
    diff.data,
    legacy.width,
    legacy.height,
    { includeAA: false, threshold: 0.1 },
  );
  const diffRatio = mismatchedPixels / (legacy.width * legacy.height);

  const legacyPath = path.join(testInfo.outputDir, 'legacy.png');
  const reactPath = path.join(testInfo.outputDir, 'react.png');
  const diffPath = path.join(testInfo.outputDir, 'diff.png');
  const diagnosticsPath = path.join(testInfo.outputDir, 'diagnostics.json');
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(legacyPath, legacyBuffer),
    fs.writeFile(reactPath, reactBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
    fs.writeFile(
      diagnosticsPath,
      `${JSON.stringify({ apiGets, diagnostics, diffRatio }, null, 2)}\n`,
    ),
  ]);

  await Promise.all([
    testInfo.attach('legacy', { path: legacyPath, contentType: 'image/png' }),
    testInfo.attach('react', { path: reactPath, contentType: 'image/png' }),
    testInfo.attach('diff', { path: diffPath, contentType: 'image/png' }),
    testInfo.attach('diagnostics', { path: diagnosticsPath, contentType: 'application/json' }),
  ]);

  return diffRatio;
}

test.describe('authenticated Ongeki card-page visual parity', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    credentials === null,
    'Set UI_TEST_USERNAME and UI_TEST_PASSWORD to run authenticated UI parity tests.',
  );

  let account: unknown;
  let currentUser: CurrentUser | undefined;
  let databaseVersion = 0;

  test.beforeAll(async ({ request }) => {
    if (!credentials) return;

    const [signIn, version] = await Promise.all([
      request.post(`${REACT_ORIGIN}/api/auth/signin`, {
        data: {
          usernameOrEmail: credentials.username,
          password: credentials.password,
        },
      }),
      request.get(`${REACT_ORIGIN}/api/static/dbVersion`),
    ]);
    expect(signIn.ok(), 'The sign-in request must succeed').toBeTruthy();
    expect(version.ok(), 'The database-version request must succeed').toBeTruthy();

    const signInResponse = (await signIn.json()) as SignInResponse;
    const versionResponse = (await version.json()) as DbVersionResponse;
    expect(signInResponse.status?.code).toBe(92001);
    expect(signInResponse.data).toBeTruthy();
    expect(signInResponse.data?.tokenType).toBeTruthy();
    expect(signInResponse.data?.accessToken).toBeTruthy();
    expect(versionResponse.version?.major).toBeGreaterThan(0);

    const authenticatedAccount = signInResponse.data;
    if (!authenticatedAccount?.tokenType || !authenticatedAccount.accessToken) {
      throw new Error('The sign-in response did not contain a usable access token');
    }
    const userResponse = await request.get(`${REACT_ORIGIN}/api/user/me`, {
      headers: {
        Authorization: `${authenticatedAccount.tokenType} ${authenticatedAccount.accessToken}`,
      },
    });
    expect(userResponse.ok(), 'The current-user request must succeed').toBeTruthy();
    const currentUserResponse = (await userResponse.json()) as CurrentUserResponse;
    expect(currentUserResponse.status?.code).toBe(92001);
    expect(currentUserResponse.data).toBeTruthy();

    const authenticatedUser = currentUserResponse.data;
    if (authenticatedUser && !authenticatedUser.defaultCard) {
      authenticatedUser.defaultCard = authenticatedUser.cards?.find((card) => card.default);
    }
    expect(authenticatedUser?.defaultCard, 'The current user must have a default card').toBeTruthy();

    account = signInResponse.data;
    currentUser = authenticatedUser;
    databaseVersion = versionResponse.version?.major ?? 0;
  });

  for (const route of routes) {
    for (const theme of themes) {
      test(`${route.name} matches the Angular baseline in ${theme} mode`, async ({ browser }, testInfo) => {
        expect(account, 'Authenticated account was not initialized').toBeTruthy();
        expect(currentUser, 'Authenticated user was not initialized').toBeTruthy();

        const context = await browser.newContext({
          colorScheme: theme,
          deviceScaleFactor: 1,
          ignoreHTTPSErrors: true,
          locale: 'zh-CN',
          serviceWorkers: 'block',
          timezoneId: 'Asia/Hong_Kong',
          viewport: { width: 1280, height: 720 },
        });
        const responseCache = new Map<string, Promise<CachedResponse>>();
        const audit = await installReadOnlyNetwork(context, responseCache);

        await context.addInitScript(
          ({ authenticatedAccount, authenticatedUser, selectedDatabaseVersion, selectedTheme, allowedOrigins }) => {
            if (!allowedOrigins.includes(window.location.origin)) return;
            localStorage.setItem('currentAccount', JSON.stringify(authenticatedAccount));
            localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
            localStorage.setItem('lang', 'zh');
            localStorage.setItem('colorTheme', selectedTheme);
            localStorage.setItem('themeFamily', 'legacy');
            localStorage.setItem('dbVersion', String(selectedDatabaseVersion));
            Math.random = () => 0.5;
            const clickTargets: string[] = [];
            Object.defineProperty(window, '__ongekiParityClicks', {
              configurable: false,
              value: clickTargets,
              writable: false,
            });
            window.addEventListener(
              'click',
              (event) => {
                const target = event.target;
                clickTargets.push(target instanceof Element ? target.outerHTML.slice(0, 200) : 'unknown');
              },
              true,
            );
          },
          {
            authenticatedAccount: account,
            authenticatedUser: currentUser,
            selectedDatabaseVersion: databaseVersion,
            selectedTheme: theme,
            allowedOrigins: [LEGACY_ORIGIN, REACT_ORIGIN],
          },
        );

        const legacyPage = await context.newPage();
        const reactPage = await context.newPage();
        await Promise.all([
          warmReadOnlyData(legacyPage, LEGACY_ORIGIN),
          warmReadOnlyData(reactPage, REACT_ORIGIN),
        ]);
        await Promise.all([
          legacyPage.goto(`${LEGACY_ORIGIN}${route.path}`, { waitUntil: 'domcontentloaded' }),
          reactPage.goto(`${REACT_ORIGIN}${route.path}`, { waitUntil: 'domcontentloaded' }),
        ]);
        await Promise.all([
          settleCardPage(legacyPage, route, 'legacy'),
          settleCardPage(reactPage, route, 'react'),
        ]);

        const [legacyClicks, reactClicks] = await Promise.all([
          legacyPage.evaluate(() =>
            (window as Window & { __ongekiParityClicks?: string[] }).__ongekiParityClicks ?? [],
          ),
          reactPage.evaluate(() =>
            (window as Window & { __ongekiParityClicks?: string[] }).__ongekiParityClicks ?? [],
          ),
        ]);
        const [legacyDiagnostics, reactDiagnostics, legacyBuffer, reactBuffer] = await Promise.all([
          captureDiagnostics(legacyPage, route),
          captureDiagnostics(reactPage, route),
          legacyPage.screenshot({ animations: 'disabled', caret: 'hide' }),
          reactPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        ]);

        const diffRatio = await saveComparison(
          legacyBuffer,
          reactBuffer,
          {
            audit: {
              blockedWrites: audit.blockedWrites,
              legacyClicks,
              reactClicks,
            },
            legacy: legacyDiagnostics,
            react: reactDiagnostics,
          },
          [...audit.apiGets].sort(),
          testInfo,
        );

        expect(legacyClicks, 'The parity test must not click any Angular control').toEqual([]);
        expect(reactClicks, 'The parity test must not click any React control').toEqual([]);
        expect(audit.blockedWrites, 'No portal business API may attempt a non-GET request').toEqual([]);
        expect(
          diffRatio,
          `Visual difference ${(diffRatio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`,
        ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
        await context.close();
      });
    }
  }
});
