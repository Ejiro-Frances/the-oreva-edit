import { priceRange } from './price';
import type { Product } from './types';
export type CatalogueFilters = {
  q?: string;
  category?: string;
  audience?: string;
  size?: string;
  colour?: string;
  max?: string;
  stock?: string;
  sort?: string;
  collection?: string;
  sale?: string;
};
export function filterProducts(products: Product[], filters: CatalogueFilters) {
  const terms = (filters.q || '').toLowerCase().trim().split(/\s+/).filter(Boolean);
  const result = products.filter((p) => {
    const text =
      `${p.name} ${p.category} ${p.tags.join(' ')} ${p.short_description} ${p.description}`.toLowerCase();
    return (
      p.status === 'active' &&
      terms.every((t) => text.includes(t)) &&
      (!filters.category ||
        (p.category_slug || p.category.toLowerCase().replaceAll(' ', '-')) === filters.category) &&
      (!filters.audience ||
        (filters.audience === 'kids'
          ? ['girls', 'boys', 'babies'].includes(p.audience)
          : p.audience === filters.audience)) &&
      (!filters.collection || p.tags.includes(filters.collection)) &&
      (!filters.sale || (p.compare_at !== null && p.compare_at > priceRange(p).min)) &&
      (!filters.max || priceRange(p).min <= Number(filters.max) * 100) &&
      p.variants.some(
        (v) =>
          (!filters.size || v.attributes.Size === filters.size) &&
          (!filters.colour || v.attributes.Colour === filters.colour) &&
          (!filters.stock || v.stock > 0),
      )
    );
  });
  if (filters.sort === 'best-selling') return result;
  return result.sort((a, b) =>
    filters.sort === 'price-asc'
      ? priceRange(a).min - priceRange(b).min
      : filters.sort === 'price-desc'
        ? priceRange(b).min - priceRange(a).min
        : filters.sort === 'newest'
          ? b.created_at.localeCompare(a.created_at)
          : Number(b.featured) - Number(a.featured),
  );
}
