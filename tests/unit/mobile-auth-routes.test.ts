import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const session = { access_token: 'a.b.c', refresh_token: 'refresh', expires_at: 1759700000 };
  const profileUpdate = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
  return {
    session,
    profileUpdate,
    mobileDb: {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
      },
      from: vi.fn(() => ({ update: profileUpdate })),
    },
    cookieDb: { auth: { signInWithPassword: vi.fn() } },
  };
});
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));
vi.mock('@/lib/auth/accounts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/accounts')>()),
  authClient: vi.fn(async () => mocks.cookieDb),
  statelessAuthClient: vi.fn(() => mocks.mobileDb),
}));

import { POST as signIn } from '@/app/api/auth/sign-in/route';
import { POST as signUp } from '@/app/api/auth/sign-up/route';
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mobileDb.auth.signInWithPassword.mockResolvedValue({
    data: { session: mocks.session },
    error: null,
  });
  mocks.mobileDb.auth.signUp.mockResolvedValue({
    data: { session: mocks.session, user: { id: 'new-user' } },
    error: null,
  });
});

describe('mobile sign-in', () => {
  it('returns the session in the body without an Origin header', async () => {
    const response = await signIn(
      post('/api/auth/sign-in', { email: 'A@b.co', password: 'secret', client: 'mobile' }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true, session: mocks.session });
    expect(mocks.mobileDb.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret',
    });
    expect(mocks.cookieDb.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('keeps the generic wrong-password message', async () => {
    mocks.mobileDb.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    const response = await signIn(
      post('/api/auth/sign-in', { email: 'a@b.co', password: 'nope', client: 'mobile' }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Email or password is incorrect.');
  });

  it('still requires the same origin for browser sign-in', async () => {
    const response = await signIn(post('/api/auth/sign-in', { email: 'a@b.co', password: 'x' }));
    expect(response.status).toBe(403);
  });
});

describe('mobile sign-up', () => {
  it('returns the new session and saves the phone with it', async () => {
    const response = await signUp(
      post('/api/auth/sign-up', {
        firstName: 'Tolu',
        lastName: 'Bello',
        email: 'tolu@example.com',
        password: 'correct horse',
        phone: '+2348012345678',
        client: 'mobile',
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, session: mocks.session });
    expect(mocks.profileUpdate).toHaveBeenCalledWith({ phone: '08012345678' });
  });
});

describe('mobile forgot password', () => {
  it('skips the origin check and gives the same answer', async () => {
    const response = await forgotPassword(
      post('/api/auth/forgot-password', { email: 'a@b.co', client: 'mobile' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.mobileDb.auth.resetPasswordForEmail).toHaveBeenCalled();
  });
});
