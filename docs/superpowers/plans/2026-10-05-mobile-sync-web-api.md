# Mobile Sync — Web API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the web store's API usable by a mobile app with the same accounts, and make the cart sync live between web and mobile.

**Architecture:** A request-aware session helper accepts either the browser cookie session (with the same-origin check) or a mobile `Authorization: Bearer` token. Auth routes can return the session to mobile instead of setting cookies. New public catalogue GET endpoints and a line-operation cart API (`GET`/`PATCH /api/shopping`) replace whole-document saves; writes use an `updated_at` check so devices cannot overwrite each other. `shopping_state` joins the Supabase Realtime publication and the web cart provider subscribes to it, refetching on every event.

**Tech Stack:** Next.js 16.3.8 route handlers, @supabase/supabase-js 2 / @supabase/ssr 0.12, Supabase Realtime, Zod 4, Vitest 5 (+ jsdom, Testing Library), PGlite for migration tests.

**Spec:** `docs/superpowers/specs/2026-10-05-mobile-app-cart-sync-design.md`

## Global Constraints

- Work on branch `feat/mobile-sync`. Package manager: pnpm.
- `AGENTS.md`: this Next.js version has breaking changes. Read the route handler guide in `node_modules/next/dist/docs/` before writing a route file. Route files may only export HTTP method handlers and Next's recognised config names.
- Commit messages: conventional style (`feat:`, `test:`, `docs:`). Never add `Co-Authored-By` or any AI attribution line.
- Cart limits (unchanged): quantity 1–20 per line, at most 50 lines, at most 500 wishlist IDs; a line is capped at `min(stock, 20)`.
- Error copy is customer-facing and stays as-is: "Email or password is incorrect", "Please sign in again." (`code: 'session_expired'`), "Your bag changed on another device. Please try again." (`code: 'cart_conflict'`).
- Catalogue GETs send `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`. Auth and shopping responses send `Cache-Control: no-store`.
- Every task ends with `pnpm test` green for the files it touches; Task 8 runs the full gate: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e`.

## Review Focus

1. **Expired or malformed bearer token** → 401 `session_expired`, never a silent fallback to the cookie session or a 500 (Task 1 tests).
2. **Two devices editing at the same moment** → both changes survive; the second write retries after the `updated_at` check fails (Task 5 test "keeps a change made on another device").
3. **A cart line whose variant sold out or was archived** → omitted from `GET`, dropped and reported in `adjusted` on the next `PATCH` (Task 3 and Task 5 tests).
4. **Adding more than stock allows** → capped, not rejected, and reported in `adjusted` so the app can explain it (Task 3 test).
5. **Fixture mode / Supabase not configured** → `GET /api/shopping` returns `{ signedIn: false }` and `PATCH` returns 401, never a 500 (Task 5 tests).

Realtime delivery itself cannot run under Vitest. It is verified manually in Task 8, Step 6.

## File Structure

| File                                                                                                                   | Responsibility                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `lib/supabase/server.ts` (modify)                                                                                      | add `requestSession()`: bearer or cookie session                 |
| `lib/auth/accounts.ts` (modify)                                                                                        | add `statelessAuthClient()`, `isMobileClient()`, `sessionBody()` |
| `app/api/auth/sign-in/route.ts`, `sign-up/route.ts`, `forgot-password/route.ts` (modify)                               | mobile mode                                                      |
| `features/cart/ops.ts` (create)                                                                                        | op schema + pure `applyShoppingOps()`                            |
| `features/cart/lines.ts` (create)                                                                                      | pure `lineDetails()`                                             |
| `features/catalogue/summary.ts` (create)                                                                               | `productSummary()`, `catalogueCacheHeaders`                      |
| `app/api/catalogue/categories/route.ts`, `products/route.ts`, `products/[slug]/route.ts`, `variants/route.ts` (create) | public read API                                                  |
| `features/cart/state.ts` (create)                                                                                      | load / view / optimistic write of `shopping_state`               |
| `app/api/shopping/route.ts` (rewrite)                                                                                  | `GET`, `PATCH`, `POST merge`                                     |
| `supabase/migrations/202610050002_shopping_realtime.sql` (create)                                                      | add table to Realtime publication                                |
| `lib/supabase/browser.ts`, `features/cart/live.ts` (create)                                                            | browser client + Realtime subscription                           |
| `features/cart/provider.tsx` (rewrite)                                                                                 | ops + live refresh                                               |
| `tests/support/fake-shopping-db.ts` (create)                                                                           | in-memory `shopping_state` double                                |
| `docs/AUTH.md`, `docs/DATABASE.md` (modify)                                                                            | document the above                                               |

---

### Task 1: Request-aware session helper

**Files:**

- Modify: `lib/supabase/server.ts`
- Test: `tests/unit/request-session.test.ts`

**Interfaces:**

- Produces: `requestSession(request: Request, options?: { mutation?: boolean }): Promise<RequestSession | null>` and `type RequestSession = { db: SupabaseClient; user: User | null; mode: 'bearer' | 'cookie' }`. Returns `null` only when Supabase is not configured. Throws `AppError(401, 'session_expired')` for a bad bearer token, and `AppError(403)` from `sameOrigin` for a cookie mutation from another origin.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/request-session.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  bearerGetUser: vi.fn(),
  cookieGetUser: vi.fn(),
  createClient: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: mocks.cookieGetUser } }),
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => {
    mocks.createClient(...args);
    return { auth: { getUser: mocks.bearerGetUser } };
  },
}));

import { requestSession } from '@/lib/supabase/server';

const token = 'header.payload.signature';
const request = (headers: Record<string, string> = {}) =>
  new Request('http://localhost:3000/api/shopping', { method: 'PATCH', headers });

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'sb_publishable_test');
  mocks.bearerGetUser.mockResolvedValue({ data: { user: { id: 'mobile-user' } }, error: null });
  mocks.cookieGetUser.mockResolvedValue({ data: { user: { id: 'cookie-user' } }, error: null });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('requestSession', () => {
  it('uses a valid bearer token and ignores cookies', async () => {
    const session = await requestSession(request({ Authorization: `Bearer ${token}` }), {
      mutation: true,
    });
    expect(session?.mode).toBe('bearer');
    expect(session?.user?.id).toBe('mobile-user');
    expect(mocks.bearerGetUser).toHaveBeenCalledWith(token);
    expect(mocks.cookieGetUser).not.toHaveBeenCalled();
    const [, , options] = mocks.createClient.mock.calls[0];
    expect(options.global.headers.Authorization).toBe(`Bearer ${token}`);
  });

  it.each(['Bearer', 'Bearer not-a-jwt', 'Basic abc', ''])(
    'rejects a malformed Authorization header %j as an expired session',
    async (value) => {
      await expect(requestSession(request({ Authorization: value }))).rejects.toMatchObject({
        status: 401,
        code: 'session_expired',
      });
      expect(mocks.cookieGetUser).not.toHaveBeenCalled();
    },
  );

  it('treats a token Supabase rejects as expired', async () => {
    mocks.bearerGetUser.mockResolvedValue({
      data: { user: null },
      error: { status: 403, code: 'bad_jwt' },
    });
    await expect(
      requestSession(request({ Authorization: `Bearer ${token}` })),
    ).rejects.toMatchObject({ status: 401, code: 'session_expired' });
  });

  it('does not sign the customer out when Supabase Auth is down', async () => {
    mocks.bearerGetUser.mockResolvedValue({ data: { user: null }, error: { status: 500 } });
    const failure = requestSession(request({ Authorization: `Bearer ${token}` }));
    await expect(failure).rejects.toThrow('Account service unavailable');
    await expect(failure).rejects.not.toMatchObject({ status: 401 });
  });

  it('requires the same origin for cookie mutations', async () => {
    await expect(requestSession(request(), { mutation: true })).rejects.toMatchObject({
      status: 403,
    });
    const session = await requestSession(request({ Origin: 'http://localhost:3000' }), {
      mutation: true,
    });
    expect(session).toMatchObject({ mode: 'cookie', user: { id: 'cookie-user' } });
  });

  it('allows cookie reads without an Origin header', async () => {
    expect((await requestSession(request()))?.user?.id).toBe('cookie-user');
  });

  it('returns null when Supabase is not configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    expect(await requestSession(request({ Authorization: `Bearer ${token}` }))).toBeNull();
    expect(await requestSession(request())).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/request-session.test.ts`
