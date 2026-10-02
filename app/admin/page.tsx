import Link from 'next/link';
import { requireAdmin } from '@/features/admin/page-guard';
import { money } from '@/lib/money';
export default async function Page() {
  const { db } = await requireAdmin();
  const [products, orders, customers, stock] = await Promise.all([
    db.from('products').select('id', { count: 'exact', head: true }),
    db
      .from('orders')
      .select('id,number,total,payment_status,test,fulfilment_status')
      .order('created_at', { ascending: false })
      .limit(20),
    db.from('profiles').select('id', { count: 'exact', head: true }),
    db.from('product_variants').select('id,sku,stock').lte('stock', 5).eq('active', true).limit(20),
  ]);
  for (const r of [products, orders, customers, stock]) if (r.error) throw r.error;
  return (
    <>
      <span className="eyebrow">THE OREVA EDIT / ADMINISTRATION</span>
      <h1>Your store at a glance.</h1>
      <div className="stats-grid">
        <div className="stat">
          <strong>{products.count || 0}</strong>
          <span>Products</span>
        </div>
        <div className="stat">
          <strong>{customers.count || 0}</strong>
          <span>Customer accounts</span>
        </div>
        <div className="stat">
          <strong>{stock.data?.length || 0}</strong>
          <span>Low-stock variants (up to 20)</span>
        </div>
        <div className="stat">
          <strong>—</strong>
          <span>Revenue: payments not connected</span>
        </div>
      </div>
      <h2>Recent orders</h2>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Fulfilment</th>
            </tr>
          </thead>
          <tbody>
            {orders.data?.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/orders/${o.id}`}>{o.number}</Link>
                  {o.test && ' · Test'}
                </td>
                <td>{money(o.total)}</td>
                <td>{o.payment_status}</td>
                <td>{o.fulfilment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!orders.data?.length && <p className="muted">No orders yet.</p>}
      <h2>Low-stock variants</h2>
      {stock.data?.map((v) => (
        <p key={v.id}>
          {v.sku} — {v.stock} available
        </p>
      ))}
    </>
  );
}
