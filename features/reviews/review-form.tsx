'use client';
import { useState } from 'react';
import { Field } from '@/components/ui/field';
export function ReviewForm({ productId }: { productId: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        try {
          const r = await fetch('/api/reviews', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              productId,
              rating: Number(f.get('rating')),
              title: f.get('title'),
              body: f.get('body'),
            }),
          });
          const data = await r.json();
          setMessage(r.ok ? 'Thank you. Your review is awaiting moderation.' : data.error);
        } catch {
          setMessage('Your review could not be submitted. Please try again.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field id="review-rating" label="Rating">
        <select id="review-rating" name="rating">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} out of 5
            </option>
          ))}
        </select>
      </Field>
      <Field id="review-title" label="Review title">
        <input id="review-title" name="title" maxLength={120} required />
      </Field>
      <Field className="span-2" id="review-body" label="Your experience">
        <textarea id="review-body" name="body" minLength={10} maxLength={2000} rows={4} required />
      </Field>
      <div className="span-2">
        <button className="small-button" disabled={busy}>
          Submit for moderation
        </button>
        <p role="status">{message}</p>
      </div>
    </form>
  );
}
