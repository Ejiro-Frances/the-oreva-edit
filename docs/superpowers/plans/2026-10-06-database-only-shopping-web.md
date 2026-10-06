# Database-only shopping — Web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guests' and customers' bags and wishlists are stored only in the database. The web stops writing them to localStorage.

**Architecture:**

- A new `guest_shopping_state` table holds guest bags. Only the server can access it (RLS on, no policies), and it is keyed by the SHA-256 of a guest token. The token is the existing `oreva_guest` cookie on the web, or an `X-Guest-Token` header from the app.
- `/api/shopping` serves guests and customers through one store interface, with the same ops and the same `updated_at` conditional write for both.
- The cart provider drops all localStorage use. It uploads any legacy browser bag once, then deletes it.

**Tech Stack:** Next.js 16.3.8 route handlers, Supabase (secret-key server client for guest rows), Zod 4, Vitest 5 (+ jsdom, Testing Library), PGlite.

**Spec:** `docs/superpowers/specs/2026-10-06-database-only-shopping-design.md`

## Global Constraints

- Branch `feat/db-only-shopping`. pnpm. Never push. Conventional commits with no `Co-Authored-By` or AI attribution.
- `AGENTS.md`: read the relevant guide in `node_modules/next/dist/docs/` before changing route handlers. Route files export only HTTP handlers.
- Guest token: 64 lowercase hex characters. Store only `tokenHash(token)`. Never log it or put it in a URL. Header name `x-guest-token`. Cookie `oreva_guest`: HttpOnly, SameSite=Lax, `secure` in production, `maxAge` 2592000, path `/`.
- Cart limits (unchanged): quantity 1–20, capped at stock, ≤50 lines, ≤500 wishlist IDs.
- Copy (verbatim): "Your bag changed on another device. Please try again." (409 `cart_conflict`), "Please wait a little before trying again." (429), "Your bag could not be updated. Please try again.", "Quantity updated to what’s in stock", "You were signed out."
- Shopping responses send `Cache-Control: no-store`.
- Fixture mode (`isFixture()`, no Supabase) must keep guest shopping working: the e2e suite runs that way in CI.
- Gate per task: the focused tests, then `pnpm typecheck`, `pnpm lint`, and `pnpm exec prettier --check --end-of-line auto <touched files>`. Local `pnpm format:check` fails on CRLF working copies; that is an environment issue. Task 7 runs the full gate plus `pnpm build` and `pnpm test:e2e`. Before e2e, kill stale servers on port 3100 by PID only, never every node process.

## Review Focus

1. **One guest's token must never read or write another guest's or a customer's bag.** Keys are hashes of high-entropy tokens, and a malformed token is ignored (Task 2 and 4 tests).
2. **Signing in with a guest bag** merges it into the account and deletes the guest row exactly once. Signing in again later does not duplicate quantities, because the merge keeps the larger quantity (Task 4 test).
3. **Cross-site forgery:** a cookie request without the same Origin and without `X-Guest-Token` is still rejected (403) on PATCH and POST (Task 2 test).
4. **Fixture mode guest bag** survives a reload. The e2e "bag persists through reload" covers this in Task 7.
5. **Legacy localStorage bag** is uploaded once and then removed, never re-uploaded on the next visit. An account-owned copy is dropped, not uploaded (Task 6 test).

---

### Task 1: Guest table migration

**Files:**

- Create: `supabase/migrations/202610060001_guest_shopping.sql`
- Modify: `tests/integration/database.test.ts` (one test inside the main `describe`)

**Interfaces:**

- Produces: table `public.guest_shopping_state(guest_hash text pk, lines jsonb, wishlist uuid[], created_at, updated_at)`, RLS enabled, no policies.

- [ ] **Step 1: Write the failing test** (inside the main `describe` of `tests/integration/database.test.ts`)

```ts
it('keeps guest bags away from browsers', async () => {
  const hash = 'a'.repeat(64);
  await db.query(`insert into public.guest_shopping_state(guest_hash, lines) values ($1, '[]')`, [
    hash,
  ]);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`set role ${role}`);
    try {
      const visible = await db
        .query('select guest_hash from public.guest_shopping_state')
        .then((r) => r.rows.length)
        .catch(() => 0);
      expect(visible).toBe(0);
      await expect(
        db.query(`insert into public.guest_shopping_state(guest_hash) values ($1)`, [
          'b'.repeat(64),
        ]),
      ).rejects.toThrow();
    } finally {
      await db.exec('reset role');
    }
  }
  await expect(
    db.query(`insert into public.guest_shopping_state(guest_hash) values ('not-a-hash')`),
  ).rejects.toThrow();
  await db.query('delete from public.guest_shopping_state');
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/integration/database.test.ts`
Expected: FAIL, relation `public.guest_shopping_state` does not exist.

- [ ] **Step 3: Write the migration**

