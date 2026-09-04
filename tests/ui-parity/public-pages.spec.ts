import { expect, test, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const LEGACY_ORIGIN = process.env.LEGACY_ORIGIN ?? 'https://portal.naominet.live:4201';
const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';
const MAX_DIFF_RATIO = Number(process.env.UI_PARITY_MAX_DIFF ?? 0.005);

const publicRoutes = [
  { name: 'home', path: '/' },
  { name: 'sign-in', path: '/sign-in' },
  { name: 'sign-up', path: '/sign-up' },
  { name: 'password-reset', path: '/password-reset' },
  { name: 'contributors', path: '/contributors' },
  { name: 'eula', path: '/eula' },
  { name: 'not-found', path: '/not-found' },
];
const themes = ['light', 'dark'] as const;
const contributorsFixture = JSON.stringify({
  SponsorsList: [
    {
      UserId: 'parity-current',
      AvatarUrl: '/assets/icons/turtle-72x72.png',
      Name: '持续赞助者',
      SponsorshipCount: 3,
      TotalMoney: 300,
      Remarks: '',
      CurrentPlan: 'monthly',
    },
    {
      UserId: 'parity-former',
      AvatarUrl: '/assets/icons/turtle-72x72.png',
      Name: '历史赞助者',
      SponsorshipCount: 1,
      TotalMoney: 100,
      Remarks: '',
      CurrentPlan: '',
    },
  ],
});

async function settlePage(page: Page) {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('load');

  const pendingEula = page.getByRole('status').filter({ hasText: '最终用户许可协议' });
  if (await pendingEula.count()) {
    await pendingEula.waitFor({ state: 'hidden', timeout: 10_000 });
  }

  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images, (image) => image.decode().catch(() => undefined)),
    );
    window.scrollTo(0, 0);
  });
}

async function captureContributorsLayout(page: Page) {
  return page.evaluate(() => {
    const inspect = (element: Element | null) => {
      if (!(element instanceof HTMLElement)) return null;
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        tag: element.tagName.toLowerCase(),
        className: element.className,
        rect: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        style: {
          display: style.display,
          boxSizing: style.boxSizing,
          width: style.width,
          maxWidth: style.maxWidth,
          marginTop: style.marginTop,
          marginRight: style.marginRight,
          marginBottom: style.marginBottom,
          marginLeft: style.marginLeft,
          paddingTop: style.paddingTop,
          paddingRight: style.paddingRight,
          paddingBottom: style.paddingBottom,
          paddingLeft: style.paddingLeft,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          lineHeight: style.lineHeight,
          verticalAlign: style.verticalAlign,
          alignItems: style.alignItems,
        },
      };
    };

    const firstAvatar = document.querySelector('.avator');
    return {
      pageRoot: inspect(
        document.querySelector('app-contributors') ??
          document.querySelector('main > div > :first-child'),
      ),
      heading1: inspect(document.querySelector('h1')),
      heading2: inspect(document.querySelector('h2')),
      firstStack: inspect(firstAvatar?.closest('.hstack') ?? null),
    };
  });
}

async function saveComparison(
  legacyBuffer: Buffer,
  reactBuffer: Buffer,
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

  const outputDir = testInfo.outputDir;
  const legacyPath = path.join(outputDir, 'legacy.png');
  const reactPath = path.join(outputDir, 'react.png');
  const diffPath = path.join(outputDir, 'diff.png');
  await fs.mkdir(outputDir, { recursive: true });
  await Promise.all([
    fs.writeFile(legacyPath, legacyBuffer),
    fs.writeFile(reactPath, reactBuffer),
    fs.writeFile(diffPath, PNG.sync.write(diff)),
  ]);

  await Promise.all([
    testInfo.attach('legacy', { path: legacyPath, contentType: 'image/png' }),
    testInfo.attach('react', { path: reactPath, contentType: 'image/png' }),
    testInfo.attach('diff', { path: diffPath, contentType: 'image/png' }),
  ]);

  expect(
    diffRatio,
    `Visual difference ${(diffRatio * 100).toFixed(3)}% exceeds ${(MAX_DIFF_RATIO * 100).toFixed(3)}%`,
  ).toBeLessThanOrEqual(MAX_DIFF_RATIO);
}

for (const route of publicRoutes) {
  for (const theme of themes) {
    test(`${route.name} matches the Angular baseline in ${theme} mode`, async ({ browser }, testInfo) => {
      const stabilizeContributors = route.path === '/contributors';
      const context = await browser.newContext({
        colorScheme: theme,
        deviceScaleFactor: 1,
        ignoreHTTPSErrors: true,
        locale: 'zh-CN',
        serviceWorkers: 'block',
        timezoneId: 'Asia/Hong_Kong',
        viewport: { width: 1280, height: 720 },
      });
      await context.addInitScript(
        ({ selectedTheme, stabilizeRandomOrder }) => {
          if (stabilizeRandomOrder) Math.random = () => 0.5;
          localStorage.setItem('lang', 'zh');
          localStorage.setItem('themeFamily', 'legacy');
          localStorage.setItem('colorTheme', selectedTheme);
        },
        { selectedTheme: theme, stabilizeRandomOrder: stabilizeContributors },
      );
      if (stabilizeContributors) {
        await context.route('**/Sponsors.json', async (interceptedRoute) => {
          expect(interceptedRoute.request().method()).toBe('GET');
          await interceptedRoute.fulfill({
            status: 200,
            contentType: 'application/json',
            body: contributorsFixture,
          });
        });
      }

      const legacyPage = await context.newPage();
      const reactPage = await context.newPage();

      await Promise.all([
        legacyPage.goto(`${LEGACY_ORIGIN}${route.path}`, { waitUntil: 'domcontentloaded' }),
        reactPage.goto(`${REACT_ORIGIN}${route.path}`, { waitUntil: 'domcontentloaded' }),
      ]);
      await Promise.all([settlePage(legacyPage), settlePage(reactPage)]);

      if (stabilizeContributors && theme === 'light') {
        const [legacyLayout, reactLayout] = await Promise.all([
          captureContributorsLayout(legacyPage),
          captureContributorsLayout(reactPage),
        ]);
        expect(
          reactLayout.pageRoot?.rect,
          'Contributors page box must match the Angular baseline',
        ).toEqual(legacyLayout.pageRoot?.rect);
        expect(
          reactLayout.heading1,
          'Contributors title geometry and computed styles must match the Angular baseline',
        ).toEqual(legacyLayout.heading1);
        expect(
          reactLayout.heading2,
          'Contributors section heading geometry and computed styles must match the Angular baseline',
        ).toEqual(legacyLayout.heading2);
        expect(
          reactLayout.firstStack,
          'Contributors inline contributor geometry and computed styles must match the Angular baseline',
        ).toEqual(legacyLayout.firstStack);
      }

      const [legacyBuffer, reactBuffer] = await Promise.all([
        legacyPage.screenshot({ animations: 'disabled', caret: 'hide' }),
        reactPage.screenshot({ animations: 'disabled', caret: 'hide' }),
      ]);

      await saveComparison(legacyBuffer, reactBuffer, testInfo);
      await context.close();
    });
  }
}
