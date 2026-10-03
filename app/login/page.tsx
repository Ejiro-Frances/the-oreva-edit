import Image from 'next/image';
import Link from 'next/link';
import { authConfigured } from '@/lib/config';
import { safeRedirect } from '@/lib/security';
import { googleConfigured } from '@/lib/auth/google';
export const metadata = { title: 'Your account', robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const query = await searchParams;
  return (
    <div className="login-layout">
      <div className="login-art">
        <Image
          src="/images/studio.jpg"
          alt="The Oreva Edit fashion editorial"
          fill
          sizes="(max-width: 600px) 100vw, 50vw"
        />
      </div>
      <div className="login-content">
        <span className="eyebrow">YOUR OWN LITTLE EDIT</span>
        <h1>
          Good to have
          <br />
          you here.
        </h1>
        <p>Keep your favourites close, save your delivery details and follow your orders.</p>
        {query.error && (
          <p role="alert" className="field-error">
            We couldn’t complete sign-in. Please try again.
          </p>
        )}
        {authConfigured() && googleConfigured() ? (
          <form action="/auth/login" method="post">
            <input type="hidden" name="next" value={safeRedirect(query.next || null)} />
            <button className="button">Continue with Google</button>
          </form>
        ) : (
          <>
            <button className="button" disabled>
              Google sign-in is not connected yet
            </button>
            <p className="caption" style={{ marginTop: 15 }}>
              Account access will be available when the store’s secure sign-in is configured. You
              can still browse and check out as a guest.
            </p>
          </>
        )}
        <p className="caption" style={{ marginTop: 25 }}>
          By continuing, you acknowledge our{' '}
          <Link href="/privacy" className="text-link">
            privacy notice
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
