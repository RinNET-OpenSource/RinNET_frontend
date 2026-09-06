import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';

type Rgba = readonly [red: number, green: number, blue: number, alpha: number];

function parseCssColor(value: string): Rgba {
  const channels = value.match(/[\d.]+/g)?.map(Number);
  if (!channels || channels.length < 3) {
    throw new Error(`Unsupported CSS color: ${value}`);
  }

  if (value.startsWith('color(srgb')) {
    return [channels[0] * 255, channels[1] * 255, channels[2] * 255, channels[3] ?? 1];
  }

  return [channels[0], channels[1], channels[2], channels[3] ?? 1];
}

function contrastAgainstBackground(foregroundValue: string, backgroundValue: string): number {
  const foreground = parseCssColor(foregroundValue);
  const background = parseCssColor(backgroundValue);
  const composite = foreground.slice(0, 3).map(
    (channel, index) => channel * foreground[3] + background[index] * (1 - foreground[3]),
  );
  const luminance = (channels: readonly number[]) => {
    const linear = channels.map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045
        ? normalized / 12.92
        : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };
  const foregroundLuminance = luminance(composite);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

async function semanticColors(
  page: Page,
  foregroundToken: string,
): Promise<{ background: string; foreground: string }> {
  return page.evaluate((token) => {
    const foregroundProbe = document.createElement('span');
    foregroundProbe.style.color = `var(${token})`;
    const backgroundProbe = document.createElement('span');
    backgroundProbe.style.backgroundColor = 'var(--ui-background)';
    document.body.append(foregroundProbe, backgroundProbe);
    const result = {
      background: getComputedStyle(backgroundProbe).backgroundColor,
      foreground: getComputedStyle(foregroundProbe).color,
    };
    foregroundProbe.remove();
    backgroundProbe.remove();
    return result;
  }, foregroundToken);
}

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

async function mountThemePrimitives(page: Page) {
  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Button } = await import('/src/components/ui/button.tsx');
    const { Dialog, DialogContent, DialogTitle } = await import('/src/components/ui/dialog.tsx');

    const host = document.createElement('div');
    host.id = 'theme-contract-probe';
    document.body.appendChild(host);
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Button,
          { 'data-testid': 'destructive-button', variant: 'destructive' },
          'Delete',
        ),
        React.createElement(
          Dialog,
          { open: true },
          React.createElement(
            DialogContent,
            { showCloseButton: false },
            React.createElement(DialogTitle, null, 'Theme contract probe'),
          ),
        ),
      ),
    );
  });
  await expect(page.getByTestId('destructive-button')).toBeVisible();
  await expect(page.locator('[data-slot="dialog-overlay"]')).toBeVisible();
}

async function mountDestructivePrimitives(page: Page) {
  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Badge } = await import('/src/components/ui/badge.tsx');
    const { Button } = await import('/src/components/ui/button.tsx');
    const {
      DropdownMenu,
      DropdownMenuContent,
      DropdownMenuItem,
      DropdownMenuTrigger,
    } = await import('/src/components/ui/dropdown-menu.tsx');

    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;top:1rem;left:1rem;z-index:2000;display:flex;align-items:center;gap:0.5rem';
    document.body.appendChild(host);
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          Button,
          { 'data-testid': 'destructive-state-button', variant: 'destructive' },
          'Delete',
        ),
        React.createElement(
          Button,
          { 'aria-invalid': true, 'data-testid': 'invalid-button' },
          'Invalid',
        ),
        React.createElement(
          Badge,
          { asChild: true, variant: 'destructive' },
          React.createElement('a', { 'data-testid': 'destructive-badge', href: '#delete' }, 'Delete'),
        ),
        React.createElement(
          DropdownMenu,
          { modal: false, open: true },
          React.createElement(
            DropdownMenuTrigger,
            { asChild: true },
            React.createElement('button', null, 'Actions'),
          ),
          React.createElement(
            DropdownMenuContent,
            null,
            React.createElement(
              DropdownMenuItem,
              { 'data-testid': 'destructive-menu-item', variant: 'destructive' },
              'Delete',
            ),
          ),
        ),
      ),
    );
  });
  await expect(page.getByTestId('destructive-state-button')).toBeVisible();
  await expect(page.getByTestId('destructive-badge')).toBeVisible();
  await expect(page.getByTestId('destructive-menu-item')).toBeVisible();
}

