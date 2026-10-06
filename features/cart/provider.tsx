'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { z } from 'zod';
import { cartSchema } from '@/lib/validation';
import type { CartLine } from '@/features/catalogue/types';
import type { ShoppingOp } from './ops';
import { subscribeToShopping } from './live';
type ShoppingContext = {
  lines: CartLine[];
  wishlist: string[];
  ready: boolean;
  notice: string;
  add: (id: string, quantity: number, stock: number) => boolean;
  update: (id: string, quantity: number) => void;
  clear: () => void;
  toggle: (id: string) => void;
  bagOpen: boolean;
  setBagOpen: (open: boolean) => void;
  notify: (message: string) => void;
};
type Remote = { lines: CartLine[]; wishlist: string[] };
const Context = createContext<ShoppingContext | null>(null);
/** Keys from when the bag lived in the browser; read once to hand over, then deleted. */
const LEGACY_KEYS = {
  bag: 'oreva-bag-v1',
  wishlist: 'oreva-wishlist-v1',
  owner: 'oreva-bag-owner',
};
const plain = (remote: Remote) =>
  remote.lines.map(({ variantId, quantity }) => ({ variantId, quantity }));

/** A guest bag left in localStorage by an older version; an account's copy is not uploaded. */
function readLegacy(): Remote {
  try {
    if (localStorage.getItem(LEGACY_KEYS.owner)) return { lines: [], wishlist: [] };
    return {
      lines: cartSchema.parse(JSON.parse(localStorage.getItem(LEGACY_KEYS.bag) || '[]')),
      wishlist: z
        .array(z.uuid())
        .max(500)
        .parse(JSON.parse(localStorage.getItem(LEGACY_KEYS.wishlist) || '[]')),
    };
  } catch {
    return { lines: [], wishlist: [] };
  }
}
function forgetLegacy() {
  try {
    for (const key of Object.values(LEGACY_KEYS)) localStorage.removeItem(key);
  } catch {
    /* Storage unavailable: nothing to remove. */
  }
}

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  /** Only the newest PATCH or refresh may set the bag, so a slow older reply cannot undo it. */
  const sequence = useRef(0);
  /** The last rendered bag, restored when a change cannot be saved or checked. */
  const committed = useRef<Remote>({ lines: [], wishlist: [] });
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    committed.current = { lines, wishlist };
  }, [lines, wishlist]);
  /** The signed-in customer whose bag is shown, readable inside async replies. */
  const shownUser = useRef<string | null>(null);
  /**
   * Shows a bag the server returned (customer or guest). A guest reply while a customer's bag was
   * shown means the session ended (for example signed out in another tab): the cookie request
   * was served as a guest instead of failing, so say so rather than switching bags silently.
   */
  const adopt = useCallback((data: Remote & { signedIn?: boolean; userId?: string }) => {
    const next = data.signedIn && data.userId ? data.userId : null;
    if (shownUser.current && !next) setNotice('You were signed out.');
    shownUser.current = next;
    setLines(plain(data));
    setWishlist(data.wishlist);
    setUserId(next);
  }, []);
  /** Shows the server's bag. Resolves false when it could not be read. */
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await fetch('/api/shopping', { cache: 'no-store' });
      if (!response.ok) return false;
      const data = await response.json();
      if (request === sequence.current) adopt(data);
      return true;
    } catch {
      return false;
    }
  }, [adopt]);
  useEffect(() => {
    let active = true;
    const legacy = readLegacy();
    /** Settles the bag on the server; false when the merge did not succeed. */
    async function merge() {
      try {
        // A customer absorbs their guest bag, and any bag an older version left in this browser
        // is handed over once.
        const response = await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'merge', ...legacy }),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return false;
        forgetLegacy();
        const data = await response.json();
        if (active) adopt(data);
        return true;
      } catch {
        return false;
      }
    }
    async function restore() {
      // If the merge fails, still show the bag already saved; the merge is retried next load.
      if (!(await merge()) && active && !(await refresh()) && active)
        setNotice('Your bag could not be loaded. Please refresh the page.');
      if (active) setReady(true);
    }
    void restore();
    return () => {
      active = false;
    };
  }, [adopt, refresh]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let stop = () => {};
    void subscribeToShopping(userId, () => void refresh()).then((unsubscribe) => {
      if (active) stop = unsubscribe;
      else unsubscribe();
    });
    return () => {
      active = false;
      stop();
    };
  }, [userId, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  /**
   * Saves a change (customer or guest). If it is refused the server's bag is fetched and shown;
   * if that fails too, the bag from before the change is restored.
   */
  const send = (ops: ShoppingOp[]) => {
    const previous = committed.current;
    const request = ++sequence.current;
    fetch('/api/shopping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    })
      .then(async (response) => {
        if (response.status === 401) {
          // A rejected session (bearer-style): show this browser's guest bag instead.
          shownUser.current = null;
          setUserId(null);
          setNotice('You were signed out.');
          await refresh();
          return;
        }
        if (!response.ok) throw new Error('Rejected');
        const data = await response.json();
        if (request !== sequence.current) return;
        if (data.adjusted?.length) setNotice('Quantity updated to what’s in stock');
        // Adopted last so a "signed out" notice wins over the stock notice.
        adopt(data);
      })
      .catch(async () => {
        setNotice('Your bag could not be updated. Please try again.');
        if (request !== sequence.current) return;
        const adopted = await refresh();
        if (!adopted && request + 1 === sequence.current) {
          setLines(previous.lines);
          setWishlist(previous.wishlist);
        }
      });
  };
  const add = (id: string, quantity: number, stock: number) => {
    const previous = lines.find((l) => l.variantId === id)?.quantity || 0;
    if (!ready || quantity < 1 || previous + quantity > Math.min(stock, 20)) return false;
    setLines((current) => {
      const existing = current.find((l) => l.variantId === id)?.quantity || 0;
      return [
        ...current.filter((l) => l.variantId !== id),
        { variantId: id, quantity: Math.min(existing + quantity, stock, 20) },
      ];
    });
    send([{ op: 'add', variantId: id, quantity }]);
    setBagOpen(true);
    setNotice('Added to your bag');
    return true;
  };
  const update = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setLines((current) => current.filter((l) => l.variantId !== id));
      send([{ op: 'remove', variantId: id }]);
      return;
    }
    const capped = Math.min(20, quantity);
    setLines((current) =>
      current.map((l) => (l.variantId === id ? { ...l, quantity: capped } : l)),
    );
    send([{ op: 'set', variantId: id, quantity: capped }]);
  };
  const clear = () => {
    if (lines.length) send(lines.map((l) => ({ op: 'remove' as const, variantId: l.variantId })));
    setLines([]);
  };
  const toggle = (id: string) => {
    const saved = wishlist.includes(id);
    setWishlist((current) =>
      saved ? current.filter((x) => x !== id) : current.includes(id) ? current : [...current, id],
    );
    send([{ op: saved ? 'unwish' : 'wish', productId: id }]);
    setNotice(saved ? 'Removed from your wishlist' : 'Saved to your wishlist');
  };
  return (
    <Context.Provider
      value={{
        lines,
        wishlist,
        ready,
        notice,
        add,
        update,
        clear,
        toggle,
        bagOpen,
        setBagOpen,
        notify,
      }}
    >
      {children}
      <div role="status" aria-live="polite" className={notice ? 'toast visible' : 'toast'}>
        {notice}
      </div>
    </Context.Provider>
  );
}
export function useShopping() {
  const context = useContext(Context);
  if (!context) throw new Error('ShoppingProvider is required');
  return context;
}
