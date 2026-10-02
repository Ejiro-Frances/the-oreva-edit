import { z } from 'zod';
import { requireAdmin } from '@/features/admin/guard';
import { sameOrigin, readJson, apiError, AppError } from '@/lib/security';
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireAdmin();
    const parsed = z
      .object({
        id: z.uuid(),
        status: z.enum(['processing', 'shipped', 'delivered', 'returned']),
        note: z.string().max(2000),
      })
      .safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('Choose a valid status and note');
    const p = parsed.data;
    const { error } = await db.rpc('update_fulfilment', {
      p_order_id: p.id,
      p_status: p.status,
      p_note: p.note,
    });
    if (error)
      throw new AppError(
        'This status change is not available. Refresh the order and check its payment status.',
        409,
      );
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
export async function PATCH(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireAdmin();
    const p = z
      .object({
        id: z.uuid(),
        action: z.enum(['note', 'confirm', 'complete', 'cancel']),
        note: z.string().max(2000),
      })
      .safeParse(await readJson(request));
    if (!p.success) throw new AppError('Check the order action and note');
    const { error } = await db.rpc('manage_order', {
      p_order: p.data.id,
      p_action: p.data.action,
      p_note: p.data.note,
    });
    if (error) throw new AppError('This action is no longer available. Reload the order.', 409);
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
