'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { z } from 'zod';
import { cartSchema } from '@/lib/validation';
import type { CartLine } from '@/features/catalogue/types';
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
const Context = createContext<ShoppingContext | null>(null);
export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
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
          if (active) {
            setSignedIn(data.signedIn);
            if (data.signedIn) {
              localLines = data.lines;
              localWishlist = data.wishlist;
            }
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
    if (!signedIn) return;
    const timer = setTimeout(() => {
      fetch('/api/shopping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', lines, wishlist }),
      })
        .then((r) => {
          if (!r.ok)
            setNotice('Your changes are saved on this device. Account sync is unavailable.');
        })
        .catch(() =>
          setNotice('Your changes are saved on this device. Account sync is unavailable.'),
        );
    }, 400);
    return () => clearTimeout(timer);
  }, [lines, wishlist, ready, signedIn]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const add = (id: string, quantity: number, stock: number) => {
    const previous = lines.find((l) => l.variantId === id)?.quantity || 0;
    if (!ready || quantity < 1 || previous + quantity > Math.min(stock, 20)) return false;
    setLines((current) => [
      ...current.filter((l) => l.variantId !== id),
      { variantId: id, quantity: previous + quantity },
    ]);
    setBagOpen(true);
    return true;
  };
  return (
    <Context.Provider
      value={{
        lines,
        wishlist,
        ready,
        notice,
        add,
        update: (id, q) =>
          setLines((current) =>
            q <= 0
              ? current.filter((l) => l.variantId !== id)
              : current.map((l) => (l.variantId === id ? { ...l, quantity: Math.min(20, q) } : l)),
          ),
        clear: () => setLines([]),
        toggle: (id) => {
          setWishlist((current) =>
            current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
          );
          setNotice(
            wishlist.includes(id) ? 'Removed from your wishlist' : 'Saved to your wishlist',
          );
        },
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
