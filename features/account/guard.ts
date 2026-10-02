import 'server-only';
import { redirect } from 'next/navigation';
import { currentUser, sessionClient } from '@/lib/supabase/server';
export async function requireCustomer() {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');
  const db = (await sessionClient())!;
  return { user, db };
}
