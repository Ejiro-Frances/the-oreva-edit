import type { CartLine, Product } from '@/features/catalogue/types';
export function mergeCart(local: CartLine[], remote: CartLine[], products: Product[]) {
  const merged = new Map<string, number>();
  for (const line of [...remote, ...local])
    merged.set(line.variantId, Math.max(merged.get(line.variantId) || 0, line.quantity));
  return [...merged.entries()]
    .flatMap(([variantId, quantity]) => {
      const v = products.flatMap((p) => p.variants).find((v) => v.id === variantId);
      return v && v.stock > 0 ? [{ variantId, quantity: Math.min(quantity, v.stock, 20) }] : [];
    })
    .slice(0, 50);
}
