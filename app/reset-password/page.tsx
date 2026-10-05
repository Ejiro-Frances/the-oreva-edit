import Link from 'next/link';
import { currentUser } from '@/lib/supabase/server';
import { ResetPasswordForm } from '@/features/auth/password-reset-forms';
export const metadata = { title: 'Choose a new password', robots: { index: false, follow: false } };
export default async function Page() {
  // The emailed reset link signs the customer in via /auth/confirm before arriving here.
  const user = await currentUser();
  return (
    <div className="container auth-page">
      <span className="eyebrow">YOUR ACCOUNT</span>
      <h1>Choose a new password.</h1>
      {user ? (
        <>
          <p>Choose a new password for {user.email}.</p>
          <ResetPasswordForm />
        </>
      ) : (
        <>
          <p role="alert" className="field-error">
            This reset link has expired or was already used.
          </p>
          <Link href="/forgot-password" className="button">
            Send a new link
          </Link>
        </>
      )}
    </div>
  );
}
