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
};

async function installFixtureApi(context: BrowserContext) {
  const blockedStateChanges: string[] = [];

  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPortal = url.origin === LEGACY_ORIGIN || url.origin === REACT_ORIGIN;
    const isBusinessApi =
      isPortal && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));

    if (isBusinessApi && request.method() !== 'GET') {
      blockedStateChanges.push(`${request.method()} ${url.pathname}`);
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
    } else if (url.pathname === '/api/game/maimai2/profile') {
      body = maimai2ProfileFixture;
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

  return blockedStateChanges;
}

async function installStorage(
  context: BrowserContext,
  theme: 'light' | 'dark',
  family: 'legacy' | 'liquefy' = 'legacy',
) {
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

async function settle(page: Page) {
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await page.getByText(maimai2ProfileFixture.userName, { exact: true }).waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images, (image) => image.decode().catch(() => undefined)));
    window.scrollTo(0, 0);
  });
}

async function openPair(context: BrowserContext, viewport: { width: number; height: number }) {
  const legacyPage = await context.newPage();
  const reactPage = await context.newPage();
  await Promise.all([legacyPage.setViewportSize(viewport), reactPage.setViewportSize(viewport)]);
  await Promise.all([
    legacyPage.goto(`${LEGACY_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' }),
    reactPage.goto(`${REACT_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' }),
  ]);
  await Promise.all([settle(legacyPage), settle(reactPage)]);
  return { legacyPage, reactPage };
}

async function compare(
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
  await Promise.all([
    fs.writeFile(path.join(testInfo.outputDir, `${label}-legacy.png`), legacyBuffer),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-react.png`), reactBuffer),
    fs.writeFile(path.join(testInfo.outputDir, `${label}-diff.png`), PNG.sync.write(diff)),
    fs.writeFile(
      path.join(testInfo.outputDir, `${label}-comparison.json`),
      JSON.stringify({ ratio, mismatchedPixels }, null, 2),
    ),
  ]);

  return ratio;
}

async function capturePair(legacyPage: Page, reactPage: Page, testInfo: TestInfo, label: string) {
  const [legacyBuffer, reactBuffer] = await Promise.all([
    legacyPage.screenshot({ animations: 'disabled', caret: 'hide' }),
    reactPage.screenshot({ animations: 'disabled', caret: 'hide' }),
  ]);
  return compare(legacyBuffer, reactBuffer, testInfo, label);
}

async function closeTransientOverlays(legacyPage: Page, reactPage: Page) {
  await Promise.all([legacyPage.keyboard.press('Escape'), reactPage.keyboard.press('Escape')]);
  await Promise.all([
    expect(legacyPage.locator('.popover.show, .dropdown-menu.show')).toHaveCount(0),
    expect(
      reactPage.locator(
        '.shell-user-popover, [role="menu"]',
      ),
    ).toHaveCount(0),
  ]);
}

function visibleNavbarButton(page: Page) {
  return page.locator('.app-navbar button.btn-icon:visible').last();
}

function footerTrigger(page: Page, index: number) {
  return page.locator('footer .row.fw-bold > .col-auto').nth(index).locator('a').first();
}

async function expectUserPopoverAboveNavbar(page: Page) {
  const layers = await page.locator('.shell-user-popover').evaluate((popover) => {
    const navbar = document.querySelector<HTMLElement>('.app-navbar');
    if (!navbar) throw new Error('Expected the application navbar to be present.');

    return {
      navbar: Number.parseInt(getComputedStyle(navbar).zIndex, 10),
      popover: Number.parseInt(getComputedStyle(popover).zIndex, 10),
    };
  });

  expect(layers.popover, 'The portalized user popover must render above the fixed navbar.').toBeGreaterThan(
    layers.navbar,
  );
}

async function expectLiquefyFooterToFloatAtViewportBottom(page: Page) {
  const geometry = await page.locator('footer.footer').evaluate((footer) => {
    const bounds = footer.getBoundingClientRect();
    return {
      bottomGap: window.innerHeight - bounds.bottom,
      position: getComputedStyle(footer).position,
    };
  });

  expect(geometry.position).toBe('fixed');
  expect(geometry.bottomGap).toBeGreaterThanOrEqual(0);
  expect(geometry.bottomGap).toBeLessThanOrEqual(12);
}

async function expectLiquefyHeaderAndFooterToShareGlassMaterial(page: Page) {
  const surfaces = await page.locator('.app-navbar, footer.footer').evaluateAll((elements) =>
    elements.map((element) => {
      const styles = getComputedStyle(element);
      return {
        backgroundColor: styles.backgroundColor,
        borderTopColor: styles.borderTopColor,
        boxShadow: styles.boxShadow,
        backdropFilter: styles.backdropFilter,
      };
    }),
  );

  expect(surfaces).toHaveLength(2);
  expect(surfaces[0]).toEqual(surfaces[1]);
}

async function expectLiquefyMobileHeaderToStayWithinViewport(page: Page) {
  const geometry = await page.locator('.app-navbar').evaluate((navbar) => {
    const bounds = navbar.getBoundingClientRect();
    return {
      leftInset: bounds.left,
      rightInset: window.innerWidth - bounds.right,
      viewportWidth: window.innerWidth,
      width: bounds.width,
    };
  });

  expect(geometry.leftInset).toBeGreaterThanOrEqual(7.5);
  expect(geometry.rightInset).toBeGreaterThanOrEqual(7.5);
  expect(Math.abs(geometry.leftInset - geometry.rightInset)).toBeLessThanOrEqual(0.5);
  expect(geometry.width).toBeCloseTo(
    geometry.viewportWidth - geometry.leftInset - geometry.rightInset,
    4,
  );
}

async function expectLiquefyMobileDrawerToCoverHeader(page: Page) {
  const layers = await page.locator('.shell-mobile-liquid-drawer').evaluate((drawer) => {
    const navbar = document.querySelector<HTMLElement>('.app-navbar');
    const backdrop = document.querySelector<HTMLElement>('.lq-drawer__backdrop');
    if (!navbar || !backdrop) throw new Error('Expected the Liquefy mobile drawer and shell surfaces.');

    const headerStyles = getComputedStyle(navbar);
    return {
      backdrop: Number.parseInt(getComputedStyle(backdrop).zIndex, 10),
      drawer: Number.parseInt(getComputedStyle(drawer).zIndex, 10),
      header: Number.parseInt(headerStyles.zIndex, 10),
      headerBottomBorder: headerStyles.borderBottomColor,
    };
  });

  expect(layers.backdrop).toBeGreaterThan(layers.header);
  expect(layers.drawer).toBeGreaterThan(layers.backdrop);
  expect(layers.headerBottomBorder).toBe('rgba(0, 0, 0, 0)');
}

test.describe('application shell responsive and overlay parity', () => {
  test.describe.configure({ timeout: 120_000 });

  for (const theme of themes) {
    test(`legacy shell overlays match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        reducedMotion: 'reduce',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
      });
      const blockedStateChanges = await installFixtureApi(context);
      await installStorage(context, theme);
      const comparisons: Array<{ label: string; ratio: number }> = [];

      const mobile = await openPair(context, { width: 390, height: 844 });
      await Promise.all([
        mobile.legacyPage.locator('.navbar-toggler:visible').click(),
        mobile.reactPage.locator('.navbar-toggler:visible').click(),
      ]);
      await Promise.all([
        mobile.legacyPage
          .locator('#sidebar[role="dialog"][aria-modal="true"]')
          .waitFor({ state: 'visible', timeout: 10_000 }),
        mobile.reactPage
          .locator('.shell-mobile-sheet')
          .waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
      comparisons.push({
        label: `mobile-sidebar-${theme}`,
        ratio: await capturePair(
          mobile.legacyPage,
          mobile.reactPage,
          testInfo,
          `mobile-sidebar-${theme}`,
        ),
      });
      await Promise.all([mobile.legacyPage.close(), mobile.reactPage.close()]);

      const desktop = await openPair(context, { width: 1280, height: 720 });
      await Promise.all([
        visibleNavbarButton(desktop.legacyPage).click(),
        visibleNavbarButton(desktop.reactPage).click(),
      ]);
      await Promise.all([
        desktop.legacyPage.locator('.popover.show').waitFor({ state: 'visible', timeout: 10_000 }),
        desktop.reactPage
          .locator('.shell-user-popover')
          .waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
      await expectUserPopoverAboveNavbar(desktop.reactPage);
      comparisons.push({
        label: `user-popover-${theme}`,
        ratio: await capturePair(
          desktop.legacyPage,
          desktop.reactPage,
          testInfo,
          `user-popover-${theme}`,
        ),
      });
      await closeTransientOverlays(desktop.legacyPage, desktop.reactPage);

      await Promise.all([
        desktop.legacyPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)),
        desktop.reactPage.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)),
      ]);

      await Promise.all([
        footerTrigger(desktop.legacyPage, 0).click(),
        footerTrigger(desktop.reactPage, 0).click(),
      ]);
      await Promise.all([
        desktop.legacyPage
          .locator('.dropdown-menu.show')
          .waitFor({ state: 'visible', timeout: 10_000 }),
        desktop.reactPage
          .getByRole('menu')
          .waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
      comparisons.push({
        label: `language-dropdown-${theme}`,
        ratio: await capturePair(
          desktop.legacyPage,
          desktop.reactPage,
          testInfo,
          `language-dropdown-${theme}`,
        ),
      });
      await closeTransientOverlays(desktop.legacyPage, desktop.reactPage);

      await Promise.all([
        footerTrigger(desktop.legacyPage, 1).click(),
        footerTrigger(desktop.reactPage, 1).click(),
      ]);
      await Promise.all([
        desktop.legacyPage
          .locator('.dropdown-menu.show')
          .waitFor({ state: 'visible', timeout: 10_000 }),
        desktop.reactPage
          .getByRole('menu')
          .waitFor({ state: 'visible', timeout: 10_000 }),
      ]);
      // The React theme menu intentionally adds a family selector above the
      // legacy color choices. Its layout and state transitions are covered by
      // theme-system.spec.ts, so it is not an Angular pixel-parity target.
      await closeTransientOverlays(desktop.legacyPage, desktop.reactPage);

      expect(blockedStateChanges, 'Shell parity must not attempt any Portal state change').toEqual([]);
      expect(
        comparisons.filter(({ ratio }) => ratio > MAX_DIFF_RATIO),
        comparisons
          .map(({ label, ratio }) => `${label}: ${(ratio * 100).toFixed(3)}%`)
          .join('\n'),
      ).toEqual([]);
      await context.close();
    });
  }

  test('liquefy shell overlays remain functional and read-only', async ({ browser }) => {
    const context = await browser.newContext({
      colorScheme: 'light',
      deviceScaleFactor: 1,
      ignoreHTTPSErrors: true,
      locale: 'zh-CN',
      reducedMotion: 'reduce',
      serviceWorkers: 'block',
      timezoneId: 'Asia/Hong_Kong',
    });
    const blockedStateChanges = await installFixtureApi(context);
    await installStorage(context, 'light', 'liquefy');

    const page = await context.newPage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${REACT_ORIGIN}/mai2/profile`, { waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
    await expect(page.locator('canvas.lq-surface__shader')).toHaveCount(0);
    await expectLiquefyMobileHeaderToStayWithinViewport(page);
    await page.getByLabel('导航', { exact: true }).click();
    await expect(page.locator('.shell-mobile-liquid-drawer')).toBeVisible();
    await expectLiquefyMobileDrawerToCoverHeader(page);
    await page.keyboard.press('Escape');

    await page.setViewportSize({ width: 1280, height: 720 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await settle(page);
    await expectLiquefyFooterToFloatAtViewportBottom(page);
    await expectLiquefyHeaderAndFooterToShareGlassMaterial(page);
    await visibleNavbarButton(page).click();
    await expect(page.locator('.shell-user-popover')).toBeVisible();
    await expectUserPopoverAboveNavbar(page);
    await page.keyboard.press('Escape');
    await visibleNavbarButton(page).click();
    await page.locator('.shell-user-popover a[href="/profile"]').click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.locator('.shell-user-popover')).toHaveCount(0);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await footerTrigger(page, 0).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await footerTrigger(page, 1).click();
    await expect(page.getByRole('menuitem', { name: '液态玻璃', exact: true })).toBeVisible();

    expect(blockedStateChanges, 'Liquefy shell smoke test must stay read-only').toEqual([]);
    await context.close();
  });
});
