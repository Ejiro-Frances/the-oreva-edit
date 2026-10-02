import type { Product } from './types';
export function priceRange(product: Pick<Product, 'price' | 'variants'>) {
  const amounts = product.variants.map((variant) => variant.price ?? product.price);
  return {
    min: amounts.length ? Math.min(...amounts) : product.price,
    max: amounts.length ? Math.max(...amounts) : product.price,
  };
}
