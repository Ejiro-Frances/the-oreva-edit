import Link from 'next/link';
import { SignOut } from '@/features/account/sign-out';
import { VerifyEmailBanner } from '@/features/account/verify-email-banner';
import { redirect } from 'next/navigation';
import { currentUser, sessionClient } from '@/lib/supabase/server';
export const metadata = { title: 'Your account', robots: { index: false, follow: false } };
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login?next=/account');
  const { data: profile } = await (await sessionClient())!
    .from('profiles')
    .select('email_verified_at')
    .eq('id', user.id)
    .maybeSingle();
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
      <div className="account-content">
        {profile && !profile.email_verified_at && user.email && (
          <VerifyEmailBanner email={user.email} />
        )}
        {children}
      </div>
    </div>
  );
}
