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

const releaseTags = [
  'v1 1.00.00',
  'v1 1.05.00',
  'v1 1.10.00',
  'v1 1.15.00',
  'v1 1.20.00',
  'v1 1.25.00',
  'v1 1.30.00',
  'v1 1.35.00',
  'v1 1.40.00',
  'v1 1.45.00',
  'v1 1.50.00',
  'v1 1.55.00',
  'v2 2.00.00',
  'v2 2.05.00',
  'v2 2.10.00',
  'v2 2.15.00',
  'v2 2.20.00',
  'v2 2.25.00',
  'v2 2.30.00',
] as const;

const characterCatalog = Array.from({ length: 30 }, (_, index) => {
  const id = index + 1;
  return {
    id,
    name: `Fixture Character ${String(id).padStart(2, '0')}`,
    releaseTag: releaseTags[index % releaseTags.length],
    worksName: `Fixture Work ${Math.floor(index / 5) + 1}`,
    illustratorName: `Fixture Illustrator ${Math.floor(index / 3) + 1}`,
    addImages: id === 1
      ? '101:Fixture Character 01 Alt,102:Fixture Character 01 Extra'
      : '-1:',
  };
});

const acquiredIds = Array.from({ length: 24 }, (_, index) => index + 1);

const profile = {
  characterId: 14,
  charaIllustId: 14,
};

const acquiredCharacters = new Map(
  acquiredIds.map((characterId) => [
    characterId,
    {
      characterId,
      playCount: characterId * 3,
      level: 10 + characterId,
      friendshipExp: characterId * 5,
      isValid: true,
      isNewMark: false,
      exMaxLv: 0,
      assignIllust: 0,
      param1: '0',
      param2: '0',
    },
  ]),
);

interface CapturedWrite {
  body: Record<string, unknown>;
  method: string;
  origin: string;
  path: string;
}

interface FixtureAudit {
  blockedWrites: string[];
  writes: CapturedWrite[];
}

