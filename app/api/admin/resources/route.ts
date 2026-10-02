import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/features/admin/guard';
import { sameOrigin, readJson, apiError, AppError } from '@/lib/security';
import { states } from '@/lib/config';
const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(120);
const schemas: Record<string, z.ZodType> = {
  categories: z.object({
    name: z.string().trim().min(1).max(100),
    slug,
    parent_id: z.uuid().nullable(),
    position: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .transform((v) => v || 0),
    active: z.boolean(),
  }),
  delivery: z
    .object({
      name: z.string().min(1).max(100),
      states: z.array(z.enum(states)).min(1).max(37),
      rate: z.number().int().nonnegative(),
      free_threshold: z.number().int().nonnegative().nullable(),
      min_days: z.number().int().nonnegative(),
      max_days: z.number().int().nonnegative(),
      active: z.boolean(),
    })
    .refine((x) => x.max_days >= x.min_days, {
      message: 'Maximum days must be at least minimum days',
    }),
  collections: z.object({
    name: z.string().min(1).max(100),
    slug,
    description: z.string().max(1000),
    position: z
      .number()
      .int()
      .nonnegative()
      .nullable()
      .transform((v) => v || 0),
    active: z.boolean(),
  }),
  reviews: z.object({ status: z.enum(['pending', 'published', 'hidden']) }),
  site: z.object({ announcement: z.string().max(150), featured_collection: slug }),
};
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireAdmin();
    const input = z
      .object({ resource: z.string(), id: z.uuid().optional(), data: z.unknown() })
      .parse(await readJson(request));
    const schema = schemas[input.resource];
    if (!schema) throw new AppError('Unknown resource');
    const parsed = schema.safeParse(input.data);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message);
    const payload = parsed.data as Record<string, unknown>;
    let error;
    if (input.resource === 'site') {
      ({ error } = await db.from('site_settings').upsert(
        Object.entries(payload).map(([key, value]) => ({
          key,
          value,
          updated_at: new Date().toISOString(),
        })),
      ));
    } else {
      const tables: Record<string, string> = {
        categories: 'categories',
        delivery: 'delivery_zones',
        collections: 'collections',
        reviews: 'reviews',
      };
      if (input.resource === 'reviews' && !input.id) throw new AppError('Review id required');
      if (input.resource === 'delivery' && payload.active) {
        const { data: other } = await db
          .from('delivery_zones')
          .select('id,states')
          .eq('active', true);
        if (
          other?.some(
            (z) =>
              z.id !== input.id && (payload.states as string[]).some((s) => z.states.includes(s)),
          )
        )
          throw new AppError('An active zone already covers one of these states');
      }
      ({ error } = input.id
        ? await db.from(tables[input.resource]).update(payload).eq('id', input.id)
        : await db.from(tables[input.resource]).insert(payload));
    }
    if (error)
      throw new AppError(
        'Could not save. Check unique names, slugs and parent relationships.',
        409,
      );
    revalidatePath('/', 'layout');
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
