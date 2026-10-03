import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  googleConfigured,
  startGoogleSignIn,
  readGoogleState,
  exchangeGoogleCode,
  GOOGLE_STATE_COOKIE,
} from '@/lib/auth/google';

const base64url = (input: Buffer) => input.toString('base64url');

describe('Google sign-in through the store domain', () => {
  beforeEach(() => {
    vi.stubEnv('GOOGLE_CLIENT_ID', 'client-id.apps.googleusercontent.com');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'client-secret');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('is configured only when both Google credentials exist', () => {
    expect(googleConfigured()).toBe(true);
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '');
    expect(googleConfigured()).toBe(false);
  });

  it('sends Google back to the store domain with state, PKCE and a hashed nonce', () => {
    const { url, cookie } = startGoogleSignIn('/admin');
    const target = new URL(url);
    const params = target.searchParams;
    const pending = JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8'));

    expect(target.origin + target.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(params.get('client_id')).toBe('client-id.apps.googleusercontent.com');
    expect(params.get('redirect_uri')).toBe('http://localhost:3000/auth/google');
    expect(params.get('response_type')).toBe('code');
    expect(params.get('scope')).toBe('openid email profile');
    expect(params.get('state')).toBe(pending.state);
    expect(params.get('code_challenge_method')).toBe('S256');
    expect(params.get('code_challenge')).toBe(
      base64url(createHash('sha256').update(pending.verifier).digest()),
    );
    expect(params.get('nonce')).toBe(createHash('sha256').update(pending.nonce).digest('hex'));
    expect(pending.next).toBe('/admin');
    expect(url).not.toContain('client-secret');
  });

  it('never stores an unsafe post-login destination', () => {
    const { cookie } = startGoogleSignIn('https://evil.example/steal');
    expect(JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8')).next).toBe('/account');
  });

  it('uses fresh random values for every attempt', () => {
    const a = new URL(startGoogleSignIn('/account').url).searchParams;
    const b = new URL(startGoogleSignIn('/account').url).searchParams;
    expect(a.get('state')).not.toBe(b.get('state'));
    expect(a.get('nonce')).not.toBe(b.get('nonce'));
    expect(a.get('code_challenge')).not.toBe(b.get('code_challenge'));
  });

  it('accepts the callback only when the state matches the cookie', () => {
    const { url, cookie } = startGoogleSignIn('/wishlist');
    const state = new URL(url).searchParams.get('state')!;
    expect(readGoogleState(cookie, state)).toMatchObject({ next: '/wishlist' });
    expect(readGoogleState(cookie, state + 'x')).toBeNull();
    expect(readGoogleState(cookie, null)).toBeNull();
    expect(readGoogleState(undefined, state)).toBeNull();
    expect(readGoogleState('not-valid-json', state)).toBeNull();
  });

  it('exchanges the code server-side with the secret and PKCE verifier', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ id_token: 'google.id.token' }));
    await expect(exchangeGoogleCode('auth-code', 'verifier-123', fetchImpl)).resolves.toBe(
      'google.id.token',
    );
    const [endpoint, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    const body = new URLSearchParams(String(init.body));
    expect(endpoint).toBe('https://oauth2.googleapis.com/token');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(body)).toEqual({
      code: 'auth-code',
      client_id: 'client-id.apps.googleusercontent.com',
      client_secret: 'client-secret',
      redirect_uri: 'http://localhost:3000/auth/google',
      grant_type: 'authorization_code',
      code_verifier: 'verifier-123',
    });
  });

  it('rejects a failed or tokenless Google response', async () => {
    const failed = vi.fn(async () => Response.json({ error: 'invalid_grant' }, { status: 400 }));
    await expect(exchangeGoogleCode('c', 'v', failed)).rejects.toThrow();
    const empty = vi.fn(async () => Response.json({}));
    await expect(exchangeGoogleCode('c', 'v', empty)).rejects.toThrow();
  });

  it('scopes the temporary cookie name to this flow', () => {
    expect(GOOGLE_STATE_COOKIE).toMatch(/google/);
  });
});
