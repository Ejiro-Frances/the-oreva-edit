import { NextResponse } from 'next/server';
import { sameOrigin, apiError } from '@/lib/security';
import { authConfigured, siteUrl } from '@/lib/config';
import {
  GOOGLE_STATE_COOKIE,
  googleConfigured,
  googleCookieOptions,
  startGoogleSignIn,
} from '@/lib/auth/google';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (!authConfigured() || !googleConfigured())
      return NextResponse.redirect(new URL('/login?error=configuration', siteUrl), 303);
    const form = await request.formData();
    const { url, cookie } = startGoogleSignIn(String(form.get('next') || ''));
    const response = NextResponse.redirect(url, 303);
    response.cookies.set(GOOGLE_STATE_COOKIE, cookie, googleCookieOptions);
    return response;
  } catch (error) {
    return apiError(error);
  }
}
