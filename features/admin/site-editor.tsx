'use client';
import { useState } from 'react';
import { Field } from '@/components/ui/field';
export function SiteEditor({ announcement, featured }: { announcement: string; featured: string }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form-grid"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = Object.fromEntries(new FormData(e.currentTarget));
        try {
          const r = await fetch('/api/admin/resources', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ resource: 'site', data: f }),
          });
          const data = await r.json();
          setMessage(r.ok ? 'Storefront settings saved.' : data.error);
        } catch {
          setMessage('Could not save settings.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field id="announcement" label="Announcement bar" className="span-2">
        <input id="announcement" name="announcement" defaultValue={announcement} maxLength={150} />
      </Field>
      <Field id="featured_collection" label="Featured collection slug" className="span-2">
        <input
          id="featured_collection"
          name="featured_collection"
          defaultValue={featured}
          maxLength={120}
        />
      </Field>
      <div className="span-2">
        <button disabled={busy} className="button">
          Save settings
        </button>
        <p role="status">{message}</p>
      </div>
    </form>
  );
}
