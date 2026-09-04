import {
  expect,
  request as playwrightRequest,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
  type TestInfo,
} from '@playwright/test';
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

const username = process.env.UI_TEST_USERNAME;
const password = process.env.UI_TEST_PASSWORD;
const credentials = username && password ? { username, password } : null;

interface SignInResponse {
  data?: {
    accessToken?: string;
    refreshToken?: string;
    tokenType?: string;
  };
  status?: {
    code?: number;
  };
}

interface DbVersionResponse {
  version?: {
    major?: number;
  };
}

interface UserResponse {
  data?: {
    cards?: Array<{
      default?: boolean;
      [key: string]: unknown;
    }>;
    defaultCard?: unknown;
    [key: string]: unknown;
  };
  status?: {
    code?: number;
  };
}

interface CachedApiResponse {
  body: Buffer;
  contentType: string;
  status: number;
}

interface OngekiPageDefinition {
  apiPath?: string;
  name: string;
  path: string;
  readySelector: string;
}

const pages: OngekiPageDefinition[] = [
  {
    name: 'recent',
    path: '/ongeki/recent',
    apiPath: '/api/game/ongeki/recent',
    readySelector: '.list-group .card:not(.placeholder-wave)',
  },
  {
    name: 'song',
    path: '/ongeki/song',
    readySelector: '.card-btn.card',
  },
  {
    name: 'music-ranking',
    path: '/ongeki/musicRanking',
    apiPath: '/api/game/ongeki/data/musicRanking',
    readySelector: 'tr.ranking-row',
  },
  {
    name: 'user-ranking',
    path: '/ongeki/userRanking',
    apiPath: '/api/game/ongeki/data/userRatingRanking',
    readySelector: 'tr.ranking-row',
  },
];

const requiredCatalogs = [
  { path: '/api/game/ongeki/data/cardList', store: 'ongekiCard' },
  { path: '/api/game/ongeki/data/charaList', store: 'ongekiCharacter' },
  { path: '/api/game/ongeki/data/musicList', store: 'ongekiMusic' },
] as const;

const apiResponseCache = new Map<string, Promise<CachedApiResponse>>();
const irrelevantCatalogPaths = new Set([
  '/api/game/chuni/v2/data/music',
  '/api/game/chuni/v2/data/character',
  '/api/game/chuni/v2/data/trophy',
  '/api/game/chuni/v2/data/nameplate',
  '/api/game/chuni/v2/data/sysvoice',
  '/api/game/chuni/v2/data/mapicon',
  '/api/game/chuni/v2/data/frame',
  '/api/game/chuni/v2/data/avatar',
  '/api/game/chuni/v2/data/symbolChatInfo',
  '/api/game/chuni/v2/data/stage',
  '/api/game/maimai2/data/musicList',
]);

function apiCacheKey(url: URL) {
  const search = new URLSearchParams(
    Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [rightKey, rightValue]) =>
      leftKey === rightKey ? leftValue.localeCompare(rightValue) : leftKey.localeCompare(rightKey),
    ),
  ).toString();
  return url.pathname + (search ? `?${search}` : '');
}

async function installReadOnlyApi(context: BrowserContext, sharedApi: APIRequestContext) {
  const blockedApiMutations: string[] = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPortalOrigin = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;

    if (request.method() !== 'GET') {
      if (isPortalOrigin && url.pathname.startsWith('/api/')) {
        blockedApiMutations.push(`${request.method()} ${url.pathname}`);
      }
      await route.abort('blockedbyclient');
      return;
    }

    if (!isPortalOrigin || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }

    if (irrelevantCatalogPaths.has(url.pathname)) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      return;
    }

    const cacheKey = apiCacheKey(url);
    let cached = apiResponseCache.get(cacheKey);
    if (!cached) {
      cached = (async () => {
        try {
          const response = await sharedApi.get(cacheKey);
          return {
            body: await response.body(),
            contentType: response.headers()['content-type'] ?? 'application/json',
            status: response.status(),
          };
        } catch {
          throw new Error(`Shared GET failed for ${url.pathname}`);
        }
      })().catch((error) => {
        apiResponseCache.delete(cacheKey);
        throw error;
      });
      apiResponseCache.set(cacheKey, cached);
    }

    const response = await cached;
    await route.fulfill(response);
  });

  return blockedApiMutations;
}

