import { test, expect, type Page } from '@playwright/test';
async function addDress(page: Page) {
  await page.goto('/products/sade-midi-dress');
  await page.getByRole('button', { name: 'Colour: Sand', exact: true }).click();
  await page.getByRole('button', { name: 'Size: M', exact: true }).click();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Your shopping bag' })).toBeVisible();
}
test('homepage has editorial navigation and meaningful metadata', async ({ page }, info) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Good pieces.');
  await expect(page).toHaveTitle(/The Oreva Edit/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en-NG');
  await expect(page.getByRole('link', { name: 'Meet your new favourites' })).toBeVisible();
  await page.screenshot({ path: `artifacts/home-${info.project.name}.png`, fullPage: true });
});
test('category navigation shows relevant products', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('link', { name: 'Women', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Women' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'The Sade midi dress', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'The everyday linen shirt', exact: true }),
  ).toHaveCount(0);
});
test('search returns matching pieces and a useful empty state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Search catalogue' }).click();
  const dialog = page.getByRole('dialog', { name: 'Find something you love' });
  await dialog.getByLabel('Search products').fill('linen');
  await expect(dialog.getByRole('link', { name: 'The everyday linen shirt' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Submit search' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('linen');
  await page.goto('/search?q=zzzznoitems');
  await expect(page.getByRole('heading', { name: 'A fresh start for your search.' })).toBeVisible();
});
test('catalogue filters are reflected in the URL', async ({ page }) => {
  await page.goto('/shop');
  await page.getByRole('button', { name: 'Filter & sort' }).click();
  const dialog = page.getByRole('dialog', { name: 'Make it your edit' });
  await dialog.getByLabel('Maximum price (₦)').fill('15000');
  await dialog.getByLabel('Sort by').selectOption('price-asc');
  await dialog.getByRole('button', { name: 'Apply filters' }).click();
  await expect(page).toHaveURL(/max=15000/);
  await expect(
    page.getByRole('link', { name: 'The sculptural drop earrings', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'The Sade midi dress', exact: true })).toHaveCount(0);
});
test('variant selection is required and sold-out sizes are disabled', async ({ page }) => {
  await page.goto('/products/sade-midi-dress');
  await expect(page.getByRole('button', { name: 'Size: XL (sold out)' })).toBeDisabled();
  await page.getByRole('button', { name: 'Add to bag', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Choose your colour and size',
  );
});
test('bag quantities can be edited and items removed', async ({ page }) => {
  await addDress(page);
  const dialog = page.getByRole('dialog', { name: 'Your shopping bag' });
  await dialog.getByRole('button', { name: 'Increase quantity of The Sade midi dress' }).click();
  await expect(dialog.locator('output')).toHaveText('2');
  await dialog.getByRole('button', { name: 'Remove The Sade midi dress', exact: true }).click();
  await expect(
    dialog.getByRole('heading', { name: 'A little room for something good.' }),
  ).toBeVisible();
});
test('bag persists through reload', async ({ page }) => {
  await addDress(page);
  await page.getByRole('button', { name: 'Close your shopping bag' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Open shopping bag, 1 items' }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Your shopping bag' })
      .getByRole('heading', { name: 'The Sade midi dress' }),
  ).toBeVisible();
});
test('wishlist saves and removes a product without reload', async ({ page }) => {
  await page.goto('/products/sade-midi-dress');
  await page.getByRole('button', { name: 'Save The Sade midi dress to wishlist' }).click();
  await page.goto('/wishlist');
  await expect(page.getByRole('link', { name: 'The Sade midi dress', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove The Sade midi dress from wishlist' }).click();
  await expect(page.getByRole('heading', { name: 'Keep the good ones close.' })).toBeVisible();
});
test('checkout validates required contact and delivery details', async ({ page }) => {
  await addDress(page);
  await page
    .getByRole('dialog', { name: 'Your shopping bag' })
    .getByRole('link', { name: 'Continue to checkout' })
    .click();
  await page.getByRole('button', { name: 'Place unpaid test order' }).click();
  await expect(page.getByText('Enter a valid email', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Confirm that this is an unpaid test order', { exact: true }),
  ).toBeVisible();
});
test('guest test checkout is unpaid and private to the guest', async ({ page, browser }) => {
  await addDress(page);
  await page
    .getByRole('dialog', { name: 'Your shopping bag' })
    .getByRole('link', { name: 'Continue to checkout' })
    .click();
  await page.getByLabel('Email address', { exact: true }).fill('synthetic@example.test');
  await page.getByLabel('Nigerian mobile number', { exact: true }).fill('08012345678');
  await page.getByLabel('First name', { exact: true }).fill('Test');
  await page.getByLabel('Last name', { exact: true }).fill('Customer');
  await page.getByLabel('State / FCT', { exact: true }).selectOption('Lagos');
  await page.getByLabel('City or town', { exact: true }).fill('Test City');
  await page.getByLabel('Delivery address', { exact: true }).fill('10 Synthetic Test Street');
  await page
    .getByRole('checkbox', { name: 'I understand this is an unpaid test order with no delivery.' })
    .check();
  await page.getByRole('button', { name: 'Place unpaid test order' }).click();
  await expect(page.getByRole('heading', { name: 'Your test edit is in.' })).toBeVisible();
  await expect(page.getByText(/Payment: unpaid/)).toBeVisible();
  const url = page.url();
  const other = await browser.newContext();
  const outsider = await other.newPage();
  await outsider.goto(url);
  await expect(
    outsider.getByRole('heading', { name: 'This page has slipped out of the edit.' }),
  ).toBeVisible();
  await expect(outsider.getByText('10 Synthetic Test Street')).toHaveCount(0);
  await other.close();
});
test('unsupported delivery state has actionable feedback', async ({ page }) => {
  await addDress(page);
  await page
    .getByRole('dialog', { name: 'Your shopping bag' })
    .getByRole('link', { name: 'Continue to checkout' })
    .click();
  await page.getByLabel('State / FCT', { exact: true }).selectOption('Kano');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Delivery is not configured',
  );
});
test('account and admin require authentication', async ({ page }) => {
  for (const path of [
    '/account/orders',
    '/account/orders/50000000-0000-4000-8000-000000000001',
    '/admin',
    '/admin/products/new',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole('heading', { name: 'Good to have you here.' })).toBeVisible();
  }
});
test('overlays support Escape and restore focus', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: 'Search catalogue' });
  await trigger.click();
  await expect(page.getByRole('dialog', { name: 'Find something you love' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Find something you love' })).not.toBeVisible();
  await expect(trigger).toBeFocused();
});
test('important routes have no horizontal overflow', async ({ page }) => {
  for (const path of ['/', '/shop', '/products/sade-midi-dress', '/cart', '/login', '/returns']) {
    await page.goto(path);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
test('missing product has an intentional not-found state', async ({ page }) => {
  await page.goto('/products/does-not-exist');
  await expect(
    page.getByRole('heading', { name: 'This page has slipped out of the edit.' }),
  ).toBeVisible();
});
test('server rejects cross-origin checkout and unauthorised admin writes', async ({
  request,
  baseURL,
}) => {
  const blocked = await request.post('/api/orders', {
    headers: { origin: 'https://untrusted.example' },
    data: {},
  });
  expect(blocked.status()).toBe(403);
  const admin = await request.post('/api/admin/products', {
    headers: { origin: baseURL! },
    data: {},
  });
  expect(admin.status()).toBe(403);
  const malformed = await request.post('/api/orders', {
    headers: { origin: baseURL! },
    data: { items: [{ quantity: -1 }] },
  });
  expect(malformed.status()).toBe(400);
});

test('mobile navigation has nested categories and closes after navigation', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'mobile', 'Mobile menu only');
  await page.goto('/');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const dialog = page.getByRole('dialog', { name: 'Explore the edit' });
  await dialog.locator('summary').filter({ hasText: 'Women' }).click();
  await dialog.getByRole('link', { name: 'Shop all women', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Women' })).toBeVisible();
  await expect(dialog).not.toBeVisible();
});
test('gallery enlargement supports keyboard dismissal', async ({ page }) => {
  await page.goto('/products/sade-midi-dress');
  await page.getByRole('button', { name: 'Enlarge product photograph' }).click();
  await expect(page.getByRole('dialog', { name: 'A closer look' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'A closer look' })).not.toBeVisible();
});
test('small phone, tablet and large desktop layouts remain within viewport', async ({
  page,
}, info) => {
  test.skip(info.project.name !== 'desktop', 'Additional viewport sweep');
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/shop', '/products/sade-midi-dress', '/login']) {
      await page.goto(path);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        path + ' at ' + width,
      ).toBe(true);
    }
  }
});
