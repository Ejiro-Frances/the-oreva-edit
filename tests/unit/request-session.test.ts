import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bearerGetUser: vi.fn(),
  cookieGetUser: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: mocks.cookieGetUser } }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    mocks.createClient(...args);
    return { auth: { getUser: mocks.bearerGetUser } };
  },
}));

import { requestSession } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/config';

// sameOrigin compares against NEXT_PUBLIC_SITE_URL, which differs between local runs and CI.
const origin = new URL(siteUrl).origin;
const token = 'header.payload.signature';
const request = (headers: Record<string, string> = {}) =>
  new Request(`${origin}/api/shopping`, { method: 'PATCH', headers });

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  mocks.bearerGetUser.mockResolvedValue({ data: { user: { id: 'mobile-user' } }, error: null });
  mocks.cookieGetUser.mockResolvedValue({ data: { user: { id: 'cookie-user' } }, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('requestSession', () => {
  it('uses a valid bearer token and ignores cookies', async () => {
    const session = await requestSession(request({ Authorization: `Bearer ${token}` }), {
      mutation: true,
    });
    expect(session?.mode).toBe('bearer');
    expect(session?.user?.id).toBe('mobile-user');
    expect(mocks.bearerGetUser).toHaveBeenCalledWith(token);
    expect(mocks.cookieGetUser).not.toHaveBeenCalled();
    const [, , options] = mocks.createClient.mock.calls[0];
    expect(options.global.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it.each(['Bearer', 'Bearer not-a-jwt', 'Basic abc', ''])(
    'rejects a malformed Authorization header %j as an expired session',
    async (value) => {
      await expect(requestSession(request({ Authorization: value }))).rejects.toMatchObject({
        status: 401,
        code: 'session_expired',
      });
      expect(mocks.cookieGetUser).not.toHaveBeenCalled();
    },
  );

  it('treats a token Supabase rejects as expired', async () => {
    mocks.bearerGetUser.mockResolvedValue({
      data: { user: null },
      error: { status: 403, code: 'bad_jwt' },
    });
    await expect(
      requestSession(request({ Authorization: `Bearer ${token}` })),
    ).rejects.toMatchObject({ status: 401, code: 'session_expired' });
  });

  it('does not sign the customer out when Supabase Auth is down', async () => {
    mocks.bearerGetUser.mockResolvedValue({ data: { user: null }, error: { status: 500 } });
    const failure = requestSession(request({ Authorization: `Bearer ${token}` }));
    await expect(failure).rejects.toThrow('Account service unavailable');
    await expect(failure).rejects.not.toMatchObject({ status: 401 });
  });

  it('requires the same origin for cookie mutations', async () => {
    await expect(requestSession(request(), { mutation: true })).rejects.toMatchObject({
      status: 403,
    });
    const session = await requestSession(request({ Origin: origin }), {
      mutation: true,
    });
    expect(session).toMatchObject({ mode: 'cookie', user: { id: 'cookie-user' } });
  });

  it('lets app guests (X-Guest-Token) mutate without an Origin, but not plain cookie requests', async () => {
    const guest = await requestSession(request({ 'X-Guest-Token': 'cd'.repeat(32) }), {
      mutation: true,
    });
    expect(guest?.mode).toBe('cookie');
    await expect(
      requestSession(request({ 'X-Guest-Token': 'not-valid' }), { mutation: true }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('allows cookie reads without an Origin header', async () => {
    expect((await requestSession(request()))?.user?.id).toBe('cookie-user');
  });

  it('returns null when Supabase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(await requestSession(request({ Authorization: `Bearer ${token}` }))).toBeNull();
    expect(await requestSession(request())).toBeNull();
  });
});
