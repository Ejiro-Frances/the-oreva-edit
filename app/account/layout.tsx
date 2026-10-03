import Link from 'next/link';
import { SignOut } from '@/features/account/sign-out';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/supabase/server';
export const metadata = { title: 'Your account', robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  if (!(await currentUser())) redirect('/login?next=/account');
  return (
    <div className="container account-layout">
      <nav className="account-nav" aria-label="Account navigation">
        <Link href="/account">Overview</Link>
        <Link href="/account/orders">Your orders</Link>
        <Link href="/account/profile">Profile</Link>
        <Link href="/account/addresses">Addresses</Link>
        <Link href="/account/wishlist">Wishlist</Link>
        <SignOut />
      </nav>
      <div className="account-content">{children}</div>
    </div>
  );
}
