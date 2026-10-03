import { test, expect } from '@playwright/test';

test('pictured colour is selected and switching updates the gallery, zoom, bag and checkout', async ({
  page,
}, info) => {
  await page.goto('/products/everyday-linen-shirt');
  const gallery = page.getByRole('button', { name: 'Enlarge product photograph' });
  await expect(page.getByRole('button', { name: 'Colour: Stone', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(gallery.getByRole('img')).toHaveAttribute('src', /shirt\.jpg/);
  await page.getByRole('button', { name: 'Colour: Sage', exact: true }).click();
  await expect(gallery.getByRole('img')).toHaveAttribute('src', /shirt-sage\.webp/);
  await gallery.click();
  const zoom = page.getByRole('dialog', { name: 'A closer look' });
  await expect(zoom.getByRole('img')).toHaveAttribute('src', /shirt-sage\.webp/);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Size: M', exact: true }).click();
  await page.getByRole('button', { name: 'View photograph 3', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Colour: Dusty blue', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Size: M', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(gallery.getByRole('img')).toHaveAttribute('src', /shirt-dusty-blue\.webp/);
  await gallery.getByRole('img').evaluate((img: HTMLImageElement) => img.decode());
  await page
    .locator('.product-detail')
    .screenshot({ path: `artifacts/colour-shirt-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  const bag = page.getByRole('dialog', { name: 'Your shopping bag' });
  await expect(bag.getByText('Dusty blue / M', { exact: true })).toBeVisible();
  await expect(bag.getByRole('img')).toHaveAttribute('src', /shirt-dusty-blue\.webp/);
  await bag.getByRole('link', { name: 'Continue to checkout' }).click();
  await expect(page.locator('.checkout-summary img')).toHaveAttribute(
    'src',
    /shirt-dusty-blue\.webp/,
  );
});

test('carry bag opens in ivory and offers matching cocoa and oxblood previews', async ({
  page,
}, info) => {
  await page.goto('/products/everyday-carry');
  const gallery = page.getByRole('button', { name: 'Enlarge product photograph' });
  await expect(page.getByRole('button', { name: 'Colour: Ivory', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Colour: Cocoa', exact: true }).click();
  await expect(gallery.getByRole('img')).toHaveAttribute('src', /bag-cocoa\.webp/);
  await page.getByRole('button', { name: 'Colour: Oxblood', exact: true }).click();
  await expect(gallery.getByRole('img')).toHaveAttribute('src', /bag-oxblood\.webp/);
  await gallery.getByRole('img').evaluate((img: HTMLImageElement) => img.decode());
  await page
    .locator('.product-detail')
    .screenshot({ path: `artifacts/colour-bag-${info.project.name}.png` });
  await page.getByRole('button', { name: 'View photograph 1', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Colour: Ivory', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(gallery.getByRole('img')).toHaveAttribute('src', /bag\.jpg/);
});
