import type { MetadataRoute } from 'next';
import { getProducts, getCategories } from '@/features/catalogue/repository';
import { siteUrl, isFixture } from '@/lib/config';
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isFixture()) return [];
  const [products, categories] = await Promise.all([getProducts(), getCategories()]);
  return [
    ...[
      '',
      '/shop',
      '/women',
      '/men',
      '/kids',
      '/new-in',
      '/about',
      '/contact',
      '/delivery',
      '/returns',
    ],
    ...categories.map((c) => `/${c.slug}`),
    ...products.map((p) => `/products/${p.slug}`),
  ].map((path) => ({ url: siteUrl + path }));
}
