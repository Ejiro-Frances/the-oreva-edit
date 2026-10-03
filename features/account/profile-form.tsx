'use client';
import { useState } from 'react';
import { Field } from '@/components/ui/field';
export function ProfileForm({
  name,
  phone,
  email,
}: {
  name: string;
  phone: string;
  email: string;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage('');
        const data = new FormData(e.currentTarget);
        try {
          const r = await fetch('/api/account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'profile',
              display_name: data.get('display_name'),
              phone: data.get('phone'),
            }),
          });
          const result = await r.json();
          setMessage(r.ok ? 'Your profile is saved.' : result.error);
        } catch {
          setMessage('We couldn’t save your changes. Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      {email && (
        <Field id="email" label="Sign-in email" className="span-2">
          <input id="email" type="email" value={email} readOnly aria-describedby="email-note" />
          <p className="caption" id="email-note">
            Managed by your sign-in provider.
          </p>
        </Field>
      )}
      <Field id="display_name" label="Display name">
        <input name="display_name" id="display_name" defaultValue={name} required maxLength={120} />
      </Field>
      <Field id="phone" label="Nigerian mobile number (optional)">
        <input id="phone" name="phone" type="tel" defaultValue={phone} />
      </Field>
      <div className="span-2">
        <button className="button" disabled={busy}>
          {busy ? 'Saving…' : 'Save profile'}
        </button>
        <p role="status" style={{ marginTop: 15 }}>
          {message}
        </p>
      </div>
    </form>
  );
}
