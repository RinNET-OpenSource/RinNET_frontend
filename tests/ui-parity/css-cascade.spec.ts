import { expect, test } from '@playwright/test';

const REACT_ORIGIN = process.env.REACT_ORIGIN ?? 'https://portal.naominet.live:5173';

test('Tailwind utilities override legacy Bootstrap element defaults', async ({ page }) => {
  await page.goto(REACT_ORIGIN, { waitUntil: 'domcontentloaded' });

  const styles = await page.evaluate(() => {
    const fixture = document.createElement('div');
    fixture.innerHTML = `
      <h3 class="text-xs font-bold leading-none m-0">Title</h3>
      <h2 data-slot="dialog-title" class="text-lg leading-none font-semibold">Dialog title</h2>
      <button class="text-xs leading-none">Button</button>
      <input class="text-xs leading-none" value="Input">
    `;
    document.body.appendChild(fixture);

    const read = (selector: string) => {
      const style = getComputedStyle(fixture.querySelector(selector)!);
      return {
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
        margin: style.margin,
      };
    };

    const result = {
      button: read('button'),
      dialogTitle: read('[data-slot="dialog-title"]'),
      heading: read('h3'),
      input: read('input'),
    };
    fixture.remove();
    return result;
  });

  expect(styles.heading).toEqual({
    fontSize: '12px',
    fontWeight: '700',
    lineHeight: '12px',
    margin: '0px',
  });
  expect(styles.button.fontSize).toBe('12px');
  expect(styles.button.lineHeight).toBe('12px');
  expect(styles.dialogTitle.margin).toBe('0px');
  expect(styles.input.fontSize).toBe('12px');
  expect(styles.input.lineHeight).toBe('12px');
});
