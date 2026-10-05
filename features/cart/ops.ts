import { z } from 'zod';
import type { CartLine, Product } from '@/features/catalogue/types';

const quantity = z.number().int().min(1).max(20);
export const shoppingOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), variantId: z.uuid(), quantity }),
  z.object({ op: z.literal('set'), variantId: z.uuid(), quantity }),
  z.object({ op: z.literal('remove'), variantId: z.uuid() }),
  z.object({ op: z.literal('wish'), productId: z.uuid() }),
  z.object({ op: z.literal('unwish'), productId: z.uuid() }),
]);
export const shoppingOpsSchema = z.object({ ops: z.array(shoppingOpSchema).min(1).max(50) });
export type ShoppingOp = z.infer<typeof shoppingOpSchema>;
export type ShoppingState = { lines: CartLine[]; wishlist: string[] };

/**
 * Applies line changes from one device to the saved bag. Every line, including ones saved
 * earlier, is capped at min(stock, 20) and the bag at 50 lines; anything capped or dropped is
 * listed in `adjusted` so the customer can be told why their bag changed.
 */
export function applyShoppingOps(state: ShoppingState, ops: ShoppingOp[], products: Product[]) {
  const active = products.filter((p) => p.status === 'active');
  const stock = new Map(active.flatMap((p) => p.variants.map((v) => [v.id, v.stock] as const)));
  const productIds = new Set(active.map((p) => p.id));
  const lines = new Map(state.lines.map((l) => [l.variantId, l.quantity]));
  const wishlist = new Set(state.wishlist);
  for (const op of ops) {
    if (op.op === 'add') lines.set(op.variantId, (lines.get(op.variantId) ?? 0) + op.quantity);
    else if (op.op === 'set') lines.set(op.variantId, op.quantity);
    else if (op.op === 'remove') lines.delete(op.variantId);
    else if (op.op === 'wish') {
      if (productIds.has(op.productId)) wishlist.add(op.productId);
    } else wishlist.delete(op.productId);
  }
  const next: CartLine[] = [];
  const adjusted: string[] = [];
  for (const [variantId, wanted] of lines) {
    const kept = next.length < 50 ? Math.min(wanted, stock.get(variantId) ?? 0, 20) : 0;
    if (kept !== wanted) adjusted.push(variantId);
    if (kept > 0) next.push({ variantId, quantity: kept });
  }
  return { lines: next, wishlist: [...wishlist].slice(0, 500), adjusted };
}
