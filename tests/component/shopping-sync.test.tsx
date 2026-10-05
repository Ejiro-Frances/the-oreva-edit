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
const otherId = '00000000-0000-4000-8000-000000000002';
const productId = '00000000-0000-4000-8000-000000000009';
const remote = (quantity: number, wishlist: string[] = []) => ({
  signedIn: true,
  lines: quantity ? [{ variantId, quantity, product: {}, variant: {} }] : [],
  wishlist,
  adjusted: [],
});

function Probe() {
  const { lines, wishlist, add, update, clear, toggle, ready } = useShopping();
  return (
    <>
      <p>count:{lines.reduce((n, l) => n + l.quantity, 0)}</p>
      <p>saved:{wishlist.length}</p>
      <button disabled={!ready} onClick={() => add(variantId, 1, 5)}>
        add
      </button>
      <button disabled={!ready} onClick={() => update(variantId, 4)}>
        set
      </button>
      <button disabled={!ready} onClick={() => update(variantId, 0)}>
        remove
      </button>
      <button disabled={!ready} onClick={clear}>
        clear
      </button>
      <button disabled={!ready} onClick={() => toggle(productId)}>
        wish
      </button>
    </>
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
const respond = (body: unknown, ok = true, status = ok ? 200 : 500) =>
  Promise.resolve({ ok, status, json: () => Promise.resolve(body) } as Response);
const signedIn = (lines: unknown[] = [], wishlist: string[] = []) =>
  respond({ signedIn: true, userId: 'user-1', lines, wishlist });
const calls = (method?: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === method);
const body = (call: unknown[]) => JSON.parse((call[1] as RequestInit).body as string);
/** A response the test resolves later, to control the order replies arrive in. */
function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((r) => (resolve = r));
  return {
    promise,
    reply: (data: unknown) =>
      resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response),
  };
}

beforeEach(() => {
  localStorage.clear();
  fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return signedIn();
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
const click = async (name: string) => userEvent.click(await screen.findByRole('button', { name }));

describe('signed-in bag sync', () => {
  it('sends an add operation instead of the whole bag', async () => {
    renderProvider();
    await click('add');
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

  it('sends set, remove, clear and wishlist operations', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return signedIn([
          { variantId, quantity: 1 },
          { variantId: otherId, quantity: 2 },
        ]);
      if (init?.method === 'PATCH') {
        const { ops } = JSON.parse(init.body as string);
        if (ops[0].op === 'wish') return respond(remote(0, [productId]));
        if (ops[0].op === 'unwish') return respond(remote(0));
        // Unanswered, so each change keeps the optimistic bag the next one builds on.
        return new Promise<Response>(() => {});
      }
      return respond(remote(0));
    });
    renderProvider();
    await screen.findByText('count:3');
    await click('set');
    await click('remove');
    await click('clear');
    await click('wish');
    await waitFor(() => expect(calls('PATCH')).toHaveLength(4));
    expect(calls('PATCH').map(body)).toEqual([
      { ops: [{ op: 'set', variantId, quantity: 4 }] },
      { ops: [{ op: 'remove', variantId }] },
      { ops: [{ op: 'remove', variantId: otherId }] },
      { ops: [{ op: 'wish', productId }] },
    ]);
    await waitFor(() => expect(screen.getByText('saved:1')).toBeInTheDocument());
    await click('wish');
    await waitFor(() => expect(calls('PATCH')).toHaveLength(5));
    expect(body(calls('PATCH')[4])).toEqual({ ops: [{ op: 'unwish', productId }] });
  });

  it('refetches the bag when another device changes it', async () => {
    renderProvider();
    await waitFor(() => expect(live.subscribe).toHaveBeenCalledWith('user-1'));
    await act(async () => live.onChange!());
    await waitFor(() => expect(screen.getByText('count:3')).toBeInTheDocument());
  });

  it('refetches the bag when the tab becomes visible again', async () => {
    renderProvider();
    await waitFor(() => expect(live.subscribe).toHaveBeenCalledWith('user-1'));
    await act(async () => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(screen.getByText('count:3')).toBeInTheDocument());
    expect(calls(undefined)).toHaveLength(1);
  });

  it('ignores an older reply that arrives after a newer one', async () => {
    const first = deferred();
    const second = deferred();
    const replies = [first, second];
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return signedIn();
      if (init?.method === 'PATCH') return replies.shift()!.promise;
      return respond(remote(3));
    });
    renderProvider();
    await click('add');
    await click('add');
    await waitFor(() => expect(calls('PATCH')).toHaveLength(2));
    await act(async () => second.reply(remote(2)));
    await waitFor(() => expect(screen.getByText('count:2')).toBeInTheDocument());
    await act(async () => first.reply(remote(1)));
    expect(screen.getByText('count:2')).toBeInTheDocument();
  });

  it('shows the account bag when the server rejects a change', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return signedIn();
      if (init?.method === 'PATCH') return respond({ error: 'nope' }, false);
      return respond(remote(3));
    });
    renderProvider();
    await click('add');
    await waitFor(() => expect(screen.getByText('count:3')).toBeInTheDocument());
    expect(calls(undefined)).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Your bag could not be updated');
  });

  it('restores the earlier bag when neither the change nor a refresh succeeds', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? signedIn() : Promise.reject(new TypeError('offline')),
    );
    renderProvider();
    await click('add');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Your bag could not be updated'),
    );
    await waitFor(() => expect(calls(undefined)).toHaveLength(1));
    await waitFor(() => expect(screen.getByText('count:0')).toBeInTheDocument());
  });

  it('keeps the bag on the device and stops syncing when the session has ended', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return signedIn();
      if (init?.method === 'PATCH') return respond({ error: 'Please sign in' }, false, 401);
      return respond(remote(3));
    });
    renderProvider();
    await click('add');
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'You were signed out. Your bag is saved on this device.',
      ),
    );
    expect(screen.getByText('count:1')).toBeInTheDocument();
    expect(localStorage.getItem('oreva-bag-owner')).toBeNull();
    await click('add');
    expect(screen.getByText('count:2')).toBeInTheDocument();
    expect(calls('PATCH')).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem('oreva-bag-v1')!)).toEqual([{ variantId, quantity: 2 }]);
  });
});

