'use client';
import { useState } from 'react';
import { Field } from '@/components/ui/field';
export function ProfileForm({
  firstName,
  lastName,
  phone,
  email,
}: {
  firstName: string;
  lastName: string;
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
              first_name: data.get('first_name'),
              last_name: data.get('last_name'),
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
            Your sign-in email can’t be changed here.
          </p>
        </Field>
      )}
      <Field id="first_name" label="First name" required>
        <input
          name="first_name"
          id="first_name"
          defaultValue={firstName}
          autoComplete="given-name"
          required
          maxLength={60}
        />
      </Field>
      <Field id="last_name" label="Last name" required>
        <input
          name="last_name"
          id="last_name"
          defaultValue={lastName}
          autoComplete="family-name"
          required
          maxLength={60}
        />
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
