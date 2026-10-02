import 'server-only';
import { cookies } from 'next/headers';
import { isFixture } from '@/lib/config';
import { currentUser, sessionClient, privilegedClient } from '@/lib/supabase/server';
import { tokenHash } from '@/lib/security';
import { fixtureOrders } from './fixture-store';
import type { Order } from './types';
export async function accessibleOrder(number: string): Promise<Order | null> {
  if (!/^ORE-\d{4}-\d{6,12}$/.test(number)) return null;
  const user = await currentUser();
  const guest = (await cookies()).get('oreva_guest')?.value;
  const hash = guest ? tokenHash(guest) : null;
  if (isFixture()) {
    const order = (await fixtureOrders()).find((o) => o.number === number);
    return order && (order.user_id === user?.id || order.guest_hash === hash) ? order : null;
  }
  if (user) {
    const db = await sessionClient();
    const { data } = await db!
      .from('orders')
      .select('*,items:order_items(*)')
      .eq('number', number)
      .eq('user_id', user.id)
      .maybeSingle();
    if (data) return data as Order;
  }
  if (hash) {
    const { data, error } = await privilegedClient()
      .from('orders')
      .select('*,items:order_items(*)')
      .eq('number', number)
      .eq('guest_hash', hash)
      .maybeSingle();
    if (error) throw error;
    return data as Order | null;
  }
  return null;
}