describe('restoring the bag on page load', () => {
  it('lets the account win over a stored copy of that account’s bag', async () => {
    localStorage.setItem('oreva-bag-v1', JSON.stringify([{ variantId, quantity: 2 }]));
    localStorage.setItem('oreva-wishlist-v1', JSON.stringify([productId]));
    localStorage.setItem('oreva-bag-owner', 'user-1');
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? signedIn([{ variantId, quantity: 1 }]) : respond(remote(1)),
    );
    renderProvider();
    await screen.findByText('count:1');
    expect(body(calls('POST')[0])).toEqual({ action: 'merge', lines: [], wishlist: [] });
    expect(screen.getByText('saved:0')).toBeInTheDocument();
  });

  it('merges a guest bag and marks the stored bag as the account’s', async () => {
    localStorage.setItem('oreva-bag-v1', JSON.stringify([{ variantId, quantity: 2 }]));
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST' ? signedIn([{ variantId, quantity: 2 }]) : respond(remote(2)),
    );
    renderProvider();
    await screen.findByText('count:2');
    expect(body(calls('POST')[0])).toEqual({
      action: 'merge',
      lines: [{ variantId, quantity: 2 }],
      wishlist: [],
    });
    await waitFor(() => expect(localStorage.getItem('oreva-bag-owner')).toBe('user-1'));
  });

  it('turns the stored copy into a guest bag after sign-out', async () => {
    localStorage.setItem('oreva-bag-v1', JSON.stringify([{ variantId, quantity: 2 }]));
    localStorage.setItem('oreva-bag-owner', 'user-1');
    fetchMock.mockImplementation(() => respond({ signedIn: false }));
    renderProvider();
    await screen.findByText('count:2');
    expect(localStorage.getItem('oreva-bag-owner')).toBeNull();
    expect(JSON.parse(localStorage.getItem('oreva-bag-v1')!)).toEqual([{ variantId, quantity: 2 }]);
  });

  it('shows the stored copy while offline', async () => {
    localStorage.setItem('oreva-bag-v1', JSON.stringify([{ variantId, quantity: 2 }]));
    localStorage.setItem('oreva-bag-owner', 'user-1');
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('offline')));
    renderProvider();
    await screen.findByText('count:2');
    expect(localStorage.getItem('oreva-bag-owner')).toBe('user-1');
  });
});

describe('guest bag', () => {
  it('stays on the device without operations or a subscription', async () => {
    fetchMock.mockImplementation(() => respond({ signedIn: false }));
    renderProvider();
    await click('add');
    expect(screen.getByText('count:1')).toBeInTheDocument();
    expect(calls('PATCH')).toHaveLength(0);
    expect(live.subscribe).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('oreva-bag-v1')!)).toEqual([{ variantId, quantity: 1 }]);
    expect(localStorage.getItem('oreva-bag-owner')).toBeNull();
  });
});
