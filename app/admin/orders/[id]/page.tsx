import { OrderActions } from '@/features/admin/order-actions';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/features/admin/page-guard';
import { OrderDetails } from '@/features/orders/order-details';
import { OrderUpdate } from '@/features/admin/order-update';
import type { Order } from '@/features/orders/types';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await db
    .from('orders')
    .select('*,items:order_items(*)')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) notFound();
  const { data: notes } = await db
    .from('order_notes')
    .select('id,note,created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: false });
  const o = data as Order;
  return (
    <>
      <h1>{o.number}</h1>
      <OrderDetails order={o} />
      <p className="muted" style={{ marginTop: 15 }}>
        {o.contact.email} · {o.contact.phone}
      </p>
      <p>
        {o.contact.landmark} {o.contact.instructions}
      </p>
      <h2>Fulfilment</h2>
      <OrderActions
        id={id}
        status={data.status}
        fulfilment={data.fulfilment_status}
        payment={data.payment_status}
        test={data.test}
      />
      <OrderUpdate
        orderStatus={o.status}
        id={o.id}
        status={o.fulfilment_status}
        test={o.test}
        payment={o.payment_status}
      />
      <h2>Internal notes</h2>
      {notes?.map((n) => (
        <p key={n.id} className="notice-box">
          {n.note}
        </p>
      ))}
    </>
  );
}
