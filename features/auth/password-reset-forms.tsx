'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/ui/field';
import { emailOnlySchema, newPasswordSchema } from '@/lib/validation';
import { PasswordInput } from './password-input';
import { postJson } from './post-json';
import { useHydrated } from './use-hydrated';

export function ForgotPasswordForm() {
  const hydrated = useHydrated();
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get('email') || '');
    const parsed = emailOnlySchema.safeParse({ email });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError('');
    setBusy(true);
    const result = await postJson('/api/auth/forgot-password', parsed.data);
    setBusy(false);
    if (result.ok) setSent(true);
    else setError(result.error || 'Something went wrong. Please try again.');
  }
  if (sent)
    return (
      <p role="status">
        If an account exists for that email, we’ve sent a link to reset your password. Check your
        inbox and spam folder.
      </p>
    );
  return (
    <form noValidate onSubmit={onSubmit} className="auth-form">
      <Field id="email" label="Email address" error={error} required>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          aria-required
          aria-invalid={!!error}
          aria-describedby={error ? 'email-error' : undefined}
        />
      </Field>
      <button className="button full" disabled={busy || !hydrated}>
        {busy ? 'Sending…' : 'Send reset link'}
      </button>
    </form>
  );
}

export function ResetPasswordForm() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get('password') || '');
    const parsed = newPasswordSchema.safeParse({ password });
    if (!parsed.success) return setError(parsed.error.issues[0].message);
    setError('');
    setBusy(true);
    const result = await postJson('/api/auth/reset-password', parsed.data);
    if (result.ok) {
      router.replace('/account?password=updated');
      return router.refresh();
    }
    setBusy(false);
    setExpired(result.code === 'expired');
    setError(result.error || 'Something went wrong. Please try again.');
  }
  return (
    <form noValidate onSubmit={onSubmit} className="auth-form">
      <Field id="password" label="New password" error={error} required>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          invalid={!!error}
          describedBy={error ? 'password-error' : 'password-hint'}
        />
        {!error && (
          <p className="caption" id="password-hint">
            At least 8 characters.
          </p>
        )}
      </Field>
      {expired && (
        <Link href="/forgot-password" className="button button-outline">
          Send a new link
        </Link>
      )}
      <button className="button full" disabled={busy || !hydrated}>
        {busy ? 'Saving…' : 'Save new password'}
      </button>
    </form>
  );
}
