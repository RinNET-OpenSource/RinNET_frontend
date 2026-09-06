import { expect, test, type BrowserContext } from '@playwright/test';

const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';

const account = {
  accessToken: 'fixture-access-token',
  refreshToken: 'fixture-refresh-token',
  tokenType: 'Bearer',
};

const card = {
  id: 1,
  extId: 10000001,
  luid: '01234567890123456789',
  default: true,
  registerTime: '2026-01-01T00:00:00+08:00',
  accessTime: '2026-01-01T00:00:00+08:00',
  cardExternalList: [],
};

const user = {
  id: 1,
  username: 'fixture-user',
  name: 'Fixture User',
  email: 'fixture@example.invalid',
  roles: [],
  games: [],
  cards: [card],
  defaultCard: card,
  keychips: [],
  userTrustKeychips: [],
  oauth2s: [],
};

const announcement = {
  id: 1,
  title: 'Fixture announcement',
  content: 'Fixture announcement body.',
  expirationDate: '2026-12-31T23:59:59+08:00',
  updatedAt: '2026-08-31T20:15:30+08:00',
  status: 'ACTIVE',
  type: 'GENERAL',
  priority: 0,
  translations: [
    {
      language: 'zh',
      translatedTitle: '测试公告',
      translatedContent: '测试公告内容。',
    },
  ],
};

async function installFixture(context: BrowserContext) {
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isReactApi = url.origin === REACT_ORIGIN && url.pathname.startsWith('/api/');

    if (!isReactApi) {
      await route.continue();
      return;
    }

    if (request.method() !== 'GET') {
      await route.abort('blockedbyclient');
      return;
    }

    let body: unknown;
    if (url.pathname === '/api/account/status') {
      body = { data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' }, status: { code: 92001 } };
    } else if (url.pathname === '/api/user/me') {
      body = { data: user, status: { code: 92001 } };
    } else if (url.pathname === '/api/static/dbVersion') {
      body = { state: 'Success', version: { major: 6 } };
    } else if (url.pathname === '/api/user/announcement/') {
      body = { data: { content: [announcement], page: 0, totalElements: 1, totalPages: 1 }, status: { code: 92001 } };
    } else if (url.pathname === '/api/user/announcement/1') {
      body = { data: announcement, status: { code: 92001 } };
    } else if (/^\/api\/game\/.*\/data\//.test(url.pathname)) {
      body = [];
    } else {
      body = { data: null, status: { code: 92001 } };
    }

    await route.fulfill({ body: JSON.stringify(body), contentType: 'application/json', status: 200 });
  });

  await context.addInitScript(
    ({ fixtureAccount, fixtureUser, origin }) => {
      if (window.location.origin !== origin) return;
      localStorage.setItem('currentAccount', JSON.stringify(fixtureAccount));
      localStorage.setItem('currentUser', JSON.stringify(fixtureUser));
      localStorage.setItem('lang', 'zh');
      localStorage.setItem('colorTheme', 'dark');
      localStorage.setItem('themeFamily', 'liquefy');
      localStorage.setItem('dbVersion', '6');
    },
    { fixtureAccount: account, fixtureUser: user, origin: REACT_ORIGIN },
  );
}

test('Liquefy announcement detail close button receives clicks above its scrollable body', async ({ browser }) => {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
    serviceWorkers: 'block',
    viewport: { width: 1280, height: 720 },
  });
  await installFixture(context);

  const page = await context.newPage();
  await page.goto(`${REACT_ORIGIN}/announcements`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');

  await page.locator('.list-group-item.card-btn').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const surface = dialog.locator('.lq-dialog__surface');
  await surface.hover({ position: { x: 32, y: 32 } });
  await expect
    .poll(() =>
      surface.evaluate((element) => Number.parseFloat(getComputedStyle(element).getPropertyValue('--lq-shine-opacity'))),
    )
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      surface.evaluate((element) => {
        const styles = getComputedStyle(element);
        return {
          rotateX: styles.getPropertyValue('--lq-rotate-x').trim(),
          rotateY: styles.getPropertyValue('--lq-rotate-y').trim(),
          scaleX: styles.getPropertyValue('--lq-scale-x').trim(),
          scaleY: styles.getPropertyValue('--lq-scale-y').trim(),
          skewX: styles.getPropertyValue('--lq-skew-x').trim(),
          squish: styles.getPropertyValue('--lq-squish').trim(),
        };
      }),
    )
    .toEqual({
      rotateX: '0deg',
      rotateY: '0deg',
      scaleX: '1',
      scaleY: '1',
      skewX: '0deg',
      squish: '0',
    });

  const closeButton = dialog.locator('.lq-dialog__header > button[aria-label]');
  await expect(closeButton).toBeVisible();
  await expect(closeButton).toHaveCount(1);

  const receivesPointerAtCenter = await closeButton.evaluate((button) => {
    const bounds = button.getBoundingClientRect();
    const target = document.elementFromPoint(bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    return target === button || button.contains(target);
  });
  expect(receivesPointerAtCenter).toBe(true);

  await closeButton.click();
  await expect(dialog).toHaveCount(0);
  await context.close();
});
