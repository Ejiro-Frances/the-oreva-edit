import { afterEach, describe, expect, it, vi } from 'vitest';

const afterCallbacks: Array<() => Promise<void> | void> = [];
vi.mock('next/server', () => ({
  after: (cb: () => Promise<void> | void) => afterCallbacks.push(cb),
}));

import { processOutbox, emailDeliveryEnabled } from '@/lib/email/outbox';

type Row = Record<string, unknown>;
function fakeDb(options: { claimed: Row[]; order?: Row | null; claimError?: unknown }) {
  const updates: Array<{ id: unknown; values: Row }> = [];
  const db = {
    rpc: vi.fn(async () => ({ data: options.claimed, error: options.claimError ?? null })),
    from: vi.fn((table: string) => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: options.order ?? null, error: null }) }),
      }),
      update: (values: Row) => ({
        eq: async (_column: string, id: unknown) => {
          expect(table).toBe('email_outbox');
          updates.push({ id, values });
          return { error: null };
        },
      }),
    })),
  };
  return { db, updates };
}

const claimed = {
  id: 'email-1',
  order_id: 'order-1',
  kind: 'order_received',
  recipient: 'customer@example.test',
  payload: { number: 'ORE-2026-000001', test: true, total: 2500000, status: 'pending' },
  attempts: 1,
};
const order = {
  number: 'ORE-2026-000001',
  contact: { firstName: 'Ada', city: 'Ikeja', state: 'Lagos', address: '10 Test Street' },
  subtotal: 2000000,
  delivery: 500000,
  total: 2500000,
  created_at: '2026-10-03T10:00:00Z',
  items: [
    {
      name: 'Sade Midi Dress',
      attributes: { Size: 'M' },
      quantity: 1,
      price: 2000000,
      discount: 0,
      image: '/images/a.jpg',
    },
  ],
};

describe('email outbox delivery', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('sends each claimed email with the order details and marks it sent', async () => {
    const { db, updates } = fakeDb({ claimed: [claimed], order });
    const send = vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({
      id: 'mailgun-id',
    }));
    await expect(processOutbox(db as never, send)).resolves.toEqual({ processed: 1, sent: 1 });
    expect(db.rpc).toHaveBeenCalledWith('claim_emails');
    expect(send).toHaveBeenCalledWith(
      'customer@example.test',
      'order_received',
      expect.objectContaining({
        number: 'ORE-2026-000001',
        order: expect.objectContaining({ items: order.items }),
      }),
      'email-1',
    );
    expect(updates).toEqual([
      {
        id: 'email-1',
        values: expect.objectContaining({ status: 'sent', provider_id: 'mailgun-id' }),
      },
    ]);
  });

  it('still sends a summary email if the order details cannot be loaded', async () => {
    const { db } = fakeDb({ claimed: [claimed], order: null });
    const send = vi.fn<(...args: unknown[]) => Promise<{ id: string }>>(async () => ({ id: 'x' }));
    await processOutbox(db as never, send);
    expect(send.mock.calls[0][2]).toMatchObject({ number: 'ORE-2026-000001', order: null });
  });

  it('marks a failed send for retry with backoff instead of throwing', async () => {
    const { db, updates } = fakeDb({ claimed: [claimed], order });
    const send = vi.fn(async () => {
      throw new Error('Email provider rejected delivery');
    });
    const before = Date.now();
    await expect(processOutbox(db as never, send)).resolves.toEqual({ processed: 1, sent: 0 });
    expect(updates[0].values.status).toBe('failed');
    const retryAt = Date.parse(String(updates[0].values.available_at));
    expect(retryAt - before).toBeGreaterThanOrEqual(119_000);
  });

  it('surfaces a claim failure to the caller', async () => {
    const { db } = fakeDb({ claimed: [], claimError: new Error('db down') });
    await expect(processOutbox(db as never, vi.fn())).rejects.toThrow('db down');
  });

  it('only delivers in production when Mailgun is configured', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('EMAIL_MODE', 'capture');
    expect(emailDeliveryEnabled()).toBe(false);
    vi.stubEnv('EMAIL_MODE', 'mailgun');
    expect(emailDeliveryEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv('EMAIL_MODE', 'capture');
    expect(emailDeliveryEnabled()).toBe(true);
  });
});
