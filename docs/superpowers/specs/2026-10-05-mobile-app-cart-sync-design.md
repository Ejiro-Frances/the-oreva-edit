# Mobile app with shared account and live cart sync — Phase 1 design

Date: 5 October 2026
Repos: `the-oreva-edit` (web, Next.js 16) and `the-oreva-edit-mobile` (Expo SDK 57)

## Brief

Build a mobile app for the existing shop using the same API endpoints. Customers sign in to the website and the app with one account. An item added to the cart on the website must appear in the app's cart instantly. Login and cart sync must be verified on a physical phone.

## Agreed scope

Full parity is delivered in three phases, each with its own plan:

1. **Phase 1 (this spec, meets the brief):** web API changes; mobile email/password sign-in, sign-up, forgot password and sign-out; catalogue with audience/category filters; product page with variant selection; bag with quantity changes; guest bag merged on sign-in; live two-way cart sync. Verified on a physical phone against `https://the-oreva-edit.vercel.app`.
2. **Phase 2:** wishlist, order history, checkout in test-order mode.
3. **Phase 3:** Google sign-in on mobile, preserving `claimAccountWithGoogle` pre-account takeover protection.

Out of scope for Phase 1: wishlist UI (the wishlist is still preserved by the cart endpoints), orders, checkout, Google, push notifications, store builds (Expo Go is sufficient), Expo web.

## Decisions

- The mobile app calls the web's `/api/*` routes for every read and write. It uses supabase-js only to hold and refresh the session and to receive Realtime events.
- Mobile requests authenticate with `Authorization: Bearer <Supabase access token>`. The browser keeps cookie sessions.
- Cart writes are line operations, not whole-document replacement, so concurrent devices cannot overwrite each other.
- Instant sync uses Supabase Realtime `postgres_changes` on `shopping_state`. Events are signals only; clients refetch `GET /api/shopping`.
- The mobile repo copies the Zod schemas and types it needs rather than sharing a package.

## Web changes (`the-oreva-edit`)

### Request authentication

New helper in `lib/supabase/server.ts`:

```ts
requestSession(request): Promise<{ db: SupabaseClient; user: User | null; mode: 'bearer' | 'cookie' } | null>
```

- If the `Authorization` header is present it must be `Bearer <jwt>`. The helper creates a supabase-js client with that header (no session persistence), calls `auth.getUser(jwt)` and ignores cookies entirely. An invalid or expired token is a 401 (`code: 'session_expired'`), never a fallback to cookies.
- Without the header it uses the existing cookie `sessionClient()` and calls `sameOrigin(request)` for mutations.
- `sameOrigin` is skipped only for bearer requests. Browsers do not attach bearer headers automatically, so they cannot be forged cross-site.
- Returns `null` when Supabase is not configured (fixture mode), matching existing behaviour.

### Mobile sign-in and sign-up

`POST /api/auth/sign-in` and `POST /api/auth/sign-up` accept an optional `client: 'mobile'` in the body (added to the shared schemas).

- Mobile mode skips `sameOrigin`, uses a Supabase client that does not write cookies, and returns:

  ```json
  { "ok": true, "session": { "access_token": "…", "refresh_token": "…", "expires_at": 1759700000 } }
  ```

- Validation, rate limits and error messages are unchanged ("Email or password is incorrect", account-exists on sign-up).
- Sign-up's phone save uses the new session's client.
- `POST /api/auth/forgot-password` also accepts `client: 'mobile'` to skip `sameOrigin`. The emailed link continues to open the website.
- Sign-out on mobile is `supabase.auth.signOut()` on the device, which revokes the refresh token. No new route.
- The response must never be cached (`Cache-Control: no-store`).

### Catalogue read endpoints

Public, built on `features/catalogue/repository.ts`, with `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`:

| Route                                                   | Response                                                                                  |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `GET /api/catalogue/categories`                         | `{ categories: Category[] }` (active only)                                                |
| `GET /api/catalogue/products?audience=&category=&page=` | `{ products: ProductSummary[], page, pageSize: 12, total }`                               |
| `GET /api/catalogue/products/[slug]`                    | `{ product: Product }` or 404 `{ error }`                                                 |
| `GET /api/catalogue/variants?ids=a,b`                   | `{ lines: LineDetail[] }` for up to 50 variant UUIDs; unknown or out-of-stock IDs omitted |

