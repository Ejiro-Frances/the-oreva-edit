import { CollectionMembers } from '@/features/admin/collection-members';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAdmin } from '@/features/admin/page-guard';
import { ResourceEditor } from '@/features/admin/resource-editor';
import { SiteEditor } from '@/features/admin/site-editor';
import { ReviewModeration } from '@/features/admin/review-moderation';
import { money } from '@/lib/money';
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { db } = await requireAdmin();
  const { resource } = await params;
  const tables: Record<string, string> = {
    categories: 'categories',
    delivery: 'delivery_zones',
    collections: 'collections',
    customers: 'profiles',
    reviews: 'reviews',
    orders: 'orders',
    site: 'site_settings',
  };
  const table = tables[resource];
  if (!table) notFound();
  let query = db.from(table).select('*').limit(100);
  if (['orders', 'reviews', 'customers'].includes(resource))
    query = query.order('created_at', { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  const rows = data || [];
  const collectionData =
    resource === 'collections'
      ? await Promise.all([
          db.from('products').select('id,name').order('name').limit(500),
          db.from('collection_products').select('collection_id,product_id'),
        ])
      : null;
  if (resource === 'site')
    return (
      <>
        <h1>Site settings.</h1>
        <SiteEditor
          announcement={rows.find((r) => r.key === 'announcement')?.value || ''}
          featured={rows.find((r) => r.key === 'featured_collection')?.value || 'the-everyday-edit'}
        />
      </>
    );
  if (['categories', 'delivery', 'collections'].includes(resource))
    return (
      <>
        <h1>
          {resource === 'delivery'
            ? 'Delivery zones'
            : resource[0].toUpperCase() + resource.slice(1)}
          .
        </h1>
        {resource === 'delivery' && (
          <p className="notice-box">
            Only enter approved business rates. Development rates must be clearly labelled. Do not
            activate overlapping state zones.
          </p>
        )}
        <ResourceEditor
          resource={resource}
          rows={rows}
          parents={resource === 'categories' ? rows : []}
        />
        {collectionData &&
          rows.map((c) => (
            <section key={c.id}>
              <h2>{c.name}</h2>
              <CollectionMembers
                id={c.id}
                products={collectionData[0].data || []}
                selected={(collectionData[1].data || [])
                  .filter((m) => m.collection_id === c.id)
                  .map((m) => m.product_id)}
              />
            </section>
          ))}
      </>
    );
  if (resource === 'reviews')
    return (
      <>
        <h1>Review moderation.</h1>
        <ReviewModeration reviews={rows} />
      </>
    );
  if (resource === 'customers')
    return (
      <>
        <h1>Customer accounts.</h1>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Orders</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.display_name || 'Customer'}</td>
                  <td>{r.email}</td>
                  <td>
                    <Link href={`/admin/customers/${r.id}`}>View history</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  const { q, status } = await searchParams;
  const orders = rows.filter(
    (r) =>
      (!q || r.number.toLowerCase().includes(q.toLowerCase())) &&
      (!status || r.fulfilment_status === status),
  );
  return (
    <>
      <h1>Orders.</h1>
      <form className="search-form">
        <input
          aria-label="Order reference"
          name="q"
          defaultValue={q}
          placeholder="Search order reference"
        />
        <select aria-label="Fulfilment status" name="status" defaultValue={status}>
          <option value="">All fulfilment</option>
          {['unfulfilled', 'processing', 'shipped', 'delivered', 'returned'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="small-button">Filter</button>
      </form>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Payment</th>
              <th>Fulfilment</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/admin/orders/${r.id}`}>{r.number}</Link>
                  {r.test && ' · Test'}
                </td>
                <td>
                  {r.contact.firstName} {r.contact.lastName}
                </td>
                <td>{money(r.total)}</td>
                <td>{r.payment_status}</td>
                <td>{r.fulfilment_status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!orders.length && <p>No orders match this selection.</p>}
      <p className="caption">Showing up to 100 recent records.</p>
    </>
  );
}
