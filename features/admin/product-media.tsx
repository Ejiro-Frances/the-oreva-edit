'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Dialog } from '@/components/ui/dialog';
type Media = { id: string; url: string; alt: string; position: number };
export function ProductMedia({ productId, images }: { productId: string; images: Media[] }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [remove, setRemove] = useState<Media | null>(null);
  async function change(body: unknown) {
    setBusy(true);
    try {
      const r = await fetch('/api/admin/media', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      setMessage(r.ok ? 'Images updated.' : data.error);
      if (r.ok) {
        router.refresh();
        setRemove(null);
      }
    } catch {
      setMessage('Image change could not be saved.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label className="field">
        Upload a product photograph (JPEG, PNG or WebP, up to 5 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            const form = new FormData();
            form.set('file', file);
            form.set('productId', productId);
            try {
              const r = await fetch('/api/admin/media', { method: 'POST', body: form });
              const data = await r.json();
              setMessage(
                r.ok ? 'Image uploaded. Set descriptive alt text before publishing.' : data.error,
              );
              if (r.ok) router.refresh();
            } catch {
              setMessage('Upload failed. Try again.');
            } finally {
              setBusy(false);
              e.target.value = '';
            }
          }}
        />
      </label>
      <div className="inline-actions">
        {images.map((m, i) => (
          <div key={m.id}>
            <Image src={m.url} alt={m.alt || 'Product image preview'} width={130} height={170} />
            <p className="caption">{i === 0 ? 'Primary image' : `Image ${i + 1}`}</p>
            <input
              aria-label={`Alt text for image ${i + 1}`}
              defaultValue={m.alt}
              onBlur={(e) => {
                if (e.target.value !== m.alt)
                  void change({ action: 'alt', id: m.id, productId, alt: e.target.value });
              }}
            />
            <div>
              <button
                type="button"
                className="small-button"
                disabled={busy || i === 0}
                onClick={() => {
                  const ordered = images.map((x) => x.id);
                  [ordered[i - 1], ordered[i]] = [ordered[i], ordered[i - 1]];
                  void change({ action: 'reorder', productId, images: ordered });
                }}
              >
                Move earlier
              </button>
              <button
                type="button"
                className="small-button"
                disabled={busy || i === 0}
                onClick={() => change({ action: 'primary', id: m.id, productId })}
              >
                Make primary
              </button>
              <button
                type="button"
                className="small-button"
                disabled={busy}
                onClick={() => setRemove(m)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
      <p role="status">{message}</p>
      <Dialog title="Delete this photograph?" open={!!remove} onClose={() => setRemove(null)}>
        <p>The photograph will be removed from this product.</p>
        <div className="inline-actions">
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={() => change({ action: 'delete', id: remove?.id, productId })}
          >
            Delete photograph
          </button>
          <button type="button" className="button button-outline" onClick={() => setRemove(null)}>
            Keep photograph
          </button>
        </div>
      </Dialog>
    </div>
  );
}
