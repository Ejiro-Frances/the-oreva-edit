import { NextResponse, type NextRequest } from 'next/server';
import { sessionClient } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/config';
import { confirmLink } from '@/lib/auth/password';
import { markEmailVerified } from '@/lib/auth/accounts';
/** Every Supabase email link lands here; the one-time token is checked on the server. */
export async function GET(request: NextRequest) {
  const link = confirmLink(request.nextUrl.searchParams);
  const failed = link?.type === 'recovery' ? '/forgot-password?error=expired' : '/login?error=link';
  const db = link ? await sessionClient() : null;
  if (link && db) {
    const { data, error } = await db.auth.verifyOtp({
      token_hash: link.tokenHash,
      type: link.type,
    });
    if (!error && data.user) {
      // Opening a link sent to the address proves ownership, for resets as well as verification.
      await markEmailVerified(data.user.id);
      return NextResponse.redirect(new URL(link.destination, siteUrl), 303);
    }
    console.error(JSON.stringify({ event: 'email_link_failed', code: error?.code || 'no_user' }));
  }
  return NextResponse.redirect(new URL(failed, siteUrl), 303);
}
