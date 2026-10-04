import { access } from 'node:fs/promises';
import { describe, it, expect } from 'vitest';
import { products, categories, deliveryZones } from '@/features/catalogue/fixtures';
import { filterProducts } from '@/features/catalogue/filter';
import { quoteOrder } from '@/features/checkout/pricing';

describe('expanded development catalogue', () => {
  it('has unique product URLs, variant identities, SKUs and option combinations', () => {
    expect(products).toHaveLength(32);
    expect(new Set(products.map((p) => p.id)).size).toBe(products.length);
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length);
    const variants = products.flatMap((p) => p.variants);
    expect(new Set(variants.map((v) => v.id)).size).toBe(variants.length);
    expect(new Set(variants.map((v) => v.sku)).size).toBe(variants.length);
    for (const product of products) {
      expect(product.fixture).toBe(true);
      expect(categories.some((category) => category.name === product.category)).toBe(true);
      const combinations = product.variants.map((v) =>
        JSON.stringify(Object.entries(v.attributes).sort()),
      );
      expect(new Set(combinations).size).toBe(product.variants.length);
    }
  });
  it('has actual local files for each product and variant photograph', async () => {
    for (const product of products) {
      for (const image of product.images) await access(`public${image}`);
      for (const variant of product.variants) expect(product.images).toContain(variant.image);
    }
  });
  it('finds new products through search and category filters', () => {
    expect(
      filterProducts(products, { q: 'daybreak', category: 'trousers' }).map((p) => p.slug),
    ).toEqual(['daybreak-trousers']);
    expect(filterProducts(products, { audience: 'boys' }).map((p) => p.slug)).toContain(
      'junior-everyday-tee',
    );
    expect(filterProducts(products, { audience: 'girls' }).map((p) => p.slug)).toContain(
      'little-occasion-dress',
    );
    expect(filterProducts(products, { category: 'skirts' }).map((p) => p.slug)).toEqual([
      'daylight-mini-skirt',
    ]);
    expect(
      filterProducts(products, { category: 'shorts', audience: 'men' }).map((p) => p.slug),
    ).toEqual(['weekend-drawstring-shorts', 'washed-denim-shorts']);
  });
  it('charges the chosen length price and retains its colour image', () => {
    const product = products.find((p) => p.slug === 'daybreak-trousers')!;
    const variant = product.variants.find(
      (v) =>
        v.attributes.Colour === 'Olive' &&
        v.attributes.Size === 'M' &&
        v.attributes.Length === 'Long',
    )!;
    const quote = quoteOrder(
      [{ variantId: variant.id, quantity: 2 }],
      products,
      deliveryZones,
      'Lagos',
    );
    expect(quote.subtotal).toBe(6300000);
    expect(quote.lines[0]).toMatchObject({
      price: 3150000,
      image: '/images/daybreak-trousers-olive.webp',
      attributes: { Colour: 'Olive', Size: 'M', Length: 'Long' },
    });
  });
  it('rejects an unavailable colour, size and length combination', () => {
    const product = products.find((p) => p.slug === 'daybreak-trousers')!;
    const variant = product.variants.find(
      (v) =>
        v.attributes.Colour === 'Ink' &&
        v.attributes.Size === 'XL' &&
        v.attributes.Length === 'Long',
    )!;
    expect(() =>
      quoteOrder([{ variantId: variant.id, quantity: 1 }], products, deliveryZones, 'Lagos'),
    ).toThrow('unavailable');
  });
  it('prices jewellery lengths independently and keeps each finish in the order snapshot', () => {
    const bracelet = products.find((p) => p.slug === 'woven-chain-bracelet')!;
    const shortGold = bracelet.variants.find(
      (v) => v.attributes.Colour === 'Gold' && v.attributes.Length === '17 cm',
    )!;
    const longSilver = bracelet.variants.find(
      (v) => v.attributes.Colour === 'Silver' && v.attributes.Length === '21 cm',
    )!;
    const quote = quoteOrder(
      [
        { variantId: shortGold.id, quantity: 1 },
        { variantId: longSilver.id, quantity: 1 },
      ],
      products,
      deliveryZones,
      'Lagos',
    );
    expect(quote.subtotal).toBe(2880000);
    expect(quote.lines).toMatchObject([
      { price: 1350000, image: '/images/woven-bracelet.webp' },
      { price: 1530000, image: '/images/woven-bracelet-silver.webp' },
    ]);
  });
});