```sql
-- Guest bags and wishlists live in the database, never on the device. Rows are keyed by the
-- SHA-256 of a random guest token (the HttpOnly oreva_guest cookie on the web, a SecureStore
-- token in the app). Only the server reads or writes them, so RLS is on with no policies.
create table public.guest_shopping_state (
  guest_hash text primary key check (guest_hash ~ '^[0-9a-f]{64}$'),
  lines jsonb not null default '[]'
    check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) <= 50),
  wishlist uuid[] not null default '{}' check (cardinality(wishlist) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.guest_shopping_state enable row level security;
create index guest_shopping_state_updated_at on public.guest_shopping_state (updated_at);
```

If the `anon`/`authenticated` roles get default privileges on new public tables in this project's migrations (check `202610020001_core.sql` for `grant ... on all tables` or `alter default privileges`), add `revoke all on public.guest_shopping_state from anon, authenticated;`. RLS with no policies already blocks rows; the revoke makes direct access fail outright.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm vitest run tests/integration/database.test.ts`. Expected: PASS (whole file).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/202610060001_guest_shopping.sql tests/integration/database.test.ts
git commit -m "feat: add server-only guest shopping table"
```

---

### Task 2: Guest identity and the same-origin exemption

**Files:**

- Modify: `lib/security.ts`, `lib/supabase/server.ts`
- Create: `features/cart/guest-token.ts`
- Test: `tests/unit/guest-token.test.ts`, `tests/unit/request-session.test.ts` (add cases)

**Interfaces:**

- Produces:
  - `guestHeaderToken(request: Request): string | null` in `lib/security.ts`. Returns the `x-guest-token` header value only when it matches `/^[0-9a-f]{64}$/`.
  - `guestToken(request: Request, { create }: { create: boolean }): Promise<string | null>` in `features/cart/guest-token.ts`. Takes the header first, then a valid `oreva_guest` cookie. With `create`, and when there is no header, it creates the cookie. Every call with `create` also refreshes the cookie's `maxAge`.
  - `requestSession` mutations skip `sameOrigin` when `guestHeaderToken(request)` is present.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/unit/guest-token.test.ts
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
```

Add to `tests/unit/request-session.test.ts` inside `describe('requestSession', ...)`:

```ts
it('lets app guests (X-Guest-Token) mutate without an Origin, but not plain cookie requests', async () => {
  const guest = await requestSession(request({ 'X-Guest-Token': 'cd'.repeat(32) }), {
    mutation: true,
  });
  expect(guest?.mode).toBe('cookie');
  await expect(
    requestSession(request({ 'X-Guest-Token': 'not-valid' }), { mutation: true }),
  ).rejects.toMatchObject({ status: 403 });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm vitest run tests/unit/guest-token.test.ts tests/unit/request-session.test.ts`
Expected: FAIL. `guest-token` is not found, `guestHeaderToken` is not exported, and the new request-session case gets a 403.

- [ ] **Step 3: Implement**

Append to `lib/security.ts`:

```ts
const GUEST_TOKEN = /^[0-9a-f]{64}$/;
export const isGuestToken = (value: string | null | undefined): value is string =>
  !!value && GUEST_TOKEN.test(value);

/** The app's guest identifier. Browsers cannot attach this header cross-site without CORS. */
export function guestHeaderToken(request: Request) {
  const value = request.headers.get('x-guest-token');
  return isGuestToken(value) ? value : null;
}
```

In `lib/supabase/server.ts` `requestSession`, change `if (mutation) sameOrigin(request);` to:

```ts
// App guests send X-Guest-Token; a cross-site page cannot add that header without CORS.
if (mutation && !guestHeaderToken(request)) sameOrigin(request);
```

and import `guestHeaderToken` from `@/lib/security` alongside `AppError, sameOrigin`.

```ts
// features/cart/guest-token.ts
import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { guestHeaderToken, isGuestToken } from '@/lib/security';

const COOKIE = 'oreva_guest';
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 2592000,
  path: '/',
});

/**
 * Identifies a guest's bag: the app's X-Guest-Token header, else the browser's HttpOnly
 * oreva_guest cookie (shared with guest order access). With `create`, a browser without a valid
 * cookie gets a new random one, and an existing cookie's lifetime is renewed.
 */
export async function guestToken(request: Request, { create }: { create: boolean }) {
  const header = guestHeaderToken(request);
  if (header) return header;
  const jar = await cookies();
  const existing = jar.get(COOKIE)?.value;
  const token = isGuestToken(existing) ? existing : null;
  if (!create) return token;
  const value = token ?? randomBytes(32).toString('hex');
  jar.set(COOKIE, value, cookieOptions());
  return value;
}
```

- [ ] **Step 4: Run tests, gate, commit**

Run: `pnpm vitest run tests/unit/guest-token.test.ts tests/unit/request-session.test.ts`. Expected: PASS. Then run `pnpm typecheck` and `pnpm lint`.

