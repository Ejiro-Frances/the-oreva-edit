'use client';
import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
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
const BAG_KEY = 'oreva-bag-v1';
const WISHLIST_KEY = 'oreva-wishlist-v1';
/** Present when the stored bag mirrors an account rather than a guest's own choices. */
const OWNER_KEY = 'oreva-bag-owner';
const plain = (remote: Remote) =>
  remote.lines.map(({ variantId, quantity }) => ({ variantId, quantity }));
function forgetOwner() {
  try {
    localStorage.removeItem(OWNER_KEY);
  } catch {
    /* Storage unavailable: nothing to forget. */
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
  useEffect(() => {
    let active = true;
    let localLines: CartLine[] = [];
    let localWishlist: string[] = [];
    let owned = false;
    try {
      owned = Boolean(localStorage.getItem(OWNER_KEY));
      localLines = cartSchema.parse(JSON.parse(localStorage.getItem(BAG_KEY) || '[]'));
      localWishlist = z
        .array(z.uuid())
        .max(500)
        .parse(JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]'));
    } catch {
      /* Corrupt or unavailable storage starts empty. */
    }
    async function restore() {
      try {
        // A copy of an account's bag is not merged back: the account may have changed since on
        // another device, and merging keeps the larger quantity, undoing those removals.
        const response = await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'merge',
            lines: owned ? [] : localLines,
            wishlist: owned ? [] : localWishlist,
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          const data = await response.json();
          if (active && data.signedIn) {
            setUserId(data.userId);
            localLines = data.lines;
            localWishlist = data.wishlist;
          } else if (active && data.signedIn === false) {
            // Signed out: the device keeps these choices as its own guest bag.
            forgetOwner();
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
      localStorage.setItem(BAG_KEY, JSON.stringify(lines));
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(wishlist));
      if (userId) localStorage.setItem(OWNER_KEY, userId);
    } catch {
      /* Session remains usable without storage. */
    }
  }, [lines, wishlist, ready, userId]);
  /** Adopts the account's bag. Resolves false when it could not be read. */
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await fetch('/api/shopping', { cache: 'no-store' });
      if (!response.ok) return false;
      const data = await response.json();
      if (!data.signedIn) return false;
      if (request === sequence.current) {
        setLines(plain(data));
        setWishlist(data.wishlist);
      }
      return true;
    } catch {
      /* The next event or visit refreshes again. */
      return false;
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
  /**
   * Saves a change to the account. If it is refused the account's bag is fetched and shown; if
   * that fails too, the bag from before the change is restored.
   */
  const send = (ops: ShoppingOp[]) => {
    if (!userId) return;
    const previous = committed.current;
    const request = ++sequence.current;
    fetch('/api/shopping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    })
      .then(async (response) => {
        if (response.status === 401) {
          // The session ended elsewhere: keep the change on this device as a guest bag.
          forgetOwner();
          setUserId(null);
          setNotice('You were signed out. Your bag is saved on this device.');
          return;
        }
        if (!response.ok) throw new Error('Rejected');
        const data = await response.json();
        if (request !== sequence.current) return;
        setLines(plain(data));
        setWishlist(data.wishlist);
        if (data.adjusted?.length) setNotice('Quantity updated to what’s in stock');
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
