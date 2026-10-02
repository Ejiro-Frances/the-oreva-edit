import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/features/admin/guard';
import { sameOrigin, readJson, apiError, AppError } from '@/lib/security';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireAdmin();
    const p = z
      .object({ id: z.uuid(), products: z.array(z.uuid()).max(500) })
      .safeParse(await readJson(request));
    if (!p.success) throw new AppError('Choose valid collection pieces');
    const { error } = await db.rpc('set_collection_products', {
      p_collection: p.data.id,
      p_products: p.data.products,
    });
    if (error) throw new AppError('Could not update this collection', 409);
    revalidatePath('/', 'layout');
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