```bash
git add lib/security.ts lib/supabase/server.ts features/cart/guest-token.ts tests/unit/guest-token.test.ts tests/unit/request-session.test.ts
git commit -m "feat: identify guest bags by cookie or app token"
```

---

### Task 3: One store interface for account and guest bags

**Files:**

- Modify: `features/cart/state.ts`
- Create: `features/cart/guest-store.ts`
- Test: `tests/unit/guest-store.test.ts`; `tests/unit/shopping-state.test.ts` must stay green unchanged

**Interfaces:**

- Consumes: `tokenHash` (`lib/security.ts`), `privilegedClient` (`lib/supabase/server.ts`), `isFixture` (`lib/config.ts`), `applyShoppingOps`, `ShoppingState`.
- Produces, in `state.ts`:
  - `type ShoppingStore = { signedIn: boolean; load(): Promise<ShoppingRow | null>; update(values: ShoppingValues, previous: string): Promise<boolean>; insert(values: ShoppingValues): Promise<boolean>; remove(): Promise<void> }`, where `type ShoppingValues = { lines: CartLine[]; wishlist: string[]; updated_at: string }`.
  - `userStore(db, userId): ShoppingStore`.
  - `writeStore(store, products, transform): Promise<ShoppingView & { adjusted: string[] }>`.
  - `shoppingView(row, products, signedIn = true)`, so `ShoppingView.signedIn` becomes `boolean`.
  - `writeShopping(db, userId, products, transform)` and `changeShopping(db, userId, ops, products)` keep their exact signatures, as wrappers over `writeStore(userStore(...))`.
- Produces, in `guest-store.ts`:
  - `guestStore(token): ShoppingStore`. It uses the Supabase secret-key client, or an in-memory store in fixture mode.
  - `deleteStaleGuests(before: Date): Promise<number>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/guest-store.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { products } from '@/features/catalogue/fixtures';

beforeEach(() => {
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
```

The fixture store is module state, and `vi.resetModules()` gives every test a fresh one.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/guest-store.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Refactor `features/cart/state.ts`**

Replace the `ShoppingView` type, `shoppingView`, and `writeShopping`/`changeShopping` with the code below. Keep `ShoppingRow` and `loadShoppingRow` unchanged.

```ts
export type ShoppingValues = { lines: CartLine[]; wishlist: string[]; updated_at: string };
export type ShoppingView = {
  signedIn: boolean;
  updatedAt: string | null;
  lines: (LineDetail & { quantity: number })[];
  wishlist: string[];
};

/** Where one bag is kept: a customer's row or a guest's row. */
export type ShoppingStore = {
  signedIn: boolean;
  load(): Promise<ShoppingRow | null>;
  /** Writes only if the row still has `previous` as updated_at; false when another write won. */
  update(values: ShoppingValues, previous: string): Promise<boolean>;
  /** False when a row already exists (another device created it first). */
  insert(values: ShoppingValues): Promise<boolean>;
  remove(): Promise<void>;
};

export function userStore(db: SupabaseClient, userId: string): ShoppingStore {
  return {
    signedIn: true,
    load: () => loadShoppingRow(db, userId),
    async update(values, previous) {
      const { data, error } = await db
        .from('shopping_state')
        .update(values)
        .eq('user_id', userId)
        .eq('updated_at', previous)
        .select('user_id');
      if (error) throw error;
      return !!data?.length;
    },
    async insert(values) {
      const { data, error } = await db
        .from('shopping_state')
        .insert({ user_id: userId, ...values })
        .select('user_id');
      if (error && error.code === '23505') return false;
      if (error) throw error;
      return !!data?.length;
    },
    async remove() {
      const { error } = await db.from('shopping_state').delete().eq('user_id', userId);
      if (error) throw error;
    },
  };
}

export function shoppingView(
  row: (Pick<ShoppingRow, 'lines' | 'wishlist'> & { updated_at: string | null }) | null,
  products: Product[],
  signedIn = true,
): ShoppingView {
  const quantities = new Map((row?.lines ?? []).map((l) => [l.variantId, l.quantity]));
  return {
    signedIn,
    updatedAt: row?.updated_at ?? null,
    lines: lineDetails([...quantities.keys()], products).map((line) => ({
      ...line,
      quantity: Math.min(quantities.get(line.variantId)!, line.variant.stock, 20),
    })),
    wishlist: row?.wishlist ?? [],
  };
}

type Transform = (state: ShoppingState) => {
  lines: CartLine[];
  wishlist: string[];
  adjusted: string[];
};

/**
 * Applies one device's changes to a bag. The write only succeeds if the row is unchanged since it
 * was read (same updated_at); otherwise another device wrote first, so re-read and re-apply.
 */
export async function writeStore(store: ShoppingStore, products: Product[], transform: Transform) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await store.load();
    const next = transform({ lines: row?.lines ?? [], wishlist: row?.wishlist ?? [] });
    const values = {
      lines: next.lines,
      wishlist: next.wishlist,
      updated_at: new Date().toISOString(),
    };
    const written = row ? await store.update(values, row.updated_at) : await store.insert(values);
    if (written)
      return { ...shoppingView(values, products, store.signedIn), adjusted: next.adjusted };
  }
  throw new AppError('Your bag changed on another device. Please try again.', 409, 'cart_conflict');
}

export function writeShopping(
  db: SupabaseClient,
  userId: string,
  products: Product[],
  transform: Transform,
) {
  return writeStore(userStore(db, userId), products, transform);
}

export function changeShopping(
  db: SupabaseClient,
  userId: string,
  ops: ShoppingOp[],
  products: Product[],
) {
  return writeShopping(db, userId, products, (state) => applyShoppingOps(state, ops, products));
}
```

