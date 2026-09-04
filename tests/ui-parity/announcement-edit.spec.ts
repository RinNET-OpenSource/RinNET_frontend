import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const themes = ['light', 'dark'] as const;
const card = { id: 1, extId: 10000001, luid: 'fixture-card', default: true, registerTime: '', accessTime: '', cardExternalList: [] };
const account = { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', tokenType: 'Bearer' };
const user = { id: 1, username: 'admin-fixture', name: 'Fixture Admin', email: 'fixture@example.invalid', roles: [{ id: 5, name: 'ROLE_ADMIN' }], games: [], cards: [card], defaultCard: card, keychips: [], userTrustKeychips: [], oauth2s: [] };

async function install(context: BrowserContext, theme: 'light' | 'dark') {
  const writes: string[] = [];
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const isPortal = [LEGACY_ORIGIN, REACT_ORIGIN].includes(url.origin);
    const business = isPortal && (url.pathname.startsWith('/api/') || url.pathname.startsWith('/Maimai2Servlet'));
    if (request.method() !== 'GET' && business) {
      writes.push(`${request.method()} ${url.pathname}`);
      await route.abort('blockedbyclient');
      return;
    }
    if (!isPortal || !url.pathname.startsWith('/api/')) {
      await route.continue();
      return;
    }
    let body: unknown;
    if (url.pathname === '/api/account/status') body = { data: { banned: false, eulaRequired: false, acceptedEulaVersion: 1, appeal: '' }, status: { code: 92001 } };
    else if (url.pathname === '/api/user/me') body = { data: user, status: { code: 92001 } };
    else if (url.pathname === '/api/static/dbVersion') body = { state: 'Success', version: { major: 6 } };
    else if (/^\/api\/game\/.*\/data\//.test(url.pathname)) body = [];
    else body = { data: null, status: { code: 92001 } };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await context.addInitScript(
    ({ fixtureAccount, fixtureUser, selectedTheme, origins }) => {
      if (!origins.includes(window.location.origin)) return;
      localStorage.setItem('currentAccount', JSON.stringify(fixtureAccount));
      localStorage.setItem('currentUser', JSON.stringify(fixtureUser));
      localStorage.setItem('lang', 'zh');
      localStorage.setItem('colorTheme', selectedTheme);
      localStorage.setItem('themeFamily', 'legacy');
      localStorage.setItem('dbVersion', '6');
    },
    { fixtureAccount: account, fixtureUser: user, selectedTheme: theme, origins: [LEGACY_ORIGIN, REACT_ORIGIN] },
  );
  return writes;
}

async function settle(page: Page) {
  await page.getByRole('heading', { name: '撰写公告' }).waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('textarea.announcement-content')).toHaveCount(2);
  await expect(page.locator('select')).toHaveCount(2);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
}

async function compare(oldBuffer: Buffer, newBuffer: Buffer, info: TestInfo, label: string) {
  const oldImage = PNG.sync.read(oldBuffer);
  const newImage = PNG.sync.read(newBuffer);
  expect({ width: newImage.width, height: newImage.height }).toEqual({ width: oldImage.width, height: oldImage.height });
  const diff = new PNG({ width: oldImage.width, height: oldImage.height });
  const mismatch = pixelmatch(oldImage.data, newImage.data, diff.data, oldImage.width, oldImage.height, { includeAA: false, threshold: 0.1 });
  const ratio = mismatch / (oldImage.width * oldImage.height);
  await fs.mkdir(info.outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(info.outputDir, `${label}-old.png`), oldBuffer),
    fs.writeFile(path.join(info.outputDir, `${label}-new.png`), newBuffer),
    fs.writeFile(path.join(info.outputDir, `${label}-diff.png`), PNG.sync.write(diff)),
  ]);
  expect(ratio, `${label} visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

test.describe('announcement editor visual parity', () => {
  test.describe.configure({ timeout: 90_000 });
  for (const theme of themes) {
    test(`editor and safe preview match Angular in ${theme} mode`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ colorScheme: theme, deviceScaleFactor: 1, ignoreHTTPSErrors: true, locale: 'zh-CN', serviceWorkers: 'block', timezoneId: 'Asia/Hong_Kong', viewport: { width: 1280, height: 720 } });
      const writes = await install(context, theme);
      const oldPage = await context.newPage();
      const newPage = await context.newPage();
      await Promise.all([
        oldPage.goto(`${LEGACY_ORIGIN}/announcements/edit`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/announcements/edit`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settle(oldPage), settle(newPage)]);
      const [oldEditor, newEditor] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldEditor, newEditor, testInfo, 'editor');

      for (const page of [oldPage, newPage]) {
        await page.getByPlaceholder('标题').fill('Fixture announcement');
        await page.getByPlaceholder('内容').fill('# Preview\n\nFixture content');
        await page.getByRole('button', { name: '快速预览' }).click();
      }
      await Promise.all([
        oldPage.getByRole('dialog').waitFor({ state: 'visible' }),
        newPage.getByRole('dialog').waitFor({ state: 'visible' }),
      ]);
      const [oldPreview, newPreview] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldPreview, newPreview, testInfo, 'preview');
      expect(writes, 'Editing and previewing locally must not submit an announcement').toEqual([]);
      await context.close();
    });
  }
});
