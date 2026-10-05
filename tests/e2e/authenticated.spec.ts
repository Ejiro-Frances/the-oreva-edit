import { test, expect, type BrowserContext } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { randomUUID } from 'node:crypto';
const enabled = process.env.E2E_SUPABASE === 'true';
test.describe('Local Supabase customer and staff workflows', () => {
  test.skip(!enabled, 'Requires an isolated local Supabase stack; see docs/TESTING.md.');
  let staffId: string;
  let customerId: string;
  let password: string;
  let customerEmail: string;
  let staffEmail: string;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const secret = process.env.SUPABASE_SECRET_KEY || '';
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  function admin() {
    if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
      throw new Error('Auth tests only run against localhost Supabase');
    return createClient(url, secret, { auth: { persistSession: false } });
  }
  async function signIn(context: BrowserContext, email: string) {
    const pending: { name: string; value: string; options: { maxAge?: number } }[] = [];
    const client = createServerClient(url, publishable, {
      cookies: {
        getAll: () => [],
        setAll: (values) => {
          pending.push(...values);
        },
      },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    await context.addCookies(
      pending.map((c) => ({
        name: c.name,
        value: c.value,
        domain: 'localhost',
        path: '/',
        sameSite: 'Lax',
        httpOnly: false,
        secure: false,
      })),
    );
  }
  test.beforeAll(async () => {
    password = randomUUID() + 'aA1!';
    const tag = randomUUID();
    customerEmail = `customer-${tag}@example.test`;
    staffEmail = `staff-${tag}@example.test`;
    const db = admin();
    for (const [email, isStaff] of [
      [customerEmail, false],
      [staffEmail, true],
    ] as const) {
      const { data, error } = await db.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) throw error || new Error('Missing test user');
      if (isStaff) {
        staffId = data.user.id;
        const result = await db.from('user_roles').insert({ user_id: staffId, role: 'admin' });
        if (result.error) throw result.error;
      } else customerId = data.user.id;
    }
  });
  test.afterAll(async () => {
    if (!enabled) return;
    const db = admin();
    if (staffId) await db.auth.admin.deleteUser(staffId);
    if (customerId) await db.auth.admin.deleteUser(customerId);
  });
  test('customer session permits profile editing and persistent wishlist', async ({
    page,
    context,
  }) => {
    await signIn(context, customerEmail);
    await page.goto('/account/profile');
    await page.getByLabel('First name').fill('Synthetic');
    await page.getByLabel('Last name').fill('Customer');
    await page.getByRole('button', { name: 'Save profile' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'saved' })).toBeVisible();
    await page.goto('/products/sade-midi-dress');
    await page.getByRole('button', { name: 'Save The Sade midi dress to wishlist' }).click();
    await expect
      .poll(async () => {
        const { data } = await admin()
          .from('shopping_state')
          .select('wishlist')
          .eq('user_id', customerId)
          .single();
        return data?.wishlist;
      })
      .toContain('20000000-0000-4000-8000-000000000001');
  });
  test('signed-in customers cannot open administration', async ({ page, context }) => {
    await signIn(context, customerEmail);
    await page.goto('/admin');
    await expect(
      page.getByRole('heading', {
        name: /Access restricted\.|This page has slipped out of the edit\./,
      }),
    ).toBeVisible();
    const result = await page.request.post('/api/admin/products', {
      headers: { origin: 'http://localhost:3100' },
      data: {},
    });
    expect(result.status()).toBe(403);
  });
  test('account orders and another customer order remain private', async ({ page, context }) => {
    await signIn(context, customerEmail);
    await page.goto('/account/orders');
    await expect(page.getByRole('heading', { name: 'Your orders.', exact: true })).toBeVisible();
    await page.goto('/account/orders/50000000-0000-4000-8000-000000000099');
    await expect(
      page.getByRole('heading', { name: 'This page has slipped out of the edit.' }),
    ).toBeVisible();
  });
  test('administrator creates and edits a draft', async ({ page, context }) => {
    await signIn(context, staffEmail);
    await page.goto('/admin/products/new');
    const name = 'Synthetic E2E shirt ' + randomUUID().slice(0, 8);
    await page.getByLabel('Product name', { exact: true }).fill(name);
    await page
      .getByLabel('URL slug', { exact: true })
      .fill(name.toLowerCase().replaceAll(' ', '-'));
    await page.getByLabel('Short description', { exact: true }).fill('Isolated test record');
    await page
      .getByLabel('Category', { exact: true })
      .selectOption('10000000-0000-4000-8000-000000000001');
    await page
      .getByLabel('Description', { exact: true })
      .fill('Synthetic product for controlled browser testing only.');
    await page.getByLabel('Price (₦)', { exact: true }).fill('12500');
    await page.getByRole('button', { name: 'Generate variants' }).click();
    await page.getByLabel('Stock for variant 1', { exact: true }).fill('4');
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/products\/[a-f0-9-]{36}$/);
    await page.getByLabel('Product name', { exact: true }).fill(name + ' edited');
    await page.getByRole('button', { name: 'Save product', exact: true }).click();
    await expect
      .poll(async () => {
        const { data } = await admin()
          .from('products')
          .select('name')
          .eq('id', page.url().split('/').at(-1)!)
          .single();
        return data?.name;
      })
      .toBe(name + ' edited');
  });
  test('administrator rejects a malformed image', async ({ page, context }) => {
    await signIn(context, staffEmail);
    const response = await page.request.post('/api/admin/media', {
      headers: { origin: 'http://localhost:3100' },
      multipart: {
        productId: '20000000-0000-4000-8000-000000000001',
        file: { name: 'invalid.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('not an image') },
      },
    });
    expect(response.status()).toBe(400);
  });
});