The existing `tests/support/fake-shopping-db.ts` supports `select…maybeSingle`, `update().eq().eq().select()` and `insert().select()`, which `userStore` uses. Add `delete: () => ({ eq: async () => { row = null; return { error: null }; } })` to its `from()` builder so `remove()` works in later tests.

- [ ] **Step 4: Implement `features/cart/guest-store.ts`**

```ts
import 'server-only';
import { isFixture } from '@/lib/config';
import { tokenHash } from '@/lib/security';
import { privilegedClient } from '@/lib/supabase/server';
import type { ShoppingRow, ShoppingStore, ShoppingValues } from './state';

const TABLE = 'guest_shopping_state';

/** Fixture mode has no database; guest bags live in this process (e2e runs one server). */
const memory = ((globalThis as { __orevaGuestBags?: Map<string, ShoppingRow> }).__orevaGuestBags ??=
  new Map());

function fixtureStore(hash: string): ShoppingStore {
  return {
    signedIn: false,
    load: async () => (memory.has(hash) ? structuredClone(memory.get(hash)!) : null),
    async update(values: ShoppingValues, previous: string) {
      if (memory.get(hash)?.updated_at !== previous) return false;
      memory.set(hash, structuredClone(values));
      return true;
    },
    async insert(values: ShoppingValues) {
      if (memory.has(hash)) return false;
      memory.set(hash, structuredClone(values));
      return true;
    },
    async remove() {
      memory.delete(hash);
    },
  };
}

function databaseStore(hash: string): ShoppingStore {
  const db = privilegedClient();
  return {
    signedIn: false,
    async load() {
      const { data, error } = await db
        .from(TABLE)
        .select('lines,wishlist,updated_at')
        .eq('guest_hash', hash)
        .maybeSingle();
      if (error) throw error;
      return (data as ShoppingRow | null) ?? null;
    },
    async update(values, previous) {
      const { data, error } = await db
        .from(TABLE)
        .update(values)
        .eq('guest_hash', hash)
        .eq('updated_at', previous)
        .select('guest_hash');
      if (error) throw error;
      return !!data?.length;
    },
    async insert(values) {
      const { data, error } = await db
        .from(TABLE)
        .insert({ guest_hash: hash, ...values })
        .select('guest_hash');
      if (error && error.code === '23505') return false;
      if (error) throw error;
      return !!data?.length;
    },
    async remove() {
      const { error } = await db.from(TABLE).delete().eq('guest_hash', hash);
      if (error) throw error;
    },
  };
}

/** A guest's bag, found by the hash of their token; the token itself is never stored. */
export function guestStore(token: string): ShoppingStore {
  const hash = tokenHash(token);
  return isFixture() ? fixtureStore(hash) : databaseStore(hash);
}

/** Deletes guest bags not changed since `before`; returns how many were removed. */
export async function deleteStaleGuests(before: Date) {
  if (isFixture()) {
    let removed = 0;
    for (const [hash, row] of memory)
      if (row.updated_at < before.toISOString()) {
        memory.delete(hash);
        removed++;
      }
    return removed;
  }
  const { data, error } = await privilegedClient()
    .from(TABLE)
    .delete()
    .lt('updated_at', before.toISOString())
    .select('guest_hash');
  if (error) throw error;
  return data?.length ?? 0;
}
```

- [ ] **Step 5: Run tests, gate, commit**

Run: `pnpm vitest run tests/unit/guest-store.test.ts tests/unit/shopping-state.test.ts tests/unit/shopping-route.test.ts`. Expected: PASS. The last two are unchanged and still pass. Then run `pnpm typecheck` and `pnpm lint`.

```bash
git add features/cart/state.ts features/cart/guest-store.ts tests/unit/guest-store.test.ts tests/support/fake-shopping-db.ts
git commit -m "feat: store account and guest bags through one conditional-write interface"
```

---

### Task 4: `/api/shopping` for guests

**Files:**