async function mountInvalidFields(page: Page) {
  await page.evaluate(async () => {
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Checkbox } = await import('/src/components/ui/checkbox.tsx');
    const { Input } = await import('/src/components/ui/input.tsx');
    const { Select, SelectTrigger, SelectValue } = await import('/src/components/ui/select.tsx');
    const { Textarea } = await import('/src/components/ui/textarea.tsx');

    const host = document.createElement('div');
    host.style.cssText =
      'position:fixed;top:1rem;left:1rem;z-index:2000;display:grid;gap:0.5rem;width:20rem';
    document.body.appendChild(host);
    createRoot(host).render(
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Input, { 'aria-invalid': true, 'data-testid': 'invalid-input' }),
        React.createElement(Textarea, { 'aria-invalid': true, 'data-testid': 'invalid-textarea' }),
        React.createElement(Checkbox, { 'aria-invalid': true, 'data-testid': 'invalid-checkbox' }),
        React.createElement(
          Select,
          null,
          React.createElement(
            SelectTrigger,
            { 'aria-invalid': true, 'data-testid': 'invalid-select' },
            React.createElement(SelectValue, { placeholder: 'Choose' }),
          ),
        ),
      ),
    );
  });
  for (const testId of ['invalid-input', 'invalid-textarea', 'invalid-checkbox', 'invalid-select']) {
    await expect(page.getByTestId(testId)).toBeVisible();
  }
}

test('defaults to the Liquefy family and preserves the colorTheme contract', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('colorTheme'))).toBe('dark');

  await context.close();
});

test('applies a saved Liquefy theme before the app becomes interactive', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'dark');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');

  await context.close();
});

test('normalizes a saved modern family to Liquefy before the app becomes interactive', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'modern' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#101c28');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');

  await context.close();
});

test('invalid persisted values fall back without breaking the document theme', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'sepia', themeFamily: 'missing' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'light');
  await expect(page.locator('html')).toHaveAttribute('data-bs-theme', 'light');
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', '#eefbff');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');
  expect(await page.evaluate(() => localStorage.getItem('colorTheme'))).toBe('auto');

  await context.close();
});

test('the footer theme menu commits family and color changes atomically', async ({ browser }) => {
  const context = await themeContext(browser);
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await page.getByLabel('主题', { exact: true }).click();
  await page.getByRole('menuitem', { name: '液态玻璃', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  expect(await page.evaluate(() => localStorage.getItem('themeFamily'))).toBe('liquefy');
  await page.getByRole('menuitem', { name: '液态玻璃', exact: true }).waitFor({ state: 'hidden' });

  await page.getByLabel('主题', { exact: true }).click();
  await page.getByRole('menuitem', { name: '深色', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'liquefy');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
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

test('the first-paint script restores generic theme state without a catalog or Bootstrap', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'future-theme' });
  const page = await context.newPage();
  await page.route('**/src/main.tsx*', (route) => route.abort());
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'future-theme');
  await expect(page.locator('html')).toHaveAttribute('data-color-scheme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-bs-theme', /.+/);
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(0);

  await context.close();
});

test('the semantic contract is framework-neutral and framework adapters stay separate', async () => {
  const [contract, tailwindAdapter, liquefyTheme] = await Promise.all([
    readFile('src/styles/theme/contract.css', 'utf8'),
    readFile('src/styles/theme/tailwind-adapter.css', 'utf8').catch(() => ''),
    readFile('src/styles/theme/liquefy.css', 'utf8'),
  ]);

  expect(contract).toContain('--ui-background');
  expect(contract).toContain('--ui-overlay');
  expect(contract).not.toContain('@theme');
  expect(contract).not.toContain('@custom-variant');
  expect(tailwindAdapter).toContain('@theme');
  expect(tailwindAdapter).toContain('var(--ui-background)');
  expect(liquefyTheme).not.toMatch(/--bs-[\w-]+\s*:/);
});

test('every theme resolves the complete semantic contract without missing values or cycles', async ({
  browser,
}) => {
  const contract = await readFile('src/styles/theme/contract.css', 'utf8');
  const contractTokens = [...new Set(contract.match(/--ui-[\w-]+/g) ?? [])].sort();
  expect(contractTokens.length).toBeGreaterThan(100);

  for (const themeFamily of ['legacy', 'liquefy']) {
    for (const colorTheme of ['light', 'dark']) {
      const context = await themeContext(browser, { colorTheme, themeFamily });
      const page = await context.newPage();
      await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
      const missingTokens = await page.evaluate((tokens) => {
        const styles = getComputedStyle(document.documentElement);
        return tokens.filter((token) => styles.getPropertyValue(token).trim() === '');
      }, contractTokens);
      expect(missingTokens, `${themeFamily}/${colorTheme}`).toEqual([]);
      await context.close();
    }
  }
});

test('the theme menu renders one theme-neutral component contract', async ({ browser }) => {
  async function menuClasses(themeFamily: 'legacy' | 'liquefy') {
    const context = await themeContext(browser, { colorTheme: 'dark', themeFamily });
    const page = await context.newPage();
    await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
    const trigger = page.getByLabel('主题', { exact: true });
    await trigger.click();
    const result = {
      content: await page.getByRole('menu').getAttribute('class'),
      item: await page.getByRole('menuitem', { name: '自动', exact: true }).getAttribute('class'),
      trigger: await trigger.getAttribute('class'),
    };
    await context.close();
    return result;
  }

  expect(await menuClasses('legacy')).toEqual(await menuClasses('liquefy'));
});

test('theme menu label presentation comes from semantic tokens', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-theme-menu-label-padding-block', '1px 3px');
    root.style.setProperty('--ui-theme-menu-label-padding-inline', '4px 2px');
    root.style.setProperty('--ui-theme-menu-label-font-size', '17px');
    root.style.setProperty('--ui-theme-menu-label-font-weight', '432');
  });
  await page.getByLabel('主题', { exact: true }).click();

  const label = page.getByRole('menu').locator('[data-slot="dropdown-menu-label"]').first();
  await expect(label).toHaveCSS('padding', '1px 2px 3px 4px');
  await expect(label).toHaveCSS('font-size', '17px');
  await expect(label).toHaveCSS('font-weight', '432');

  await context.close();
});

