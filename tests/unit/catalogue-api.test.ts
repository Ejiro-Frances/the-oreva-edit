import { beforeAll, describe, expect, it, vi } from 'vitest';
import { products } from '@/features/catalogue/fixtures';

let categoriesRoute: typeof import('@/app/api/catalogue/categories/route');
let productsRoute: typeof import('@/app/api/catalogue/products/route');
let productRoute: typeof import('@/app/api/catalogue/products/[slug]/route');
let variantsRoute: typeof import('@/app/api/catalogue/variants/route');
beforeAll(async () => {
  vi.stubEnv('DATA_MODE', 'fixture');
  categoriesRoute = await import('@/app/api/catalogue/categories/route');
  productsRoute = await import('@/app/api/catalogue/products/route');
  productRoute = await import('@/app/api/catalogue/products/[slug]/route');
  variantsRoute = await import('@/app/api/catalogue/variants/route');
});

const get = (path: string) => new Request(`http://localhost:3000${path}`);
const list = async (query: string) => {
  const response = await productsRoute.GET(get(`/api/catalogue/products${query}`));
  return { status: response.status, body: await response.json() };
};

describe('catalogue API', () => {
  it('lists active categories with public caching', async () => {
    const response = await categoriesRoute.GET();
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=300',
    );
    const { categories } = await response.json();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c: { active: boolean }) => c.active)).toBe(true);
  });

  it('pages the men’s range as summaries', async () => {
    const { body } = await list('?audience=men');
    expect(body).toMatchObject({ page: 1, pageSize: 12, total: 12 });
    expect(Object.keys(body.products[0]).sort()).toEqual(
      [
        'alt',
        'audience',
        'category',
        'compare_at',
        'id',
        'image',
        'inStock',
        'name',
        'price',
        'slug',
      ].sort(),
    );
  });

  it('includes child categories in a parent category', async () => {
    const caps = await list('?category=caps');
    const accessories = await list('?category=accessories');
    expect(caps.body.total).toBeGreaterThan(0);
    expect(accessories.body.total).toBeGreaterThan(caps.body.total);
  });

  it('treats empty filters as absent and unknown ones as empty', async () => {
    expect((await list('?audience=&category=')).body.total).toBe(
      products.filter((p) => p.status === 'active').length,
    );
    expect((await list('?audience=aliens')).body).toMatchObject({ total: 0, products: [] });
  });

  it.each(['?page=0', '?page=abc', '?page=101', '?category=DROP%20TABLE'])(
    'rejects %s',
    async (query) => {
      expect((await list(query)).status).toBe(400);
    },
  );

  it('returns one product with variants, or 404', async () => {
    const found = await productRoute.GET(get('/api/catalogue/products/everyday-boxer-briefs'), {
      params: Promise.resolve({ slug: 'everyday-boxer-briefs' }),
    });
    expect(found.status).toBe(200);
    expect((await found.json()).product.variants.length).toBeGreaterThan(0);
    const missing = await productRoute.GET(get('/api/catalogue/products/nope'), {
      params: Promise.resolve({ slug: 'nope' }),
    });
    expect(missing.status).toBe(404);
  });

  it('describes variants by ID for a guest bag', async () => {
    const all = products.flatMap((p) => p.variants);
    const inStock = all.find((v) => v.stock > 0)!;
    const soldOut = all.find((v) => v.stock === 0)!;
    const response = await variantsRoute.GET(
      get(`/api/catalogue/variants?ids=${inStock.id},${soldOut.id}`),
    );
    const { lines } = await response.json();
    expect(lines.map((l: { variantId: string }) => l.variantId)).toEqual([inStock.id]);
    const bad = await variantsRoute.GET(get('/api/catalogue/variants?ids=not-a-uuid'));
    expect(bad.status).toBe(400);
  });
});
