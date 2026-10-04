import { describe, expect, it } from 'vitest';
import { products, categories, deliveryZones } from '@/features/catalogue/fixtures';
import { filterProducts } from '@/features/catalogue/filter';
import {
  categoriesForProducts,
  categoryBranchSlugs,
  navigationProducts,
} from '@/features/catalogue/category-tree';
import { quoteOrder } from '@/features/checkout/pricing';

describe('menswear range and navigation', () => {
  it('covers every requested menswear category with available products', () => {
    const men = navigationProducts(products, categories, 'men');
    expect(men).toHaveLength(12);
    for (const category of [
      'shirts',
      'trousers',
      'caps',
      'sunglasses',
      'boxers',
      'singlets',
      'shorts',
      'jackets',
    ]) {
      const available = filterProducts(men, { category, stock: '1' });
      expect(available.length, category).toBeGreaterThan(0);
      expect(available.every((p) => p.audience === 'men')).toBe(true);
    }
  });
  it('only lists relevant men’s categories and includes accessory parents', () => {
    const menu = categoriesForProducts(
      categories,
      navigationProducts(products, categories, 'men'),
    ).map((c) => c.slug);
    expect(menu).toEqual(
      expect.arrayContaining([
        'shirts',
        'trousers',
        'caps',
        'sunglasses',
        'accessories',
        'boxers',
        'singlets',
        'shorts',
        'jackets',
      ]),
    );
    expect(menu).not.toEqual(expect.arrayContaining(['dresses']));
    expect(menu).not.toContain('kids-clothing');
    const accessories = navigationProducts(products, categories, 'accessories');
    expect(accessories.map((p) => p.slug)).toEqual(
      expect.arrayContaining(['everyday-baseball-cap', 'square-frame-sunglasses']),
    );
    expect(accessories.some((p) => p.category === 'Boxers')).toBe(false);
  });
  it('includes future nested categories and hides branches without active products', () => {
    const hats = categories.find((c) => c.slug === 'caps')!;
    const nested = {
      ...hats,
      id: 'seasonal-caps',
      slug: 'seasonal-caps',
      name: 'Seasonal caps',
      parent_id: hats.id,
    };
    const tree = [...categories, nested];
    expect(categoryBranchSlugs(tree, ['accessories']).has('seasonal-caps')).toBe(true);
    const cap = products.find((p) => p.slug === 'everyday-baseball-cap')!;
    const custom = { ...cap, category: nested.name, category_slug: nested.slug };
    expect(categoriesForProducts(tree, [custom]).map((c) => c.slug)).toEqual([
      'accessories',
      'caps',
      'seasonal-caps',
    ]);
    expect(categoriesForProducts(tree, [{ ...custom, status: 'archived' }])).toEqual([]);
  });
  it('prices a boxer pack as one sellable variant and rejects an unavailable pack size', () => {
    const boxers = products.find((p) => p.slug === 'everyday-boxer-briefs')!;
    const pack = boxers.variants.find(
      (v) => v.attributes.Size === 'M' && v.attributes.Pack === '3 pairs',
    )!;
    const quote = quoteOrder(
      [{ variantId: pack.id, quantity: 2 }],
      products,
      deliveryZones,
      'Lagos',
    );
    expect(quote.subtotal).toBe(4700000);
    expect(quote.lines[0]).toMatchObject({
      price: 2350000,
      quantity: 2,
      attributes: { Colour: 'Blue', Size: 'M', Pack: '3 pairs' },
    });
    const unavailable = boxers.variants.find(
      (v) => v.attributes.Size === 'XXL' && v.attributes.Pack === '3 pairs',
    )!;
    expect(() =>
      quoteOrder([{ variantId: unavailable.id, quantity: 1 }], products, deliveryZones, 'Lagos'),
    ).toThrow('unavailable');
  });
});
