'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
const plain = (remote: Remote) =>
  remote.lines.map(({ variantId, quantity }) => ({ variantId, quantity }));
export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    let active = true;
    let localLines: CartLine[] = [];
    let localWishlist: string[] = [];
    try {
      localLines = cartSchema.parse(JSON.parse(localStorage.getItem('oreva-bag-v1') || '[]'));
      localWishlist = z
        .array(z.uuid())
        .max(500)
        .parse(JSON.parse(localStorage.getItem('oreva-wishlist-v1') || '[]'));
    } catch {
      /* Corrupt or unavailable storage starts empty. */
    }
    async function restore() {
      try {
        const response = await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'merge', lines: localLines, wishlist: localWishlist }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          const data = await response.json();
          if (active && data.signedIn) {
            setUserId(data.userId);
            localLines = data.lines;
            localWishlist = data.wishlist;
          }
        }
      } catch {
        /* Guest shopping remains usable while the network is unavailable. */
      }
      if (active) {
        setLines(localLines);
        setWishlist(localWishlist);
        setReady(true);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem('oreva-bag-v1', JSON.stringify(lines));
      localStorage.setItem('oreva-wishlist-v1', JSON.stringify(wishlist));
    } catch {
      /* Session remains usable without storage. */
    }
  }, [lines, wishlist, ready]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/shopping', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.signedIn) return;
      setLines(plain(data));
      setWishlist(data.wishlist);
    } catch {
      /* The next event or visit refreshes again. */
    }
  }, []);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let stop = () => {};
    void subscribeToShopping(userId, () => void refresh()).then((unsubscribe) => {
      if (active) stop = unsubscribe;
      else unsubscribe();
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  /** Saves a change to the account; the optimistic local state is restored if it is refused. */
  const send = (ops: ShoppingOp[]) => {
    if (!userId) return;
    const previous = { lines, wishlist };
    fetch('/api/shopping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Rejected');
        const data = await response.json();
        setLines(plain(data));
        setWishlist(data.wishlist);
        if (data.adjusted.length) setNotice('Quantity updated to what’s in stock');
      })
      .catch(() => {
        setLines(previous.lines);
        setWishlist(previous.wishlist);
        setNotice('Your bag could not be updated. Please try again.');
      });
  };
  const add = (id: string, quantity: number, stock: number) => {
    const previous = lines.find((l) => l.variantId === id)?.quantity || 0;
    if (!ready || quantity < 1 || previous + quantity > Math.min(stock, 20)) return false;
    setLines([
      ...lines.filter((l) => l.variantId !== id),
      { variantId: id, quantity: previous + quantity },
    ]);
    send([{ op: 'add', variantId: id, quantity }]);
    setBagOpen(true);
    return true;
  };
  const update = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setLines(lines.filter((l) => l.variantId !== id));
      send([{ op: 'remove', variantId: id }]);
      return;
    }
    const capped = Math.min(20, quantity);
    setLines(lines.map((l) => (l.variantId === id ? { ...l, quantity: capped } : l)));
    send([{ op: 'set', variantId: id, quantity: capped }]);
  };
  const clear = () => {
    if (lines.length) send(lines.map((l) => ({ op: 'remove' as const, variantId: l.variantId })));
    setLines([]);
  };
  const toggle = (id: string) => {
    const saved = wishlist.includes(id);
    setWishlist(saved ? wishlist.filter((x) => x !== id) : [...wishlist, id]);
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
