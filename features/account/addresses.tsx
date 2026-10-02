'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { states } from '@/lib/config';
import { Field } from '@/components/ui/field';
import { Dialog } from '@/components/ui/dialog';
type Address = { id: string; label: string; details: Record<string, string> };
export function Addresses({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<string | null>(null);
  async function send(body: unknown) {
    setBusy(true);
    try {
      const r = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await r.json();
      if (!r.ok) {
        setMessage(result.error);
        return false;
      }
      setMessage('Your addresses are updated.');
      router.refresh();
      return true;
    } catch {
      setMessage('Your change could not be saved. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div>
        {addresses.map((a) => (
          <div className="notice-box" style={{ marginBottom: 15 }} key={a.id}>
            <strong>{a.label}</strong>
            <p>
              {a.details.firstName} {a.details.lastName}
              <br />
              {a.details.address}
              <br />
              {a.details.city}, {a.details.state}
            </p>
            <button className="small-button" onClick={() => setRemove(a.id)}>
              Remove address
            </button>
          </div>
        ))}
      </div>
      <h2>Add a delivery address</h2>
      <form
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = Object.fromEntries(new FormData(form));
          const { label, ...details } = data;
          if (await send({ action: 'address', label, details })) form.reset();
        }}
      >
        {[
          ['label', 'Address label'],
          ['firstName', 'First name'],
          ['lastName', 'Last name'],
          ['phone', 'Nigerian mobile number'],
          ['city', 'City or town'],
          ['address', 'Delivery address'],
          ['lga', 'LGA (optional)'],
          ['landmark', 'Landmark (optional)'],
          ['instructions', 'Delivery instructions (optional)'],
        ].map(([name, label]) => (
          <Field id={name} label={label} key={name}>
            <input
              id={name}
              name={name}
              required={!['lga', 'landmark', 'instructions'].includes(name)}
            />
          </Field>
        ))}
        <Field id="state" label="State / FCT">
          <select id="state" name="state" required>
            <option value="">Choose a state</option>
            {states.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <div className="span-2">
          <button className="button" disabled={busy}>
            Save address
          </button>
        </div>
      </form>
      <p role="status" style={{ marginTop: 20 }}>
        {message}
      </p>
      <Dialog title="Remove this address?" open={!!remove} onClose={() => setRemove(null)}>
        <p>
          This removes it from your saved addresses. Past order records retain their delivery
          details.
        </p>
        <div className="inline-actions">
          <button
            className="button"
            disabled={busy}
            onClick={async () => {
              if (await send({ action: 'remove-address', id: remove })) setRemove(null);
            }}
          >
            Remove address
          </button>
          <button className="button button-outline" onClick={() => setRemove(null)}>
            Keep address
          </button>
        </div>
      </Dialog>
    </>
  );
}
