import { describe, expect, it } from 'vitest';
import { applyShoppingOps, shoppingOpsSchema } from '@/features/cart/ops';
import { lineDetails } from '@/features/cart/lines';
import type { Product, Variant } from '@/features/catalogue/types';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const variant = (n: number, stock: number): Variant => ({
  id: id(n),
  sku: `SKU-${n}`,
  attributes: { Size: 'M' },
  price: null,
  stock,
  image: null,
});
const product = (
  n: number,
  variants: Variant[],
  status: Product['status'] = 'active',
): Product => ({
  id: id(1000 + n),
  name: `Piece ${n}`,
  slug: `piece-${n}`,
  description: '',
  short_description: '',
  category: 'Dresses',
  audience: 'women',
  tags: [],
  status,
  price: 1500000,
  compare_at: null,
  images: [`/images/piece-${n}.jpg`],
  alt: `Piece ${n}`,
  variants,
  details: [],
  care: '',
  featured: false,
  created_at: '2026-10-01T00:00:00Z',
  fixture: true,
});
const plenty = variant(1, 30);
const scarce = variant(2, 3);
const soldOut = variant(3, 0);
const archived = variant(4, 10);
const products = [product(1, [plenty, scarce, soldOut]), product(2, [archived], 'archived')];
const empty = { lines: [], wishlist: [] };

describe('applyShoppingOps', () => {
  it('adds, increments, sets and removes lines', () => {
    const added = applyShoppingOps(
      empty,
      [{ op: 'add', variantId: plenty.id, quantity: 2 }],
      products,
    );
    expect(added.lines).toEqual([{ variantId: plenty.id, quantity: 2 }]);
    const more = applyShoppingOps(
      added,
      [{ op: 'add', variantId: plenty.id, quantity: 3 }],
      products,
    );
    expect(more.lines).toEqual([{ variantId: plenty.id, quantity: 5 }]);
    const set = applyShoppingOps(
      more,
      [{ op: 'set', variantId: plenty.id, quantity: 1 }],
      products,
    );
    expect(set.lines).toEqual([{ variantId: plenty.id, quantity: 1 }]);
    const removed = applyShoppingOps(set, [{ op: 'remove', variantId: plenty.id }], products);
    expect(removed.lines).toEqual([]);
    expect(removed.adjusted).toEqual([]);
  });

  it('caps a line at stock and reports it', () => {
    const result = applyShoppingOps(
      empty,
      [{ op: 'add', variantId: scarce.id, quantity: 5 }],
      products,
    );
    expect(result.lines).toEqual([{ variantId: scarce.id, quantity: 3 }]);
    expect(result.adjusted).toEqual([scarce.id]);
  });

  it('caps a line at 20 even with more stock', () => {
    const start = { lines: [{ variantId: plenty.id, quantity: 18 }], wishlist: [] };
    const result = applyShoppingOps(
      start,
      [{ op: 'add', variantId: plenty.id, quantity: 5 }],
      products,
    );
    expect(result.lines).toEqual([{ variantId: plenty.id, quantity: 20 }]);
    expect(result.adjusted).toEqual([plenty.id]);
  });

  it('drops sold-out, archived and unknown variants, including ones already saved', () => {
    const start = { lines: [{ variantId: soldOut.id, quantity: 1 }], wishlist: [] };
    const result = applyShoppingOps(
      start,
      [
        { op: 'add', variantId: archived.id, quantity: 1 },
        { op: 'add', variantId: id(999), quantity: 1 },
      ],
      products,
    );
    expect(result.lines).toEqual([]);
    expect(result.adjusted.sort()).toEqual([soldOut.id, archived.id, id(999)].sort());
  });

  it('keeps at most 50 lines, rejecting the newest', () => {
    const many = Array.from({ length: 51 }, (_, n) => variant(100 + n, 5));
    const catalogue = [product(9, many)];
    const ops = many.map((v) => ({ op: 'add' as const, variantId: v.id, quantity: 1 }));
    const result = applyShoppingOps(empty, ops, catalogue);
    expect(result.lines).toHaveLength(50);
    expect(result.adjusted).toEqual([many[50].id]);
  });

  it('saves and removes wishlist products, ignoring unknown ones', () => {
    const productId = products[0].id;
    const saved = applyShoppingOps(
      empty,
      [
        { op: 'wish', productId },
        { op: 'wish', productId: id(5000) },
      ],
      products,
    );
    expect(saved.wishlist).toEqual([productId]);
    expect(applyShoppingOps(saved, [{ op: 'unwish', productId }], products).wishlist).toEqual([]);
  });
});

describe('shoppingOpsSchema', () => {
  it('rejects quantity 0, unknown ops and empty or oversized batches', () => {
    const bad = [
      { ops: [{ op: 'set', variantId: plenty.id, quantity: 0 }] },
      { ops: [{ op: 'clear' }] },
      { ops: [] },
      { ops: Array.from({ length: 51 }, () => ({ op: 'remove', variantId: plenty.id })) },
    ];
    for (const body of bad) expect(shoppingOpsSchema.safeParse(body).success).toBe(false);
  });
});

describe('lineDetails', () => {
  it('describes in-stock variants in order and omits the rest', () => {
    const lines = lineDetails([scarce.id, soldOut.id, archived.id, plenty.id], products);
    expect(lines.map((l) => l.variantId)).toEqual([scarce.id, plenty.id]);
    expect(lines[0]).toEqual({
      variantId: scarce.id,
      product: {
        id: products[0].id,
        slug: 'piece-1',
        name: 'Piece 1',
        image: '/images/piece-1.jpg',
        alt: 'Piece 1',
        price: 1500000,
      },
      variant: { attributes: { Size: 'M' }, price: null, stock: 3 },
    });
  });
});
