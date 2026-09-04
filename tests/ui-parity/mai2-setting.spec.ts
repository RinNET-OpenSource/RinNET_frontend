import { expect, test, type BrowserContext, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);
const themes = ['light', 'dark'] as const;
const card = { id: 7, extId: 10000001, luid: 'fixture-mai2', default: true, registerTime: '', accessTime: '', cardExternalList: [] };
const account = { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', tokenType: 'Bearer' };
const user = { id: 1, username: 'fixture', name: 'Fixture', email: 'fixture@example.invalid', roles: [], games: ['maimai2'], cards: [card], defaultCard: card, keychips: [], userTrustKeychips: [], oauth2s: [] };
const profile = {
  userName: 'ＭＡＩＭＡＩ　ＴＥＳＴ', iconId: 1, plateId: 1, titleId: 1, partnerId: 1, frameId: 1, selectMapId: 1,
  totalAwake: 20, gradeRating: 0, musicRating: 14000, playerRating: 14500, highestRating: 15000, gradeRank: 1, classRank: 1,
  courseRank: 1, charaSlot: '', charaLockSlot: '', playCount: 100, eventWatchedDate: '', lastRomVersion: '1.50.00',
  lastDataVersion: '1.50.00', lastPlayDate: '2026-08-31T12:00:00+08:00', playVsCount: 0, playSyncCount: 0, winCount: 0,
  helpCount: 0, comboCount: 0, totalDeluxscore: 0, totalBasicDeluxscore: 0, totalAdvancedDeluxscore: 0, totalExpertDeluxscore: 0,
  totalMasterDeluxscore: 0, totalReMasterDeluxscore: 0, totalSync: 0, totalBasicSync: 0, totalAdvancedSync: 0,
  totalExpertSync: 0, totalMasterSync: 0, totalReMasterSync: 0, totalAchievement: 0, totalBasicAchievement: 0,
  totalAdvancedAchievement: 0, totalExpertAchievement: 0, totalMasterAchievement: 0, totalReMasterAchievement: 0,
};

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
    else if (url.pathname === '/api/game/maimai2/profile') body = profile;
    else if (url.pathname === '/api/game/maimai2/config/userPhoto/divMaxLength') body = 10;
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
  await page.locator('h1.page-heading').waitFor({ state: 'visible', timeout: 30_000 });
  await expect(page.locator('.card.mb-3')).toHaveCount(4, { timeout: 30_000 });
  await expect(page.locator('#username')).toHaveValue(profile.userName);
  await expect(page.locator('.progress.fixed-top')).toHaveCount(0, { timeout: 30_000 });
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); });
}

async function compare(oldBuffer: Buffer, newBuffer: Buffer, info: TestInfo) {
  const oldImage = PNG.sync.read(oldBuffer);
  const newImage = PNG.sync.read(newBuffer);
  expect({ width: newImage.width, height: newImage.height }).toEqual({ width: oldImage.width, height: oldImage.height });
  const diff = new PNG({ width: oldImage.width, height: oldImage.height });
  const mismatch = pixelmatch(oldImage.data, newImage.data, diff.data, oldImage.width, oldImage.height, { includeAA: false, threshold: 0.1 });
  const ratio = mismatch / (oldImage.width * oldImage.height);
  await fs.mkdir(info.outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(path.join(info.outputDir, 'old.png'), oldBuffer),
    fs.writeFile(path.join(info.outputDir, 'new.png'), newBuffer),
    fs.writeFile(path.join(info.outputDir, 'diff.png'), PNG.sync.write(diff)),
  ]);
  expect(ratio, `Visual difference ${(ratio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

test.describe('Maimai DX settings visual parity', () => {
  for (const theme of themes) {
    test(`matches Angular in ${theme} mode without writes`, async ({ browser }, testInfo) => {
      const context = await browser.newContext({ colorScheme: theme, deviceScaleFactor: 1, ignoreHTTPSErrors: true, locale: 'zh-CN', serviceWorkers: 'block', timezoneId: 'Asia/Hong_Kong', viewport: { width: 1280, height: 720 } });
      const writes = await install(context, theme);
      const oldPage = await context.newPage();
      const newPage = await context.newPage();
      await Promise.all([
        oldPage.goto(`${LEGACY_ORIGIN}/mai2/setting`, { waitUntil: 'domcontentloaded' }),
        newPage.goto(`${REACT_ORIGIN}/mai2/setting`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settle(oldPage), settle(newPage)]);
      const [oldBuffer, newBuffer] = await Promise.all([
        oldPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        newPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);
      await compare(oldBuffer, newBuffer, testInfo);
      expect(writes, 'Default settings rendering must not attempt a business write').toEqual([]);
      await context.close();
    });
  }
});
