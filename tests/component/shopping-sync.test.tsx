// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const live = vi.hoisted(() => ({ onChange: null as null | (() => void), subscribe: vi.fn() }));
vi.mock('@/features/cart/live', () => ({
  subscribeToShopping: async (userId: string, onChange: () => void) => {
    live.subscribe(userId);
    live.onChange = onChange;
    return () => {};
  },
}));

import { ShoppingProvider, useShopping } from '@/features/cart/provider';

const variantId = '00000000-0000-4000-8000-000000000001';
const remote = (quantity: number) => ({
  signedIn: true,
  lines: quantity ? [{ variantId, quantity, product: {}, variant: {} }] : [],
  wishlist: [],
  adjusted: [],
});

function Probe() {
  const { lines, add, ready } = useShopping();
  return (
    <>
      <p>count:{lines.reduce((n, l) => n + l.quantity, 0)}</p>
      <button disabled={!ready} onClick={() => add(variantId, 1, 5)}>
        add
      </button>
    </>
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
const respond = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'POST')
      return respond({ signedIn: true, userId: 'user-1', lines: [], wishlist: [] });
    if (init?.method === 'PATCH') return respond(remote(1));
    return respond(remote(3));
  });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const renderProvider = () =>
  render(
    <ShoppingProvider>
      <Probe />
    </ShoppingProvider>,
  );

describe('signed-in bag sync', () => {
  it('sends an add operation instead of the whole bag', async () => {
    renderProvider();
    await userEvent.click(await screen.findByRole('button', { name: 'add' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/shopping',
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ ops: [{ op: 'add', variantId, quantity: 1 }] }),
        }),
      ),
    );
    expect(screen.getByText('count:1')).toBeInTheDocument();
  });

  it('refetches the bag when another device changes it', async () => {
    renderProvider();
    await waitFor(() => expect(live.subscribe).toHaveBeenCalledWith('user-1'));
    await act(async () => live.onChange!());
    await waitFor(() => expect(screen.getByText('count:3')).toBeInTheDocument());
  });

  it('reverts and explains when the server rejects a change', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'PATCH'
        ? respond({ error: 'nope' }, false)
        : respond({ signedIn: true, userId: 'user-1', lines: [], wishlist: [] }),
    );
    renderProvider();
    await userEvent.click(await screen.findByRole('button', { name: 'add' }));
    await waitFor(() => expect(screen.getByText('count:0')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Your bag could not be updated');
  });
});

describe('guest bag', () => {
  it('stays on the device without operations or a subscription', async () => {
    fetchMock.mockImplementation(() => respond({ signedIn: false }));
    renderProvider();
    await userEvent.click(await screen.findByRole('button', { name: 'add' }));
    expect(screen.getByText('count:1')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
    expect(live.subscribe).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('oreva-bag-v1')!)).toEqual([{ variantId, quantity: 1 }]);
  });
});
