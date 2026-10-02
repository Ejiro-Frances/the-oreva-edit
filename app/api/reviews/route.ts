import { z } from 'zod';
import { currentUser, sessionClient } from '@/lib/supabase/server';
import { sameOrigin, readJson, apiError, AppError } from '@/lib/security';
import { rateLimit } from '@/lib/rate-limit';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await currentUser();
    if (!user) throw new AppError('Sign in to leave a review', 401);
    const parsed = z
      .object({
        productId: z.uuid(),
        rating: z.number().int().min(1).max(5),
        title: z.string().trim().min(1).max(120),
        body: z.string().trim().min(10).max(2000),
      })
      .safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message);
    await rateLimit('reviews:' + user.id, 5, 3600);
    const p = parsed.data;
    const { error } = await (await sessionClient())!.rpc('submit_review', {
      p_product: p.productId,
      p_rating: p.rating,
      p_title: p.title,
      p_body: p.body,
    });
    if (error) throw new AppError('The review could not be submitted', 409);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
