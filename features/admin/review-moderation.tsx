'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function ReviewModeration({ reviews }: { reviews: Record<string, unknown>[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  return (
    <>
      {reviews.length ? (
        reviews.map((r) => (
          <article key={String(r.id)} className="notice-box" style={{ marginBottom: 15 }}>
            <h3>
              {String(r.title)} · {String(r.rating)}/5
            </h3>
            <p>{String(r.body)}</p>
            <label>
              Moderation status{' '}
              <select
                defaultValue={String(r.status)}
                onChange={async (e) => {
                  try {
                    const result = await fetch('/api/admin/resources', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        resource: 'reviews',
                        id: r.id,
                        data: { status: e.target.value },
                      }),
                    });
                    const data = await result.json();
                    setMessage(result.ok ? 'Moderation saved.' : data.error);
                    if (result.ok) router.refresh();
                  } catch {
                    setMessage('Could not save moderation.');
                  }
                }}
              >
                <option value="pending">Pending</option>
                <option value="published">Published</option>
                <option value="hidden">Hidden</option>
              </select>
            </label>
          </article>
        ))
      ) : (
        <p>No reviews to moderate.</p>
      )}
      <p role="status">{message}</p>
    </>
  );
}
