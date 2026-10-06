import { beforeEach, describe, expect, it, vi } from 'vitest';
import { products } from '@/features/catalogue/fixtures';

beforeEach(() => {
  // The fixture store lives on globalThis, which vi.resetModules() does not reset.
  delete (globalThis as { __orevaGuestBags?: unknown }).__orevaGuestBags;
  vi.resetModules();
  vi.stubEnv('DATA_MODE', 'fixture');
});

const token = 'ef'.repeat(32);
const variant = products.flatMap((p) => p.variants).find((v) => v.stock >= 3)!;

describe('fixture guest store', () => {
  it('keeps a guest bag between requests and applies ops with caps', async () => {
    const { guestStore } = await import('@/features/cart/guest-store');
    const { writeStore } = await import('@/features/cart/state');
    const { applyShoppingOps } = await import('@/features/cart/ops');
    const store = guestStore(token);
    const view = await writeStore(store, products, (s) =>
      applyShoppingOps(s, [{ op: 'add', variantId: variant.id, quantity: 2 }], products),
    );
    expect(view).toMatchObject({ signedIn: false, adjusted: [] });
    expect(view.lines[0]).toMatchObject({ variantId: variant.id, quantity: 2 });
    expect((await guestStore(token).load())?.lines).toEqual([
      { variantId: variant.id, quantity: 2 },
    ]);
    expect(await guestStore('01'.repeat(32)).load()).toBeNull();
  });

  it('refuses a stale conditional update and a duplicate insert', async () => {
    const { guestStore } = await import('@/features/cart/guest-store');
    const store = guestStore(token);
    const values = { lines: [], wishlist: [], updated_at: '2026-10-06T00:00:00.000Z' };
    expect(await store.insert(values)).toBe(true);
    expect(await store.insert(values)).toBe(false);
    expect(await store.update({ ...values, updated_at: 'later' }, 'wrong')).toBe(false);
    expect(await store.update({ ...values, updated_at: 'later' }, values.updated_at)).toBe(true);
    await store.remove();
    expect(await store.load()).toBeNull();
  });

  it('deletes guest bags untouched since a cutoff', async () => {
    const { guestStore, deleteStaleGuests } = await import('@/features/cart/guest-store');
    await guestStore('11'.repeat(32)).insert({
      lines: [],
      wishlist: [],
      updated_at: '2026-08-01T00:00:00.000Z',
    });
    await guestStore('22'.repeat(32)).insert({
      lines: [],
      wishlist: [],
      updated_at: '2026-10-05T00:00:00.000Z',
    });
    expect(await deleteStaleGuests(new Date('2026-09-06T00:00:00.000Z'))).toBe(1);
    expect(await guestStore('11'.repeat(32)).load()).toBeNull();
    expect(await guestStore('22'.repeat(32)).load()).not.toBeNull();
  });
});

describe('conditional guest delete', () => {
  it('keeps a guest change made between the merge read and the delete', async () => {
    const { guestStore } = await import('@/features/cart/guest-store');
    const store = guestStore(token);
    const first = { lines: [], wishlist: [], updated_at: '2026-10-06T00:00:00.000Z' };
    await store.insert(first);
    const read = await store.load();
    const changed = {
      lines: [{ variantId: variant.id, quantity: 1 }],
      wishlist: [],
      updated_at: '2026-10-06T00:00:01.000Z',
    };
    expect(await store.update(changed, first.updated_at)).toBe(true);
    expect(await store.remove(read!.updated_at)).toBe(false);
    expect((await store.load())?.lines).toEqual(changed.lines);
    expect(await store.remove(changed.updated_at)).toBe(true);
    expect(await store.load()).toBeNull();
  });
});
