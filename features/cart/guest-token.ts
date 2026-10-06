import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { guestHeaderToken, isGuestToken } from '@/lib/security';

const COOKIE = 'oreva_guest';
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 2592000,
  path: '/',
});

/**
 * Identifies a guest's bag: the app's X-Guest-Token header, else the browser's HttpOnly
 * oreva_guest cookie (shared with guest order access). With `create`, a browser without a valid
 * cookie gets a new random one, and an existing cookie's lifetime is renewed.
 */
export async function guestToken(request: Request, { create }: { create: boolean }) {
  const header = guestHeaderToken(request);
  if (header) return header;
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  const token = isGuestToken(existing) ? existing : null;
  if (!create) return token;
  const value = token ?? randomBytes(32).toString('hex');
  jar.set(COOKIE, value, cookieOptions());
  return value;
}
