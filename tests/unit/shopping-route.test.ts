import { beforeEach, describe, expect, it, vi } from 'vitest';
import { products } from '@/features/catalogue/fixtures';
import { fakeShoppingDb } from '../support/fake-shopping-db';

const mocks = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    session: null as unknown,
    values,
    jar: {
      get: vi.fn((name: string) => (values.has(name) ? { value: values.get(name)! } : undefined)),
      set: vi.fn((name: string, value: string) => values.set(name, value)),
    },
    rateLimit: vi.fn(),
  };
});
vi.mock('next/headers', () => ({ cookies: async () => mocks.jar }));
vi.mock('@/lib/supabase/server', () => ({ requestSession: vi.fn(async () => mocks.session) }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: mocks.rateLimit }));

let route: typeof import('@/app/api/shopping/route');
const variant = products.flatMap((p) => p.variants).find((v) => v.stock >= 3)!;
const other = products.flatMap((p) => p.variants).find((v) => v.stock >= 3 && v.id !== variant.id)!;
const appToken = '9a'.repeat(32);

const call = (method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/shopping', {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const signedIn = () => {
  const fake = fakeShoppingDb(null);
  mocks.session = { db: fake.db, user: { id: 'user-1' }, mode: 'bearer' };
  return fake;
};
const add = (variantId: string, quantity = 1) => ({ ops: [{ op: 'add', variantId, quantity }] });

beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv('DATA_MODE', 'fixture');
  vi.clearAllMocks();
  mocks.values.clear();
  mocks.session = null;
  delete (globalThis as { __orevaGuestBags?: unknown }).__orevaGuestBags;
  route = await import('@/app/api/shopping/route');
});

describe('/api/shopping for customers', () => {
  it('applies ops and returns the detailed bag with no-store', async () => {
    const fake = signedIn();
    const response = await route.PATCH(call('PATCH', add(variant.id)));
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body).toMatchObject({ signedIn: true, adjusted: [] });
    expect(fake.row()?.lines).toEqual([{ variantId: variant.id, quantity: 1 }]);
    expect((await (await route.GET(call('GET'))).json()).userId).toBe('user-1');
  });

  it('rejects invalid ops with a 400', async () => {
    signedIn();
    const response = await route.PATCH(
      call('PATCH', { ops: [{ op: 'set', variantId: variant.id, quantity: 0 }] }),
    );
    expect(response.status).toBe(400);
  });
});

describe('/api/shopping for guests', () => {
  it('returns an empty guest bag when there is no identifier, without creating one', async () => {
    const body = await (await route.GET(call('GET'))).json();
    expect(body).toMatchObject({ signedIn: false, lines: [], wishlist: [] });
    expect(mocks.jar.set).not.toHaveBeenCalled();
  });

  it('saves a browser guest bag under a new HttpOnly cookie and reads it back', async () => {
    const saved = await (await route.PATCH(call('PATCH', add(variant.id, 2)))).json();
    expect(saved).toMatchObject({ signedIn: false });
    expect(saved.lines[0]).toMatchObject({ variantId: variant.id, quantity: 2 });
    expect(mocks.values.get('oreva_guest')).toMatch(/^[0-9a-f]{64}$/);
    const read = await (await route.GET(call('GET'))).json();
    expect(read.lines[0]).toMatchObject({ variantId: variant.id, quantity: 2 });
  });

  it('keeps app guests apart by token and never sets a cookie for them', async () => {
    await route.PATCH(call('PATCH', add(variant.id), { 'X-Guest-Token': appToken }));
    const mine = await (
      await route.GET(call('GET', undefined, { 'X-Guest-Token': appToken }))
    ).json();
    const someoneElse = await (
      await route.GET(call('GET', undefined, { 'X-Guest-Token': 'b0'.repeat(32) }))
    ).json();
    expect(mine.lines).toHaveLength(1);
    expect(someoneElse.lines).toEqual([]);
    expect(mocks.jar.set).not.toHaveBeenCalled();
  });

  it('rate-limits guest writes per IP', async () => {
    await route.PATCH(call('PATCH', add(variant.id), { 'X-Forwarded-For': '203.0.113.9' }));
    expect(mocks.rateLimit).toHaveBeenCalledWith('guest-bag:203.0.113.9', 120, 600);
  });

  it('uploads a legacy browser bag into the guest row', async () => {
    const body = await (
      await route.POST(
        call('POST', {
          action: 'merge',
          lines: [{ variantId: variant.id, quantity: 1 }],
          wishlist: [],
        }),
      )
    ).json();
    expect(body).toMatchObject({ signedIn: false });
    expect(body.lines.map((l: { variantId: string }) => l.variantId)).toEqual([variant.id]);
  });
});

