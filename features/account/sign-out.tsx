'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog } from '@/components/ui/dialog';
export function SignOut() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Sign out
      </button>
      <Dialog title="Sign out?" open={open} onClose={() => !busy && setOpen(false)}>
        <p>Your bag and wishlist stay saved to your account for next time.</p>
        <form action="/auth/logout" method="post" onSubmit={() => setBusy(true)}>
          <div className="inline-actions">
            <button className="button" disabled={busy} aria-busy={busy}>
              {busy && <Loader2 className="spinner" aria-hidden />}
              {busy ? 'Signing out…' : 'Sign out'}
            </button>
            <button
              type="button"
              className="button button-outline"
              disabled={busy}
              onClick={() => setOpen(false)}
            >
              Stay signed in
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
