import Link from 'next/link';
import { ForgotPasswordForm } from '@/features/auth/password-reset-forms';
export const metadata = { title: 'Reset your password', robots: { index: false, follow: false } };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <div className="container auth-page">
      <span className="eyebrow">YOUR ACCOUNT</span>
      <h1>Forgot your password?</h1>
      <p>Enter the email you use to sign in and we’ll send you a link to choose a new one.</p>
      {error === 'expired' && (
        <p role="alert" className="field-error">
          That reset link is invalid or has expired. Request a new one below.
        </p>
      )}
      <ForgotPasswordForm />
      <p className="caption">
        Remembered it?{' '}
        <Link href="/login" className="text-link">
          Sign in
        </Link>
      </p>
    </div>
  );
}