Expected: FAIL, `requestSession is not a function` (or not exported).

- [ ] **Step 3: Implement `requestSession`**

In `lib/supabase/server.ts`, change the imports at the top to:

```ts
import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { authConfigured } from '@/lib/config';
import { AppError, sameOrigin } from '@/lib/security';
```

Append to the end of the file:

```ts
export type RequestSession = { db: SupabaseClient; user: User | null; mode: 'bearer' | 'cookie' };

const expired = () => new AppError('Please sign in again.', 401, 'session_expired');

/**
 * Identifies the caller of an API route. The mobile app sends `Authorization: Bearer <access
 * token>` and is never read from cookies. Browsers use the cookie session and, for mutations,
 * must pass the same-origin check; bearer requests skip it because a browser cannot attach that
 * header to a cross-site request on its own.
 */
export async function requestSession(
  request: Request,
  { mutation = false }: { mutation?: boolean } = {},
): Promise<RequestSession | null> {
  const header = request.headers.get('authorization');
  if (header === null) {
    if (mutation) sameOrigin(request);
    const db = await sessionClient();
    if (!db) return null;
    const { data } = await db.auth.getUser();
    return { db, user: data.user ?? null, mode: 'cookie' };
  }
  if (!authConfigured()) return null;
  const token = /^Bearer ([\w-]+\.[\w-]+\.[\w-]+)$/.exec(header)?.[1];
  if (!token) throw expired();
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );
  const { data, error } = await db.auth.getUser(token);
  if (error && error.status !== 401 && error.status !== 403)
    throw new Error('Account service unavailable');
  if (!data.user) throw expired();
  return { db, user: data.user, mode: 'bearer' };
}
```

(`lib/security.ts` imports only `lib/config`, so there is no import cycle.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run tests/unit/request-session.test.ts`
Expected: PASS (all cases). Then `pnpm typecheck`. Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add lib/supabase/server.ts tests/unit/request-session.test.ts
git commit -m "feat: accept bearer sessions alongside cookie sessions"
```

---

### Task 2: Mobile mode for sign-in, sign-up and forgot password

**Files:**

- Modify: `lib/auth/accounts.ts`, `app/api/auth/sign-in/route.ts`, `app/api/auth/sign-up/route.ts`, `app/api/auth/forgot-password/route.ts`
- Test: `tests/unit/mobile-auth-routes.test.ts`

**Interfaces:**

- Produces: `statelessAuthClient(): SupabaseClient` (no cookies, throws `AppError(503)` when unconfigured), `isMobileClient(body: unknown): boolean`, `sessionBody(session: Session)` → `{ ok: true, session: { access_token, refresh_token, expires_at } }`.
- Contract for mobile: `POST /api/auth/sign-in` and `/sign-up` with `client: 'mobile'` in the body return `sessionBody(...)` with `Cache-Control: no-store` and set no cookies. `/forgot-password` with `client: 'mobile'` skips the origin check and returns `{ ok: true }`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/mobile-auth-routes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const session = { access_token: 'a.b.c', refresh_token: 'refresh', expires_at: 1759700000 };
  const profileUpdate = vi.fn(() => ({ eq: () => Promise.resolve({ error: null }) }));
  return {
    session,
    profileUpdate,
    mobileDb: {
      auth: {
        signInWithPassword: vi.fn(),
        signUp: vi.fn(),
        resetPasswordForEmail: vi.fn(() => Promise.resolve({ error: null })),
      },
      from: vi.fn(() => ({ update: profileUpdate })),
    },
    cookieDb: { auth: { signInWithPassword: vi.fn() } },
  };
});
vi.mock('@/lib/rate-limit', () => ({ rateLimit: vi.fn() }));
vi.mock('@/lib/auth/accounts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/accounts')>()),
  authClient: vi.fn(async () => mocks.cookieDb),
  statelessAuthClient: vi.fn(() => mocks.mobileDb),
}));

import { POST as signIn } from '@/app/api/auth/sign-in/route';
import { POST as signUp } from '@/app/api/auth/sign-up/route';
import { POST as forgotPassword } from '@/app/api/auth/forgot-password/route';

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.mobileDb.auth.signInWithPassword.mockResolvedValue({
    data: { session: mocks.session },
    error: null,
  });
  mocks.mobileDb.auth.signUp.mockResolvedValue({
    data: { session: mocks.session, user: { id: 'new-user' } },
    error: null,
  });
});

