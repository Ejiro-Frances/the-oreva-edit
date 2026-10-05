import type { Product } from '@/features/catalogue/types';

export type LineDetail = {
  variantId: string;
  product: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    alt: string;
    price: number;
  };
  variant: { attributes: Record<string, string>; price: number | null; stock: number };
};

/** Everything a bag needs to display a variant; unknown, archived and sold-out variants are left out. */
export function lineDetails(variantIds: string[], products: Product[]): LineDetail[] {
  const index = new Map(
    products
      .filter((p) => p.status === 'active')
      .flatMap((p) => p.variants.map((v) => [v.id, { p, v }] as const)),
  );
  return variantIds.flatMap((variantId) => {
    const hit = index.get(variantId);
    if (!hit || hit.v.stock <= 0) return [];
    const { p, v } = hit;
    return [
      {
        variantId,
        product: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          image: v.image ?? p.images[0] ?? null,
          alt: p.alt,
          price: p.price,
        },
        variant: { attributes: v.attributes, price: v.price, stock: v.stock },
      },
    ];
  });
}
