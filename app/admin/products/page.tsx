import Link from 'next/link';
import { requireAdmin } from '@/features/admin/page-guard';
import { money } from '@/lib/money';
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { db } = await requireAdmin();
  const { q, status } = await searchParams;
  let query = db
    .from('products')
    .select('id,name,slug,price,status')
    .order('updated_at', { ascending: false })
    .limit(100);
  if (status && ['draft', 'active', 'archived'].includes(status))
    query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  let rows = data || [];
  if (q) {
    const { data: variants } = await db
      .from('product_variants')
      .select('product_id,sku')
      .ilike('sku', `%${q.replace(/[%_]/g, '')}%`)
      .limit(100);
    rows = rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q.toLowerCase()) ||
        variants?.some((v) => v.product_id === p.id),
    );
  }
  return (
    <>
      <div className="admin-toolbar">
        <h1>Products.</h1>
        <Link className="button" href="/admin/products/new">
          Add a product
        </Link>
      </div>
      <form className="search-form">
        <input
          aria-label="Search products or SKU"
          name="q"
          defaultValue={q}
          placeholder="Search name or SKU"
        />
        <select aria-label="Product status" name="status" defaultValue={status}>
          <option value="">All statuses</option>
          <option value="active">Published</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <button className="small-button">Search</button>
      </form>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/products/${p.id}`}>{p.name}</Link>
                </td>
                <td>{money(p.price)}</td>
                <td>
                  <span className="status">{p.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>No products match this selection.</p>}
      <p className="caption">Showing up to 100 recently updated products.</p>
    </>
  );
}