`ProductSummary` = `id, slug, name, price, compare_at, image, alt, audience, category, inStock`. `LineDetail` is the `{ variantId, product, variant }` shape used by `GET /api/shopping` (without `quantity`), built by one shared function. Filtering reuses the same logic as the web catalogue pages (category includes populated descendants). Query parameters are validated with Zod; an unknown audience/category returns an empty list, a bad page returns 400.

### Cart endpoints (`app/api/shopping/route.ts`)

All accept both auth modes via `requestSession`.

- **`GET /api/shopping`**: `{ signedIn: false }` when there is no session; otherwise

  ```json
  {
    "signedIn": true,
    "updatedAt": "…",
    "lines": [
      {
        "variantId": "…",
        "quantity": 2,
        "product": { "id": "…", "slug": "…", "name": "…", "image": "…", "price": 1500000 },
        "variant": { "attributes": { "Colour": "Oxblood", "Size": "M" }, "price": null, "stock": 4 }
      }
    ],
    "wishlist": ["…"]
  }
  ```

  Lines whose variant no longer exists or is out of stock are omitted (same rule as `mergeCart`).

- **`PATCH /api/shopping`**: body `{ ops: Op[] }`, 1–20 ops, where
  `Op = { op: 'add', variantId, quantity } | { op: 'set', variantId, quantity } | { op: 'remove', variantId }` (quantities 1–20; `set` 0 is rejected, use `remove`).
  - Pure function `applyCartOps(lines, ops, products)` in `features/cart/ops.ts`: `add` increments, `set` replaces, `remove` deletes; each line is capped at `min(stock, 20)`; at most 50 lines. Returns `{ lines, adjusted: variantId[] }` listing lines that were capped or dropped.
  - Write path: read `lines, updated_at`; apply; `update … where user_id = $1 and updated_at = $previous` (or insert if no row). If no row updated, retry up to 3 times, then 409 `code: 'cart_conflict'`.
  - Response: the `GET` shape plus `adjusted`.
  - 401 without a session.
- **`POST /api/shopping` `merge`** stays as is for guest → account merge, now also accepted with bearer auth. The guest cookie is only set for cookie requests. The `save` action is removed once the web provider uses `PATCH`.

### Realtime

Migration `202610050002_shopping_realtime.sql`:

```sql
alter publication supabase_realtime add table public.shopping_state;
```

Existing own-row RLS (`own_shopping`) restricts delivered events to the owner. Clients subscribe with filter `user_id=eq.<uid>` and treat any event as "refetch `GET /api/shopping`". The PGlite integration test setup must tolerate the publication (create it if absent in the test harness).

### Web cart provider (`features/cart/provider.tsx`)

- Adds `lib/supabase/browser.ts` (`createBrowserClient` from `@supabase/ssr`, reading the existing session cookies).
- When signed in: `add`/`update`/remove send `PATCH` ops immediately (optimistic local state; on failure, revert and show the existing "Account sync is unavailable" toast); subscribes to the Realtime channel and refetches on each event and when the tab regains visibility.
- Guests are unchanged: localStorage only, merge on sign-in.
- Its own changes echo back as events; the refetch is idempotent.

### Web tests

- Unit: `applyCartOps` (increment, set, remove, stock cap, 20 cap, 50-line cap, unknown variant dropped, `adjusted` reporting).
- Route: bearer valid → user's cart; bearer invalid → 401; cookie request without origin on `PATCH` → 403; bearer request without origin → allowed; mobile sign-in returns a session and sets no cookies; catalogue endpoints validate params and return 404 for unknown slugs.
- Integration (PGlite): optimistic `updated_at` write and retry.
- E2E: existing shopping suite stays green.

## Mobile app (`the-oreva-edit-mobile`)

### Configuration

`.env` (committed as `.env.example`, real file git-ignored):

```
EXPO_PUBLIC_API_URL=https://the-oreva-edit.vercel.app
EXPO_PUBLIC_SUPABASE_URL=…
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=…
```

All Phase 1 dependencies are included in Expo Go; no development build is needed. Move `jest` and `jest-expo` to `devDependencies`. Remove the template's demo screens and assets. Set the app name to "The Oreva Edit" and use the brand colours for the splash and adaptive icon background.

### Structure

