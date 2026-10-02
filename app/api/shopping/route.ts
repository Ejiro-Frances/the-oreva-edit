import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { cartSchema } from '@/lib/validation';
import { sessionClient } from '@/lib/supabase/server';
import { sameOrigin, readJson, apiError, AppError } from '@/lib/security';
import { mergeCart } from '@/features/cart/merge';
import { getProducts } from '@/features/catalogue/repository';
const schema = z.object({
  action: z.enum(['merge', 'save']),
  lines: cartSchema,
  wishlist: z.array(z.uuid()).max(500),
});
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('Your shopping list needs to be refreshed');
    const jar = await cookies();
    if (!jar.get('oreva_guest'))
      jar.set('oreva_guest', randomBytes(32).toString('hex'), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 2592000,
        path: '/',
      });
    const db = await sessionClient();
    if (!db) return Response.json({ signedIn: false });
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return Response.json({ signedIn: false });
    const input = parsed.data;
    const { data: existing, error } = await db
      .from('shopping_state')
      .select('lines,wishlist')
      .eq('user_id', user.id)
      .maybeSingle();
    if (error) throw error;
    const products = await getProducts();
    const lines = mergeCart(
      input.lines,
      input.action === 'merge' ? existing?.lines || [] : [],
      products,
    );
    const wishlist = [
      ...new Set([
        ...input.wishlist,
        ...(input.action === 'merge' ? existing?.wishlist || [] : []),
      ]),
    ]
      .filter((id) => products.some((p) => p.id === id))
      .slice(0, 500);
    const { error: saveError } = await db
      .from('shopping_state')
      .upsert({ user_id: user.id, lines, wishlist, updated_at: new Date().toISOString() });
    if (saveError) throw saveError;
    return Response.json({ signedIn: true, lines, wishlist });
  } catch (error) {
    return apiError(error);
  }
}