- Rewrite: `app/api/shopping/route.ts`
- Test: `tests/unit/shopping-route.test.ts` (update and extend)

**Interfaces:**

- Consumes: `requestSession`, `guestToken` (Task 2); `guestStore`, `writeStore`, `userStore`, `shoppingView`, `loadShoppingRow` (Task 3); `rateLimit`, `clientIp`.
- Produces (HTTP, all `no-store`):
  - `GET`: customer view plus `userId`; guest view (`signedIn: false`); or an empty guest view when there is no identifier.
  - `PATCH {ops}`: customer or guest, returning the view plus `adjusted`. Guests are limited to 120 writes per 10 minutes per IP.
  - `POST {action:'merge', lines?, wishlist?}`:
    - **Signed in:** merges the guest row and any legacy body into the account, deletes the guest row, and returns the view plus `userId`.
    - **Guest:** merges any legacy body into the guest row and returns the guest view.

- [ ] **Step 1: Update the route tests**

Replace `tests/unit/shopping-route.test.ts` with the version below. It keeps the existing customer cases and adds the guest cases. Guests run on the fixture store (`DATA_MODE=fixture`) and the cookie jar is mocked.

```ts
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
```

- [ ] **Step 2: Run to verify the guest cases fail**

Run: `pnpm vitest run tests/unit/shopping-route.test.ts`. Expected: the guest and merge cases FAIL. The PATCH without a session currently returns 401.

- [ ] **Step 3: Rewrite the route**

```ts
import { z } from 'zod';
import { cartSchema } from '@/lib/validation';
import { requestSession } from '@/lib/supabase/server';
import { readJson, apiError } from '@/lib/security';
import { rateLimit } from '@/lib/rate-limit';
import { clientIp } from '@/lib/auth/accounts';
import { mergeCart } from '@/features/cart/merge';
import { applyShoppingOps, shoppingOpsSchema } from '@/features/cart/ops';
import { loadShoppingRow, shoppingView, userStore, writeStore } from '@/features/cart/state';
import { guestStore } from '@/features/cart/guest-store';
import { guestToken } from '@/features/cart/guest-token';
import { getProducts } from '@/features/catalogue/repository';
import type { Product } from '@/features/catalogue/types';

const noStore = { headers: { 'Cache-Control': 'no-store' } };
const mergeSchema = z.object({
  action: z.literal('merge'),
  // Legacy device bags (localStorage/AsyncStorage) are uploaded once through these fields.
  lines: cartSchema.optional().default([]),
  wishlist: z.array(z.uuid()).max(500).optional().default([]),
});
const knownWishlist = (ids: string[], products: Product[]) =>
  [...new Set(ids)].filter((id) => products.some((p) => p.id === id)).slice(0, 500);

export async function GET(request: Request) {
  try {
    const session = await requestSession(request);
    const products = await getProducts();
    if (session?.user) {
      const row = await loadShoppingRow(session.db, session.user.id);
      return Response.json({ ...shoppingView(row, products), userId: session.user.id }, noStore);
    }
    const token = await guestToken(request, { create: false });
    const row = token ? await guestStore(token).load() : null;
    return Response.json(shoppingView(row, products, false), noStore);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await requestSession(request, { mutation: true });
    const { ops } = shoppingOpsSchema.parse(await readJson(request));
    const products = await getProducts();
    const apply = (state: Parameters<typeof applyShoppingOps>[0]) =>
      applyShoppingOps(state, ops, products);
    if (session?.user) {
      const view = await writeStore(userStore(session.db, session.user.id), products, apply);
      return Response.json({ ...view, userId: session.user.id }, noStore);
    }
    await rateLimit(`guest-bag:${clientIp(request)}`, 120, 600);
    const token = (await guestToken(request, { create: true }))!;
    return Response.json(await writeStore(guestStore(token), products, apply), noStore);
  } catch (error) {
    return apiError(error);
  }
}

/**
 * Settles where the bag lives after sign-in or on first load: a signed-in customer absorbs the
 * guest bag (then it is deleted); a guest absorbs any legacy device bag sent in the body.
 */
export async function POST(request: Request) {
  try {
    const session = await requestSession(request, { mutation: true });
    const input = mergeSchema.parse(await readJson(request));
    const products = await getProducts();
    const token = await guestToken(request, { create: !session?.user });
    if (session?.user) {
      const guest = token ? guestStore(token) : null;
      const guestRow = guest ? await guest.load() : null;
      const incoming = mergeCart(input.lines, guestRow?.lines ?? [], products);
      const view = await writeStore(userStore(session.db, session.user.id), products, (state) => ({
        lines: mergeCart(incoming, state.lines, products),
        wishlist: knownWishlist(
          [...input.wishlist, ...(guestRow?.wishlist ?? []), ...state.wishlist],
          products,
        ),
        adjusted: [],
      }));
      if (guest && guestRow) await guest.remove();
      return Response.json({ ...view, userId: session.user.id }, noStore);
    }
    const store = guestStore(token!);
    if (!input.lines.length && !input.wishlist.length)
      return Response.json(shoppingView(await store.load(), products, false), noStore);
    const view = await writeStore(store, products, (state) => ({
      lines: mergeCart(input.lines, state.lines, products),
      wishlist: knownWishlist([...input.wishlist, ...state.wishlist], products),
      adjusted: [],
    }));
    return Response.json(view, noStore);
  } catch (error) {
    return apiError(error);
  }
}
```

