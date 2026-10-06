// tests/component/shopping-sync.test.tsx
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

const A = '00000000-0000-4000-8000-000000000001';
const B = '00000000-0000-4000-8000-000000000002';
const P = '00000000-0000-4000-8000-000000000099';
const line = (variantId: string, quantity: number) => ({
  variantId,
  quantity,
  product: {},
  variant: {},
});
const view = (signedIn: boolean, lines: ReturnType<typeof line>[], extra: object = {}) => ({
  signedIn,
  ...(signedIn ? { userId: 'user-1' } : {}),
  lines,
  wishlist: [],
  adjusted: [],
  ...extra,
});

function Probe() {
  const { lines, wishlist, add, update, toggle, ready } = useShopping();
  return (
    <>
      <p>count:{lines.reduce((n, l) => n + l.quantity, 0)}</p>
      <p>wished:{wishlist.length}</p>
      <button disabled={!ready} onClick={() => add(A, 1, 5)}>
        add
      </button>
      <button disabled={!ready} onClick={() => update(A, 3)}>
        set3
      </button>
      <button disabled={!ready} onClick={() => toggle(P)}>
        wish
      </button>
    </>
  );
}

let fetchMock: ReturnType<typeof vi.fn>;
const respond = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 400, status, json: () => Promise.resolve(body) } as Response);
const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);
const setItem = vi.spyOn(Storage.prototype, 'setItem');

beforeEach(() => {
  localStorage.clear();
  setItem.mockClear();
  fetchMock = vi.fn((_url: string, init?: RequestInit) => {
    if (init?.method === 'POST') return respond(view(false, []));
    if (init?.method === 'PATCH') return respond(view(false, [line(A, 1)]));
    return respond(view(false, [line(A, 2)]));
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

describe('bag storage', () => {
  it('saves a guest change to the server and never to localStorage', async () => {
    renderProvider();
    await userEvent.click(await screen.findByRole('button', { name: 'add' }));
    expect(screen.getByRole('status')).toHaveTextContent('Added to your bag');
    await waitFor(() => expect(calls('PATCH')).toHaveLength(1));
    expect(JSON.parse(calls('PATCH')[0][1].body)).toEqual({
      ops: [{ op: 'add', variantId: A, quantity: 1 }],
    });
    await waitFor(() => expect(screen.getByText('count:1')).toBeInTheDocument());
    expect(setItem).not.toHaveBeenCalled();
  });

  it('sends wishlist changes to the server', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      respond(init?.method === 'PATCH' ? view(false, [], { wishlist: [P] }) : view(false, [])),
    );
    renderProvider();
    await userEvent.click(await screen.findByRole('button', { name: 'wish' }));
    await waitFor(() => expect(screen.getByText('wished:1')).toBeInTheDocument());
    expect(JSON.parse(calls('PATCH')[0][1].body)).toEqual({ ops: [{ op: 'wish', productId: P }] });
    expect(setItem).not.toHaveBeenCalled();
  });
});

describe('legacy localStorage bags', () => {
  it('uploads a guest bag left in localStorage once, then removes every old key', async () => {
    localStorage.setItem('oreva-bag-v1', JSON.stringify([{ variantId: B, quantity: 2 }]));
    localStorage.setItem('oreva-wishlist-v1', JSON.stringify([P]));
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      respond(init?.method === 'POST' ? view(false, [line(B, 2)]) : view(false, [line(B, 2)])),
    );
    renderProvider();
    await waitFor(() => expect(screen.getByText('count:2')).toBeInTheDocument());
    expect(JSON.parse(calls('POST')[0][1].body)).toEqual({
      action: 'merge',
      lines: [{ variantId: B, quantity: 2 }],
      wishlist: [P],
    });
    expect(localStorage.getItem('oreva-bag-v1')).toBeNull();
    expect(localStorage.getItem('oreva-wishlist-v1')).toBeNull();
    cleanup();
    fetchMock.mockClear();
    renderProvider();
    await waitFor(() => expect(calls('POST')).toHaveLength(1));
    expect(JSON.parse(calls('POST')[0][1].body)).toEqual({
      action: 'merge',
      lines: [],
      wishlist: [],
    });
  });

  it('drops an account-owned copy instead of uploading it', async () => {
    localStorage.setItem('oreva-bag-v1', JSON.stringify([{ variantId: B, quantity: 2 }]));
    localStorage.setItem('oreva-bag-owner', 'user-1');
    renderProvider();
    await waitFor(() => expect(calls('POST')).toHaveLength(1));
    expect(JSON.parse(calls('POST')[0][1].body)).toEqual({
      action: 'merge',
      lines: [],
      wishlist: [],
    });
    await waitFor(() => expect(localStorage.getItem('oreva-bag-owner')).toBeNull());
    expect(localStorage.getItem('oreva-bag-v1')).toBeNull();
  });

  it('keeps the old keys when the upload fails, so nothing is lost', async () => {
    localStorage.setItem('oreva-bag-v1', JSON.stringify([{ variantId: B, quantity: 2 }]));
    fetchMock.mockImplementation(() => Promise.reject(new TypeError('offline')));
    renderProvider();
    await waitFor(() => expect(calls('POST')).toHaveLength(1));
    expect(localStorage.getItem('oreva-bag-v1')).not.toBeNull();
  });
});

describe('signed-in sync', () => {
  beforeEach(() => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return respond(view(true, [line(A, 1)]));
      if (init?.method === 'PATCH') return respond(view(true, [line(A, 3)]));
      return respond(view(true, [line(A, 4)]));
    });
  });

  it('subscribes for the signed-in customer and refetches on events', async () => {
    renderProvider();
    await waitFor(() => expect(live.subscribe).toHaveBeenCalledWith('user-1'));
    await act(async () => live.onChange!());
    await waitFor(() => expect(screen.getByText('count:4')).toBeInTheDocument());
  });

  it('says so when the session ended in another tab and the change lands in the guest bag', async () => {
    // A cookie session that ended is served as a guest (200), never a 401.
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return respond(view(true, [line(A, 1)]));
      if (init?.method === 'PATCH') return respond(view(false, [line(A, 3)]));
      return respond(view(false, []));
    });
    renderProvider();
    await waitFor(() => expect(live.subscribe).toHaveBeenCalledWith('user-1'));
    await userEvent.click(await screen.findByRole('button', { name: 'set3' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('You were signed out.'),
    );
    expect(screen.getByText('count:3')).toBeInTheDocument();
  });

  it('notices a signed-out session on refresh too', async () => {
    renderProvider();
    await waitFor(() => expect(live.subscribe).toHaveBeenCalledWith('user-1'));
    fetchMock.mockImplementation(() => respond(view(false, [])));
    await act(async () => live.onChange!());
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('You were signed out.'),
    );
    expect(screen.getByText('count:0')).toBeInTheDocument();
  });

  it('becomes a guest on an explicit 401', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return respond(view(true, [line(A, 1)]));
      if (init?.method === 'PATCH') return respond({ error: 'Please sign in again.' }, 401);
      return respond(view(false, []));
    });
    renderProvider();
    await userEvent.click(await screen.findByRole('button', { name: 'set3' }));
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('You were signed out.'),
    );
    await waitFor(() => expect(screen.getByText('count:0')).toBeInTheDocument());
  });
});

