import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
await mkdir('artifacts', { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.screenshot({ path: 'artifacts/home-desktop.png', fullPage: true });
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
  .analyze();
console.log(
  JSON.stringify({
    violations: results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  }),
);
await page.setViewportSize({ width: 390, height: 844 });
await page.reload({ waitUntil: 'networkidle' });
await page.screenshot({ path: 'artifacts/home-mobile.png', fullPage: true });
console.log(
  JSON.stringify({
    mobileOverflow: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
  }),
);
await browser.close();
