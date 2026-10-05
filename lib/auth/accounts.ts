import 'server-only';
import { randomBytes } from 'node:crypto';
import type { AuthError, SupabaseClient, User } from '@supabase/supabase-js';
import { privilegedClient, sessionClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/security';
import { siteUrl } from '@/lib/config';
import { authErrorMessage, CONFIRM_PATH } from './password';

/** Where every Supabase email link returns; must be in the project's allowed redirect URLs. */
export const confirmUrl = `${siteUrl}${CONFIRM_PATH}`;

export async function authClient() {
  const db = await sessionClient();
  if (!db) throw new AppError('Account sign-in is not available yet.', 503);
  return db;
}

export function clientIp(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

const statuses: Record<string, number> = {
  invalid_credentials: 401,
  user_already_exists: 409,
  email_exists: 409,
  over_email_send_rate_limit: 429,
  over_request_rate_limit: 429,
};

/** Converts a Supabase Auth error into customer-safe copy; the code alone is logged. */
export function authFailure(error: AuthError) {
  const code = error.code;
  if (!code || !(code in statuses))
    console.error(JSON.stringify({ event: 'auth_failed', code: code || 'unknown' }));
  const exists = code === 'user_already_exists' || code === 'email_exists';
  return new AppError(
    authErrorMessage(code),
    (code && statuses[code]) || 400,
    exists ? 'account_exists' : undefined,
  );
}

/** Records that the customer proved they own their sign-in email. Never callable by customers. */
export async function markEmailVerified(userId: string) {
  const { error } = await privilegedClient()
    .from('profiles')
    .update({ email_verified_at: new Date().toISOString() })
    .eq('id', userId)
    .is('email_verified_at', null);
  if (error) console.error(JSON.stringify({ event: 'email_verify_save_failed' }));
}

/**
 * Runs after a successful Google sign-in. "Confirm email" is off, so anyone could have
 * created a password account for this address before its owner arrived, and Supabase then
 * links Google to it (pre-account takeover). Google has now proved ownership: if the
 * address was never verified, the password nobody proved is replaced and every other
 * session is ended before the account is marked verified. Throws if that cannot be done,
 * so the caller refuses the sign-in rather than leave the account shared.
 */
export async function claimAccountWithGoogle(user: User, session: SupabaseClient) {
  const admin = privilegedClient();
  const { data: profile, error } = await admin
    .from('profiles')
    .select('email_verified_at')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw new Error('Could not read account verification');
  const hasPassword = user.identities?.some((identity) => identity.provider === 'email');
  if (!profile?.email_verified_at && hasPassword) {
    const revoked = await admin.auth.admin.updateUserById(user.id, {
      password: randomBytes(32).toString('base64url'),
    });
    if (revoked.error) throw new Error('Could not remove unverified password');
    const ended = await session.auth.signOut({ scope: 'others' });
    if (ended.error) throw new Error('Could not end other sessions');
    console.info(JSON.stringify({ event: 'unverified_password_revoked' }));
  }
  await markEmailVerified(user.id);
}
