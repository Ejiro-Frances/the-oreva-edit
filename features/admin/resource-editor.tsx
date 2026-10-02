'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Field } from '@/components/ui/field';
type Row = Record<string, unknown>;
export function ResourceEditor({
  resource,
  rows,
  parents = [],
}: {
  resource: string;
  rows: Row[];
  parents?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Row | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const fields: Record<string, [string, string, string][]> = {
    categories: [
      ['name', 'Category name', 'text'],
      ['slug', 'URL slug', 'text'],
      ['position', 'Display order', 'number'],
    ],
    delivery: [
      ['name', 'Zone name', 'text'],
      ['states', 'States (comma separated, use FCT for Abuja)', 'text'],
      ['rate', 'Delivery charge (₦)', 'number'],
      ['free_threshold', 'Free delivery above (₦, optional)', 'number'],
      ['min_days', 'Minimum days', 'number'],
      ['max_days', 'Maximum days', 'number'],
    ],
    collections: [
      ['name', 'Collection name', 'text'],
      ['slug', 'URL slug', 'text'],
      ['description', 'Description', 'text'],
      ['position', 'Display order', 'number'],
    ],
  };
  return (
    <>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Status</th>
              <th>Manage</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={String(r.id)}>
                <td>{String(r.name)}</td>
                <td>{r.active ? 'Active' : 'Archived / inactive'}</td>
                <td>
                  <button
                    className="small-button"
                    onClick={() => {
                      setEditing(r);
                      setMessage('');
                    }}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2>{editing ? 'Edit entry' : 'Add an entry'}</h2>
      <form
        key={String(editing?.id || 'new')}
        className="form-grid"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = Object.fromEntries(new FormData(e.currentTarget));
          const payload: Row = { ...f, active: f.active === 'on' };
          for (const key of ['position', 'rate', 'free_threshold', 'min_days', 'max_days'])
            if (key in f)
              payload[key] =
                f[key] === ''
                  ? null
                  : Number(f[key]) * (key === 'rate' || key === 'free_threshold' ? 100 : 1);
          if (resource === 'delivery')
            payload.states = String(f.states)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean);
          if (resource === 'categories') payload.parent_id = f.parent_id || null;
          setBusy(true);
          try {
            const r = await fetch('/api/admin/resources', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ resource, id: editing?.id, data: payload }),
            });
            const data = await r.json();
            setMessage(r.ok ? 'Saved.' : data.error);
            if (r.ok) {
              setEditing(null);
              router.refresh();
            }
          } catch {
            setMessage('Could not save. Please try again.');
          } finally {
            setBusy(false);
          }
        }}
      >
        {(fields[resource] || []).map(([name, label, type]) => {
          let value = editing?.[name] ?? '';
          if (Array.isArray(value)) value = value.join(', ');
          if (['rate', 'free_threshold'].includes(name) && value !== '')
            value = Number(value) / 100;
          return (
            <Field id={name} label={label} key={name}>
              <input
                name={name}
                id={name}
                type={type}
                min={type === 'number' ? 0 : undefined}
                step={['rate', 'free_threshold'].includes(name) ? '.01' : undefined}
                defaultValue={String(value)}
                required={!['free_threshold', 'description', 'position'].includes(name)}
              />
            </Field>
          );
        })}
        {resource === 'categories' && (
          <Field id="parent_id" label="Parent category (optional)">
            <select id="parent_id" name="parent_id" defaultValue={String(editing?.parent_id || '')}>
              <option value="">No parent</option>
              {parents
                .filter((p) => p.id !== editing?.id)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </Field>
        )}
        <label className="checkbox-label">
          <input type="checkbox" name="active" defaultChecked={Boolean(editing?.active)} />
          Active
        </label>
        <div className="span-2 inline-actions">
          <button disabled={busy} className="button">
            {busy ? 'Saving…' : 'Save entry'}
          </button>
          {editing && (
            <button
              type="button"
              className="button button-outline"
              onClick={() => setEditing(null)}
            >
              Cancel edit
            </button>
          )}
        </div>
        <p className="span-2" role="status">
          {message}
        </p>
      </form>
    </>
  );
}