describe('signing in with a guest bag', () => {
  it('moves the guest bag into the account once and deletes it', async () => {
    await route.PATCH(call('PATCH', add(variant.id, 2), { 'X-Guest-Token': appToken }));
    const fake = signedIn();
    const merged = await (
      await route.POST(call('POST', { action: 'merge' }, { 'X-Guest-Token': appToken }))
    ).json();
    expect(merged).toMatchObject({ signedIn: true, userId: 'user-1' });
    expect(fake.row()?.lines).toEqual([{ variantId: variant.id, quantity: 2 }]);
    mocks.session = null;
    const guestAfter = await (
      await route.GET(call('GET', undefined, { 'X-Guest-Token': appToken }))
    ).json();
    expect(guestAfter.lines).toEqual([]);
    mocks.session = { db: fake.db, user: { id: 'user-1' }, mode: 'bearer' };
    await route.POST(call('POST', { action: 'merge' }, { 'X-Guest-Token': appToken }));
    expect(fake.row()?.lines).toEqual([{ variantId: variant.id, quantity: 2 }]);
  });

  it('also merges legacy lines sent in the body, keeping the larger quantity', async () => {
    const fake = signedIn();
    await route.POST(
      call('POST', {
        action: 'merge',
        lines: [
          { variantId: variant.id, quantity: 1 },
          { variantId: other.id, quantity: 1 },
        ],
        wishlist: [],
      }),
    );
    expect(fake.row()?.lines).toEqual(
      expect.arrayContaining([
        { variantId: variant.id, quantity: 1 },
        { variantId: other.id, quantity: 1 },
      ]),
    );
  });

  it('no longer accepts whole-bag saves', async () => {
    signedIn();
    expect(
      (await route.POST(call('POST', { action: 'save', lines: [], wishlist: [] }))).status,
    ).toBe(400);
  });
});

describe('guest merge hardening', () => {
  const legacy = { action: 'merge', lines: [{ variantId: variant.id, quantity: 1 }], wishlist: [] };
  const limited = async () => {
    const { AppError } = await import('@/lib/security');
    mocks.rateLimit.mockRejectedValue(new AppError('Too many requests.', 429));
  };

  it('rate-limits guest POST merges that write, per IP', async () => {
    await route.POST(call('POST', legacy, { 'X-Forwarded-For': '203.0.113.9' }));
    expect(mocks.rateLimit).toHaveBeenCalledWith('guest-bag:203.0.113.9', 120, 600);
  });

  it('writes nothing when the limit is hit', async () => {
    await limited();
    const headers = { 'X-Guest-Token': appToken };
    expect((await route.PATCH(call('PATCH', add(variant.id), headers))).status).toBe(429);
    expect((await route.POST(call('POST', legacy, headers))).status).toBe(429);
    mocks.rateLimit.mockResolvedValue(undefined);
    const read = await (await route.GET(call('GET', undefined, headers))).json();
    expect(read.lines).toEqual([]);
    expect(mocks.jar.set).not.toHaveBeenCalled();
  });

  it('does not rate-limit signed-in customers', async () => {
    signedIn();
    await route.PATCH(call('PATCH', add(variant.id)));
    await route.POST(call('POST', legacy));
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it('gives a new guest a cookie on an empty merge without writing a row', async () => {
    const body = await (await route.POST(call('POST', { action: 'merge' }))).json();
    expect(body).toMatchObject({ signedIn: false, lines: [] });
    expect(mocks.values.get('oreva_guest')).toMatch(/^[0-9a-f]{64}$/);
    expect(mocks.jar.set).toHaveBeenCalledWith(
      'oreva_guest',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
    const read = await (await route.GET(call('GET'))).json();
    expect(read.lines).toEqual([]);
    expect(
      (globalThis as { __orevaGuestBags?: Map<string, unknown> }).__orevaGuestBags?.size ?? 0,
    ).toBe(0);
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it('still succeeds when deleting the guest bag fails', async () => {
    vi.resetModules();
    vi.doMock('@/features/cart/guest-store', async () => {
      const actual = await vi.importActual<typeof import('@/features/cart/guest-store')>(
        '@/features/cart/guest-store',
      );
      return {
        ...actual,
        guestStore: (token: string) => ({
          ...actual.guestStore(token),
          remove: async () => {
            throw new Error('db down');
          },
        }),
      };
    });
    const failing = await import('@/app/api/shopping/route');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await failing.PATCH(call('PATCH', add(variant.id, 2), { 'X-Guest-Token': appToken }));
    const fake = signedIn();
    const response = await failing.POST(
      call('POST', { action: 'merge' }, { 'X-Guest-Token': appToken }),
    );
    vi.doUnmock('@/features/cart/guest-store');
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ signedIn: true, userId: 'user-1' });
    expect(fake.row()?.lines).toEqual([{ variantId: variant.id, quantity: 2 }]);
    expect(log).toHaveBeenCalledWith(JSON.stringify({ event: 'guest_bag_delete_failed' }));
    log.mockRestore();
  });
});