describe('mobile sign-in', () => {
  it('returns the session in the body without an Origin header', async () => {
    const response = await signIn(
      post('/api/auth/sign-in', { email: 'A@b.co', password: 'secret', client: 'mobile' }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ ok: true, session: mocks.session });
    expect(mocks.mobileDb.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret',
    });
    expect(mocks.cookieDb.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('keeps the generic wrong-password message', async () => {
    mocks.mobileDb.auth.signInWithPassword.mockResolvedValue({
      data: { session: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    });
    const response = await signIn(
      post('/api/auth/sign-in', { email: 'a@b.co', password: 'nope', client: 'mobile' }),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('Email or password is incorrect');
  });

  it('still requires the same origin for browser sign-in', async () => {
    const response = await signIn(post('/api/auth/sign-in', { email: 'a@b.co', password: 'x' }));
    expect(response.status).toBe(403);
  });
});

describe('mobile sign-up', () => {
  it('returns the new session and saves the phone with it', async () => {
    const response = await signUp(
      post('/api/auth/sign-up', {
        firstName: 'Tolu',
        lastName: 'Bello',
        email: 'tolu@example.com',
        password: 'correct horse',
        phone: '+2348012345678',
        client: 'mobile',
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, session: mocks.session });
    expect(mocks.profileUpdate).toHaveBeenCalledWith({ phone: '08012345678' });
  });
});

describe('mobile forgot password', () => {
  it('skips the origin check and gives the same answer', async () => {
    const response = await forgotPassword(
      post('/api/auth/forgot-password', { email: 'a@b.co', client: 'mobile' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.mobileDb.auth.resetPasswordForEmail).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/mobile-auth-routes.test.ts`
Expected: FAIL. The mobile requests return 403 because the routes still call `sameOrigin` first.

- [ ] **Step 3: Add the account helpers**

In `lib/auth/accounts.ts`, change the supabase-js import and add `authConfigured` to the config import:

```ts
import {
  createClient,
  type AuthError,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { authConfigured, siteUrl } from '@/lib/config';
```

Add after `authClient()`:

```ts
/** A Supabase client that never writes cookies; mobile receives the session in the body instead. */
export function statelessAuthClient() {
  if (!authConfigured()) throw new AppError('Account sign-in is not available yet.', 503);
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

/**
 * Mobile requests skip the same-origin check: they set no cookies and a cross-site page cannot
 * read the response, so there is nothing to forge. Rate limits still apply.
 */
export const isMobileClient = (body: unknown) =>
  typeof body === 'object' && body !== null && (body as { client?: unknown }).client === 'mobile';

export function sessionBody(session: Session) {
  return {
    ok: true,
    session: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at,
    },
  };
}
```

- [ ] **Step 4: Update the three routes**

Replace `app/api/auth/sign-in/route.ts` with:

```ts
import { signInSchema } from '@/lib/validation';
import { rateLimit } from '@/lib/rate-limit';
import { apiError, readJson, sameOrigin } from '@/lib/security';
import {
  authClient,
  authFailure,
  clientIp,
  isMobileClient,
  sessionBody,
  statelessAuthClient,
} from '@/lib/auth/accounts';
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const mobile = isMobileClient(body);
    if (!mobile) sameOrigin(request);
    const input = signInSchema.parse(body);
    await rateLimit(`sign-in:${clientIp(request)}:${input.email}`, 10, 600);
    const db = mobile ? statelessAuthClient() : await authClient();
    const { data, error } = await db.auth.signInWithPassword(input);
    if (error) throw authFailure(error);
    if (mobile)
      return Response.json(sessionBody(data.session), { headers: { 'Cache-Control': 'no-store' } });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
```

In `app/api/auth/sign-up/route.ts`:

- Import `isMobileClient, sessionBody, statelessAuthClient` from `@/lib/auth/accounts`.
- Replace `sameOrigin(request);` and the `const input = ...` line with:

  ```ts
  const body = await readJson(request);
  const mobile = isMobileClient(body);
  if (!mobile) sameOrigin(request);
  const input = signUpSchema.parse(body);
  ```

- Replace `const db = await authClient();` with `const db = mobile ? statelessAuthClient() : await authClient();`.
- Replace the final `return Response.json({ ok: true });` with:

  ```ts
  if (mobile)
    return Response.json(sessionBody(data.session), { headers: { 'Cache-Control': 'no-store' } });
  return Response.json({ ok: true });
  ```

In `app/api/auth/forgot-password/route.ts`:

- Import `isMobileClient, statelessAuthClient`.
- Replace the first two lines of the `try` with:

  ```ts
  const body = await readJson(request);
  const mobile = isMobileClient(body);
  if (!mobile) sameOrigin(request);
  const { email } = emailOnlySchema.parse(body);
  ```

- Replace `(await authClient())` with `(mobile ? statelessAuthClient() : await authClient())`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/mobile-auth-routes.test.ts tests/unit/auth.test.ts`
Expected: PASS. Then `pnpm typecheck` passes.

- [ ] **Step 6: Commit**

```bash
git add lib/auth/accounts.ts app/api/auth tests/unit/mobile-auth-routes.test.ts
git commit -m "feat: return Supabase sessions to the mobile app from auth routes"
```

---

### Task 3: Cart operations and line details (pure functions)

**Files:**

- Create: `features/cart/ops.ts`, `features/cart/lines.ts`
- Test: `tests/unit/shopping-ops.test.ts`

**Interfaces:**

- Produces:
  - `shoppingOpsSchema` (Zod, `{ ops: ShoppingOp[] }`, 1–50 ops), `type ShoppingOp`:
    `{ op: 'add' | 'set'; variantId: string; quantity: number }` (1–20) `| { op: 'remove'; variantId: string } | { op: 'wish' | 'unwish'; productId: string }`.
  - `applyShoppingOps(state: { lines: CartLine[]; wishlist: string[] }, ops: ShoppingOp[], products: Product[]): { lines: CartLine[]; wishlist: string[]; adjusted: string[] }`.
  - `type LineDetail = { variantId: string; product: { id: string; slug: string; name: string; image: string | null; alt: string; price: number }; variant: { attributes: Record<string, string>; price: number | null; stock: number } }`.
  - `lineDetails(variantIds: string[], products: Product[]): LineDetail[]` keeps the input order, drops unknown, inactive-product and sold-out variants.

`wish`/`unwish` extend the spec's op list so the web wishlist keeps syncing once the whole-document `save` action is removed (Task 5).

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/shopping-ops.test.ts
import { describe, expect, it } from 'vitest';
import { applyShoppingOps, shoppingOpsSchema } from '@/features/cart/ops';
import { lineDetails } from '@/features/cart/lines';
import type { Product, Variant } from '@/features/catalogue/types';

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const variant = (n: number, stock: number): Variant => ({
  id: id(n),
  sku: `SKU-${n}`,
  attributes: { Size: 'M' },
  price: null,
  stock,
  image: null,
});
const product = (
  n: number,
  variants: Variant[],
  status: Product['status'] = 'active',
): Product => ({
  id: id(1000 + n),
  name: `Piece ${n}`,
  slug: `piece-${n}`,
  description: '',
  short_description: '',
  category: 'Dresses',
  audience: 'women',
  tags: [],
  status,
  price: 1500000,
  compare_at: null,
  images: [`/images/piece-${n}.jpg`],
  alt: `Piece ${n}`,
  variants,
  details: [],
  care: '',
  featured: false,
  created_at: '2026-10-01T00:00:00Z',
  fixture: true,
});
const plenty = variant(1, 30);
const scarce = variant(2, 3);
const soldOut = variant(3, 0);
const archived = variant(4, 10);
const products = [product(1, [plenty, scarce, soldOut]), product(2, [archived], 'archived')];
const empty = { lines: [], wishlist: [] };

describe('applyShoppingOps', () => {
  it('adds, increments, sets and removes lines', () => {
    const added = applyShoppingOps(
      empty,
      [{ op: 'add', variantId: plenty.id, quantity: 2 }],
      products,
    );
    expect(added.lines).toEqual([{ variantId: plenty.id, quantity: 2 }]);
    const more = applyShoppingOps(
      added,
      [{ op: 'add', variantId: plenty.id, quantity: 3 }],
      products,
    );
    expect(more.lines).toEqual([{ variantId: plenty.id, quantity: 5 }]);
    const set = applyShoppingOps(
      more,
      [{ op: 'set', variantId: plenty.id, quantity: 1 }],
      products,
    );
    expect(set.lines).toEqual([{ variantId: plenty.id, quantity: 1 }]);
    const removed = applyShoppingOps(set, [{ op: 'remove', variantId: plenty.id }], products);
    expect(removed.lines).toEqual([]);
    expect(removed.adjusted).toEqual([]);
  });

  it('caps a line at stock and reports it', () => {
    const result = applyShoppingOps(
      empty,
      [{ op: 'add', variantId: scarce.id, quantity: 5 }],
      products,
    );
    expect(result.lines).toEqual([{ variantId: scarce.id, quantity: 3 }]);
    expect(result.adjusted).toEqual([scarce.id]);
  });

  it('caps a line at 20 even with more stock', () => {
    const start = { lines: [{ variantId: plenty.id, quantity: 18 }], wishlist: [] };
    const result = applyShoppingOps(
      start,
      [{ op: 'add', variantId: plenty.id, quantity: 5 }],
      products,
    );
    expect(result.lines).toEqual([{ variantId: plenty.id, quantity: 20 }]);
    expect(result.adjusted).toEqual([plenty.id]);
  });

  it('drops sold-out, archived and unknown variants, including ones already saved', () => {
    const start = { lines: [{ variantId: soldOut.id, quantity: 1 }], wishlist: [] };
    const result = applyShoppingOps(
      start,
      [
        { op: 'add', variantId: archived.id, quantity: 1 },
        { op: 'add', variantId: id(999), quantity: 1 },
      ],
      products,
    );
    expect(result.lines).toEqual([]);
    expect(result.adjusted.sort()).toEqual([soldOut.id, archived.id, id(999)].sort());
  });

  it('keeps at most 50 lines, rejecting the newest', () => {
    const many = Array.from({ length: 51 }, (_, n) => variant(100 + n, 5));
    const catalogue = [product(9, many)];
    const ops = many.map((v) => ({ op: 'add' as const, variantId: v.id, quantity: 1 }));
    const result = applyShoppingOps(empty, ops, catalogue);
    expect(result.lines).toHaveLength(50);
    expect(result.adjusted).toEqual([many[50].id]);
  });

  it('saves and removes wishlist products, ignoring unknown ones', () => {
    const productId = products[0].id;
    const saved = applyShoppingOps(
      empty,
      [
        { op: 'wish', productId },
        { op: 'wish', productId: id(5000) },
      ],
      products,
    );
    expect(saved.wishlist).toEqual([productId]);
    expect(applyShoppingOps(saved, [{ op: 'unwish', productId }], products).wishlist).toEqual([]);
  });
});

describe('shoppingOpsSchema', () => {
  it('rejects quantity 0, unknown ops and empty or oversized batches', () => {
    const bad = [
      { ops: [{ op: 'set', variantId: plenty.id, quantity: 0 }] },
      { ops: [{ op: 'clear' }] },
      { ops: [] },
      { ops: Array.from({ length: 51 }, () => ({ op: 'remove', variantId: plenty.id })) },
    ];
    for (const body of bad) expect(shoppingOpsSchema.safeParse(body).success).toBe(false);
  });
});

describe('lineDetails', () => {
  it('describes in-stock variants in order and omits the rest', () => {
    const lines = lineDetails([scarce.id, soldOut.id, archived.id, plenty.id], products);
    expect(lines.map((l) => l.variantId)).toEqual([scarce.id, plenty.id]);
    expect(lines[0]).toEqual({
      variantId: scarce.id,
      product: {
        id: products[0].id,
        slug: 'piece-1',
        name: 'Piece 1',
        image: '/images/piece-1.jpg',
        alt: 'Piece 1',
        price: 1500000,
      },
      variant: { attributes: { Size: 'M' }, price: null, stock: 3 },
    });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/shopping-ops.test.ts`
Expected: FAIL, cannot resolve `@/features/cart/ops`.

- [ ] **Step 3: Implement `features/cart/ops.ts`**

```ts
import { z } from 'zod';
import type { CartLine, Product } from '@/features/catalogue/types';

const quantity = z.number().int().min(1).max(20);
export const shoppingOpSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('add'), variantId: z.uuid(), quantity }),
  z.object({ op: z.literal('set'), variantId: z.uuid(), quantity }),
  z.object({ op: z.literal('remove'), variantId: z.uuid() }),
  z.object({ op: z.literal('wish'), productId: z.uuid() }),
  z.object({ op: z.literal('unwish'), productId: z.uuid() }),
]);
export const shoppingOpsSchema = z.object({ ops: z.array(shoppingOpSchema).min(1).max(50) });
export type ShoppingOp = z.infer<typeof shoppingOpSchema>;
export type ShoppingState = { lines: CartLine[]; wishlist: string[] };

/**
 * Applies line changes from one device to the saved bag. Every line, including ones saved
 * earlier, is capped at min(stock, 20) and the bag at 50 lines; anything capped or dropped is
 * listed in `adjusted` so the customer can be told why their bag changed.
 */
export function applyShoppingOps(state: ShoppingState, ops: ShoppingOp[], products: Product[]) {
  const active = products.filter((p) => p.status === 'active');
  const stock = new Map(active.flatMap((p) => p.variants.map((v) => [v.id, v.stock] as const)));
  const productIds = new Set(active.map((p) => p.id));
  const lines = new Map(state.lines.map((l) => [l.variantId, l.quantity]));
  const wishlist = new Set(state.wishlist);
  for (const op of ops) {
    if (op.op === 'add') lines.set(op.variantId, (lines.get(op.variantId) ?? 0) + op.quantity);
    else if (op.op === 'set') lines.set(op.variantId, op.quantity);
    else if (op.op === 'remove') lines.delete(op.variantId);
    else if (op.op === 'wish') {
      if (productIds.has(op.productId)) wishlist.add(op.productId);
    } else wishlist.delete(op.productId);
  }
  const next: CartLine[] = [];
  const adjusted: string[] = [];
  for (const [variantId, wanted] of lines) {
    const kept = next.length < 50 ? Math.min(wanted, stock.get(variantId) ?? 0, 20) : 0;
    if (kept !== wanted) adjusted.push(variantId);
    if (kept > 0) next.push({ variantId, quantity: kept });
  }
  return { lines: next, wishlist: [...wishlist].slice(0, 500), adjusted };
}
```

- [ ] **Step 4: Implement `features/cart/lines.ts`**

```ts
import type { Product } from '@/features/catalogue/types';

export type LineDetail = {
  variantId: string;
  product: {
    id: string;
    slug: string;
    name: string;
    image: string | null;
    alt: string;
    price: number;
  };
  variant: { attributes: Record<string, string>; price: number | null; stock: number };
};

/** Everything a bag needs to display a variant; unknown, archived and sold-out variants are left out. */
export function lineDetails(variantIds: string[], products: Product[]): LineDetail[] {
  const index = new Map(
    products
      .filter((p) => p.status === 'active')
      .flatMap((p) => p.variants.map((v) => [v.id, { p, v }] as const)),
  );
  return variantIds.flatMap((variantId) => {
    const hit = index.get(variantId);
    if (!hit || hit.v.stock <= 0) return [];
    const { p, v } = hit;
    return [
      {
        variantId,
        product: {
          id: p.id,
          slug: p.slug,
          name: p.name,
          image: v.image ?? p.images[0] ?? null,
          alt: p.alt,
          price: p.price,
        },
        variant: { attributes: v.attributes, price: v.price, stock: v.stock },
      },
    ];
  });
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/shopping-ops.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add features/cart/ops.ts features/cart/lines.ts tests/unit/shopping-ops.test.ts
git commit -m "feat: apply cart line operations with stock caps"
```

---

### Task 4: Public catalogue read endpoints

**Files:**

- Create: `features/catalogue/summary.ts`, `app/api/catalogue/categories/route.ts`, `app/api/catalogue/products/route.ts`, `app/api/catalogue/products/[slug]/route.ts`, `app/api/catalogue/variants/route.ts`
- Test: `tests/unit/catalogue-api.test.ts`

**Interfaces:**

- Consumes: `lineDetails` (Task 3); existing `getProducts`, `getCategories`, `getProduct`, `filterProducts`, `categoryBranchSlugs`, `productCategorySlug`, `priceRange`.
- Produces (HTTP):
  - `GET /api/catalogue/categories` → `{ categories: Category[] }`
  - `GET /api/catalogue/products?audience=&category=&page=` → `{ products: ProductSummary[], page: number, pageSize: 12, total: number }`. An empty parameter counts as absent, an unknown slug gives an empty list, and a page outside 1–100 gives 400.
  - `GET /api/catalogue/products/[slug]` → `{ product: Product }` | 404 `{ error }`
  - `GET /api/catalogue/variants?ids=a,b` → `{ lines: LineDetail[] }` (≤50 UUIDs, else 400)
  - `type ProductSummary = { id; slug; name; price; compare_at; image: string | null; alt; audience; category; inStock: boolean }`, where `price` is the lowest variant price.

Before Step 3, read the route handler guide in `node_modules/next/dist/docs/` (search for "route" / "Route Handlers") and confirm the signature for dynamic `params`. In Next 15+ it is a `Promise`. If the docs name a `RouteContext` helper type, use it instead of the inline type below.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/catalogue-api.test.ts
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { products } from '@/features/catalogue/fixtures';

let categoriesRoute: typeof import('@/app/api/catalogue/categories/route');
let productsRoute: typeof import('@/app/api/catalogue/products/route');
let productRoute: typeof import('@/app/api/catalogue/products/[slug]/route');
let variantsRoute: typeof import('@/app/api/catalogue/variants/route');
beforeAll(async () => {
  vi.stubEnv('DATA_MODE', 'fixture');
  categoriesRoute = await import('@/app/api/catalogue/categories/route');
  productsRoute = await import('@/app/api/catalogue/products/route');
  productRoute = await import('@/app/api/catalogue/products/[slug]/route');
  variantsRoute = await import('@/app/api/catalogue/variants/route');
});

const get = (path: string) => new Request(`http://localhost:3000${path}`);
const list = async (query: string) => {
  const response = await productsRoute.GET(get(`/api/catalogue/products${query}`));
  return { status: response.status, body: await response.json() };
};

describe('catalogue API', () => {
  it('lists active categories with public caching', async () => {
    const response = await categoriesRoute.GET(get('/api/catalogue/categories'));
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=60, stale-while-revalidate=300',
    );
    const { categories } = await response.json();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories.every((c: { active: boolean }) => c.active)).toBe(true);
  });

  it('pages the men’s range as summaries', async () => {
    const { body } = await list('?audience=men');
    expect(body).toMatchObject({ page: 1, pageSize: 12, total: 12 });
    expect(Object.keys(body.products[0]).sort()).toEqual(
      [
        'alt',
        'audience',
        'category',
        'compare_at',
        'id',
        'image',
        'inStock',
        'name',
        'price',
        'slug',
      ].sort(),
    );
  });

  it('includes child categories in a parent category', async () => {
    const caps = await list('?category=caps');
    const accessories = await list('?category=accessories');
    expect(caps.body.total).toBeGreaterThan(0);
    expect(accessories.body.total).toBeGreaterThan(caps.body.total);
  });

  it('treats empty filters as absent and unknown ones as empty', async () => {
    expect((await list('?audience=&category=')).body.total).toBe(
      products.filter((p) => p.status === 'active').length,
    );
    expect((await list('?audience=aliens')).body).toMatchObject({ total: 0, products: [] });
  });

  it.each(['?page=0', '?page=abc', '?page=101', '?category=DROP%20TABLE'])(
    'rejects %s',
    async (query) => {
      expect((await list(query)).status).toBe(400);
    },
  );

  it('returns one product with variants, or 404', async () => {
    const found = await productRoute.GET(get('/api/catalogue/products/everyday-boxer-briefs'), {
      params: Promise.resolve({ slug: 'everyday-boxer-briefs' }),
    });
    expect(found.status).toBe(200);
    expect((await found.json()).product.variants.length).toBeGreaterThan(0);
    const missing = await productRoute.GET(get('/api/catalogue/products/nope'), {
      params: Promise.resolve({ slug: 'nope' }),
    });
    expect(missing.status).toBe(404);
  });

  it('describes variants by ID for a guest bag', async () => {
    const all = products.flatMap((p) => p.variants);
    const inStock = all.find((v) => v.stock > 0)!;
    const soldOut = all.find((v) => v.stock === 0)!;
    const response = await variantsRoute.GET(
      get(`/api/catalogue/variants?ids=${inStock.id},${soldOut.id}`),
    );
    const { lines } = await response.json();
    expect(lines.map((l: { variantId: string }) => l.variantId)).toEqual([inStock.id]);
    const bad = await variantsRoute.GET(get('/api/catalogue/variants?ids=not-a-uuid'));
    expect(bad.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run tests/unit/catalogue-api.test.ts`
Expected: FAIL, cannot resolve the route modules.

- [ ] **Step 3: Implement the summary module**

```ts
// features/catalogue/summary.ts
import { priceRange } from './price';
import type { Product } from './types';

export const catalogueCacheHeaders = {
  'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
};

export type ProductSummary = {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at: number | null;
  image: string | null;
  alt: string;
  audience: string;
  category: string;
  inStock: boolean;
};

export function productSummary(p: Product): ProductSummary {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    price: priceRange(p).min,
    compare_at: p.compare_at,
    image: p.images[0] ?? null,
    alt: p.alt,
    audience: p.audience,
    category: p.category,
    inStock: p.variants.some((v) => v.stock > 0),
  };
}
```

- [ ] **Step 4: Implement the four routes**

```ts
// app/api/catalogue/categories/route.ts
import { getCategories } from '@/features/catalogue/repository';
import { catalogueCacheHeaders } from '@/features/catalogue/summary';
import { apiError } from '@/lib/security';
export async function GET() {
  try {
    return Response.json({ categories: await getCategories() }, { headers: catalogueCacheHeaders });
  } catch (error) {
    return apiError(error);
  }
}
```

```ts
// app/api/catalogue/products/route.ts
import { z } from 'zod';
import { getCategories, getProducts } from '@/features/catalogue/repository';
import { filterProducts } from '@/features/catalogue/filter';
import { categoryBranchSlugs, productCategorySlug } from '@/features/catalogue/category-tree';
import { catalogueCacheHeaders, productSummary } from '@/features/catalogue/summary';
import { apiError, AppError } from '@/lib/security';

const slug = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(/^[a-z0-9-]{1,60}$/)
    .optional(),
);
const query = z.object({
  audience: slug,
  category: slug,
  page: z.coerce.number().int().min(1).max(100).default(1),
});
const pageSize = 12;

export async function GET(request: Request) {
  try {
    const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) throw new AppError('Check the catalogue filters', 400);
    const { audience, category, page } = parsed.data;
    let source = await getProducts();
    if (audience) source = filterProducts(source, { audience });
    if (category) {
      const slugs = categoryBranchSlugs(await getCategories(), [category]);
      source = source.filter((p) => slugs.has(productCategorySlug(p)));
    }
    const all = filterProducts(source, {});
    return Response.json(
      {
        products: all.slice((page - 1) * pageSize, page * pageSize).map(productSummary),
        page,
        pageSize,
        total: all.length,
      },
      { headers: catalogueCacheHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}
```

```ts
// app/api/catalogue/products/[slug]/route.ts
import { getProduct } from '@/features/catalogue/repository';
import { catalogueCacheHeaders } from '@/features/catalogue/summary';
import { apiError } from '@/lib/security';
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params;
    const product = /^[a-z0-9-]{1,120}$/.test(slug) ? await getProduct(slug) : undefined;
    if (!product || product.status !== 'active')
      return Response.json({ error: 'This piece is no longer available' }, { status: 404 });
    return Response.json({ product }, { headers: catalogueCacheHeaders });
  } catch (error) {
    return apiError(error);
  }
}
```

```ts
// app/api/catalogue/variants/route.ts
import { z } from 'zod';
import { getProducts } from '@/features/catalogue/repository';
import { lineDetails } from '@/features/cart/lines';
import { catalogueCacheHeaders } from '@/features/catalogue/summary';
import { apiError, AppError } from '@/lib/security';
const ids = z.array(z.uuid()).min(1).max(50);
export async function GET(request: Request) {
  try {
    const parsed = ids.safeParse(new URL(request.url).searchParams.get('ids')?.split(',') ?? []);
    if (!parsed.success) throw new AppError('Your bag needs to be refreshed', 400);
    return Response.json(
      { lines: lineDetails(parsed.data, await getProducts()) },
      { headers: catalogueCacheHeaders },
    );
  } catch (error) {
    return apiError(error);
  }
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm vitest run tests/unit/catalogue-api.test.ts`
Expected: PASS. Then `pnpm typecheck`. Next's generated route types also check the `[slug]` handler signature during `pnpm build` in Task 8.

- [ ] **Step 6: Commit**

```bash
git add features/catalogue/summary.ts app/api/catalogue tests/unit/catalogue-api.test.ts
git commit -m "feat: add public catalogue read API"
```

---

### Task 5: Cart state persistence and the shopping route

**Files:**

- Create: `features/cart/state.ts`, `tests/support/fake-shopping-db.ts`
- Rewrite: `app/api/shopping/route.ts`
- Test: `tests/unit/shopping-state.test.ts`, `tests/unit/shopping-route.test.ts`

**Interfaces:**

- Consumes: `requestSession` (Task 1), `applyShoppingOps`, `shoppingOpsSchema`, `ShoppingOp`, `lineDetails`, `LineDetail` (Task 3), existing `mergeCart`.
- Produces:
  - `loadShoppingRow(db: SupabaseClient, userId: string): Promise<ShoppingRow | null>`, where `ShoppingRow = { lines: CartLine[]; wishlist: string[]; updated_at: string }`.
  - `shoppingView(row: ShoppingRow | null, products: Product[]): ShoppingView`, where `ShoppingView = { signedIn: true; updatedAt: string | null; lines: (LineDetail & { quantity: number })[]; wishlist: string[] }`.
  - `changeShopping(db, userId, ops: ShoppingOp[], products): Promise<ShoppingView & { adjusted: string[] }>`. Retries 3 times on a concurrent write, then throws `AppError(409, 'cart_conflict')`.
  - HTTP: `GET /api/shopping` → `{ signedIn: false }` or `ShoppingView`. `PATCH /api/shopping { ops }` → `ShoppingView & { adjusted }`, or 401 without a session. `POST /api/shopping { action: 'merge', lines, wishlist }` → `{ signedIn: true, userId, lines: CartLine[], wishlist }` or `{ signedIn: false }`. The `save` action is removed; the web provider switches to `PATCH` in Task 7.

- [ ] **Step 1: Write the in-memory test double**

```ts
// tests/support/fake-shopping-db.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { CartLine } from '@/features/catalogue/types';

export type FakeRow = {
  user_id: string;
  lines: CartLine[];
  wishlist: string[];
  updated_at: string;
};

/**
 * Just enough of the supabase-js query builder for shopping_state. `beforeWrite` runs between
 * this device's read and its write, which is where another device's change would land: once by
 * default, or before every write with `{ every: true }`. `writes()` counts write attempts.
 */
export function fakeShoppingDb(
  initial: FakeRow | null,
  beforeWrite?: (row: FakeRow | null) => FakeRow | null,
  { every = false }: { every?: boolean } = {},
) {
  let row = initial;
  let pending = beforeWrite;
  let attempts = 0;
  const interleave = () => {
    attempts++;
    if (pending) {
      row = pending(row);
      if (!every) pending = undefined;
    }
  };
  const db = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row && structuredClone(row), error: null }),
        }),
      }),
      update: (values: Partial<FakeRow>) => ({
        eq: () => ({
          eq: (_column: string, expected: string) => ({
            select: async () => {
              interleave();
              if (!row || row.updated_at !== expected) return { data: [], error: null };
              row = { ...row, ...values };
              return { data: [{ user_id: row.user_id }], error: null };
            },
          }),
        }),
      }),
      insert: (values: FakeRow) => ({
        select: async () => {
          interleave();
          if (row) return { data: null, error: { code: '23505', message: 'duplicate key' } };
          row = values;
          return { data: [{ user_id: values.user_id }], error: null };
        },
      }),
      upsert: async (values: FakeRow) => {
        row = values;
        return { error: null };
      },
    }),
  };
  return { db: db as unknown as SupabaseClient, row: () => row, writes: () => attempts };
}
```

- [ ] **Step 2: Write the failing state test**

```ts
// tests/unit/shopping-state.test.ts
import { describe, expect, it } from 'vitest';
import { changeShopping, shoppingView } from '@/features/cart/state';
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/shopping-state.test.ts`
Expected: FAIL, cannot resolve `@/features/cart/state`.

- [ ] **Step 4: Implement `features/cart/state.ts`**

```ts
import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from '@/lib/security';
import type { CartLine, Product } from '@/features/catalogue/types';
import { applyShoppingOps, type ShoppingOp } from './ops';
import { lineDetails, type LineDetail } from './lines';

export type ShoppingRow = { lines: CartLine[]; wishlist: string[]; updated_at: string };
export type ShoppingView = {
  signedIn: true;
  updatedAt: string | null;
  lines: (LineDetail & { quantity: number })[];
  wishlist: string[];
};

export async function loadShoppingRow(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from('shopping_state')
    .select('lines,wishlist,updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return (data as ShoppingRow | null) ?? null;
}

export function shoppingView(row: ShoppingRow | null, products: Product[]): ShoppingView {
  const quantities = new Map((row?.lines ?? []).map((l) => [l.variantId, l.quantity]));
  return {
    signedIn: true,
    updatedAt: row?.updated_at ?? null,
    lines: lineDetails([...quantities.keys()], products).map((line) => ({
      ...line,
      quantity: Math.min(quantities.get(line.variantId)!, line.variant.stock, 20),
    })),
    wishlist: row?.wishlist ?? [],
  };
}

/**
 * Applies one device's changes. The write only succeeds if the row is unchanged since it was
 * read (same updated_at); otherwise another device wrote first, so re-read and re-apply.
 */
export async function changeShopping(
  db: SupabaseClient,
  userId: string,
  ops: ShoppingOp[],
  products: Product[],
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await loadShoppingRow(db, userId);
    const next = applyShoppingOps(
      { lines: row?.lines ?? [], wishlist: row?.wishlist ?? [] },
      ops,
      products,
    );
    const values = {
      lines: next.lines,
      wishlist: next.wishlist,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = row
      ? await db
          .from('shopping_state')
          .update(values)
          .eq('user_id', userId)
          .eq('updated_at', row.updated_at)
          .select('user_id')
      : await db
          .from('shopping_state')
          .insert({ user_id: userId, ...values })
          .select('user_id');
    if (error && error.code !== '23505') throw error;
    if (!error && data?.length)
      return { ...shoppingView(values, products), adjusted: next.adjusted };
  }
  throw new AppError('Your bag changed on another device. Please try again.', 409, 'cart_conflict');
}
```

- [ ] **Step 5: Run the state test to verify it passes**

Run: `pnpm vitest run tests/unit/shopping-state.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the failing route test**

```ts
// tests/unit/shopping-route.test.ts
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
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/shopping-route.test.ts`
Expected: FAIL. `GET`/`PATCH` are not exported, and `save` is still accepted.

- [ ] **Step 8: Rewrite `app/api/shopping/route.ts`**

```ts
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { cartSchema } from '@/lib/validation';
import { requestSession } from '@/lib/supabase/server';
import { readJson, apiError, AppError } from '@/lib/security';
import { mergeCart } from '@/features/cart/merge';
import { shoppingOpsSchema } from '@/features/cart/ops';
import { changeShopping, loadShoppingRow, shoppingView } from '@/features/cart/state';
import { getProducts } from '@/features/catalogue/repository';

const noStore = { headers: { 'Cache-Control': 'no-store' } };
const mergeSchema = z.object({
  action: z.literal('merge'),
  lines: cartSchema,
  wishlist: z.array(z.uuid()).max(500),
});

export async function GET(request: Request) {
  try {
    const session = await requestSession(request);
    if (!session?.user) return Response.json({ signedIn: false }, noStore);
    const row = await loadShoppingRow(session.db, session.user.id);
    return Response.json(shoppingView(row, await getProducts()), noStore);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requestSession(request, { mutation: true });
    if (!session?.user) throw new AppError('Please sign in to update your bag.', 401);
    const { ops } = shoppingOpsSchema.parse(await readJson(request));
    const view = await changeShopping(session.db, session.user.id, ops, await getProducts());
    return Response.json(view, noStore);
  } catch (error) {
    return apiError(error);
  }
}

/** Joins a guest bag and wishlist to the account when a customer signs in. */
export async function POST(request: Request) {
  try {
    const session = await requestSession(request, { mutation: true });
    const parsed = mergeSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new AppError('Your shopping list needs to be refreshed');
    if (session?.mode !== 'bearer') {
      const jar = await cookies();
      if (!jar.get('oreva_guest'))
        jar.set('oreva_guest', randomBytes(32).toString('hex'), {
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 2592000,
          path: '/',
        });
    }
    if (!session?.user) return Response.json({ signedIn: false }, noStore);
    const { db, user } = session;
    const input = parsed.data;
    const existing = await loadShoppingRow(db, user.id);
    const products = await getProducts();
    const lines = mergeCart(input.lines, existing?.lines || [], products);
    const wishlist = [...new Set([...input.wishlist, ...(existing?.wishlist || [])])]
      .filter((id) => products.some((p) => p.id === id))
      .slice(0, 500);
    const { error } = await db
      .from('shopping_state')
      .upsert({ user_id: user.id, lines, wishlist, updated_at: new Date().toISOString() });
    if (error) throw error;
    return Response.json({ signedIn: true, userId: user.id, lines, wishlist }, noStore);
  } catch (error) {
    return apiError(error);
  }
}
```

- [ ] **Step 9: Run both tests to verify they pass**

Run: `pnpm vitest run tests/unit/shopping-state.test.ts tests/unit/shopping-route.test.ts tests/unit/commerce.test.ts`
Expected: PASS. (`commerce.test.ts` covers `mergeCart`, which is unchanged.)

- [ ] **Step 10: Commit**

```bash
git add features/cart/state.ts app/api/shopping/route.ts tests/support tests/unit/shopping-state.test.ts tests/unit/shopping-route.test.ts
git commit -m "feat: line-level cart API with concurrent write protection"
```

The web provider still sends `save` until Task 7. Do not deploy between Task 5 and Task 7.

---

### Task 6: Realtime publication migration

**Files:**

- Create: `supabase/migrations/202610050002_shopping_realtime.sql`
- Modify: `tests/integration/database.test.ts` (add one test at the end of the `describe`)

**Interfaces:**

- Produces: `public.shopping_state` in the `supabase_realtime` publication on hosted Supabase. The migration is a no-op where that publication does not exist (PGlite) and safe to run twice.

- [ ] **Step 1: Write the failing test**

Add inside the main `describe(...)` in `tests/integration/database.test.ts`:

```ts
it('publishes shopping_state to Realtime once the publication exists', async () => {
  const sql = await readFile('supabase/migrations/202610050002_shopping_realtime.sql', 'utf8');
  await db.exec('create publication supabase_realtime');
  await db.exec(sql);
  await db.exec(sql);
  const tables = await db.query<{ tablename: string }>(
    "select tablename from pg_publication_tables where pubname='supabase_realtime'",
  );
  expect(tables.rows).toEqual([{ tablename: 'shopping_state' }]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/integration/database.test.ts`
Expected: FAIL, `ENOENT` for the migration file.

If PGlite instead fails on `create publication` itself ("feature not supported"), remove this test, rely on `beforeAll` running the migration (which proves the guarded no-op path), and say so in the commit message.

- [ ] **Step 3: Write the migration**

```sql
-- Live cart sync: deliver shopping_state changes to its owner over Supabase Realtime.
-- The own_shopping RLS policy limits each subscriber to their own row. Clients treat an event
-- as a signal and refetch GET /api/shopping.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_state'
    )
  then
    alter publication supabase_realtime add table public.shopping_state;
  end if;
end $$;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run tests/integration/database.test.ts`
Expected: PASS (whole file, including the existing RLS tests).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202610050002_shopping_realtime.sql tests/integration/database.test.ts
git commit -m "feat: publish shopping state changes over Realtime"
```

---

### Task 7: Web cart provider: line operations and live refresh

**Files:**

- Create: `lib/supabase/browser.ts`, `features/cart/live.ts`
- Rewrite: `features/cart/provider.tsx` (the `useShopping()` context shape is unchanged)
- Test: `tests/component/shopping-sync.test.tsx`

**Interfaces:**

- Consumes: `ShoppingOp` type (Task 3); HTTP `GET`/`PATCH`/`POST merge` (Task 5); Realtime publication (Task 6).
- Produces: `browserClient(): SupabaseClient | null`; `subscribeToShopping(userId: string, onChange: () => void): Promise<() => void>`.

- [ ] **Step 1: Check for other users of the removed `save` action**

Run: `pnpm exec grep -rn "'save'" app features components tests --include=*.ts --include=*.tsx` (or use the editor search for `action: 'save'`).
Expected: only `features/cart/provider.tsx`. If an e2e test posts `save`, change it to a `PATCH` with ops in this task.

- [ ] **Step 2: Write the failing component test**

```tsx
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
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm vitest run tests/component/shopping-sync.test.tsx`
Expected: FAIL. `@/features/cart/live` does not exist, and the provider does not send `PATCH`.

- [ ] **Step 4: Add the browser client and the subscription**

```ts
// lib/supabase/browser.ts
'use client';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Reads the session from the same cookies the server sets; null when Supabase is not configured. */
export function browserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return (client ??= createBrowserClient(url, key));
}
```

```ts
// features/cart/live.ts
'use client';
import { browserClient } from '@/lib/supabase/browser';

/** Calls onChange whenever this customer's saved bag changes on any device. */
export async function subscribeToShopping(userId: string, onChange: () => void) {
  const supabase = browserClient();
  if (!supabase) return () => {};
  const { data } = await supabase.auth.getSession();
  if (!data.session) return () => {};
  // Without the customer's token Realtime applies RLS as anonymous and delivers nothing.
  await supabase.realtime.setAuth(data.session.access_token);
  const channel = supabase
    .channel(`shopping:${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'shopping_state', filter: `user_id=eq.${userId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}
```

- [ ] **Step 5: Rewrite `features/cart/provider.tsx`**

```tsx
'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { z } from 'zod';
import { cartSchema } from '@/lib/validation';
import type { CartLine } from '@/features/catalogue/types';
import type { ShoppingOp } from './ops';
import { subscribeToShopping } from './live';
type ShoppingContext = {
  lines: CartLine[];
  wishlist: string[];
  ready: boolean;
  notice: string;
  add: (id: string, quantity: number, stock: number) => boolean;
  update: (id: string, quantity: number) => void;
  clear: () => void;
  toggle: (id: string) => void;
  bagOpen: boolean;
  setBagOpen: (open: boolean) => void;
  notify: (message: string) => void;
};
type Remote = { lines: CartLine[]; wishlist: string[] };
const Context = createContext<ShoppingContext | null>(null);
const plain = (remote: Remote) =>
  remote.lines.map(({ variantId, quantity }) => ({ variantId, quantity }));
export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    let active = true;
    let localLines: CartLine[] = [];
    let localWishlist: string[] = [];
    try {
      localLines = cartSchema.parse(JSON.parse(localStorage.getItem('oreva-bag-v1') || '[]'));
      localWishlist = z
        .array(z.uuid())
        .max(500)
        .parse(JSON.parse(localStorage.getItem('oreva-wishlist-v1') || '[]'));
    } catch {
      /* Corrupt or unavailable storage starts empty. */
    }
    async function restore() {
      try {
        const response = await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'merge', lines: localLines, wishlist: localWishlist }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          const data = await response.json();
          if (active && data.signedIn) {
            setUserId(data.userId);
            localLines = data.lines;
            localWishlist = data.wishlist;
          }
        }
      } catch {
        /* Guest shopping remains usable while the network is unavailable. */
      }
      if (active) {
        setLines(localLines);
        setWishlist(localWishlist);
        setReady(true);
      }
    }
    void restore();
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem('oreva-bag-v1', JSON.stringify(lines));
      localStorage.setItem('oreva-wishlist-v1', JSON.stringify(wishlist));
    } catch {
      /* Session remains usable without storage. */
    }
  }, [lines, wishlist, ready]);
  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/shopping', { cache: 'no-store' });
      if (!response.ok) return;
      const data = await response.json();
      if (!data.signedIn) return;
      setLines(plain(data));
      setWishlist(data.wishlist);
    } catch {
      /* The next event or visit refreshes again. */
    }
  }, []);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let stop = () => {};
    void subscribeToShopping(userId, () => void refresh()).then((unsubscribe) => {
      if (active) stop = unsubscribe;
      else unsubscribe();
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      stop();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  /** Saves a change to the account; the optimistic local state is restored if it is refused. */
  const send = (ops: ShoppingOp[]) => {
    if (!userId) return;
    const previous = { lines, wishlist };
    fetch('/api/shopping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error('Rejected');
        const data = await response.json();
        setLines(plain(data));
        setWishlist(data.wishlist);
        if (data.adjusted.length) setNotice('Quantity updated to what’s in stock');
      })
      .catch(() => {
        setLines(previous.lines);
        setWishlist(previous.wishlist);
        setNotice('Your bag could not be updated. Please try again.');
      });
  };
  const add = (id: string, quantity: number, stock: number) => {
    const previous = lines.find((l) => l.variantId === id)?.quantity || 0;
    if (!ready || quantity < 1 || previous + quantity > Math.min(stock, 20)) return false;
    setLines([
      ...lines.filter((l) => l.variantId !== id),
      { variantId: id, quantity: previous + quantity },
    ]);
    send([{ op: 'add', variantId: id, quantity }]);
    setBagOpen(true);
    return true;
  };
  const update = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setLines(lines.filter((l) => l.variantId !== id));
      send([{ op: 'remove', variantId: id }]);
      return;
    }
    const capped = Math.min(20, quantity);
    setLines(lines.map((l) => (l.variantId === id ? { ...l, quantity: capped } : l)));
    send([{ op: 'set', variantId: id, quantity: capped }]);
  };
  const clear = () => {
    if (lines.length) send(lines.map((l) => ({ op: 'remove' as const, variantId: l.variantId })));
    setLines([]);
  };
  const toggle = (id: string) => {
    const saved = wishlist.includes(id);
    setWishlist(saved ? wishlist.filter((x) => x !== id) : [...wishlist, id]);
    send([{ op: saved ? 'unwish' : 'wish', productId: id }]);
    setNotice(saved ? 'Removed from your wishlist' : 'Saved to your wishlist');
  };
  return (
    <Context.Provider
      value={{
        lines,
        wishlist,
        ready,
        notice,
        add,
        update,
        clear,
        toggle,
        bagOpen,
        setBagOpen,
        notify,
      }}
    >
      {children}
      <div role="status" aria-live="polite" className={notice ? 'toast visible' : 'toast'}>
        {notice}
      </div>
    </Context.Provider>
  );
}
export function useShopping() {
  const context = useContext(Context);
  if (!context) throw new Error('ShoppingProvider is required');
  return context;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm vitest run tests/component`
Expected: PASS (the new file plus the existing `controls.test.tsx`).

- [ ] **Step 7: Commit**

```bash
git add lib/supabase/browser.ts features/cart/live.ts features/cart/provider.tsx tests/component/shopping-sync.test.tsx
git commit -m "feat: sync the web bag live with other devices"
```

---

### Task 8: Docs, full verification and deploy

**Files:**

- Modify: `docs/AUTH.md`, `docs/DATABASE.md`

- [ ] **Step 1: Document mobile sessions in `docs/AUTH.md`**

Add this section before "Customers own profiles, addresses…":

```markdown
## Mobile app sessions

The mobile app (`the-oreva-edit-mobile`) uses the same Supabase accounts. It sends `client: "mobile"` to POST /api/auth/sign-in, /sign-up and /forgot-password; those requests skip the same-origin check, set no cookies and return `{ session: { access_token, refresh_token, expires_at } }` with `Cache-Control: no-store`. Rate limits and error copy are identical to the web. The app stores the session in the device keychain/keystore and refreshes it with supabase-js.

Every other API call from the app sends `Authorization: Bearer <access token>`. `requestSession()` verifies it with Supabase `getUser` and never falls back to cookies; a missing, malformed or rejected token is 401 `session_expired`. Bearer requests skip the origin check because browsers cannot attach that header cross-site. Cookie requests keep it.
```

- [ ] **Step 2: Document the cart API and Realtime in `docs/DATABASE.md`**

Add after the RLS paragraph:

```markdown
## Cart sync

Clients change the saved bag with PATCH /api/shopping line operations (`add`, `set`, `remove`, `wish`, `unwish`), never by replacing the document. The server re-reads the row, applies the operations with stock and 20-per-line caps, and writes only if `updated_at` is unchanged, retrying up to three times before answering 409 `cart_conflict`. Capped or dropped variants are returned in `adjusted`.

`202610050002_shopping_realtime.sql` adds `shopping_state` to the `supabase_realtime` publication. RLS (`own_shopping`) limits events to the owner. Web and mobile subscribe with `user_id=eq.<uid>` and refetch GET /api/shopping on every event and when they return to the foreground.
```

- [ ] **Step 3: Run the full gate**

Run: `pnpm format && pnpm format:check && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all succeed. `pnpm build` also type-checks the route handler signatures.

- [ ] **Step 4: Run the browser suite**

Run: `pnpm test:e2e`
Expected: all existing specs pass, in particular `shopping.spec.ts` ("bag persists through reload", "bag quantities can be edited and items removed") and `authenticated.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add docs/AUTH.md docs/DATABASE.md
git commit -m "docs: mobile sessions and live cart sync"
```

- [ ] **Step 6: Deploy and verify live (needs the owner's go-ahead for each outward step)**

1. Ask the owner before pushing: `git push -u origin feat/mobile-sync`, then open a PR to `main`.
2. After merge, apply the migration to the hosted project: `pnpm dlx supabase link --project-ref <ref>` (once) and `pnpm dlx supabase db push`. Confirm in Supabase Dashboard → Database → Publications that `supabase_realtime` lists `shopping_state`.
3. Wait for the Vercel production deploy of `main` to finish.
4. API smoke test with a test account (replace the values):

   ```bash
   curl -s -X POST https://the-oreva-edit.vercel.app/api/auth/sign-in \
     -H "Content-Type: application/json" \
     -d '{"email":"TEST_EMAIL","password":"TEST_PASSWORD","client":"mobile"}'
   # → {"ok":true,"session":{"access_token":"…",…}}
   curl -s https://the-oreva-edit.vercel.app/api/shopping -H "Authorization: Bearer ACCESS_TOKEN"
   # → {"signedIn":true,…}
   curl -s https://the-oreva-edit.vercel.app/api/shopping -H "Authorization: Bearer bad.token.value"
   # → 401 {"error":"Please sign in again.","code":"session_expired"}
   curl -s "https://the-oreva-edit.vercel.app/api/catalogue/products?audience=men" | head -c 300
   ```

5. Live web-to-web check, which stands in for the phone until the app exists: sign in as the same account in Chrome and in a private Edge window. Add a piece in one, and the other's bag count updates within about 2 seconds without a reload. Change the quantity in the second, and the first updates.

The mobile app is planned separately in `docs/superpowers/plans/2026-10-05-mobile-sync-app.md`, written after this plan's API is deployed.
