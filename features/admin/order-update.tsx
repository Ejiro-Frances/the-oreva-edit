'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { fulfilmentTransitions } from '@/features/orders/status';
import { Field } from '@/components/ui/field';
export function OrderUpdate({
  id,
  status,
  test,
  payment,
  orderStatus,
}: {
  id: string;
  status: string;
  test: boolean;
  payment: string;
  orderStatus: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const next = fulfilmentTransitions[status] || [];
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const data = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const r = await fetch('/api/admin/orders', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, ...data }),
          });
          const result = await r.json();
          setMessage(r.ok ? 'Order updated.' : result.error);
          if (r.ok) router.refresh();
        } catch {
          setMessage('The order could not be updated.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field id="status" label="Next fulfilment status">
        <select name="status" id="status" required>
          <option value="">Choose a status</option>
          {next.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </Field>
      <Field id="note" label="Internal note (optional)">
        <textarea id="note" name="note" maxLength={2000} />
      </Field>
      <div className="span-2">
        <button
          className="button"
          disabled={
            orderStatus === 'cancelled' || busy || !next.length || (!test && payment !== 'paid')
          }
        >
          Update fulfilment
        </button>
        {!test && payment !== 'paid' && (
          <p className="field-error">An unpaid live order cannot be fulfilled.</p>
        )}
        <p role="status">{message}</p>
      </div>
    </form>
  );
}
