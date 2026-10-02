import Link from 'next/link';
import { redirect } from 'next/navigation';
import { adminUser, currentUser } from '@/lib/supabase/server';
export const metadata = { title: 'Administration', robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/admin');
  if (!(await adminUser()))
    return (
      <div className="empty-state">
        <h1>Access restricted.</h1>
        <p>This workspace is available to authorised store administrators.</p>
        <Link href="/" className="button">
          Back to the store
        </Link>
      </div>
    );
  return (
    <div className="container account-layout">
      <nav className="account-nav" aria-label="Administration">
        <span className="eyebrow">STORE WORKSPACE</span>
        {[
          ['Overview', ''],
          ['Products', '/products'],
          ['Categories', '/categories'],
          ['Orders', '/orders'],
          ['Customers', '/customers'],
          ['Reviews', '/reviews'],
          ['Delivery', '/delivery'],
          ['Collections', '/collections'],
          ['Site settings', '/site'],
        ].map(([name, path]) => (
          <Link key={path} href={`/admin${path}`}>
            {name}
          </Link>
        ))}
      </nav>
      <div className="account-content">{children}</div>
    </div>
  );
}
