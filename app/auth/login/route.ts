import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/supabase/server';
import { sameOrigin, safeRedirect, apiError } from '@/lib/security';
import { siteUrl } from '@/lib/config';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const db = await sessionClient();
    if (!db) return NextResponse.redirect(new URL('/login?error=configuration', siteUrl), 303);
    const form = await request.formData();
    const next = safeRedirect(String(form.get('next') || ''));
    const { data, error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error || !data.url)
      return NextResponse.redirect(new URL('/login?error=oauth', siteUrl), 303);
    return NextResponse.redirect(data.url, 303);
  } catch (error) {
    return apiError(error);
  }
}
