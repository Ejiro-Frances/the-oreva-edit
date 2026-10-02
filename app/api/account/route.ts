import { z } from 'zod';
import { addressSchema } from '@/lib/validation';
import { sessionClient } from '@/lib/supabase/server';
import { sameOrigin, readJson, apiError, AppError } from '@/lib/security';
const schema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('profile'),
    display_name: z.string().trim().min(1).max(120),
    phone: z.union([addressSchema.shape.phone, z.literal('')]),
  }),
  z.object({
    action: z.literal('address'),
    label: z.string().trim().min(1).max(60),
    details: addressSchema,
  }),
  z.object({ action: z.literal('remove-address'), id: z.uuid() }),
]);
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const db = await sessionClient();
    const user = db ? (await db.auth.getUser()).data.user : null;
    if (!user || !db) throw new AppError('Please sign in to continue', 401);
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message);
    const p = parsed.data;
    const result =
      p.action === 'profile'
        ? await db
            .from('profiles')
            .update({
              display_name: p.display_name,
              phone: p.phone,
              updated_at: new Date().toISOString(),
            })
            .eq('id', user.id)
        : p.action === 'address'
          ? await db
              .from('addresses')
              .insert({ user_id: user.id, label: p.label, details: p.details })
          : await db.from('addresses').delete().eq('id', p.id).eq('user_id', user.id);
    if (result.error) throw result.error;
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
