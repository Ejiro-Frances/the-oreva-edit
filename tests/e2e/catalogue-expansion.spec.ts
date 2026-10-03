import { test, expect } from '@playwright/test';

test('new arrivals include the expanded range and link to selectable variants', async ({
  page,
}) => {
  await page.goto('/new-in');
  await expect(
    page.getByRole('link', { name: 'The Ada everyday tank', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'The junior everyday tee', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'The Daylight mini skirt', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'The woven sun hat', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'The Ada everyday tank', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Colour: White', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const rose = page.getByRole('button', { name: 'Colour: Rose', exact: true });
  await expect(rose.locator('img')).toHaveAttribute('src', /everyday-tank-rose/);
  await rose.click();
  await expect(page.getByRole('button', { name: 'Size: XL (sold out)' })).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Enlarge product photograph' }).getByRole('img'),
  ).toHaveAttribute('src', /everyday-tank-rose/);
});

test('colour, size and length select the correct price, stock and bag item', async ({
  page,
}, info) => {
  await page.goto('/products/daybreak-trousers');
  await page.getByRole('button', { name: 'Colour: Ink', exact: true }).click();
  await page.getByRole('button', { name: 'Size: XL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Length: Long (sold out)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Colour: Olive', exact: true }).click();
  await page.getByRole('button', { name: 'Size: M', exact: true }).click();
  await page.getByRole('button', { name: 'Length: Long', exact: true }).click();
  await expect(page.locator('.detail-price')).toHaveText('₦31,500');
  const photograph = page
    .getByRole('button', { name: 'Enlarge product photograph' })
    .getByRole('img');
  await photograph.evaluate((img: HTMLImageElement) => img.decode());
  await page
    .locator('.product-detail')
    .screenshot({ path: `artifacts/expanded-variants-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  const bag = page.getByRole('dialog', { name: 'Your shopping bag' });
  await expect(bag.getByText('Olive / M / Long', { exact: true })).toBeVisible();
  await expect(bag.getByRole('img')).toHaveAttribute('src', /daybreak-trousers-olive/);
});

test('jewellery supports length options without requiring a clothing size', async ({ page }) => {
  await page.goto('/products/fine-line-necklace');
  await page.getByRole('button', { name: 'Colour: Silver', exact: true }).click();
  await page.getByRole('button', { name: 'Length: 50 cm', exact: true }).click();
  await expect(page.locator('.detail-price')).toHaveText('₦17,500');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Your shopping bag' })
      .getByText('Silver / 50 cm', { exact: true }),
  ).toBeVisible();
});

test('new categories expose colour variants and clear a size unavailable in the next colour', async ({
  page,
}, info) => {
  await page.goto('/shop?category=skirts');
  await page.getByRole('link', { name: 'The Daylight mini skirt', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Colour: White', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Size: XL', exact: true }).click();
  await page.getByRole('button', { name: 'Colour: Stone', exact: true }).click();
  const unavailableSize = page.getByRole('button', { name: 'Size: XL (sold out)', exact: true });
  await expect(unavailableSize).toBeDisabled();
  await expect(unavailableSize).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.locator('.product-detail').getByRole('alert')).toHaveText(
    'Choose your size before adding to your bag.',
  );
  await page.getByRole('button', { name: 'Colour: Oxblood', exact: true }).click();
  await page.getByRole('button', { name: 'Size: M', exact: true }).click();
  const photograph = page
    .getByRole('button', { name: 'Enlarge product photograph' })
    .getByRole('img');
  await expect(photograph).toHaveAttribute('src', /daylight-skirt-oxblood/);
  await photograph.evaluate((img: HTMLImageElement) => img.decode());
  await page
    .locator('.product-detail')
    .screenshot({ path: `artifacts/skirt-variants-${info.project.name}.png` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.goto('/men?category=shorts');
  await page.getByRole('link', { name: 'The weekend drawstring shorts', exact: true }).click();
  await page.getByRole('button', { name: 'Colour: Navy', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Size: XXL (sold out)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Size: M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  const bag = page.getByRole('dialog', { name: 'Your shopping bag' });
  await expect(bag.getByText('Navy / M', { exact: true })).toBeVisible();
  await expect(bag.getByRole('img')).toHaveAttribute('src', /weekend-shorts-navy/);
});

test('bracelet lengths and the added earring finish can be bought as distinct variants', async ({
  page,
}) => {
  await page.goto('/products/woven-chain-bracelet');
  await page.getByRole('button', { name: 'Colour: Silver', exact: true }).click();
  await page.getByRole('button', { name: 'Length: 21 cm', exact: true }).click();
  await expect(page.locator('.detail-price')).toHaveText('₦15,300');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  const braceletBag = page.getByRole('dialog', { name: 'Your shopping bag' });
  await expect(braceletBag.getByText('Silver / 21 cm', { exact: true })).toBeVisible();
  await expect(braceletBag.getByRole('img')).toHaveAttribute('src', /woven-bracelet-silver/);

  await page.goto('/products/sculptural-drop-earrings');
  await expect(page.getByRole('button', { name: 'Colour: Gold', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Colour: Silver', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Enlarge product photograph' }).getByRole('img'),
  ).toHaveAttribute('src', /earrings-silver/);
  await page.getByRole('button', { name: 'Size: One size', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  const bag = page.getByRole('dialog', { name: 'Your shopping bag' });
  await expect(bag.getByText('Silver / One size', { exact: true })).toBeVisible();
  await expect(bag.getByText('Silver / 21 cm', { exact: true })).toBeVisible();
});
