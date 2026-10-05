import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/security';
import type { CartLine, Product } from '@/features/catalogue/types';
import { applyShoppingOps, type ShoppingOp, type ShoppingState } from './ops';
import { lineDetails, type LineDetail } from './lines';

export type ShoppingRow = { lines: CartLine[]; wishlist: string[]; updated_at: string };
export type ShoppingView = {
  signedIn: true;
  updatedAt: string | null;
  lines: (LineDetail & { quantity: number })[];
  wishlist: string[];
};

export async function loadShoppingRow(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('shopping_state')
    .select('lines,wishlist,updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ShoppingRow | null) ?? null;
}

export function shoppingView(row: ShoppingRow | null, products: Product[]): ShoppingView {
  const quantities = new Map((row?.lines ?? []).map((l) => [l.variantId, l.quantity]));
  return {
    signedIn: true,
    updatedAt: row?.updated_at ?? null,
    lines: lineDetails([...quantities.keys()], products).map((line) => ({
      ...line,
      quantity: Math.min(quantities.get(line.variantId)!, line.variant.stock, 20),
    })),
    wishlist: row?.wishlist ?? [],
  };
}

/**
 * Applies one device's changes. The write only succeeds if the row is unchanged since it was
 * read (same updated_at); otherwise another device wrote first, so re-read and re-apply.
 */
export async function writeShopping(
  db: SupabaseClient,
  userId: string,
  products: Product[],
  transform: (state: ShoppingState) => {
    lines: CartLine[];
    wishlist: string[];
    adjusted: string[];
  },
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await loadShoppingRow(db, userId);
    const next = transform({ lines: row?.lines ?? [], wishlist: row?.wishlist ?? [] });
    const values = {
      lines: next.lines,
      wishlist: next.wishlist,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = row
      ? await db
          .from('shopping_state')
          .update(values)
          .eq('user_id', userId)
          .eq('updated_at', row.updated_at)
          .select('user_id')
      : await db
          .from('shopping_state')
          .insert({ user_id: userId, ...values })
          .select('user_id');
    if (error && error.code !== '23505') throw error;
    if (!error && data?.length)
      return { ...shoppingView(values, products), adjusted: next.adjusted };
  }
  throw new AppError('Your bag changed on another device. Please try again.', 409, 'cart_conflict');
}

export function changeShopping(
  db: SupabaseClient,
  userId: string,
  ops: ShoppingOp[],
  products: Product[],
) {
  return writeShopping(db, userId, products, (state) => applyShoppingOps(state, ops, products));
}
