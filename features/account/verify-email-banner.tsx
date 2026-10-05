'use client';
import { useEffect, useState } from 'react';
import { postJson } from '@/features/auth/post-json';
const COOLDOWN = 60;
/** Non-blocking reminder for accounts whose email hasn't been proven yet. */
export function VerifyEmailBanner({ email }: { email: string }) {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [wait, setWait] = useState(0);
  useEffect(() => {
    if (!wait) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  async function send() {
    setStatus('sending');
    const result = await postJson('/api/account/verify-email', {});
    setStatus(result.ok ? 'sent' : 'error');
    setMessage(
      result.ok
        ? `Sent! Check ${email}, including your spam folder.`
        : result.error || 'We couldn’t send the email. Please try again.',
    );
    setWait(COOLDOWN);
  }
  return (
    <section className="verify-banner" aria-labelledby="verify-heading">
      <div>
        <h2 id="verify-heading">Please verify your email.</h2>
        <p>We’ll send a link to {email} to confirm it’s yours.</p>
        <p role={status === 'error' ? 'alert' : 'status'} className="caption">
          {message}
        </p>
      </div>
      <button
        type="button"
        className="button button-outline"
        onClick={send}
        disabled={status === 'sending' || wait > 0}
      >
        {status === 'sending'
          ? 'Sending…'
          : wait > 0
            ? `Send again in ${wait}s`
            : status === 'sent'
              ? 'Send again'
              : 'Send verification email'}
      </button>
    </section>
  );
}
