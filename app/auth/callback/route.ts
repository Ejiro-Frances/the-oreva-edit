import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/supabase/server';
import { safeRedirect } from '@/lib/security';
import { siteUrl } from '@/lib/config';
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const db = await sessionClient();
  if (code && db) {
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(new URL(safeRedirect(url.searchParams.get('next')), siteUrl));
  }
  return NextResponse.redirect(new URL('/login?error=callback', siteUrl));
}
