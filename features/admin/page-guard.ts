import 'server-only';
import { redirect, notFound } from 'next/navigation';
import { currentUser, adminUser, sessionClient } from '@/lib/supabase/server';
export async function requireAdmin() {
  if (!(await currentUser())) redirect('/login?next=/admin');
  const user = await adminUser();
  if (!user) notFound();
  return { user, db: (await sessionClient())! };
}
