import { beforeEach, describe, expect, it, vi } from 'vitest';
import { products } from '@/features/catalogue/fixtures';
import { fakeShoppingDb } from '../support/fake-shopping-db';

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  jar: { get: vi.fn(() => undefined), set: vi.fn() },
}));
vi.mock('next/headers', () => ({ cookies: async () => mocks.jar }));
vi.mock('@/lib/supabase/server', () => ({ requestSession: vi.fn(async () => mocks.session) }));

import { GET, PATCH, POST } from '@/app/api/shopping/route';

const variant = products.flatMap((p) => p.variants).find((v) => v.stock >= 2)!;
const call = (method: string, body?: unknown) =>
  new Request('http://localhost:3000/api/shopping', {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer a.b.c' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const signedIn = (initial = null) => {
  const fake = fakeShoppingDb(initial);
  mocks.session = { db: fake.db, user: { id: 'user-1' }, mode: 'bearer' };
  return fake;
};

beforeEach(() => {
  vi.stubEnv('DATA_MODE', 'fixture');
  vi.clearAllMocks();
  mocks.session = null;
});

describe('/api/shopping', () => {
  it('reports a guest when there is no session (including fixture mode)', async () => {
    const response = await GET(call('GET'));
    expect(await response.json()).toEqual({ signedIn: false });
    expect(
      (await PATCH(call('PATCH', { ops: [{ op: 'remove', variantId: variant.id }] }))).status,
    ).toBe(401);
  });

  it('applies ops and returns the detailed bag', async () => {
    const fake = signedIn();
    const response = await PATCH(
      call('PATCH', { ops: [{ op: 'add', variantId: variant.id, quantity: 1 }] }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const body = await response.json();
    expect(body.lines[0]).toMatchObject({ variantId: variant.id, quantity: 1 });
    expect(body.adjusted).toEqual([]);
    expect(fake.row()?.lines).toEqual([{ variantId: variant.id, quantity: 1 }]);
    const read = await (await GET(call('GET'))).json();
    expect(read.lines[0].product.slug).toBeTruthy();
  });

  it('rejects invalid ops with a 400', async () => {
    signedIn();
    const response = await PATCH(
      call('PATCH', { ops: [{ op: 'set', variantId: variant.id, quantity: 0 }] }),
    );
    expect(response.status).toBe(400);
  });

  it('merges a guest bag for a bearer session without setting the guest cookie', async () => {
    signedIn();
    const response = await POST(
      call('POST', {
        action: 'merge',
        lines: [{ variantId: variant.id, quantity: 1 }],
        wishlist: [],
      }),
    );
    const body = await response.json();
    expect(body).toMatchObject({ signedIn: true, userId: 'user-1' });
    expect(body.lines).toEqual([{ variantId: variant.id, quantity: 1 }]);
    expect(mocks.jar.set).not.toHaveBeenCalled();
  });

  it('no longer accepts whole-bag saves', async () => {
    signedIn();
    const response = await POST(call('POST', { action: 'save', lines: [], wishlist: [] }));
    expect(response.status).toBe(400);
  });
});
