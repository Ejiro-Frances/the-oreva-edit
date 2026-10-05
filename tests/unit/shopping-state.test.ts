import { describe, expect, it } from 'vitest';
import { mergeCart } from '@/features/cart/merge';
import { changeShopping, shoppingView, writeShopping } from '@/features/cart/state';
import { products } from '@/features/catalogue/fixtures';
import { fakeShoppingDb, type FakeRow } from '../support/fake-shopping-db';

const user = 'user-1';
const inStock = products.flatMap((p) => p.variants).filter((v) => v.stock >= 2);
const [a, b] = inStock;
const saved = (lines: FakeRow['lines']): FakeRow => ({
  user_id: user,
  lines,
  wishlist: [],
  updated_at: '2026-10-05T10:00:00.000Z',
});

describe('changeShopping', () => {
  it('creates the row on the first change', async () => {
    const { db, row } = fakeShoppingDb(null);
    const view = await changeShopping(
      db,
      user,
      [{ op: 'add', variantId: a.id, quantity: 1 }],
      products,
    );
    expect(row()?.lines).toEqual([{ variantId: a.id, quantity: 1 }]);
    expect(view.lines[0]).toMatchObject({ variantId: a.id, quantity: 1 });
    expect(view.adjusted).toEqual([]);
  });

  it('keeps a change made on another device between read and write', async () => {
    const { db, row } = fakeShoppingDb(saved([]), (current) => ({
      ...current!,
      lines: [{ variantId: b.id, quantity: 1 }],
      updated_at: '2026-10-05T10:00:01.000Z',
    }));
    await changeShopping(db, user, [{ op: 'add', variantId: a.id, quantity: 1 }], products);
    expect(row()?.lines).toEqual([
      { variantId: b.id, quantity: 1 },
      { variantId: a.id, quantity: 1 },
    ]);
  });

  it('gives up with a conflict after three concurrent writes in a row', async () => {
    let tick = 0;
    const { db, writes } = fakeShoppingDb(
      saved([]),
      (current) => ({ ...current!, updated_at: `2026-10-05T10:00:0${++tick}.000Z` }),
      { every: true },
    );
    await expect(
      changeShopping(db, user, [{ op: 'add', variantId: a.id, quantity: 1 }], products),
    ).rejects.toMatchObject({ status: 409, code: 'cart_conflict' });
    expect(writes()).toBe(3);
  });
});

describe('writeShopping', () => {
  it('keeps another device write when a sign-in merge races it', async () => {
    const { db, row } = fakeShoppingDb(saved([]), (current) => ({
      ...current!,
      lines: [{ variantId: b.id, quantity: 1 }],
      updated_at: '2026-10-05T10:00:01.000Z',
    }));
    await writeShopping(db, user, products, (state) => ({
      lines: mergeCart([{ variantId: a.id, quantity: 1 }], state.lines, products),
      wishlist: state.wishlist,
      adjusted: [],
    }));
    expect(
      row()
        ?.lines.map((l) => l.variantId)
        .sort(),
    ).toEqual([a.id, b.id].sort());
  });
});

describe('shoppingView', () => {
  it('omits sold-out lines and caps saved quantities at stock', () => {
    const soldOut = products.flatMap((p) => p.variants).find((v) => v.stock === 0)!;
    const view = shoppingView(
      saved([
        { variantId: soldOut.id, quantity: 1 },
        { variantId: a.id, quantity: 20 },
      ]),
      products,
    );
    expect(view.lines.map((l) => l.variantId)).toEqual([a.id]);
    expect(view.lines[0].quantity).toBe(Math.min(20, a.stock));
  });
});
