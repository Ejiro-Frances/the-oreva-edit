import { NextResponse, type NextRequest } from 'next/server';
import { sessionClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/config';
import { markEmailVerified } from '@/lib/auth/accounts';
import {
  GOOGLE_STATE_COOKIE,
  exchangeGoogleCode,
  googleConfigured,
  googleCookieOptions,
  readGoogleState,
} from '@/lib/auth/google';

/** Google returns here (the store's own domain); Supabase then issues the session. */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const pending = readGoogleState(
    request.cookies.get(GOOGLE_STATE_COOKIE)?.value,
    params.get('state'),
  );
  const code = params.get('code');
  let destination = params.get('error') === 'access_denied' ? '/login' : '/login?error=callback';

  const db = pending && code && googleConfigured() ? await sessionClient() : null;
  if (pending && code && db) {
    try {
      const token = await exchangeGoogleCode(code, pending.verifier);
      const { data, error } = await db.auth.signInWithIdToken({
        provider: 'google',
        token,
        nonce: pending.nonce,
      });
      if (error) logFailure('supabase_rejected_token', error.code || error.message);
      else {
        // Google has already verified the address it vouches for.
        if (data.user) await markEmailVerified(data.user.id);
        destination = pending.next;
      }
    } catch (error) {
      logFailure('token_exchange', error instanceof Error ? error.message : 'unknown');
    }
  } else if (!params.get('error')) {
    logFailure(pending ? 'missing_code_or_configuration' : 'state_mismatch');
  }

  const response = NextResponse.redirect(new URL(destination, siteUrl), 303);
  // The state is single-use whatever the outcome.
  response.cookies.set(GOOGLE_STATE_COOKIE, '', { ...googleCookieOptions, maxAge: 0 });
  return response;
}

function logFailure(reason: string, detail?: string) {
  console.error(JSON.stringify({ event: 'google_signin_failed', reason, detail }));
}
