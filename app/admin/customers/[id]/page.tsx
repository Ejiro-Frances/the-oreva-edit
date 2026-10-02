import { notFound } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import { requireAdmin } from '@/features/admin/page-guard';
import { money } from '@/lib/money';
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data: customer } = await db
    .from('profiles')
    .select('display_name,email,phone')
    .eq('id', id)
    .maybeSingle();
  if (!customer) notFound();
  const { data: orders, error } = await db
    .from('orders')
    .select('id,number,total,status')
    .eq('user_id', id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (
    <>
      <h1>{customer.display_name || 'Customer account'}</h1>
      <p>{customer.email}</p>
      <p>{customer.phone}</p>
      <h2>Order history</h2>
      {orders?.map((o) => (
        <div className="total-row" key={o.id}>
          <Link className="text-link" href={`/admin/orders/${o.id}`}>
            {o.number} · {o.status}
          </Link>
          <span>{money(o.total)}</span>
        </div>
      ))}
      {!orders?.length && <p>No orders yet.</p>}
    </>
  );
}
