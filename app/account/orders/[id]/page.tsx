import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireCustomer } from '@/features/account/guard';
import { OrderDetails } from '@/features/orders/order-details';
import type { Order } from '@/features/orders/types';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { user, db } = await requireCustomer();
  const { data, error } = await db!
    .from('orders')
    .select('*,items:order_items(*)')
    .eq('id', id)
    .eq('user_id', user!.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  return (
    <>
      <h1>Your order.</h1>
      <OrderDetails order={data as Order} />
    </>
  );
}
