import { z } from 'zod';
import { cartSchema } from '@/lib/validation';
import { requestSession } from '@/lib/supabase/server';
import { readJson, apiError } from '@/lib/security';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/auth/accounts';
import { mergeCart } from '@/features/cart/merge';
import { applyShoppingOps, shoppingOpsSchema } from '@/features/cart/ops';
import { loadShoppingRow, shoppingView, userStore, writeStore } from '@/features/cart/state';
import { guestStore } from '@/features/cart/guest-store';
import { guestToken } from '@/features/cart/guest-token';
import { getProducts } from '@/features/catalogue/repository';
import type { Product } from '@/features/catalogue/types';

const noStore = { headers: { 'Cache-Control': 'no-store' } };
const mergeSchema = z.object({
  action: z.literal('merge'),
  // Legacy device bags (localStorage/AsyncStorage) are uploaded once through these fields.
  lines: cartSchema.optional().default([]),
  wishlist: z.array(z.uuid()).max(500).optional().default([]),
});
const knownWishlist = (ids: string[], products: Product[]) =>
  [...new Set(ids)].filter((id) => products.some((p) => p.id === id)).slice(0, 500);

export async function GET(request: Request) {
  try {
    const session = await requestSession(request);
    const products = await getProducts();
    if (session?.user) {
      const row = await loadShoppingRow(session.db, session.user.id);
      return Response.json({ ...shoppingView(row, products), userId: session.user.id }, noStore);
    }
    const token = await guestToken(request, { create: false });
    const row = token ? await guestStore(token).load() : null;
    return Response.json(shoppingView(row, products, false), noStore);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requestSession(request, { mutation: true });
    const { ops } = shoppingOpsSchema.parse(await readJson(request));
    const products = await getProducts();
    const apply = (state: Parameters<typeof applyShoppingOps>[0]) =>
      applyShoppingOps(state, ops, products);
    if (session?.user) {
      const view = await writeStore(userStore(session.db, session.user.id), products, apply);
      return Response.json({ ...view, userId: session.user.id }, noStore);
    }
    await rateLimit(`guest-bag:${clientIp(request)}`, 120, 600);
    const token = (await guestToken(request, { create: true }))!;
    return Response.json(await writeStore(guestStore(token), products, apply), noStore);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Settles where the bag lives after sign-in or on first load: a signed-in customer absorbs the
 * guest bag (then it is deleted); a guest absorbs any legacy device bag sent in the body.
 */
export async function POST(request: Request) {
  try {
    const session = await requestSession(request, { mutation: true });
    const input = mergeSchema.parse(await readJson(request));
    const products = await getProducts();
    const hasBody = input.lines.length > 0 || input.wishlist.length > 0;
    if (!session?.user && hasBody) await rateLimit(`guest-bag:${clientIp(request)}`, 120, 600);
    const token = await guestToken(request, { create: !session?.user && hasBody });
    if (session?.user) {
      const guest = token ? guestStore(token) : null;
      const guestRow = guest ? await guest.load() : null;
      const incoming = mergeCart(input.lines, guestRow?.lines ?? [], products);
      const view = await writeStore(userStore(session.db, session.user.id), products, (state) => ({
        lines: mergeCart(incoming, state.lines, products),
        wishlist: knownWishlist(
          [...input.wishlist, ...(guestRow?.wishlist ?? []), ...state.wishlist],
          products,
        ),
        adjusted: [],
      }));
      if (guest && guestRow) {
        try {
          await guest.remove();
        } catch {
          // The merge is committed and idempotent; the stale-guest cleanup removes the row later.
          console.error(JSON.stringify({ event: 'guest_bag_delete_failed' }));
        }
      }
      return Response.json({ ...view, userId: session.user.id }, noStore);
    }
    if (!hasBody) {
      const row = token ? await guestStore(token).load() : null;
      return Response.json(shoppingView(row, products, false), noStore);
    }
    const store = guestStore(token!);
    const view = await writeStore(store, products, (state) => ({
      lines: mergeCart(input.lines, state.lines, products),
      wishlist: knownWishlist([...input.wishlist, ...state.wishlist], products),
      adjusted: [],
    }));
    return Response.json(view, noStore);
  } catch (error) {
    return apiError(error);
  }
}