```
src/app/                      routes only
  _layout.tsx                 fonts, QueryClientProvider, AuthProvider, CartSync, Stack
  (tabs)/_layout.tsx          Shop · Bag (count badge) · Account
  (tabs)/index.tsx            catalogue: audience + category filters, paged grid
  (tabs)/bag.tsx              lines, quantity steppers, remove, subtotal
  (tabs)/account.tsx          signed in: name, email, sign out; guest: sign-in / create account
  product/[slug].tsx          images, variant picker, add to bag
  sign-in.tsx                 modal
  sign-up.tsx                 modal
  forgot-password.tsx         modal
src/lib/api.ts                fetch wrapper
src/lib/supabase.ts           client, SecureStore storage adapter, foreground refresh
src/lib/schemas.ts            Zod schemas copied from web
src/lib/money.ts              kobo → "₦15,000"
src/features/auth/            AuthProvider, useAuth
src/features/cart/            useCart, useCartOps, useCartRealtime, guest bag store
src/features/catalogue/       useCategories, useProducts, useProduct, variant selection
src/components/               ProductCard, Price, Button, Field, Banner, theme tokens
```

### Units

- **`api.ts`**: `api<T>(path, { method, body, auth })` prefixes `EXPO_PUBLIC_API_URL`, adds `Authorization` from the current Supabase session when `auth` is set, applies an 8 s timeout and maps failures to `ApiError { status, message, code }` (`network` when unreachable). On 401 with `code: 'session_expired'` it refreshes the session once and retries; if refresh fails it signs out.
- **`supabase.ts`**: `createClient(url, key, { auth: { storage: secureStoreAdapter, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } })`. `secureStoreAdapter` implements `getItem/setItem/removeItem`, splitting values into ≤1800-byte chunks (`key.0…key.n` plus `key.count`) because SecureStore values are size-limited. `AppState` listener calls `startAutoRefresh`/`stopAutoRefresh`.
- **`AuthProvider`**: `signIn(email, password)` and `signUp(input)` call the API with `client: 'mobile'` and pass the returned tokens to `supabase.auth.setSession`; then merge the guest bag (`POST /api/shopping` `merge`) and clear it. `signOut()` calls `supabase.auth.signOut()` and clears the cart query. Exposes `{ user, ready }` from `onAuthStateChange`.
- **Cart**: one interface, two backends.
  - Signed in: `useCart` is a React Query query on `GET /api/shopping`; `useCartOps` is a mutation on `PATCH` with optimistic update and rollback, and shows `adjusted` as "Quantity updated to what's in stock".
  - Guest: lines in AsyncStorage (`oreva-bag-v1`), validated with the copied `cartSchema`; line details come from `GET /api/catalogue/variants`.
- **`useCartRealtime`**: while signed in, subscribes to `postgres_changes` on `public.shopping_state` with `user_id=eq.<uid>`; on any event, invalidates the cart query. Refetches when the app returns to the foreground. Unsubscribes on sign-out.
- **Forms**: React Hook Form + copied Zod schemas, same rules and messages as web (password 8–72 with show/hide, optional Nigerian mobile number). Errors keep everything typed except the password.

### Error handling

- `network` errors: a "Can't reach the store" banner with Retry; the guest bag still works offline.
- Server `{ error }` messages are shown as-is (they are already user-facing).
- Cart conflict (409): refetch and retry the op once, then show the error.

### Visual design

Matches the web: bone background, ink text, oxblood primary actions, muted olive accents; Cormorant Garamond for display, Manrope for text; Lucide icons; square edges. Respects safe areas, dynamic type and accessibility labels on icon buttons.

### Mobile tests and checks

- jest-expo unit tests: `secureStoreAdapter` chunking round-trip, `api` error mapping and single refresh-retry, guest bag add/set/remove/caps, `money` formatting, variant selection.
- `npx expo lint` and `npx tsc --noEmit` pass.

## Physical phone verification

Run with `npx expo start` and Expo Go on an Android or iOS phone, API pointed at production after the web PR is deployed.

1. Create an account on the phone; sign in with it on the web in a desktop browser.
2. On the web, add a product variant. The phone's Bag shows it within about 2 seconds without any touch.
3. On the phone, change the quantity. The web bag updates within about 2 seconds.
4. Remove the line on the web; it disappears on the phone.
5. Sign out on the phone, add an item as a guest, sign in: the guest item is merged into the account bag and appears on the web.
6. Background the app, add an item on the web, reopen the app: the item is there.
7. Turn on airplane mode: the banner appears; turn it off and Retry recovers.

Record a short screen recording of steps 2 and 3 as evidence.

## Rollout order

1. Web PR (`feat/mobile-sync`): auth helper, routes, ops, provider, migration, tests, docs (`AUTH.md`, `DATABASE.md`).
2. Apply the migration to the hosted Supabase project (`supabase db push`) and deploy to Vercel.
3. Mobile app built against the deployed API, then the phone verification.
