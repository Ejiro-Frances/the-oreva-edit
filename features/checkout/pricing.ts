import type { CartLine, Product, DeliveryZone } from '@/features/catalogue/types';
import { calculateTotals } from '@/lib/money';
export function quoteOrder(
  items: CartLine[],
  products: Product[],
  zones: DeliveryZone[],
  state: string,
) {
  if (!items.length) throw new Error('Your bag is empty');
  const seen = new Set<string>();
  const lines = items.map((item) => {
    if (seen.has(item.variantId)) throw new Error('Duplicate variant');
    seen.add(item.variantId);
    const product = products.find(
      (p) => p.status === 'active' && p.variants.some((v) => v.id === item.variantId),
    );
    const variant = product?.variants.find((v) => v.id === item.variantId);
    if (!product || !variant) throw new Error('A piece is no longer available');
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 20 ||
      variant.stock < item.quantity
    )
      throw new Error(`The selected quantity of ${product.name} is unavailable`);
    return {
      variant_id: variant.id,
      product_id: product.id,
      name: product.name,
      sku: variant.sku,
      attributes: variant.attributes,
      image: product.images[0],
      price: variant.price ?? product.price,
      quantity: item.quantity,
      discount: 0,
    };
  });
  const subtotal = calculateTotals(lines).subtotal;
  const zone = zones.find((z) => z.active && z.states.includes(state));
  if (!zone) throw new Error('Delivery is not available for this state yet');
  const delivery = zone.free_threshold !== null && subtotal >= zone.free_threshold ? 0 : zone.rate;
  return { lines, zone, ...calculateTotals(lines, delivery) };
}