async function expectedCatalogCounts() {
  const entries = await Promise.all(
    requiredCatalogs.map(async ({ path: catalogPath, store }) => {
      const response = await apiResponseCache.get(catalogPath);
      if (!response) throw new Error(`Missing cached catalog response for ${catalogPath}`);
      const data = JSON.parse(response.body.toString('utf8')) as unknown;
      if (!Array.isArray(data)) throw new Error(`Catalog response is not an array for ${catalogPath}`);
      return [store, data.length] as const;
    }),
  );
  return Object.fromEntries(entries) as Record<(typeof requiredCatalogs)[number]['store'], number>;
}

async function waitForOngekiCatalog(
  page: Page,
  expectedCounts: Record<(typeof requiredCatalogs)[number]['store'], number>,
) {
  await page.waitForFunction(
    async (expected) => {
      const metadata = await indexedDB.databases();
      const aqua = metadata.find((database) => database.name === 'Aqua');
      if (!aqua || (aqua.version ?? 0) < 6) return false;

      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('Aqua');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
      });
      const stores = ['ongekiCard', 'ongekiCharacter', 'ongekiMusic'] as const;
      if (stores.some((store) => !database.objectStoreNames.contains(store))) {
        database.close();
        return false;
      }

      const transaction = database.transaction(stores, 'readonly');
      const counts = await Promise.all(
        stores.map(
          (store) =>
            new Promise<number>((resolve, reject) => {
              const request = transaction.objectStore(store).count();
              request.onerror = () => reject(request.error);
              request.onsuccess = () => resolve(request.result);
            }),
        ),
      );
      database.close();
      return counts.every((count, index) => count === expected[stores[index]]);
    },
    expectedCounts,
    { polling: 250, timeout: READY_TIMEOUT_MS },
  );
}

async function waitForImages(page: Page) {
  await page.waitForFunction(
    () => Array.from(document.images).every((image) => image.complete),
    undefined,
    { polling: 100, timeout: READY_TIMEOUT_MS },
  );
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => undefined)),
    );
    window.scrollTo(0, 0);
  });
}

async function contentSnapshot(page: Page) {
  return page.locator('main').evaluate((main) => {
    const rect = main.getBoundingClientRect();
    return {
      height: Math.round(rect.height * 100) / 100,
      images: Array.from(main.querySelectorAll('img'), (image) => ({
        complete: image.complete,
        height: image.naturalHeight,
        src: image.currentSrc,
        width: image.naturalWidth,
      })),
      placeholders: main.querySelectorAll('.placeholder').length,
      rows: main.querySelectorAll('tr.ranking-row').length,
      songCards: main.querySelectorAll('.card-btn.card').length,
      text: (main.textContent ?? '').replace(/\s+/g, ' ').trim(),
      width: Math.round(rect.width * 100) / 100,
    };
  });
}

async function captureRecentProbe(page: Page) {
  return page.evaluate(() => {
    const inspect = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        style: {
          display: style.display,
          fontSize: style.fontSize,
          gridTemplateColumns: style.gridTemplateColumns,
          lineHeight: style.lineHeight,
          marginBottom: style.marginBottom,
          marginLeft: style.marginLeft,
          marginRight: style.marginRight,
          maxWidth: style.maxWidth,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          position: style.position,
          width: style.width,
          zIndex: style.zIndex,
        },
      };
    };

    const pagination = document.querySelector('.pagination');
    const firstCard = document.querySelector('.list-group .card');
    return {
      battleArea: inspect(firstCard?.querySelector('.battle-area') ?? null),
      charaContainer: inspect(
        firstCard?.querySelector('.chara-container, .recent-chara-container') ?? null,
      ),
      charaImages: Array.from(
        firstCard?.querySelectorAll('.chara-container img, .recent-chara-container img') ?? [],
        (image) => ({
          complete: image.complete,
          naturalHeight: image.naturalHeight,
          naturalWidth: image.naturalWidth,
          src: image.currentSrc,
        }),
      ),
      firstCard: inspect(firstCard),
      difficultyBadge: inspect(firstCard?.querySelector('.difficulty') ?? null),
      jacket: inspect(firstCard?.querySelector('.jacket') ?? null),
      jacketContainer: inspect(firstCard?.querySelector('.jacket-container') ?? null),
      pagination: inspect(pagination),
      paginationLabels: Array.from(pagination?.querySelectorAll('.page-link') ?? [], (link) =>
        (link.textContent ?? '').trim(),
      ),
      scoreArea: inspect(firstCard?.querySelector('.score-area') ?? null),
      songHeader: inspect(
        firstCard?.querySelector('.song-info.card-header, .recent-song-info.card-header') ?? null,
      ),
    };
  });
}

