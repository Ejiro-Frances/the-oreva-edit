import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('storefront and product controls have no serious accessibility violations', async ({
  page,
}) => {
  for (const path of ['/', '/shop', '/products/sade-midi-dress']) {
    await page.goto(path);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-NG');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(
      result.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious'),
    ).toEqual([]);
  }
});
