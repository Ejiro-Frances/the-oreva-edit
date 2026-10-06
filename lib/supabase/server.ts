import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { authConfigured } from '@/lib/config';
import { AppError, guestHeaderToken, sameOrigin } from '@/lib/security';

export async function sessionClient() {
  if (!authConfigured()) return null;
  const jar = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => jar.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) => jar.set(name, value, options));
          } catch {
            /* Server Components cannot set cookies; proxy refreshes them. */
          }
        },
      },
    },
  );
}
export function publicClient() {
  if (!authConfigured()) throw new Error('Catalogue connection is not configured');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false } },
  );
}
export function privilegedClient() {
  if (!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    throw new Error('Server database credentials are not configured');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export async function currentUser() {
  const db = await sessionClient();
  if (!db) return null;
  const { data, error } = await db.auth.getUser();
  return error ? null : data.user;
}
export async function adminUser() {
  const db = await sessionClient();
  if (!db) return null;
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();
  return data ? user : null;
}

export type RequestSession = { db: SupabaseClient; user: User | null; mode: 'bearer' | 'cookie' };

const expired = () => new AppError('Please sign in again.', 401, 'session_expired');

/**
 * Identifies the caller of an API route. The mobile app sends `Authorization: Bearer <access
 * token>` and is never read from cookies. Browsers use the cookie session and, for mutations,
 * must pass the same-origin check; bearer requests skip it because a browser cannot attach that
 * header to a cross-site request on its own. A request with a valid X-Guest-Token (the app's
 * guests) and no Authorization header is always a guest: its cookies are never read, so a
 * cross-site page cannot use that header to act on a signed-in browser session.
 */
export async function requestSession(
  request: Request,
  { mutation = false }: { mutation?: boolean } = {},
): Promise<RequestSession | null> {
  const header = request.headers.get('authorization');
  if (header === null && guestHeaderToken(request)) {
    const db = await sessionClient();
    return db ? { db, user: null, mode: 'cookie' } : null;
  }
  if (header === null) {
    if (mutation) sameOrigin(request);
    const db = await sessionClient();
    if (!db) return null;
    const { data } = await db.auth.getUser();
    return { db, user: data.user ?? null, mode: 'cookie' };
  }
  if (!authConfigured()) return null;
  const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header)?.[1];
  if (!token) throw expired();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { data, error } = await db.auth.getUser(token);
  if (error && error.status !== 401 && error.status !== 403)
    throw new Error('Account service unavailable');
  if (!data.user) throw expired();
  return { db, user: data.user, mode: 'bearer' };
}
