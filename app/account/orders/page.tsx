import Link from 'next/link';
import { requireCustomer } from '@/features/account/guard';
import { money } from '@/lib/money';
import { EmptyState } from '@/components/ui/empty-state';
export default async function Page() {
  const { user, db } = await requireCustomer();
  const { data: orders, error } = await db!
    .from('orders')
    .select('id,number,created_at,total,status,payment_status')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (
    <>
      <h1>Your orders.</h1>
      {orders?.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Date</th>
                <th>Status</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/account/orders/${o.id}`}>{o.number}</Link>
                  </td>
                  <td>{new Date(o.created_at).toLocaleDateString('en-NG')}</td>
                  <td>
                    {o.status} / {o.payment_status}
                  </td>
                  <td>{money(o.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          title="Your first edit is still to come."
          description="Your orders will appear here when you shop while signed in."
        />
      )}
    </>
  );
}
