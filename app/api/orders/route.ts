import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { orderRequestSchema } from '@/lib/validation';
import { sameOrigin, readJson, apiError, AppError, tokenHash } from '@/lib/security';
import { isFixture } from '@/lib/config';
import { currentUser, privilegedClient } from '@/lib/supabase/server';
import { createFixtureOrder } from '@/features/orders/fixture-store';
import { rateLimit } from '@/lib/rate-limit';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    if (process.env.ALLOW_TEST_ORDERS !== 'true' && process.env.NODE_ENV === 'production')
      throw new AppError('Checkout is not accepting orders yet', 503);
    const input = orderRequestSchema.safeParse(await readJson(request));
    if (!input.success)
      throw new AppError(input.error.issues[0]?.message || 'Check your checkout details');
    const jar = await cookies();
    const guest = jar.get('oreva_guest')?.value || randomBytes(32).toString('hex');
    jar.set('oreva_guest', guest, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 2592000,
    });
    const hash = tokenHash(guest);
    await rateLimit('checkout:' + hash, 10, 600);
    const user = await currentUser();
    let number: string;
    if (isFixture()) {
      const order = await createFixtureOrder(input.data, hash, user?.id || null);
      number = order.number;
    } else {
      const { data, error } = await privilegedClient().rpc('create_test_order', {
        p_items: input.data.items,
        p_contact: input.data.contact,
        p_key: input.data.idempotencyKey,
        p_guest_hash: hash,
        p_user_id: user?.id || null,
      });
      if (error)
        throw new AppError(
          error.message.includes('stock')
            ? 'One of your pieces is no longer available. Update your bag.'
            : 'We could not create this order. Check delivery availability and try again.',
          409,
        );
      number = data;
    }
    return Response.json({ number }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return apiError(error);
  }
}
