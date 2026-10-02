'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
export function OrderActions({
  id,
  status,
  fulfilment,
  payment,
  test,
}: {
  id: string;
  status: string;
  fulfilment: string;
  payment: string;
  test: boolean;
}) {
  const [action, setAction] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <section className="form-section">
      <h2>Order management</h2>
      <div className="inline-actions">
        <button className="small-button" onClick={() => setAction('note')}>
          Add internal note
        </button>
        {status === 'pending' && (test || payment === 'paid') && (
          <button className="small-button" onClick={() => setAction('confirm')}>
            Confirm order
          </button>
        )}
        {status === 'confirmed' && fulfilment === 'delivered' && (
          <button className="small-button" onClick={() => setAction('complete')}>
            Complete order
          </button>
        )}
        {['pending', 'confirmed'].includes(status) &&
          ['unfulfilled', 'processing'].includes(fulfilment) &&
          ['unpaid', 'failed'].includes(payment) && (
            <button className="small-button" onClick={() => setAction('cancel')}>
              Cancel unpaid order
            </button>
          )}
      </div>
      <p role="status">{message}</p>
      <Dialog
        open={!!action}
        onClose={() => setAction('')}
        title={
          action === 'note'
            ? 'Add an internal note'
            : `${action.charAt(0).toUpperCase() + action.slice(1)} this order?`
        }
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const note = new FormData(e.currentTarget).get('note');
            try {
              const r = await fetch('/api/admin/orders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action, note }),
              });
              const result = await r.json();
              setMessage(r.ok ? 'Order updated.' : result.error);
              if (r.ok) {
                setAction('');
                router.refresh();
              }
            } catch {
              setMessage('The change could not be saved.');
            } finally {
              setBusy(false);
            }
          }}
        >
          {action === 'cancel' && (
            <p>
              Cancelling restores the quantities to inventory. No money is refunded because this
              order is unpaid.
            </p>
          )}
          <Field id="management-note" label="Internal note">
            <textarea
              id="management-note"
              name="note"
              maxLength={2000}
              required={action === 'note'}
            />
          </Field>
          <div className="inline-actions">
            <button className="button" disabled={busy}>
              Confirm change
            </button>
            <button type="button" className="button button-outline" onClick={() => setAction('')}>
              Go back
            </button>
          </div>
          <p role="status">{message}</p>
        </form>
      </Dialog>
    </section>
  );
}
