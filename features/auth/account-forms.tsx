'use client';
import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { z } from 'zod';
import { Field } from '@/components/ui/field';
import { signInSchema, signUpSchema } from '@/lib/validation';
import { PasswordInput } from './password-input';
import { postJson } from './post-json';

type Errors = Record<string, string | undefined>;

function fieldErrors(error: z.ZodError) {
  const errors: Errors = {};
  for (const issue of error.issues) errors[String(issue.path[0])] ??= issue.message;
  return errors;
}

function values(form: HTMLFormElement) {
  return Object.fromEntries(
    [...new FormData(form)].map(([k, v]) => [k, typeof v === 'string' ? v : '']),
  );
}

/** Shared submit flow: validate on the client, post, then do a full load so the session applies. */
function useAccountForm(schema: z.ZodType, url: string, next: string) {
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<{ message: string; code?: string } | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setFailure(null);
    const parsed = schema.safeParse(values(form));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    const result = await postJson(url, values(form));
    if (result.ok && result.confirm) {
      setNotice('Your account is ready. Check your email to confirm it, then sign in.');
      setBusy(false);
    } else if (result.ok) window.location.assign(next);
    else {
      // Keep everything the customer typed except the password.
      const password = form.elements.namedItem('password');
      if (password instanceof HTMLInputElement) password.value = '';
      setFailure({
        message: result.error || 'Something went wrong. Please try again.',
        code: result.code,
      });
      setBusy(false);
    }
  }
  return { errors, failure, notice, busy, onSubmit };
}

function input(name: string, errors: Errors, props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      id={name}
      name={name}
      aria-invalid={!!errors[name]}
      aria-describedby={errors[name] ? `${name}-error` : undefined}
      {...props}
    />
  );
}

export function SignInForm({ next }: { next: string }) {
  const { errors, failure, busy, onSubmit } = useAccountForm(
    signInSchema,
    '/api/auth/sign-in',
    next,
  );
  return (
    <form noValidate onSubmit={onSubmit} className="auth-form">
      <Field id="email" label="Email address" error={errors.email} required>
        {input('email', errors, {
          type: 'email',
          autoComplete: 'email',
          required: true,
          'aria-required': true,
        })}
      </Field>
      <Field id="password" label="Password" error={errors.password} required>
        <PasswordInput
          id="password"
          autoComplete="current-password"
          invalid={!!errors.password}
          describedBy={errors.password ? 'password-error' : undefined}
        />
      </Field>
      <Link href="/forgot-password" className="auth-aside text-link">
        Forgot password?
      </Link>
      {failure && (
        <p role="alert" className="field-error">
          {failure.message}
        </p>
      )}
      <button className="button full" disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export function SignUpForm({ next }: { next: string }) {
  const { errors, failure, notice, busy, onSubmit } = useAccountForm(
    signUpSchema,
    '/api/auth/sign-up',
    next,
  );
  if (notice) return <p role="status">{notice}</p>;
  return (
    <form noValidate onSubmit={onSubmit} className="auth-form">
      <p className="caption">
        Fields marked <span className="required-mark">*</span> are required.
      </p>
      <div className="form-grid">
        <Field id="firstName" label="First name" error={errors.firstName} required>
          {input('firstName', errors, {
            autoComplete: 'given-name',
            maxLength: 60,
            required: true,
            'aria-required': true,
          })}
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName} required>
          {input('lastName', errors, {
            autoComplete: 'family-name',
            maxLength: 60,
            required: true,
            'aria-required': true,
          })}
        </Field>
        <Field id="email" label="Email address" error={errors.email} required className="span-2">
          {input('email', errors, {
            type: 'email',
            autoComplete: 'email',
            required: true,
            'aria-required': true,
          })}
        </Field>
        <Field id="password" label="Password" error={errors.password} required className="span-2">
          <PasswordInput
            id="password"
            autoComplete="new-password"
            invalid={!!errors.password}
            describedBy={errors.password ? 'password-error' : 'password-hint'}
          />
          {!errors.password && (
            <p className="caption" id="password-hint">
              At least 8 characters.
            </p>
          )}
        </Field>
        <Field
          id="phone"
          label="Nigerian mobile number (optional)"
          error={errors.phone}
          className="span-2"
        >
          {input('phone', errors, {
            type: 'tel',
            autoComplete: 'tel',
            inputMode: 'tel',
            placeholder: '08012345678',
          })}
        </Field>
      </div>
      {failure && (
        <p role="alert" className="field-error">
          {failure.message}
          {failure.code === 'account_exists' && (
            <>
              {' '}
              <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-link">
                Sign in
              </Link>{' '}
              or{' '}
              <Link href="/forgot-password" className="text-link">
                reset your password
              </Link>
              .
            </>
          )}
        </p>
      )}
      <button className="button full" disabled={busy}>
        {busy ? 'Creating your account…' : 'Create account'}
      </button>
    </form>
  );
}
