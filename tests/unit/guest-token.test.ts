import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockJar = vi.hoisted(() => {
  const values = new Map<string, string>();
  return {
    values,
    get: vi.fn((name: string) => (values.has(name) ? { value: values.get(name)! } : undefined)),
    set: vi.fn((name: string, value: string) => values.set(name, value)),
  };
});
vi.mock('next/headers', () => ({ cookies: async () => mockJar }));

import { guestToken } from '@/features/cart/guest-token';
import { guestHeaderToken } from '@/lib/security';

const token = 'ab'.repeat(32);
const request = (headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/shopping', { headers });

beforeEach(() => {
  mockJar.values.clear();
  vi.clearAllMocks();
});

describe('guestHeaderToken', () => {
  it('accepts only 64 lowercase hex characters', () => {
    expect(guestHeaderToken(request({ 'X-Guest-Token': token }))).toBe(token);
    for (const bad of ['', 'abc', 'G'.repeat(64), token.toUpperCase(), `${token}0`])
      expect(guestHeaderToken(request({ 'X-Guest-Token': bad }))).toBeNull();
    expect(guestHeaderToken(request())).toBeNull();
  });
});

describe('guestToken', () => {
  it('prefers a valid header and never sets a cookie for it', async () => {
    expect(await guestToken(request({ 'X-Guest-Token': token }), { create: true })).toBe(token);
    expect(mockJar.set).not.toHaveBeenCalled();
  });

  it('reads an existing cookie and refreshes it when creating', async () => {
    mockJar.values.set('oreva_guest', token);
    expect(await guestToken(request(), { create: false })).toBe(token);
    expect(mockJar.set).not.toHaveBeenCalled();
    expect(await guestToken(request(), { create: true })).toBe(token);
    expect(mockJar.set).toHaveBeenCalledWith(
      'oreva_guest',
      token,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 2592000, path: '/' }),
    );
  });

  it('creates a new random cookie only when asked', async () => {
    expect(await guestToken(request(), { create: false })).toBeNull();
    const created = await guestToken(request(), { create: true });
    expect(created).toMatch(/^[0-9a-f]{64}$/);
    expect(mockJar.values.get('oreva_guest')).toBe(created);
  });

  it('replaces a malformed cookie instead of trusting it', async () => {
    mockJar.values.set('oreva_guest', 'not-a-token');
    expect(await guestToken(request(), { create: false })).toBeNull();
    expect(await guestToken(request(), { create: true })).toMatch(/^[0-9a-f]{64}$/);
  });
});
