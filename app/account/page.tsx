import Link from 'next/link';
import { currentUser } from '@/lib/supabase/server';
export default async function Page() {
  const user = await currentUser();
  return (
    <>
      <span className="eyebrow">YOUR OWN LITTLE EDIT</span>
      <h1>Welcome back.</h1>
      <p className="muted">{user?.email}</p>
      <h2>All the good things, together.</h2>
      <p>Find your orders, update your details and revisit the pieces you saved.</p>
      <div className="inline-actions">
        <Link className="button" href="/account/orders">
          View your orders
        </Link>
        <Link className="button button-outline" href="/account/wishlist">
          Your wishlist
        </Link>
      </div>
    </>
  );
}
