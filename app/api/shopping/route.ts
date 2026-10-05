import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { cartSchema } from '@/lib/validation';
import { requestSession } from '@/lib/supabase/server';
import { readJson, apiError, AppError } from '@/lib/security';
import { mergeCart } from '@/features/cart/merge';
import { shoppingOpsSchema } from '@/features/cart/ops';
import { changeShopping, loadShoppingRow, shoppingView } from '@/features/cart/state';
import { getProducts } from '@/features/catalogue/repository';

const noStore = { headers: { 'Cache-Control': 'no-store' } };
const mergeSchema = z.object({
  action: z.literal('merge'),
  lines: cartSchema,
  wishlist: z.array(z.uuid()).max(500),
});

export async function GET(request: Request) {
  try {
    const session = await requestSession(request);
    if (!session?.user) return Response.json({ signedIn: false }, noStore);
    const row = await loadShoppingRow(session.db, session.user.id);
    return Response.json(shoppingView(row, await getProducts()), noStore);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requestSession(request, { mutation: true });
    if (!session?.user) throw new AppError('Please sign in to update your bag.', 401);
    const { ops } = shoppingOpsSchema.parse(await readJson(request));
    const view = await changeShopping(session.db, session.user.id, ops, await getProducts());
    return Response.json(view, noStore);
  } catch (error) {
    return apiError(error);
  }
}

/** Joins a guest bag and wishlist to the account when a customer signs in. */
export async function POST(request: Request) {
  try {
    const session = await requestSession(request, { mutation: true });
    const parsed = mergeSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('Your shopping list needs to be refreshed');
    if (session?.mode !== 'bearer') {
      const jar = await cookies();
      if (!jar.get('oreva_guest'))
        jar.set('oreva_guest', randomBytes(32).toString('hex'), {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 2592000,
          path: '/',
        });
    }
    if (!session?.user) return Response.json({ signedIn: false }, noStore);
    const { db, user } = session;
    const input = parsed.data;
    const existing = await loadShoppingRow(db, user.id);
    const products = await getProducts();
    const lines = mergeCart(input.lines, existing?.lines || [], products);
    const wishlist = [...new Set([...input.wishlist, ...(existing?.wishlist || [])])]
      .filter((id) => products.some((p) => p.id === id))
      .slice(0, 500);
    const { error } = await db
      .from('shopping_state')
      .upsert({ user_id: user.id, lines, wishlist, updated_at: new Date().toISOString() });
    if (error) throw error;
    return Response.json({ signedIn: true, userId: user.id, lines, wishlist }, noStore);
  } catch (error) {
    return apiError(error);
  }
}