test('Liquefy theme menu surfaces and item states remain controlled by semantic menu tokens', async ({
  browser,
}) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-theme-menu-background', 'rgb(1 2 3)');
    root.style.setProperty('--ui-theme-menu-border', 'rgb(4 5 6)');
    root.style.setProperty('--ui-theme-menu-radius', '7px');
    root.style.setProperty('--ui-theme-menu-shadow', 'none');
    root.style.setProperty('--ui-theme-menu-item-hover', 'rgb(7 8 9)');
  });
  await page.getByLabel('主题', { exact: true }).click();

  const menu = page.getByRole('menu');
  await expect(menu).toHaveCSS('background-color', 'rgb(1, 2, 3)');
  await expect(menu).toHaveCSS('border-color', 'rgb(4, 5, 6)');
  await expect(menu).toHaveCSS('border-radius', '7px');
  await expect(menu).toHaveCSS('box-shadow', 'none');
  const legacyItem = menu.getByRole('menuitem', { name: '经典', exact: true });
  await legacyItem.hover();
  await expect(legacyItem).toHaveCSS('background-color', 'rgb(7, 8, 9)');

  await context.close();
});

test('shadcn primitives consume destructive and overlay semantic tokens', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--ui-destructive', '#123456');
    document.documentElement.style.setProperty('--ui-destructive-foreground', '#fedcba');
    document.documentElement.style.setProperty('--ui-overlay', 'rgb(1 2 3 / 25%)');
  });
  await mountThemePrimitives(page);

  await expect(page.getByTestId('destructive-button')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await expect(page.getByTestId('destructive-button')).toHaveCSS('color', 'rgb(254, 220, 186)');
  await expect(page.locator('[data-slot="dialog-overlay"]')).toHaveCSS(
    'background-color',
    'rgba(1, 2, 3, 0.25)',
  );

  await context.close();
});

test('destructive and invalid interactions consume final theme-owned semantic colors', async ({
  browser,
}) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-destructive-control-hover-background', 'rgb(10 20 30)');
    root.style.setProperty('--ui-destructive-subtle', 'rgb(40 50 60)');
    root.style.setProperty('--ui-focus-ring', 'rgb(70 80 90)');
  });
  await mountDestructivePrimitives(page);

  const button = page.getByTestId('destructive-state-button');
  await button.focus();
  await expect(button).toHaveCSS('outline-color', 'rgb(70, 80, 90)');

  const invalidButton = page.getByTestId('invalid-button');
  await invalidButton.focus();
  await expect(invalidButton).toHaveCSS('outline-color', 'rgb(70, 80, 90)');

  await button.hover();
  await expect(button).toHaveCSS('background-color', 'rgb(10, 20, 30)');

  const badge = page.getByTestId('destructive-badge');
  await badge.hover();
  await expect(badge).toHaveCSS('background-color', 'rgb(10, 20, 30)');

  const menuItem = page.getByTestId('destructive-menu-item');
  await menuItem.focus();
  await expect(menuItem).toHaveCSS('background-color', 'rgb(40, 50, 60)');

  await context.close();
});

test('Liquefy invalid fields preserve the semantic invalid border while focused', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-invalid', 'rgb(10 20 30)');
    root.style.setProperty('--ui-destructive', 'rgb(40 50 60)');
  });
  await mountInvalidFields(page);

  for (const testId of ['invalid-input', 'invalid-textarea', 'invalid-checkbox', 'invalid-select']) {
    const field = page.getByTestId(testId);
    await expect(field).toHaveCSS('border-color', 'rgb(10, 20, 30)');
    await field.focus();
    await expect(field).toHaveCSS('border-color', 'rgb(10, 20, 30)');
  }

  await context.close();
});

