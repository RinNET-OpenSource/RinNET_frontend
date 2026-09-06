import { expect, test, type BrowserContext } from '@playwright/test';

const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';

const account = {
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
  tokenType: 'Bearer',
};

const user = {
  id: 1,
  username: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.invalid',
  roles: [],
  games: ['maimai2'],
  cards: [],
  defaultCard: null,
  keychips: [],
  userTrustKeychips: [],
  oauth2s: [],
};

async function installFixtureApi(context: BrowserContext) {
  await context.route((url) => url.origin === REACT_ORIGIN && url.pathname.startsWith('/api/'), async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/account/status') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' },
          status: { code: 92001 },
        }),
      });
      return;
    }

    if (url.pathname === '/api/user/me') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: user, status: { code: 92001 } }),
      });
      return;
    }

    if (url.pathname === '/api/static/dbVersion') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ state: 'Success', version: { major: 6 } }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: null, status: { code: 92001 } }),
    });
  });
}

test('Liquefy importer keeps its warning prominent and its toast dismissible', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
    serviceWorkers: 'block',
  });
  await installFixtureApi(context);
  await context.addInitScript(({ savedAccount, savedUser, origin }) => {
    if (window.location.origin !== origin) return;

    localStorage.clear();
    localStorage.setItem('currentAccount', JSON.stringify(savedAccount));
    localStorage.setItem('currentUser', JSON.stringify(savedUser));
    localStorage.setItem('lang', 'zh');
    localStorage.setItem('colorTheme', 'dark');
    localStorage.setItem('themeFamily', 'liquefy');
    localStorage.setItem('dbVersion', '6');
  }, { savedAccount: account, savedUser: user, origin: REACT_ORIGIN });

  const page = await context.newPage();
  await page.goto(`${REACT_ORIGIN}/import`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
  await expect(page.getByRole('heading', { name: '导入' })).toBeVisible();

  const warning = page.locator('.liquefy-import-warning');
  await expect(warning).toBeVisible();
  expect(await warning.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThanOrEqual(88);
  await expect(warning.locator('.lq-alert__icon')).toBeVisible();

  await page.locator('input[type="file"]').first().setInputFiles({
    name: 'wrong-game.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ gameId: 'wrong' })),
  });
  const toast = page.locator('.liquefy-toast').filter({ hasText: 'Wrong Game ID' });
  await expect(toast).toContainText('Wrong Game ID');
  await toast.getByRole('button').click();
  await expect(toast).toHaveCount(0);

  await context.close();
});
