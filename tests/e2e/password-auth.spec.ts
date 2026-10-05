import { test, expect, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

// Runs against the isolated local Supabase stack; its Mailpit inbox receives the auth emails.
const enabled = process.env.E2E_SUPABASE === 'true';
const mailpit = process.env.E2E_MAILPIT_URL || 'http://127.0.0.1:54324';

async function emailLink(email: string, subject: string) {
  let link = '';
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:"${email}" subject:"${subject}"`)}`,
        ).then((r) => r.json());
        const id = search.messages?.[0]?.ID;
        if (!id) return '';
        const message = await fetch(`${mailpit}/api/v1/message/${id}`).then((r) => r.json());
        link =
          /href="([^"]*token_hash=[^"]*)"/.exec(message.HTML)?.[1].replaceAll('&amp;', '&') || '';
        return link;
      },
      { timeout: 20000 },
    )
    .toContain('/auth/confirm?token_hash=');
  return link;
}

/** Submit stays disabled until the form is interactive; typing earlier can be lost. */
async function ready(page: Page, submit: string) {
  await expect(page.getByRole('button', { name: submit, exact: true })).toBeEnabled();
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await ready(page, 'Sign in');
  await page.getByLabel('Email address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

test.describe('Email and password accounts', () => {
  test.skip(!enabled, 'Requires an isolated local Supabase stack; see docs/TESTING.md.');
  const email = `shopper-${randomUUID()}@example.test`;
  const googleEmail = `google-${randomUUID()}@example.test`;
  const password = 'first password';
  const newPassword = 'second password';
  const admin = () =>
    createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false },
    });
  const accountsFor = async (address: string) =>
    (await admin().auth.admin.listUsers({ perPage: 1000 })).data.users.filter(
      (u) => u.email === address,
    );

  test.afterAll(async () => {
    if (!enabled) return;
    for (const address of [email, googleEmail])
      for (const user of await accountsFor(address)) await admin().auth.admin.deleteUser(user.id);
  });

  test('sign up, verify, sign in again and reset the password', async ({ page, context }) => {
    await page.goto('/login?mode=signup');
    await ready(page, 'Create account');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Enter your first name')).toBeVisible();

    await page.getByLabel('First name').fill('Mary Jane');
    await page.getByLabel('Last name').fill('Bello');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('type', 'text');
    await page.getByLabel('Nigerian mobile number (optional)').fill('+2348012345678');
    await page.getByRole('button', { name: 'Create account' }).click();

    // Signed in immediately, with a non-blocking verification reminder.
    await expect(page).toHaveURL(/\/account$/);
    await expect(page.getByRole('heading', { name: 'Please verify your email.' })).toBeVisible();
    await page.goto('/account/profile');
    await expect(page.getByLabel('First name')).toHaveValue('Mary Jane');
    await expect(page.getByLabel('Last name')).toHaveValue('Bello');
    await expect(page.getByLabel('Nigerian mobile number (optional)')).toHaveValue('08012345678');

    await page.getByRole('button', { name: 'Send verification email' }).click();
    await expect(page.getByText(`Sent! Check ${email}`)).toBeVisible();
    await expect(page.getByRole('button', { name: /Send again in/ })).toBeDisabled();
    await page.goto(await emailLink(email, 'Verify your email'));
    await expect(page).toHaveURL(/\/account\?verified=1$/);
    await expect(page.getByText('Email verified ✓')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Please verify your email.' })).toHaveCount(0);

    // A second account with the same email is refused with a way forward.
    await context.clearCookies();
    await page.goto('/login?mode=signup');
    await ready(page, 'Create account');
    await page.getByLabel('First name').fill('Someone');
    await page.getByLabel('Last name').fill('Else');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('another password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('An account already exists for this email.')).toBeVisible();
    await expect(page.getByLabel('First name')).toHaveValue('Someone');
    await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');

    await signIn(page, email, 'wrong password');
    await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
    await signIn(page, email, password);
    await expect(page).toHaveURL(/\/account$/);

    await context.clearCookies();
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await ready(page, 'Send reset link');
    await page.getByLabel('Email address').fill(email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText('If an account exists for that email')).toBeVisible();
    await page.goto(await emailLink(email, 'Reset your password'));
    await ready(page, 'Save new password');
    await expect(page).toHaveURL(/\/reset-password$/);
    await page.getByLabel('New password').fill(newPassword);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByText('Your password has been updated.')).toBeVisible();

    await context.clearCookies();
    await signIn(page, email, password);
    await expect(page.getByText('Email or password is incorrect.')).toBeVisible();
    await signIn(page, email, newPassword);
    await expect(page).toHaveURL(/\/account$/);
  });

  test('an existing Google account gains a password instead of a duplicate account', async ({
    page,
  }) => {
    // Same shape as a Google sign-up: confirmed email, no password.
    const { data, error } = await admin().auth.admin.createUser({
      email: googleEmail,
      email_confirm: true,
      user_metadata: { full_name: 'Ada Obi' },
    });
    if (error || !data.user) throw error || new Error('Missing test user');

    await page.goto('/login?mode=signup');

    await ready(page, 'Create account');
    await page.getByLabel('First name').fill('Ada');
    await page.getByLabel('Last name').fill('Obi');
    await page.getByLabel('Email address').fill(googleEmail);
    await page.getByLabel('Password', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('An account already exists for this email.')).toBeVisible();
    await signIn(page, googleEmail, password);
    await expect(page.getByText('Email or password is incorrect.')).toBeVisible();

    await page.getByRole('link', { name: 'Forgot password?' }).click();

    await ready(page, 'Send reset link');
    await page.getByLabel('Email address').fill(googleEmail);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await page.goto(await emailLink(googleEmail, 'Reset your password'));
    await ready(page, 'Save new password');
    await page.getByLabel('New password').fill(password);
    await page.getByRole('button', { name: 'Save new password' }).click();
    await expect(page.getByText('Your password has been updated.')).toBeVisible();

    await page.context().clearCookies();
    await signIn(page, googleEmail, password);
    await expect(page).toHaveURL(/\/account$/);
    const accounts = await accountsFor(googleEmail);
    expect(accounts.map((u) => u.id)).toEqual([data.user.id]);
  });

  test('expired or tampered email links fail safely', async ({ page }) => {
    await page.goto('/auth/confirm?token_hash=not-a-real-token&type=recovery');
    await expect(page).toHaveURL(/\/forgot-password\?error=expired$/);
    await expect(page.getByText('That reset link is invalid or has expired.')).toBeVisible();
    await page.goto('/auth/confirm?token_hash=x&type=signup');
    await expect(page).toHaveURL(/\/login\?error=link$/);
  });
});
