import { priceRange } from './price';
import type { Product } from './types';

export const catalogueCacheHeaders = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at: number | null;
  image: string | null;
  alt: string;
  audience: string;
  category: string;
  inStock: boolean;
};

export function productSummary(p: Product): ProductSummary {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: priceRange(p).min,
    compare_at: p.compare_at,
    image: p.images[0] ?? null,
    alt: p.alt,
    audience: p.audience,
    category: p.category,
    inStock: p.variants.some((v) => v.stock > 0),
  };
}