`ZodError` from `mergeSchema.parse` becomes a 400 through `apiError` (`action: 'save'` fails the literal). The `x-forwarded-for` IP comes from `clientIp`.

- [ ] **Step 4: Run tests, gate, commit**

Run: `pnpm vitest run tests/unit/shopping-route.test.ts tests/unit/shopping-state.test.ts tests/unit/guest-store.test.ts`. Expected: PASS. Then run `pnpm typecheck` and `pnpm lint`.

```bash
git add app/api/shopping/route.ts tests/unit/shopping-route.test.ts
git commit -m "feat: serve guest bags from the database and merge them at sign-in"
```

---

### Task 5: Guest bag cleanup cron

**Files:**

- Create: `lib/cron.ts`, `app/api/internal/guest-cleanup/route.ts`
- Modify: `app/api/internal/email-worker/route.ts` (use `authoriseCron`), `vercel.json`
- Test: `tests/unit/guest-cleanup.test.ts`

**Interfaces:**

- Produces:
  - `authoriseCron(request: Request): void`. It throws `AppError(401)` unless the request carries `Authorization: Bearer ${CRON_SECRET}`, compared in constant time.
  - `GET`/`POST /api/internal/guest-cleanup` returns `{ deleted: number }` and removes guest bags older than 30 days.

- [ ] **Step 1: Write the failing test**

```ts
// tests/unit/guest-cleanup.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/guest-cleanup.test.ts`. Expected: FAIL, route not found.

- [ ] **Step 3: Implement**

```ts
// lib/cron.ts
import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@/lib/security';

/** Scheduled jobs (Vercel Cron, external schedulers) send Authorization: Bearer CRON_SECRET. */
export function authoriseCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get('authorization')?.replace(/^Bearer /, '');
  if (
    !expected ||
    !actual ||
    expected.length !== actual.length ||
    !timingSafeEqual(Buffer.from(expected), Buffer.from(actual))
  )
    throw new AppError('Unauthorised', 401);
}
```

In `app/api/internal/email-worker/route.ts`, delete the local `authorise` function and the `timingSafeEqual` import. Import `authoriseCron` from `@/lib/cron` and call it where `authorise(request)` was. Its behaviour is unchanged.

```ts
// app/api/internal/guest-cleanup/route.ts
import { authoriseCron } from '@/lib/cron';
import { apiError } from '@/lib/security';
import { deleteStaleGuests } from '@/features/cart/guest-store';

const DAYS = 30;

async function run(request: Request) {
  try {
    authoriseCron(request);
    const before = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000);
    return Response.json({ deleted: await deleteStaleGuests(before) });
  } catch (error) {
    return apiError(error);
  }
}

/** Vercel Cron sends GET; external schedulers may POST. Both need Authorization: Bearer CRON_SECRET. */
export const GET = run;
export const POST = run;
```

`vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "crons": [
    { "path": "/api/internal/email-worker", "schedule": "0 7 * * *" },
    { "path": "/api/internal/guest-cleanup", "schedule": "30 3 * * *" }
  ]
}
```

- [ ] **Step 4: Run tests, gate, commit**

Run: `pnpm vitest run tests/unit/guest-cleanup.test.ts tests/unit/email-outbox.test.ts`. Expected: PASS. Then run `pnpm typecheck` and `pnpm lint`.

```bash
git add lib/cron.ts app/api/internal vercel.json tests/unit/guest-cleanup.test.ts
git commit -m "feat: delete guest bags unused for 30 days"
```

---

### Task 6: Web cart provider without localStorage

**Files:**

- Rewrite: `features/cart/provider.tsx` (the `useShopping()` context shape is unchanged)
- Rewrite: `tests/component/shopping-sync.test.tsx`

**Interfaces:**

- Consumes: the Task 4 HTTP contract and `subscribeToShopping(userId, onChange)` (unchanged, `features/cart/live.ts`).
- Produces: the same `useShopping()` API: `lines, wishlist, ready, notice, add, update, clear, toggle, bagOpen, setBagOpen, notify`.