async function captureSongProbe(page: Page) {
  return page.locator('.card-btn.card').first().evaluate((card) => {
    const badgeRow = card.querySelector('.difficulty')?.parentElement;
    return {
      gap: badgeRow ? getComputedStyle(badgeRow).columnGap : null,
      badges: Array.from(card.querySelectorAll('.difficulty'), (badge) => {
        const rect = badge.getBoundingClientRect();
        const style = getComputedStyle(badge);
        return {
          height: Math.round(rect.height * 100) / 100,
          lineHeight: style.lineHeight,
          paddingLeft: style.paddingLeft,
          paddingRight: style.paddingRight,
          text: badge.textContent?.trim() ?? '',
          width: Math.round(rect.width * 100) / 100,
        };
      }),
    };
  });
}

async function settlePage(page: Page, definition: OngekiPageDefinition) {
  await page.waitForLoadState('domcontentloaded');
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  await page.locator(definition.readySelector).first().waitFor({
    state: 'visible',
    timeout: READY_TIMEOUT_MS,
  });
  await expect(page.locator('main .placeholder')).toHaveCount(0, { timeout: READY_TIMEOUT_MS });
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: READY_TIMEOUT_MS });
  await waitForImages(page);

  const before = await contentSnapshot(page);
  await page.waitForTimeout(VISUAL_STABILITY_DELAY_MS);
  const after = await contentSnapshot(page);
  expect(after, `${definition.name} content must remain stable before capture`).toEqual(before);
}

