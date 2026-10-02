import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/supabase/server';
import { sameOrigin, apiError } from '@/lib/security';
import { siteUrl } from '@/lib/config';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    await (await sessionClient())?.auth.signOut();
    return NextResponse.redirect(new URL('/', siteUrl), 303);
  } catch (error) {
    return apiError(error);
  }
}
