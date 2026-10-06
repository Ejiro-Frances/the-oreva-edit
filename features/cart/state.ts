import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/security';
import type { CartLine, Product } from '@/features/catalogue/types';
import { applyShoppingOps, type ShoppingOp, type ShoppingState } from './ops';
import { lineDetails, type LineDetail } from './lines';

export type ShoppingRow = { lines: CartLine[]; wishlist: string[]; updated_at: string };
export type ShoppingValues = { lines: CartLine[]; wishlist: string[]; updated_at: string };
export type ShoppingView = {
  signedIn: boolean;
  updatedAt: string | null;
  lines: (LineDetail & { quantity: number })[];
  wishlist: string[];
};

/** Where one bag is kept: a customer's row or a guest's row. */
export type ShoppingStore = {
  signedIn: boolean;
  load(): Promise<ShoppingRow | null>;
  /** Writes only if the row still has `previous` as updated_at; false when another write won. */
  update(values: ShoppingValues, previous: string): Promise<boolean>;
  /** False when a row already exists (another device created it first). */
  insert(values: ShoppingValues): Promise<boolean>;
  /**
   * Deletes the row; with `previousUpdatedAt`, only while it still has that updated_at, so a
   * change made since it was read survives. False when nothing was deleted.
   */
  remove(previousUpdatedAt?: string): Promise<boolean>;
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

export function userStore(db: SupabaseClient, userId: string): ShoppingStore {
  return {
    signedIn: true,
    load: () => loadShoppingRow(db, userId),
    async update(values, previous) {
      const { data, error } = await db
        .from('shopping_state')
        .update(values)
        .eq('user_id', userId)
        .eq('updated_at', previous)
        .select('user_id');
      if (error) throw error;
      return !!data?.length;
    },
    async insert(values) {
      const { data, error } = await db
        .from('shopping_state')
        .insert({ user_id: userId, ...values })
        .select('user_id');
      if (error && error.code === '23505') return false;
      if (error) throw error;
      return !!data?.length;
    },
    async remove(previousUpdatedAt) {
      let query = db.from('shopping_state').delete().eq('user_id', userId);
      if (previousUpdatedAt) query = query.eq('updated_at', previousUpdatedAt);
      const { data, error } = await query.select('user_id');
      if (error) throw error;
      return !!data?.length;
    },
  };
}

export function shoppingView(
  row: (Pick<ShoppingRow, 'lines' | 'wishlist'> & { updated_at: string | null }) | null,
  products: Product[],
  signedIn = true,
): ShoppingView {
  const quantities = new Map((row?.lines ?? []).map((l) => [l.variantId, l.quantity]));
  return {
    signedIn,
    updatedAt: row?.updated_at ?? null,
    lines: lineDetails([...quantities.keys()], products).map((line) => ({
      ...line,
      quantity: Math.min(quantities.get(line.variantId)!, line.variant.stock, 20),
    })),
    wishlist: row?.wishlist ?? [],
  };
}

type Transform = (state: ShoppingState) => {
  lines: CartLine[];
  wishlist: string[];
  adjusted: string[];
};

/**
 * Applies one device's changes to a bag. The write only succeeds if the row is unchanged since it
 * was read (same updated_at); otherwise another device wrote first, so re-read and re-apply.
 */
export async function writeStore(store: ShoppingStore, products: Product[], transform: Transform) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await store.load();
    const next = transform({ lines: row?.lines ?? [], wishlist: row?.wishlist ?? [] });
    const values = {
      lines: next.lines,
      wishlist: next.wishlist,
      updated_at: new Date().toISOString(),
    };
    const written = row ? await store.update(values, row.updated_at) : await store.insert(values);
    if (written)
      return { ...shoppingView(values, products, store.signedIn), adjusted: next.adjusted };
  }
  throw new AppError('Your bag changed on another device. Please try again.', 409, 'cart_conflict');
}

export function writeShopping(
  db: SupabaseClient,
  userId: string,
  products: Product[],
  transform: Transform,
) {
  return writeStore(userStore(db, userId), products, transform);
}

export function changeShopping(
  db: SupabaseClient,
  userId: string,
  ops: ShoppingOp[],
  products: Product[],
) {
  return writeShopping(db, userId, products, (state) => applyShoppingOps(state, ops, products));
}
