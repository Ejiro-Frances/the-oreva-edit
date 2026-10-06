import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

const mockDelete = vi.hoisted(() => vi.fn(async () => 3));
vi.mock('@/features/cart/guest-store', () => ({ deleteStaleGuests: mockDelete }));

import { GET } from '@/app/api/internal/guest-cleanup/route';

const req = (auth?: string) =>
  new Request('http://localhost:3000/api/internal/guest-cleanup', {
    headers: auth ? { Authorization: auth } : {},
  });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('CRON_SECRET', 'cron-secret-value');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T03:30:00.000Z'));
});

afterEach(() => vi.useRealTimers());

describe('guest cleanup cron', () => {
  it('requires the cron secret', async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer wrong-secret-val'))).status).toBe(401);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('deletes guest bags untouched for 30 days', async () => {
    const response = await GET(req('Bearer cron-secret-value'));
    expect(await response.json()).toEqual({ deleted: 3 });
    expect(mockDelete).toHaveBeenCalledWith(new Date('2026-09-06T03:30:00.000Z'));
  });
});
