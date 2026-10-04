import { test, expect } from '@playwright/test';

test('Men shows the expanded range and relevant category shortcuts', async ({ page }, info) => {
  await page.goto('/men');
  await expect(page.getByRole('heading', { name: 'Men', exact: true })).toBeVisible();
  await expect(
    page.locator('#main-content').getByText('12 pieces in this edit', { exact: true }),
  ).toBeVisible();
  for (const name of [
    'The open-layer shirt',
    'The textured straight trousers',
    'The everyday baseball cap',
    'The square-frame sunglasses',
    'The everyday boxer briefs',
    'The everyday singlet',
    'The washed denim shorts',
    'The city varsity jacket',
  ]) {
    await expect(page.getByRole('link', { name, exact: true })).toBeVisible();
  }
  const navigation = page.getByRole('navigation', { name: 'Men categories' });
  await expect(navigation.getByRole('link', { name: 'Dresses', exact: true })).toHaveCount(0);
  await expect(navigation.getByRole('link', { name: 'Boxers', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `artifacts/menswear-${info.project.name}.png`, fullPage: true });
});

test('navigation reaches men’s boxers and a selected pack goes into the bag', async ({
  page,
}, info) => {
  await page.goto('/');
  if (info.project.name === 'mobile') {
    await page.getByRole('button', { name: 'Open navigation' }).click();
    const menu = page.getByRole('navigation', { name: 'Mobile navigation' });
    await menu.locator('summary').filter({ hasText: /^Men$/ }).click();
    const men = menu
      .locator('details')
      .filter({ has: page.locator('summary').filter({ hasText: /^Men$/ }) });
    await expect(men.getByRole('link', { name: 'Dresses', exact: true })).toHaveCount(0);
    await men.getByRole('link', { name: 'Boxers', exact: true }).click();
  } else {
    await page
      .getByRole('navigation', { name: 'Main navigation', exact: true })
      .getByRole('link', { name: 'Men', exact: true })
      .click();
    await page
      .getByRole('navigation', { name: 'Men categories' })
      .getByRole('link', { name: 'Boxers', exact: true })
      .click();
  }
  await expect(page).toHaveURL(/\/men\?category=boxers/);
  await page.getByRole('link', { name: 'The everyday boxer briefs', exact: true }).click();
  await page.getByRole('button', { name: 'Size: XXL', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pack: 3 pairs (sold out)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Size: M', exact: true }).click();
  await page.getByRole('button', { name: 'Pack: 3 pairs', exact: true }).click();
  await expect(page.locator('.detail-price')).toHaveText('₦23,500');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  const bag = page.getByRole('dialog', { name: 'Your shopping bag' });
  await expect(bag.getByText('Blue / M / 3 pairs', { exact: true })).toBeVisible();
});

test('men’s trousers use waist and inside-leg options with an authoritative price', async ({
  page,
}) => {
  await page.goto('/men?category=trousers');
  await expect(page.getByRole('link', { name: 'The Daybreak trousers', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('link', { name: 'The textured straight trousers', exact: true }).click();
  await page.getByRole('button', { name: 'Size: 38 in', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Length: 34 in (sold out)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Size: 32 in', exact: true }).click();
  await page.getByRole('button', { name: 'Length: 34 in', exact: true }).click();
  await expect(page.locator('.detail-price')).toHaveText('₦36,500');
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Your shopping bag' })
      .getByText('Grey / 32 in / 34 in', { exact: true }),
  ).toBeVisible();
});

test('caps and singlets change photographs when their colour changes', async ({ page }) => {
  await page.goto('/accessories?category=caps');
  await page.getByRole('link', { name: 'The everyday baseball cap', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Colour: White', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Colour: Olive', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Enlarge product photograph' }).getByRole('img'),
  ).toHaveAttribute('src', /everyday-cap-olive/);
  await page.getByRole('button', { name: 'Size: One size', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Your shopping bag' })
      .getByText('Olive / One size', { exact: true }),
  ).toBeVisible();
  await page.goto('/products/everyday-singlet');
  await page.getByRole('button', { name: 'Colour: Ink', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Enlarge product photograph' }).getByRole('img'),
  ).toHaveAttribute('src', /everyday-singlet-ink/);
  await page.getByRole('button', { name: 'Size: L', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Your shopping bag' }).getByText('Ink / L', { exact: true }),
  ).toBeVisible();
});

test('category shortcuts find sunglasses and jackets while keeping the Men section', async ({
  page,
}) => {
  await page.goto('/men?category=sunglasses');
  await expect(
    page.getByRole('link', { name: 'The square-frame sunglasses', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'The Sunroom frames', exact: true })).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Men categories' })
    .getByRole('link', { name: 'Jackets', exact: true })
    .click();
  await expect(page).toHaveURL(/\/men\?category=jackets/);
  await page.getByRole('link', { name: 'The city varsity jacket', exact: true }).click();
  await page.getByRole('button', { name: 'Size: L', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Your shopping bag' }).getByText('Beige / L', { exact: true }),
  ).toBeVisible();
});
