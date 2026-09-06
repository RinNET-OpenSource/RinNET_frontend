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

test('defaults to the Liquefy family and preserves the colorTheme contract', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('colorTheme'))).toBe('dark');

  await context.close();
});

test('applies a saved Liquefy theme before the app becomes interactive', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');

  await context.close();
});

test('normalizes a saved modern family to Liquefy before the app becomes interactive', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'modern' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');

  await context.close();
});

test('invalid persisted values fall back without breaking the document theme', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'sepia', themeFamily: 'missing' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#eefbff');

  await context.close();
});

test('the footer theme menu commits family and color changes atomically', async ({ browser }) => {
  const context = await themeContext(browser);
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('主题', { exact: true }).click();
  await page.getByRole('menuitem', { name: '液态玻璃', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');
  await page.getByRole('menuitem', { name: '液态玻璃', exact: true }).waitFor({ state: 'hidden' });

  await page.getByLabel('主题', { exact: true }).click();
  await page.getByRole('menuitem', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme-family', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(
    await page.evaluate(() => ({
      colorTheme: localStorage.getItem('colorTheme'),
      themeFamily: localStorage.getItem('themeFamily'),
    })),
  ).toEqual({ colorTheme: 'dark', themeFamily: 'liquefy' });

  await context.close();
});

test('the legacy theme menu uses the same family-over-color layout as Liquefy', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('主题', { exact: true }).click();
  const menu = page.getByRole('menu');
  await expect(menu.getByText('界面风格', { exact: true })).toBeVisible();
  await expect(menu.getByText('明暗模式', { exact: true })).toBeVisible();
  await expect(menu.getByRole('separator')).toHaveCount(1);
  await expect(menu.getByRole('menuitem', { name: '经典', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '液态玻璃', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '自动', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '浅色', exact: true })).toBeVisible();
  await expect(menu.getByRole('menuitem', { name: '深色', exact: true })).toHaveClass(/active/);

  await context.close();
});