test('Legacy invalid field focus uses the final semantic focus color', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'dark', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const root = document.documentElement;
    root.style.setProperty('--ui-focus-ring', 'rgb(70 80 90)');
    root.style.setProperty('--ui-destructive', 'rgb(10 20 30)');
  });
  await mountInvalidFields(page);

  for (const testId of ['invalid-input', 'invalid-textarea', 'invalid-checkbox', 'invalid-select']) {
    const field = page.getByTestId(testId);
    await field.focus();
    await expect(field).toHaveCSS('box-shadow', /rgb\(70, 80, 90\)/);
  }

  await context.close();
});

test('shadcn focus rings consume the final semantic ring color without recompositing it', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => {
    document.documentElement.style.setProperty('--ui-focus-ring', 'rgb(1 2 3 / 25%)');
    const reactModule = await import('/@id/react');
    const reactDomClientModule = await import('/@id/react-dom/client');
    const React = reactModule.default ?? reactModule;
    const createRoot = reactDomClientModule.createRoot ?? reactDomClientModule.default.createRoot;
    const { Button } = await import('/src/components/ui/button.tsx');
    const host = document.createElement('div');
    document.body.appendChild(host);
    createRoot(host).render(React.createElement(Button, { 'data-testid': 'focus-button' }, 'Focus'));
  });
  const button = page.getByTestId('focus-button');
  await button.focus();

  await expect(button).toHaveCSS('box-shadow', /rgba\(1, 2, 3, 0\.25\)/);

  await context.close();
});

test('focus indicators keep at least 3:1 contrast in every theme', async ({ browser }) => {
  for (const themeFamily of ['legacy', 'liquefy']) {
    for (const colorTheme of ['light', 'dark']) {
      const context = await themeContext(browser, { colorTheme, themeFamily });
      const page = await context.newPage();
      await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
      const colors = await semanticColors(page, '--ui-focus-ring');
      expect(
        contrastAgainstBackground(colors.foreground, colors.background),
        `${themeFamily}/${colorTheme}`,
      ).toBeGreaterThanOrEqual(3);
      await context.close();
    }
  }
});

test('Legacy muted foreground retains readable Bootstrap secondary contrast', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    const text = document.createElement('span');
    text.className = 'text-muted-foreground';
    text.dataset.testid = 'muted-text';
    text.textContent = 'Readable description';
    document.body.appendChild(text);
  });

  await expect(page.getByTestId('muted-text')).toHaveCSS('color', 'rgba(33, 37, 41, 0.75)');

  await context.close();
});

test('Liquefy muted foreground keeps normal text contrast in light mode', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'liquefy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  const colors = await semanticColors(page, '--ui-muted-foreground');
  expect(contrastAgainstBackground(colors.foreground, colors.background)).toBeGreaterThanOrEqual(4.5);
  await context.close();
});

test('Bootstrap colors are compatibility aliases of the semantic contract', async ({ browser }) => {
  for (const themeFamily of ['legacy', 'liquefy']) {
    const context = await themeContext(browser, { colorTheme: 'light', themeFamily });
    const page = await context.newPage();
    await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      document.documentElement.style.setProperty('--ui-destructive', '#123456');
      document.documentElement.style.setProperty('--ui-destructive-foreground', '#fedcba');
      document.documentElement.style.setProperty('--ui-destructive-control-background', '#123456');
      const button = document.createElement('button');
      button.className = 'btn btn-danger';
      button.dataset.testid = 'bootstrap-danger';
      button.textContent = 'Delete';
      document.body.appendChild(button);
    });

    await expect(page.getByTestId('bootstrap-danger')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
    await expect(page.getByTestId('bootstrap-danger')).toHaveCSS('color', 'rgb(254, 220, 186)');

    await context.close();
  }
});

test('Bootstrap backdrops render the final semantic overlay color once', async ({ browser }) => {
  const context = await themeContext(browser, { colorTheme: 'light', themeFamily: 'legacy' });
  const page = await context.newPage();
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--ui-overlay', 'rgb(1 2 3 / 25%)');
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fade show';
    backdrop.dataset.testid = 'bootstrap-backdrop';
    document.body.appendChild(backdrop);
  });

  const backdrop = page.getByTestId('bootstrap-backdrop');
  await expect(backdrop).toHaveCSS('background-color', 'rgba(1, 2, 3, 0.25)');
  await expect(backdrop).toHaveCSS('opacity', '1');

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
