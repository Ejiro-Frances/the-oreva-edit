'use client';
import { browserClient } from '@/lib/supabase/browser';

/** Calls onChange whenever this customer's saved bag changes on any device. */
export async function subscribeToShopping(userId: string, onChange: () => void) {
  const supabase = browserClient();
  if (!supabase) return () => {};
  const { data } = await supabase.auth.getSession();
  if (!data.session) return () => {};
  // Without the customer's token Realtime applies RLS as anonymous and delivers nothing.
  await supabase.realtime.setAuth(data.session.access_token);
  const channel = supabase
    .channel(`shopping:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shopping_state', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