describe('guests', () => {
  it('do not subscribe to Realtime', async () => {
    renderProvider();
    await screen.findByRole('button', { name: 'add' });
    await waitFor(() => expect(calls('POST')).toHaveLength(1));
    expect(live.subscribe).not.toHaveBeenCalled();
  });
});

describe('loading the bag', () => {
  it('shows the saved bag when the merge is refused, keeping the old keys', async () => {
    localStorage.setItem('oreva-bag-v1', JSON.stringify([{ variantId: B, quantity: 2 }]));
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? respond({ error: 'Server error' }, 500)
        : respond(view(false, [line(A, 2)])),
    );
    renderProvider();
    await waitFor(() => expect(screen.getByText('count:2')).toBeInTheDocument());
    expect(calls('GET')).toHaveLength(1);
    expect(localStorage.getItem('oreva-bag-v1')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'add' })).toBeEnabled();
  });

  it('asks for a reload when neither the merge nor the bag can be read', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? Promise.reject(new TypeError('offline'))
        : respond({ error: 'Server error' }, 500),
    );
    renderProvider();
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Your bag could not be loaded. Please refresh the page.',
      ),
    );
    expect(calls('GET')).toHaveLength(1);
    expect(screen.getByText('count:0')).toBeInTheDocument();
  });
});

describe('saving changes', () => {
  it('ignores a slow older reply that arrives after a newer one', async () => {
    let releaseFirst: (value: Response) => void = () => {};
    let patches = 0;
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method !== 'PATCH') return respond(view(false, []));
      patches++;
      if (patches === 1)
        return new Promise<Response>((resolve) => {
          releaseFirst = resolve;
        });
      return respond(view(false, [line(A, 3)]));
    });
    renderProvider();
    await userEvent.click(await screen.findByRole('button', { name: 'add' }));
    await userEvent.click(screen.getByRole('button', { name: 'set3' }));
    await waitFor(() => expect(calls('PATCH')).toHaveLength(2));
    await waitFor(() => expect(screen.getByText('count:3')).toBeInTheDocument());
    await act(async () => {
      releaseFirst((await respond(view(false, [line(A, 1)]))) as Response);
    });
    expect(screen.getByText('count:3')).toBeInTheDocument();
  });

  it('shows the server bag when a change is refused', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return respond(view(false, [line(A, 1)]));
      if (init?.method === 'PATCH') return respond({ error: 'Conflict' }, 409);
      return respond(view(false, [line(A, 2)]));
    });
    renderProvider();
    await waitFor(() => expect(screen.getByText('count:1')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'set3' }));
    await waitFor(() => expect(screen.getByText('count:2')).toBeInTheDocument());
    expect(calls('GET')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your bag could not be updated. Please try again.',
    );
  });

  it('restores the previous bag when offline', async () => {
    fetchMock.mockImplementation((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? respond(view(false, [line(A, 1)]))
        : Promise.reject(new TypeError('offline')),
    );
    renderProvider();
    await waitFor(() => expect(screen.getByText('count:1')).toBeInTheDocument());
    await userEvent.click(screen.getByRole('button', { name: 'set3' }));
    await waitFor(() => expect(calls('GET')).toHaveLength(1));
    await waitFor(() => expect(screen.getByText('count:1')).toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent(
      'Your bag could not be updated. Please try again.',
    );
  });

  it('re-reads the bag when the tab becomes visible', async () => {
    renderProvider();
    await waitFor(() => expect(calls('POST')).toHaveLength(1));
    expect(calls('GET')).toHaveLength(0);
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await waitFor(() => expect(screen.getByText('count:2')).toBeInTheDocument());
    expect(calls('GET')).toHaveLength(1);
    visibility.mockRestore();
  });
});
