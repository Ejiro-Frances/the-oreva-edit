'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function CollectionMembers({
  id,
  products,
  selected,
}: {
  id: string;
  products: { id: string; name: string }[];
  selected: string[];
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <details className="disclosure">
      <summary>Choose pieces for this collection</summary>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const ids = new FormData(e.currentTarget).getAll('products');
          try {
            const r = await fetch('/api/admin/collections', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id, products: ids }),
            });
            const result = await r.json();
            setMessage(r.ok ? 'Collection pieces saved.' : result.error);
            if (r.ok) router.refresh();
          } catch {
            setMessage('Changes could not be saved.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="form-grid">
          {products.map((p) => (
            <label key={p.id} className="checkbox-label">
              <input
                name="products"
                type="checkbox"
                value={p.id}
                defaultChecked={selected.includes(p.id)}
              />
              {p.name}
            </label>
          ))}
        </div>
        <button className="small-button" disabled={busy}>
          Save collection pieces
        </button>
        <p role="status">{message}</p>
      </form>
    </details>
  );
}