- [ ] **Step 1: Write the failing component test (replace the file)**

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

  it('becomes a guest when the session ends', async () => {
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/component/shopping-sync.test.tsx`. Expected: FAIL. The current provider writes localStorage and skips `PATCH` for guests.

- [ ] **Step 3: Rewrite `features/cart/provider.tsx`**

```tsx
'use client';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
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
/** Keys from when the bag lived in the browser; read once to hand over, then deleted. */
const LEGACY_KEYS = {
  bag: 'oreva-bag-v1',
  wishlist: 'oreva-wishlist-v1',
  owner: 'oreva-bag-owner',
};
const plain = (remote: Remote) =>
  remote.lines.map(({ variantId, quantity }) => ({ variantId, quantity }));

/** A guest bag left in localStorage by an older version; an account's copy is not uploaded. */
function readLegacy(): Remote {
  try {
    if (localStorage.getItem(LEGACY_KEYS.owner)) return { lines: [], wishlist: [] };
    return {
      lines: cartSchema.parse(JSON.parse(localStorage.getItem(LEGACY_KEYS.bag) || '[]')),
      wishlist: z
        .array(z.uuid())
        .max(500)
        .parse(JSON.parse(localStorage.getItem(LEGACY_KEYS.wishlist) || '[]')),
    };
  } catch {
    return { lines: [], wishlist: [] };
  }
}
function forgetLegacy() {
  try {
    for (const key of Object.values(LEGACY_KEYS)) localStorage.removeItem(key);
  } catch {
    /* Storage unavailable: nothing to remove. */
  }
}

export function ShoppingProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState('');
  const [bagOpen, setBagOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  /** Only the newest PATCH or refresh may set the bag, so a slow older reply cannot undo it. */
  const sequence = useRef(0);
  /** The last rendered bag, restored when a change cannot be saved or checked. */
  const committed = useRef<Remote>({ lines: [], wishlist: [] });
  const notify = useCallback((message: string) => setNotice(message), []);
  useEffect(() => {
    committed.current = { lines, wishlist };
  }, [lines, wishlist]);
  /** Shows a bag the server returned (customer or guest). */
  const adopt = useCallback((data: Remote & { signedIn?: boolean; userId?: string }) => {
    setLines(plain(data));
    setWishlist(data.wishlist);
    setUserId(data.signedIn && data.userId ? data.userId : null);
  }, []);
  useEffect(() => {
    let active = true;
    const legacy = readLegacy();
    async function restore() {
      try {
        // Settles the bag on the server: a customer absorbs their guest bag, and any bag an older
        // version left in this browser is handed over once.
        const response = await fetch('/api/shopping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'merge', ...legacy }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.ok) {
          forgetLegacy();
          if (active) adopt(await response.json());
        }
      } catch {
        /* Offline: the bag shows once the server can be reached. */
      }
      if (active) setReady(true);
    }
    void restore();
    return () => {
      active = false;
    };
  }, [adopt]);
  /** Shows the server's bag. Resolves false when it could not be read. */
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const response = await fetch('/api/shopping', { cache: 'no-store' });
      if (!response.ok) return false;
      const data = await response.json();
      if (request === sequence.current) adopt(data);
      return true;
    } catch {
      return false;
    }
  }, [adopt]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let stop = () => {};
    void subscribeToShopping(userId, () => void refresh()).then((unsubscribe) => {
      if (active) stop = unsubscribe;
      else unsubscribe();
    });
    return () => {
      active = false;
      stop();
    };
  }, [userId, refresh]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  /**
   * Saves a change (customer or guest). If it is refused the server's bag is fetched and shown;
   * if that fails too, the bag from before the change is restored.
   */
  const send = (ops: ShoppingOp[]) => {
    const previous = committed.current;
    const request = ++sequence.current;
    fetch('/api/shopping', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }),
    })
      .then(async (response) => {
        if (response.status === 401) {
          // The session ended elsewhere: show this browser's guest bag instead.
          setUserId(null);
          setNotice('You were signed out.');
          await refresh();
          return;
        }
        if (!response.ok) throw new Error('Rejected');
        const data = await response.json();
        if (request !== sequence.current) return;
        adopt(data);
        if (data.adjusted?.length) setNotice('Quantity updated to what’s in stock');
      })
      .catch(async () => {
        setNotice('Your bag could not be updated. Please try again.');
        if (request !== sequence.current) return;
        const adopted = await refresh();
        if (!adopted && request + 1 === sequence.current) {
          setLines(previous.lines);
          setWishlist(previous.wishlist);
        }
      });
  };
  const add = (id: string, quantity: number, stock: number) => {
    const previous = lines.find((l) => l.variantId === id)?.quantity || 0;
    if (!ready || quantity < 1 || previous + quantity > Math.min(stock, 20)) return false;
    setLines((current) => {
      const existing = current.find((l) => l.variantId === id)?.quantity || 0;
      return [
        ...current.filter((l) => l.variantId !== id),
        { variantId: id, quantity: Math.min(existing + quantity, stock, 20) },
      ];
    });
    send([{ op: 'add', variantId: id, quantity }]);
    setBagOpen(true);
    return true;
  };
  const update = (id: string, quantity: number) => {
    if (quantity <= 0) {
      setLines((current) => current.filter((l) => l.variantId !== id));
      send([{ op: 'remove', variantId: id }]);
      return;
    }
    const capped = Math.min(20, quantity);
    setLines((current) =>
      current.map((l) => (l.variantId === id ? { ...l, quantity: capped } : l)),
    );
    send([{ op: 'set', variantId: id, quantity: capped }]);
  };
  const clear = () => {
    if (lines.length) send(lines.map((l) => ({ op: 'remove' as const, variantId: l.variantId })));
    setLines([]);
  };
  const toggle = (id: string) => {
    const saved = wishlist.includes(id);
    setWishlist((current) =>
      saved ? current.filter((x) => x !== id) : current.includes(id) ? current : [...current, id],
    );
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

- [ ] **Step 4: Run tests, gate, commit**

Run: `pnpm vitest run tests/component`. Expected: PASS, including the existing `controls.test.tsx`. Then run `pnpm typecheck` and `pnpm lint`.

Search for any other localStorage use of these keys: `grep -rn "oreva-bag\|oreva-wishlist\|localStorage" app features components lib`. Expected: only the legacy read and removal in `provider.tsx`.

```bash
git add features/cart/provider.tsx tests/component/shopping-sync.test.tsx
git commit -m "feat: keep the web bag and wishlist only on the server"
```

---

### Task 7: Copy, docs and full verification

**Files:**

- Modify: `features/content/information.tsx`, `app/error.tsx`, `docs/AUTH.md`, `docs/DATABASE.md`, `docs/DEPLOYMENT.md` (cron list, if it lists crons)

- [ ] **Step 1: Customer-facing copy**

- `app/error.tsx`: change "Your bag is still saved on this device." to "Your bag is still saved."
- `features/content/information.tsx`: rename the section heading `'Cookies and local storage'` to `'Cookies'`, and replace its body with:

  > Essential authentication cookies maintain your session. An HttpOnly guest cookie protects access to guest orders and identifies a guest's bag and wishlist, which we store on our servers and delete after 30 days without use. Signed-in bags and wishlists are saved to your account. There are no optional analytics or advertising scripts, and no optional tracking is pre-enabled. Clearing cookies starts a new guest bag and removes guest order access.

  If a test or e2e spec asserts the old heading or text, update it to the new copy.

- [ ] **Step 2: Docs**

- `docs/DATABASE.md`:
  - **Shopping line:** "Shopping: shopping_state (one owned document per customer) and guest_shopping_state (server-only, keyed by the SHA-256 of the guest token, deleted after 30 days unused). No shopping data is stored on the device."
  - **Cart sync section:** add that guests use the same ops and conditional write against `guest_shopping_state`, and that `POST merge` moves a guest bag into the account and deletes it.
- `docs/AUTH.md`:
  - **Replace the "Guest cart/wishlist survive reload…" paragraph:** guest bags and wishlists live in `guest_shopping_state`. The browser is identified by the HttpOnly `oreva_guest` cookie, the app by `X-Guest-Token` from SecureStore, and only the hash is stored. On sign-in the guest bag merges into the account (union, larger quantity per variant, stock/20 caps), then the guest row is deleted. Sign-out shows an empty guest bag, and no account data stays in the browser. Requests carrying `X-Guest-Token` skip the same-origin check because browsers cannot attach that header cross-site without CORS.
  - **The existing "Guest order access uses…" sentences:** keep them.
- `docs/DEPLOYMENT.md`: if it lists crons or migrations, add `/api/internal/guest-cleanup` (daily, `CRON_SECRET`) and `202610060001_guest_shopping.sql`.

- [ ] **Step 3: Full gate**

Run: `pnpm exec prettier --check --end-of-line auto . && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: all pass.

- [ ] **Step 4: E2E**

Kill any stale server on port 3100 by PID (`netstat -ano | grep :3100`, then `taskkill /PID <pid> /T /F`), then run `pnpm test:e2e`.
Expected: 0 failures. The Supabase-backed specs skip without local Supabase. These must pass on the fixture guest store:

- "bag persists through reload",
- "bag quantities can be edited and items removed",
- "wishlist saves and removes a product without reload",
- "guest checkout takes a simulated payment…".

If the fixture orders file has run out of stock, reset `.data/e2e-orders.json` (git-ignored) and say so.

- [ ] **Step 5: Commit**

```bash
git add features/content/information.tsx app/error.tsx docs/AUTH.md docs/DATABASE.md docs/DEPLOYMENT.md
git commit -m "docs: explain database-only shopping and the guest cookie"
```

Deploying is the owner's step:

- merge the PR;
- run `supabase db push` for `202610060001_guest_shopping.sql`;
- check that `CRON_SECRET` is set in Vercel (the email worker already needs it);
- confirm Vercel shows both crons.
