import { expect, test, type Browser, type BrowserContext } from '@playwright/test';

const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';

async function themeContext(
  browser: Browser,
  values: { colorTheme?: string; themeFamily?: string } = {},
): Promise<BrowserContext> {
  const context = await browser.newContext({
    colorScheme: 'light',
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
    serviceWorkers: 'block',
  });
  await context.addInitScript((storedValues) => {
    localStorage.clear();
    if (storedValues.colorTheme !== undefined) {
      localStorage.setItem('colorTheme', storedValues.colorTheme);
    }
    if (storedValues.themeFamily !== undefined) {
      localStorage.setItem('themeFamily', storedValues.themeFamily);
    }
  }, values);
  return context;
}

test('defaults to the legacy family and preserves the old colorTheme contract', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'legacy');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#2a2f33');
  expect(await page.evaluate(() => localStorage.getItem('colorTheme'))).toBe('dark');

  await context.close();
});

test('applies a saved modern theme before the app becomes interactive', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'modern' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'modern');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111815');
  expect(
    await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bs-primary').trim()),
  ).toBe('#a9c83f');

  await context.close();
});

test('invalid persisted values fall back without breaking the document theme', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'sepia', themeFamily: 'missing' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'legacy');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#f9fafa');

  await context.close();
});

test('the footer theme menu commits family and color changes atomically', async ({ browser }) => {
  const context = await themeContext(browser);
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('主题', { exact: true }).click();
  await page.getByRole('menuitem', { name: '现代', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'modern');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('modern');
  await page.getByRole('menuitem', { name: '现代', exact: true }).waitFor({ state: 'hidden' });

  await page.getByLabel('主题', { exact: true }).click();
  await page.getByRole('menuitem', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'modern');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#111815');
  expect(
    await page.evaluate(() => ({
      colorTheme: localStorage.getItem('colorTheme'),
      themeFamily: localStorage.getItem('themeFamily'),
    })),
  ).toEqual({ colorTheme: 'dark', themeFamily: 'modern' });

  await context.close();
});
