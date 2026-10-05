import { describe, expect, it } from 'vitest';
import { newPasswordSchema, signInSchema, signUpSchema } from '@/lib/validation';
import { authErrorMessage, confirmLink } from '@/lib/auth/password';

const valid = {
  firstName: 'Mary Jane',
  lastName: 'Bello',
  email: 'Tolu@Example.com ',
  password: 'correct horse',
  phone: '',
};

describe('sign-up validation', () => {
  it('accepts names, email and an 8+ character password with no phone', () => {
    const parsed = signUpSchema.parse(valid);
    expect(parsed).toMatchObject({ firstName: 'Mary Jane', email: 'tolu@example.com', phone: '' });
  });

  it('normalises an optional Nigerian phone to the local format', () => {
    expect(signUpSchema.parse({ ...valid, phone: '+2348012345678' }).phone).toBe('08012345678');
  });

  it.each([
    [{ firstName: ' ' }, 'Enter your first name'],
    [{ lastName: '' }, 'Enter your last name'],
    [{ email: 'not-an-email' }, 'Enter a valid email address'],
    [{ password: 'short' }, 'Use at least 8 characters'],
    [{ password: 'x'.repeat(73) }, 'Use 72 characters or fewer'],
    [{ phone: '12345' }, 'Enter a Nigerian mobile number, e.g. 08012345678'],
  ])('rejects %o', (change, message) => {
    const result = signUpSchema.safeParse({ ...valid, ...change });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe(message);
  });
});

describe('sign-in and new password validation', () => {
  it('only requires a non-empty password to sign in', () => {
    expect(signInSchema.parse({ email: 'a@b.co', password: 'x' }).password).toBe('x');
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('applies the same length rule to a new password', () => {
    expect(newPasswordSchema.safeParse({ password: 'short' }).success).toBe(false);
    expect(newPasswordSchema.parse({ password: 'long enough' }).password).toBe('long enough');
  });
});

describe('emailed link handling', () => {
  const params = (q: string) => new URLSearchParams(q);

  it('sends verification links to the account with a success flag', () => {
    expect(confirmLink(params('token_hash=abc&type=email'))).toEqual({
      tokenHash: 'abc',
      type: 'email',
      destination: '/account?verified=1',
    });
  });

  it('sends password reset links to the new password page', () => {
    expect(confirmLink(params('token_hash=abc&type=recovery'))?.destination).toBe(
      '/reset-password',
    );
  });

  it.each([
    '',
    'type=email',
    'token_hash=abc',
    'token_hash=abc&type=signup',
    'token_hash=&type=email',
  ])('rejects unsupported or incomplete links: %s', (q) =>
    expect(confirmLink(params(q))).toBeNull(),
  );
});

describe('auth error messages', () => {
  it('never reveals which credential was wrong', () => {
    expect(authErrorMessage('invalid_credentials')).toBe('Email or password is incorrect.');
  });

  it('explains rate limits and weak passwords', () => {
    expect(authErrorMessage('over_email_send_rate_limit')).toMatch(/wait/);
    expect(authErrorMessage('weak_password')).toMatch(/stronger password/);
  });

  it('falls back to a generic message for unknown codes', () => {
    expect(authErrorMessage(undefined)).toBe('Something went wrong. Please try again.');
  });
});
