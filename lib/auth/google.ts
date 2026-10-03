import 'server-only';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { siteUrl } from '@/lib/config';
import { safeRedirect } from '@/lib/security';

/**
 * Google sign-in that returns users to the store's own domain.
 *
 * The server runs Google's authorization-code flow with PKCE, then hands the
 * resulting Google ID token to Supabase (signInWithIdToken). Supabase verifies
 * the token signature, audience and nonce, and issues the normal session, so
 * RLS, roles and profiles are unchanged.
 */

export const GOOGLE_STATE_COOKIE = 'oe_google_signin';
export const GOOGLE_CALLBACK_PATH = '/auth/google';
const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type PendingGoogleSignIn = { state: string; verifier: string; nonce: string; next: string };

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const redirectUri = () => `${siteUrl}${GOOGLE_CALLBACK_PATH}`;
const random = () => randomBytes(32).toString('base64url');

/** Builds the Google consent URL and the HttpOnly cookie value that must accompany it. */
export function startGoogleSignIn(next: string | null) {
  const pending: PendingGoogleSignIn = {
    state: random(),
    verifier: random(),
    nonce: random(),
    next: safeRedirect(next),
  };
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: 'openid email profile',
    state: pending.state,
    // Supabase compares the SHA-256 hex of the raw nonce with the token's nonce claim.
    nonce: createHash('sha256').update(pending.nonce).digest('hex'),
    code_challenge: createHash('sha256').update(pending.verifier).digest('base64url'),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return {
    url: `${AUTHORIZE_URL}?${params}`,
    cookie: Buffer.from(JSON.stringify(pending)).toString('base64url'),
  };
}

/** Returns the pending sign-in only when the callback state matches the cookie. */
export function readGoogleState(
  cookie: string | undefined,
  state: string | null,
): PendingGoogleSignIn | null {
  if (!cookie || !state) return null;
  try {
    const pending = JSON.parse(Buffer.from(cookie, 'base64url').toString('utf8'));
    if (
      typeof pending?.state !== 'string' ||
      typeof pending.verifier !== 'string' ||
      typeof pending.nonce !== 'string'
    )
      return null;
    const expected = Buffer.from(pending.state);
    const received = Buffer.from(state);
    if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
    return { ...pending, next: safeRedirect(pending.next) };
  } catch {
    return null;
  }
}

/** Exchanges the authorization code for a Google ID token. Server-only: uses the client secret. */
export async function exchangeGoogleCode(
  code: string,
  verifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: 'authorization_code',
      code_verifier: verifier,
    }).toString(),
    cache: 'no-store',
  });
  const body = (await response.json().catch(() => ({}))) as { id_token?: unknown };
  if (!response.ok || typeof body.id_token !== 'string')
    throw new Error(`Google token exchange failed (${response.status})`);
  return body.id_token;
}

export const googleCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  // Lax lets the cookie travel on Google's top-level redirect back to the store.
  sameSite: 'lax' as const,
  path: GOOGLE_CALLBACK_PATH,
  maxAge: 600,
};
