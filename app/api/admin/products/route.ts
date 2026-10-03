import { z } from 'zod';
import { requireAdmin } from '@/features/admin/guard';
import { productInputSchema } from '@/lib/validation';
import { sameOrigin, readJson, apiError, AppError } from '@/lib/security';
const schema = z.object({
  id: z.uuid().optional(),
  expectedUpdatedAt: z.string().optional(),
  product: productInputSchema,
  variants: z
    .array(
      z.object({
        id: z.uuid().optional(),
        sku: z.string().trim().min(1).max(80),
        attributes: z
          .record(z.string().min(1).max(40), z.string().min(1).max(80))
          .refine((v) => Object.keys(v).length > 0 && Object.keys(v).length <= 6),
        stock: z.number().int().min(0).max(1000000),
        expectedStock: z.number().int().nonnegative().optional(),
        price: z.number().int().nonnegative().max(1000000000).nullable(),
        active: z.boolean(),
        image: z.string().max(2048).nullable().optional(),
      }),
    )
    .max(200),
});
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { db } = await requireAdmin();
    const parsed = schema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message);
    const p = parsed.data;
    const { data, error } = await db.rpc('save_product', {
      p_id: p.id || null,
      p_data: p.product,
      p_variants: p.variants,
      p_expected: p.expectedUpdatedAt || null,
    });
    if (error)
      throw new AppError(
        error.message.includes('changed')
          ? 'Stock or product details changed while you were editing. Reload before saving.'
          : error.message.includes('publish')
            ? 'Add a photograph and an active variant before publishing.'
            : error.message.includes('variant_image_product')
              ? 'Choose a photograph uploaded to this product. Reload if it was removed.'
              : 'Check for duplicate SKU, slug or variant options and try again.',
        409,
      );
    return Response.json({ id: data });
  } catch (error) {
    return apiError(error);
  }
}