async function saveComparison(oldBuffer: Buffer, newBuffer: Buffer, testInfo: TestInfo) {
  const oldImage = PNG.sync.read(oldBuffer);
  const newImage = PNG.sync.read(newBuffer);

  expect(
    { width: newImage.width, height: newImage.height },
    'Legacy and React screenshots must have identical dimensions',
  ).toEqual({ width: oldImage.width, height: oldImage.height });

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

  const oldPath = path.join(testInfo.outputDir, 'old.png');
  const newPath = path.join(testInfo.outputDir, 'new.png');
  const diffPath = path.join(testInfo.outputDir, 'diff.png');
  await fs.mkdir(testInfo.outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(oldPath, oldBuffer),
    fs.writeFile(newPath, newBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
  ]);

  await Promise.all([
    testInfo.attach('old', { path: oldPath, contentType: 'image/png' }),
    testInfo.attach('new', { path: newPath, contentType: 'image/png' }),
    testInfo.attach('diff', { path: diffPath, contentType: 'image/png' }),
  ]);

  expect(
    diffRatio,
    `Visual difference ${(diffRatio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`,
  ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

test.describe('authenticated Ongeki list page visual parity', () => {
  test.describe.configure({ timeout: 180_000 });

  test.skip(
    credentials === null,
    'Set UI_TEST_USERNAME and UI_TEST_PASSWORD to run authenticated UI parity tests.',
  );

  let authenticatedState: Awaited<ReturnType<BrowserContext['storageState']>> | undefined;
  let sharedApi: APIRequestContext | undefined;

  test.beforeAll(async ({ browser, request }, testInfo) => {
    testInfo.setTimeout(180_000);
    if (!credentials) return;

    const [response, versionResponse] = await Promise.all([
      request.post(`${REACT_ORIGIN}/api/auth/signin`, {
        data: {
          usernameOrEmail: credentials.username,
          password: credentials.password,
        },
      }),
      request.get(`${REACT_ORIGIN}/api/static/dbVersion`),
    ]);
    expect(response.ok(), 'The React-origin sign-in request must succeed').toBeTruthy();
    expect(versionResponse.ok(), 'The database-version request must succeed').toBeTruthy();

    const signInResponse = (await response.json()) as SignInResponse;
    const dbVersionResponse = (await versionResponse.json()) as DbVersionResponse;
    expect(signInResponse.status?.code, 'The sign-in response must have status code 92001').toBe(92001);
    expect(signInResponse.data, 'The sign-in response must include an account').toBeTruthy();
    expect(dbVersionResponse.version?.major, 'The database version must be available').toBeGreaterThan(0);
    expect(signInResponse.data?.tokenType, 'The sign-in response must include a token type').toBeTruthy();
    expect(signInResponse.data?.accessToken, 'The sign-in response must include an access token').toBeTruthy();

    sharedApi = await playwrightRequest.newContext({
      baseURL: REACT_ORIGIN,
      extraHTTPHeaders: {
        Authorization: `${signInResponse.data?.tokenType} ${signInResponse.data?.accessToken}`,
        'Accept-Language': 'zh-CN',
      },
      ignoreHTTPSErrors: true,
    });
    const userResponse = await sharedApi.get('/api/user/me');
    expect(userResponse.ok(), 'The authenticated user request must succeed').toBeTruthy();
    const userBody = await userResponse.body();
    const parsedUserResponse = JSON.parse(userBody.toString('utf8')) as UserResponse;
    expect(parsedUserResponse.status?.code, 'The user response must have status code 92001').toBe(92001);
    expect(parsedUserResponse.data, 'The user response must include a user').toBeTruthy();
    const currentUser = parsedUserResponse.data!;
    currentUser.defaultCard = currentUser.cards?.find((card) => card.default);
    apiResponseCache.set(
      '/api/user/me',
      Promise.resolve({
        body: userBody,
        contentType: userResponse.headers()['content-type'] ?? 'application/json',
        status: userResponse.status(),
      }),
    );

    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
      viewport: { width: 1280, height: 720 },
    });
    const blockedApiMutations = await installReadOnlyApi(context, sharedApi);
    await context.addInitScript(
      ({ authenticatedAccount, authenticatedUser, allowedOrigins, selectedDatabaseVersion }) => {
        if (!allowedOrigins.includes(window.location.origin)) return;
        localStorage.setItem('currentAccount', JSON.stringify(authenticatedAccount));
        localStorage.setItem('currentUser', JSON.stringify(authenticatedUser));
        localStorage.setItem('lang', 'zh');
        localStorage.setItem('colorTheme', 'light');
        localStorage.setItem('themeFamily', 'legacy');
        localStorage.setItem('dbVersion', String(selectedDatabaseVersion));
      },
      {
        authenticatedAccount: signInResponse.data,
        authenticatedUser: currentUser,
        allowedOrigins: [LEGACY_ORIGIN, REACT_ORIGIN],
        selectedDatabaseVersion: dbVersionResponse.version?.major ?? 0,
      },
    );

    const oldPage = await context.newPage();
    const newPage = await context.newPage();
    const catalogResponseWaits = [oldPage, newPage].flatMap((page) =>
      requiredCatalogs.map(({ path: catalogPath }) =>
        page.waitForResponse(
          (catalogResponse) =>
            catalogResponse.request().method() === 'GET' &&
            new URL(catalogResponse.url()).pathname === catalogPath,
          { timeout: READY_TIMEOUT_MS },
        ),
      ),
    );
    await Promise.all([
      oldPage.goto(`${LEGACY_ORIGIN}/dashboard`, { waitUntil: 'domcontentloaded' }),
      newPage.goto(`${REACT_ORIGIN}/dashboard`, { waitUntil: 'domcontentloaded' }),
      ...catalogResponseWaits,
    ]);
    await Promise.all([
      oldPage.locator('h1.page-heading').waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS }),
      newPage.locator('h1.page-heading').waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS }),
    ]);
    const catalogCounts = await expectedCatalogCounts();
    await Promise.all([
      waitForOngekiCatalog(oldPage, catalogCounts),
      waitForOngekiCatalog(newPage, catalogCounts),
    ]);
    expect(blockedApiMutations, 'Catalog warm-up must not attempt API mutations').toEqual([]);

    authenticatedState = await context.storageState({ indexedDB: true });
    await context.close();
  });

  test.afterAll(async () => {
    await sharedApi?.dispose();
  });

  for (const definition of pages) {
    for (const theme of themes) {
      test(`${definition.name} matches the Angular baseline in ${theme} mode`, async ({ browser }, testInfo) => {
        expect(authenticatedState, 'Authenticated browser state was not initialized').toBeTruthy();
        expect(sharedApi, 'Shared API request context was not initialized').toBeTruthy();

        const context = await browser.newContext({
          colorScheme: theme,
          deviceScaleFactor: 1,
          ignoreHTTPSErrors: true,
          locale: 'zh-CN',
          serviceWorkers: 'block',
          storageState: authenticatedState,
          timezoneId: 'Asia/Hong_Kong',
          viewport: { width: 1280, height: 720 },
        });
        const blockedApiMutations = await installReadOnlyApi(context, sharedApi!);
        await context.addInitScript(
          ({ selectedTheme, allowedOrigins }) => {
            if (!allowedOrigins.includes(window.location.origin)) return;
            localStorage.setItem('lang', 'zh');
            localStorage.setItem('colorTheme', selectedTheme);
            localStorage.setItem('themeFamily', 'legacy');
          },
          {
            selectedTheme: theme,
            allowedOrigins: [LEGACY_ORIGIN, REACT_ORIGIN],
          },
        );

        const oldPage = await context.newPage();
        const newPage = await context.newPage();
        const responseWaits = definition.apiPath
          ? [oldPage, newPage].map((page) =>
              page.waitForResponse(
                (response) =>
                  response.request().method() === 'GET' &&
                  new URL(response.url()).pathname === definition.apiPath,
                { timeout: READY_TIMEOUT_MS },
              ),
            )
          : [];

        await Promise.all([
          oldPage.goto(`${LEGACY_ORIGIN}${definition.path}`, { waitUntil: 'domcontentloaded' }),
          newPage.goto(`${REACT_ORIGIN}${definition.path}`, { waitUntil: 'domcontentloaded' }),
          ...responseWaits,
        ]);
        await Promise.all([
          settlePage(oldPage, definition),
          settlePage(newPage, definition),
        ]);

        if (definition.name === 'recent' && theme === 'light') {
          const [oldProbe, newProbe] = await Promise.all([
            captureRecentProbe(oldPage),
            captureRecentProbe(newPage),
          ]);
          expect(
            newProbe.paginationLabels,
            'Recent pagination window must match the Angular baseline',
          ).toEqual(oldProbe.paginationLabels);
          expect(
            newProbe.pagination?.rect,
            'Recent pagination geometry must match the Angular baseline',
          ).toEqual(oldProbe.pagination?.rect);
          expect(
            newProbe.charaImages,
            'Recent card lineup must use the same loaded assets as the Angular baseline',
          ).toEqual(oldProbe.charaImages);
          expect(
            newProbe.charaContainer?.style.zIndex,
            'Recent card lineup must not be hidden behind the card body',
          ).toBe(oldProbe.charaContainer?.style.zIndex);
          expect(
            newProbe.jacketContainer,
            'Recent jacket container geometry must match the Angular baseline',
          ).toEqual(oldProbe.jacketContainer);
          expect(
            newProbe.jacket,
            'Recent jacket geometry must match the Angular baseline',
          ).toEqual(oldProbe.jacket);
          expect(
            newProbe.difficultyBadge?.style.fontSize,
            'Recent difficulty badge font size must match the Angular baseline',
          ).toBe(oldProbe.difficultyBadge?.style.fontSize);
          expect(newProbe.difficultyBadge?.style.lineHeight).toBe(
            oldProbe.difficultyBadge?.style.lineHeight,
          );
          expect(newProbe.difficultyBadge?.rect.x).toBe(oldProbe.difficultyBadge?.rect.x);
          expect(newProbe.difficultyBadge?.rect.y).toBe(oldProbe.difficultyBadge?.rect.y);
          expect(newProbe.difficultyBadge?.rect.height).toBe(
            oldProbe.difficultyBadge?.rect.height,
          );
          expect(
            Math.abs(
              (newProbe.difficultyBadge?.rect.width ?? 0) -
                (oldProbe.difficultyBadge?.rect.width ?? 0),
            ),
            'Recent difficulty badge width must remain within subpixel rendering tolerance',
          ).toBeLessThanOrEqual(0.1);
          expect(
            newProbe.songHeader?.rect,
            'Recent song header geometry must match the Angular baseline',
          ).toEqual(oldProbe.songHeader?.rect);
        }

        if (definition.name === 'song' && theme === 'light') {
          const [oldProbe, newProbe] = await Promise.all([
            captureSongProbe(oldPage),
            captureSongProbe(newPage),
          ]);
          expect(
            newProbe,
            'Song difficulty badge gutter and geometry must match the Angular baseline',
          ).toEqual(oldProbe);
        }

        await expect(oldPage).toHaveURL(`${LEGACY_ORIGIN}${definition.path}`);
        await expect(newPage).toHaveURL(`${REACT_ORIGIN}${definition.path}`);
        expect(blockedApiMutations, `${definition.name} must not attempt API mutations`).toEqual([]);

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
