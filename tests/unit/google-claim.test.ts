import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient, User } from '@supabase/supabase-js';

const state = vi.hoisted(() => ({
  verifiedAt: null as string | null,
  updateError: null as { message: string } | null,
  updateUserById: vi.fn(),
  markVerified: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  sessionClient: vi.fn(),
  privilegedClient: () => ({
    auth: {
      admin: {
        updateUserById: (...args: unknown[]) => {
          state.updateUserById(...args);
          return Promise.resolve({ error: state.updateError });
        },
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () =>
            Promise.resolve({ data: { email_verified_at: state.verifiedAt }, error: null }),
        }),
      }),
      update: (values: unknown) => ({
        eq: () => ({
          is: () => {
            state.markVerified(values);
            return Promise.resolve({ error: null });
          },
        }),
      }),
    }),
  }),
}));

import { claimAccountWithGoogle } from '@/lib/auth/accounts';

const signOut = vi.fn(() => Promise.resolve({ error: null }));
const session = { auth: { signOut } } as unknown as SupabaseClient;
const user = (...providers: string[]) =>
  ({ id: 'user-1', identities: providers.map((provider) => ({ provider })) }) as unknown as User;

describe('claiming an account with Google', () => {
  beforeEach(() => {
    state.verifiedAt = null;
    state.updateError = null;
    vi.clearAllMocks();
  });

  it('removes a password nobody proved and signs out every other session', async () => {
    await claimAccountWithGoogle(user('email', 'google'), session);
    const [id, attributes] = state.updateUserById.mock.calls[0];
    expect(id).toBe('user-1');
    expect(attributes.password).toMatch(/^[\w-]{40,}$/);
    expect(signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(state.markVerified).toHaveBeenCalledOnce();
  });

  it('uses a different random password every time', async () => {
    await claimAccountWithGoogle(user('email', 'google'), session);
    await claimAccountWithGoogle(user('email', 'google'), session);
    const [first, second] = state.updateUserById.mock.calls.map(([, a]) => a.password);
    expect(first).not.toBe(second);
  });

  it('leaves an already verified account and its password alone', async () => {
    state.verifiedAt = '2026-10-01T00:00:00Z';
    await claimAccountWithGoogle(user('email', 'google'), session);
    expect(state.updateUserById).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it('only marks a Google-only account verified', async () => {
    await claimAccountWithGoogle(user('google'), session);
    expect(state.updateUserById).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
    expect(state.markVerified).toHaveBeenCalledOnce();
  });

  it('refuses the sign-in, without verifying, if the password cannot be removed', async () => {
    state.updateError = { message: 'unavailable' };
    await expect(claimAccountWithGoogle(user('email', 'google'), session)).rejects.toThrow();
    expect(signOut).not.toHaveBeenCalled();
    expect(state.markVerified).not.toHaveBeenCalled();
  });
});
