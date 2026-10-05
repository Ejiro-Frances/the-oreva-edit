import { z } from 'zod';
import { getCategories, getProducts } from '@/features/catalogue/repository';
import { filterProducts } from '@/features/catalogue/filter';
import { categoryBranchSlugs, productCategorySlug } from '@/features/catalogue/category-tree';
import { catalogueCacheHeaders, productSummary } from '@/features/catalogue/summary';
import { apiError, AppError } from '@/lib/security';

const slug = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
);
const query = z.object({
  audience: slug,
  category: slug,
  page: z.coerce.number().int().min(1).max(100).default(1),
});
const pageSize = 12;

export async function GET(request: Request) {
  try {
    const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new AppError('Check the catalogue filters', 400);
    const { audience, category, page } = parsed.data;
    let source = await getProducts();
    if (audience) source = filterProducts(source, { audience });
    if (category) {
      const slugs = categoryBranchSlugs(await getCategories(), [category]);
      source = source.filter((p) => slugs.has(productCategorySlug(p)));
    }
    const all = filterProducts(source, {});
    return Response.json(
      {
        products: all.slice((page - 1) * pageSize, page * pageSize).map(productSummary),
        page,
        pageSize,
        total: all.length,
      },
      { headers: catalogueCacheHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}
