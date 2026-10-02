import 'server-only';
import { adminUser, sessionClient } from '@/lib/supabase/server';
import { AppError } from '@/lib/security';
export async function requireAdmin() {
  const user = await adminUser();
  if (!user) throw new AppError('Administrator access required', 403);
  const db = (await sessionClient())!;
  return { user, db };
}
