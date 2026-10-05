import Image from 'next/image';
import Link from 'next/link';
import { authConfigured } from '@/lib/config';
import { safeRedirect } from '@/lib/security';
import { googleConfigured } from '@/lib/auth/google';
import { SignInForm, SignUpForm } from '@/features/auth/account-forms';
export const metadata = { title: 'Your account', robots: { index: false, follow: false } };
const errors: Record<string, string> = {
  link: 'That link is invalid or has expired. Sign in and send a new one from your account.',
};
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const query = await searchParams;
  const next = safeRedirect(query.next || null);
  const signUp = query.mode === 'signup';
  const tab = (mode: string) => `/login?${new URLSearchParams({ mode, next })}`;
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
        {/* <span className="eyebrow mb-3">YOUR OWN LITTLE EDIT</span> */}
        <h1 className="eyebrow mb-3">
          Good to have you here.
          {/* <br /> */}
        </h1>
        {/* <p>Keep your favourites close, save your delivery details and follow your orders.</p> */}
        {query.error && (
          <p role="alert" className="field-error">
            {errors[query.error] || 'We couldn’t complete sign-in. Please try again.'}
          </p>
        )}
        {authConfigured() ? (
          <div className="auth-panel">
            {googleConfigured() && (
              <>
                <form action="/auth/login" method="post">
                  <input type="hidden" name="next" value={next} />
                  <button className="button button-outline full">Continue with Google</button>
                </form>
                <p className="auth-divider">
                  <span>or</span>
                </p>
              </>
            )}
            <nav className="auth-tabs" aria-label="Account options">
              <Link href={tab('signin')} aria-current={signUp ? undefined : 'page'}>
                Sign in
              </Link>
              <Link href={tab('signup')} aria-current={signUp ? 'page' : undefined}>
                Create account
              </Link>
            </nav>
            <h2 className="sr-only">{signUp ? 'Create an account' : 'Sign in'}</h2>
            {signUp ? <SignUpForm next={next} /> : <SignInForm next={next} />}
          </div>
        ) : (
          <>
            <button className="button" disabled>
              Account sign-in is not connected yet
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