async function installFixtureApi(context: BrowserContext): Promise<FixtureAudit> {
  const audit: FixtureAudit = { blockedWrites: [], writes: [] };
  const runtimeAcquiredCharacters = new Map(acquiredCharacters);

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;
    const isBusinessApi =
      isPortal &&
      (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));

    if (isBusinessApi && method !== 'GET') {
      const isSet = method === 'PUT' && url.pathname === '/api/game/chuni/v2/profile/character';
      const isUnlock = method === 'POST' && url.pathname === '/api/game/chuni/v2/character';
      if (!isSet && !isUnlock) {
        audit.blockedWrites.push(`${method} ${url.pathname}`);
        await route.abort('blockedbyclient');
        return;
      }

      const body = (request.postDataJSON() ?? {}) as Record<string, unknown>;
      audit.writes.push({ body, method, origin: url.origin, path: url.pathname });
      if (isUnlock) {
        const characterId = Number(body.characterId);
        runtimeAcquiredCharacters.set(characterId, {
          characterId,
          playCount: 0,
          level: Number(body.level),
          friendshipExp: 0,
          isValid: true,
          isNewMark: Boolean(body.isNewMark),
          exMaxLv: 0,
          assignIllust: 0,
          param1: '0',
          param2: '0',
        });
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          isSet
            ? { characterId: body.characterId, charaIllustId: body.charaIllustId }
            : { ...body },
        ),
      });
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
    } else if (url.pathname === '/api/game/chuni/v2/data/character') {
      body = characterCatalog;
    } else if (url.pathname === '/api/game/chuni/v2/profile') {
      body = profile;
    } else if (url.pathname === '/api/game/chuni/v2/charaIds') {
      body = acquiredIds;
    } else if (url.pathname === '/api/game/chuni/v2/charaInfos') {
      const ids = (url.searchParams.get('charaIds') ?? '')
        .split(',')
        .filter(Boolean)
        .map(Number);
      body = ids.flatMap((id) => {
        const character = runtimeAcquiredCharacters.get(id);
        return character ? [character] : [];
      });
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

  return audit;
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
      Math.random = () => 0.5;
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

async function waitForCharacterCatalog(page: Page) {
  await page.waitForFunction(
    async (expected) => {
      try {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('Aqua');
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        if (!database.objectStoreNames.contains('chusanCharacter')) {
          database.close();
          return false;
        }
        const count = await new Promise<number>((resolve, reject) => {
          const request = database
            .transaction('chusanCharacter', 'readonly')
            .objectStore('chusanCharacter')
            .count();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
        database.close();
        return count === expected;
      } catch {
        return false;
      }
    },
    characterCatalog.length,
    { timeout: 30_000 },
  );
}

function pageRoot(page: Page) {
  return page.locator('h1.page-heading').locator('..');
}

async function settleCharacterPage(page: Page, expectedCards = 12) {
  const root = pageRoot(page);
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(root.locator('.row.row-cols-2 > .col')).toHaveCount(expectedCards, {
    timeout: 30_000,
  });
  await expect(root.locator('.pagination').first().locator('.page-item.active')).toHaveText('2');
  await expect(root.locator('.character-title').first()).toContainText('Fixture Character 13');
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
    window.scrollTo(0, 0);
  });
  await page.mouse.move(0, 0);
}

async function saveComparison(
  legacyBuffer: Buffer,
  reactBuffer: Buffer,
  testInfo: TestInfo,
  label: string,
) {
  const legacy = PNG.sync.read(legacyBuffer);
  const react = PNG.sync.read(reactBuffer);
  expect({ width: react.width, height: react.height }).toEqual({
    width: legacy.width,
    height: legacy.height,
  });

  const diff = new PNG({ width: legacy.width, height: legacy.height });
  const mismatchedPixels = pixelmatch(
    legacy.data,
    react.data,
    diff.data,
    legacy.width,
    legacy.height,
    { includeAA: false, threshold: 0.1 },
  );
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
  await Promise.all([
    testInfo.attach(`${label}-legacy`, { path: legacyPath, contentType: 'image/png' }),
    testInfo.attach(`${label}-react`, { path: reactPath, contentType: 'image/png' }),
    testInfo.attach(`${label}-diff`, { path: diffPath, contentType: 'image/png' }),
  ]);
  expect(
    ratio,
    `${label} visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`,
  ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

async function state(page: Page) {
  const root = pageRoot(page);
  return root.evaluate((element) => ({
    acquired: (element.querySelector('#showAcquired') as HTMLInputElement | null)?.checked,
    cards: Array.from(element.querySelectorAll('.character-title'), (title) =>
      (title.textContent ?? '').replace(/\s+/g, ' ').trim(),
    ),
    filterVisible: !!element.querySelector('#filterCollapse.show'),
    page: element.querySelector('.pagination .page-item.active')?.textContent?.trim(),
    resetVisible: Array.from(element.querySelectorAll('.link-btn')).some(
      (link) => link.textContent?.trim() === '重置过滤',
    ),
    total: Array.from(element.querySelectorAll('.mb-2'))
      .map((item) => item.textContent?.replace(/\s+/g, ' ').trim())
      .find((text) => text?.startsWith('共 ')),
    unacquired: (element.querySelector('#showUnacquired') as HTMLInputElement | null)?.checked,
  }));
}

async function expectSameState(legacyPage: Page, reactPage: Page) {
  await expect.poll(() => state(legacyPage)).toEqual(await state(reactPage));
}

async function openCharacterPages(context: BrowserContext) {
  const legacyPage = await context.newPage();
  const reactPage = await context.newPage();
  await Promise.all([
    legacyPage.goto(`${LEGACY_ORIGIN}/chuni/v2/character`, { waitUntil: 'domcontentloaded' }),
    reactPage.goto(`${REACT_ORIGIN}/chuni/v2/character`, { waitUntil: 'domcontentloaded' }),
  ]);
  await Promise.all([waitForCharacterCatalog(legacyPage), waitForCharacterCatalog(reactPage)]);
  await Promise.all([
    legacyPage.reload({ waitUntil: 'domcontentloaded' }),
    reactPage.reload({ waitUntil: 'domcontentloaded' }),
  ]);
  await Promise.all([settleCharacterPage(legacyPage), settleCharacterPage(reactPage)]);
  return { legacyPage, reactPage };
}

test.describe('Chunithm v2 character parity', () => {
  test.describe.configure({ timeout: 150_000 });

  for (const theme of themes) {
    test(`default page matches Angular in ${theme} mode`, async ({ browser }, testInfo) => {
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
      await installFixtureStorage(context, theme);
      const { legacyPage, reactPage } = await openCharacterPages(context);
      const [legacyScreenshot, reactScreenshot] = await Promise.all([
        legacyPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        reactPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await saveComparison(legacyScreenshot, reactScreenshot, testInfo, `character-${theme}`);
      expect(audit.writes).toEqual([]);
      expect(audit.blockedWrites).toEqual([]);
      await context.close();
    });
  }

  test('filters, pagination, illustrations, modals, set, and unlock match Angular', async ({
    browser,
  }, testInfo) => {
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
    await installFixtureStorage(context, 'light');
    const { legacyPage, reactPage } = await openCharacterPages(context);

    for (const page of [legacyPage, reactPage]) {
      await pageRoot(page).getByText('显示过滤', { exact: true }).click();
      const filter = pageRoot(page).locator('#filterCollapse');
      await expect(filter).toHaveClass(/show/);
      // Bootstrap's Angular transition occasionally retains an inline 0px height in
      // headless Chromium. Keep the toggle assertion, then expose the legacy controls
      // so this fixture can exercise the underlying handlers on both implementations.
      await filter.evaluate((element) => {
        if (getComputedStyle(element).height === '0px') {
          (element as HTMLElement).style.height = 'auto';
        }
        if (getComputedStyle(element).visibility === 'collapse') {
          (element as HTMLElement).style.visibility = 'visible';
        }
      });
      await expect(filter).toBeVisible();
    }
    const reactFilter = pageRoot(reactPage).locator('#filterCollapse');
    await expect(reactFilter).toHaveClass(/chuni-v2-character-filter-collapse/);
    await expect(reactFilter).toHaveAttribute('aria-hidden', 'false');
    const openFilterStyle = await reactFilter.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        gridTemplateRows: style.gridTemplateRows,
        opacity: style.opacity,
        transitionDuration: style.transitionDuration,
        transitionProperty: style.transitionProperty,
        visibility: style.visibility,
      };
    });
    expect(openFilterStyle.transitionProperty).toContain('grid-template-rows');
    expect(openFilterStyle.transitionProperty).toContain('opacity');
    expect(parseFloat(openFilterStyle.transitionDuration)).toBeGreaterThan(0);
    await expect.poll(() =>
      reactFilter.evaluate((element) => {
        const style = getComputedStyle(element);
        return { opacity: style.opacity, visibility: style.visibility };
      }),
    ).toEqual({ opacity: '1', visibility: 'visible' });

    await pageRoot(reactPage).getByText('隐藏过滤', { exact: true }).click();
    await expect(reactFilter).not.toHaveClass(/show/);
    await expect(reactFilter).toHaveAttribute('aria-hidden', 'true');
    await expect.poll(() =>
      reactFilter.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          opacity: style.opacity,
          visibility: style.visibility,
          height: style.height,
        };
      }),
    ).toEqual({ opacity: '0', visibility: 'hidden', height: '0px' });
    await pageRoot(reactPage).getByText('显示过滤', { exact: true }).click();
    await expect(reactFilter).toHaveClass(/show/);

    const [legacyFilter, reactFilterScreenshot] = await Promise.all([
      legacyPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      reactPage.screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await saveComparison(legacyFilter, reactFilterScreenshot, testInfo, 'character-filter-expanded');

    for (const page of [legacyPage, reactPage]) {
      await pageRoot(page).locator('label[for="showAcquired"]').click();
      await pageRoot(page).locator('label[for="showUnacquired"]').click();
    }
    await expectSameState(legacyPage, reactPage);
    await expect(pageRoot(reactPage).locator('.character-title')).toHaveCount(6);

    for (const page of [legacyPage, reactPage]) {
      await pageRoot(page).locator('label[for="releaseTag5"]').click();
    }
    await expectSameState(legacyPage, reactPage);
    await expect(pageRoot(reactPage).locator('.character-title')).toHaveCount(1);

    for (const page of [legacyPage, reactPage]) {
      await pageRoot(page).locator('input[placeholder]').fill('Fixture Character 25');
    }
    await expectSameState(legacyPage, reactPage);
    await expect(pageRoot(reactPage).locator('.character-title')).toHaveCount(1);

    for (const page of [legacyPage, reactPage]) {
      await pageRoot(page).getByText('重置过滤', { exact: true }).click();
      await expect(pageRoot(page).locator('#showAcquired')).toBeChecked();
      await expect(pageRoot(page).locator('#showUnacquired')).not.toBeChecked();
      await pageRoot(page).locator('.pagination').first().getByText('1', { exact: true }).click();
      await expect(page).toHaveURL(/\?page=1$/);
      await expect(pageRoot(page).locator('.character-title').first()).toContainText(
        'Fixture Character 01',
      );
    }
    await expectSameState(legacyPage, reactPage);

    for (const page of [legacyPage, reactPage]) {
      await pageRoot(page).locator('.image-switch').first().click();
      await expect(pageRoot(page).locator('.character-title').first()).toContainText(
        'Fixture Character 01 Alt',
      );
      await expect(pageRoot(page).locator('.character-img img').first()).toHaveAttribute(
        'src',
        /CHU_UI_Character_0010_01_00\.webp$/,
      );
      await pageRoot(page).locator('.card.card-btn').first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('tbody tr').first()).toContainText('101');
      await expect(dialog).toContainText('Fixture Character 01 Alt');
      if (page === reactPage) {
        const modal = page.locator('.chuni-v2-character-dialog');
        await expect.poll(() => modal.evaluate((element) => getComputedStyle(element).animationName)).toMatch(
          /chuni-v2-character-dialog-in/,
        );
      }
    }
    const [legacyAcquiredModal, reactAcquiredModal] = await Promise.all([
      legacyPage.getByRole('dialog').locator('.modal-content').screenshot({ animations: 'disabled', caret: 'hide' }),
      reactPage.getByRole('dialog').locator('.modal-content').screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await saveComparison(
      legacyAcquiredModal,
      reactAcquiredModal,
      testInfo,
      'character-acquired-modal',
    );
    const reactDialog = reactPage.getByRole('dialog');
    await reactDialog.locator('button.btn-close').click();
    const closedReactModal = reactPage.locator('.chuni-v2-character-dialog');
    await expect(closedReactModal).toHaveCount(1);
    await expect.poll(() =>
      closedReactModal.evaluate((element) => getComputedStyle(element).animationName),
    ).toMatch(/chuni-v2-character-dialog-out/);
    await expect(closedReactModal).toHaveCount(0);
    await pageRoot(reactPage).locator('.card.card-btn').first().click();
    await expect(reactPage.getByRole('dialog')).toBeVisible();

    for (const page of [legacyPage, reactPage]) {
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: '使用', exact: true }).click();
      await expect(dialog).not.toBeVisible();
    }

    for (const page of [legacyPage, reactPage]) {
      await pageRoot(page).locator('label[for="showAcquired"]').click();
      await pageRoot(page).locator('label[for="showUnacquired"]').click();
      await expect(pageRoot(page).locator('.character-title')).toHaveCount(6);
      await pageRoot(page).locator('.card.card-btn').first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('Fixture Character 25');
      await expect(dialog).not.toContainText('使用次数');
    }
    const [legacyUnacquiredModal, reactUnacquiredModal] = await Promise.all([
      legacyPage.getByRole('dialog').locator('.modal-content').screenshot({ animations: 'disabled', caret: 'hide' }),
      reactPage.getByRole('dialog').locator('.modal-content').screenshot({ animations: 'disabled', caret: 'hide' }),
    ]);
    await saveComparison(
      legacyUnacquiredModal,
      reactUnacquiredModal,
      testInfo,
      'character-unacquired-modal',
    );
    for (const page of [legacyPage, reactPage]) {
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: '解锁', exact: true }).click();
      await expect(pageRoot(page).locator('.character-title')).toHaveCount(6);
    }

    await expect.poll(() => audit.writes.length).toBe(4);
    const setWrites = audit.writes.filter(
      (write) => write.path === '/api/game/chuni/v2/profile/character',
    );
    const unlockWrites = audit.writes.filter(
      (write) => write.path === '/api/game/chuni/v2/character',
    );
    expect(setWrites).toHaveLength(2);
    expect(unlockWrites).toHaveLength(2);
    expect(setWrites.map((write) => write.body)).toEqual([
      { aimeId: '10000001', characterId: 1, charaIllustId: 101 },
      { aimeId: '10000001', characterId: 1, charaIllustId: 101 },
    ]);
    expect(unlockWrites.map((write) => write.body)).toEqual([
      { aimeId: '10000001', characterId: 25, level: 1, isValid: true, isNewMark: true },
      { aimeId: '10000001', characterId: 25, level: 1, isValid: true, isNewMark: true },
    ]);
    expect(audit.blockedWrites).toEqual([]);
    await context.close();
  });
});
