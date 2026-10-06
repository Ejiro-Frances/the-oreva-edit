# Shopping data in the database only

Date: 6 October 2026
Repos: `the-oreva-edit` (web) and `the-oreva-edit-mobile` (Expo app)
Builds on: `2026-10-05-mobile-app-cart-sync-design.md`

## Decision

The bag and the wishlist are never stored on the device again, for guests or for signed-in customers, on the web or in the app. Only the database holds them. The device keeps nothing but an opaque guest identifier: the existing HttpOnly `oreva_guest` cookie on the web, and a random token in SecureStore in the app.

Reasons: the owner wants one source of truth, and wants a signed-out shared computer to show no trace of an account's bag.

## Behaviour

- A guest's bag and wishlist survive reloads and closing the browser or app, because they are in the database.
- A new guest bag starts when the guest identifier is lost:
  - **Web:** clearing cookies.
  - **Android:** reinstalling the app, because app data is wiped on uninstall.
  - **iOS:** the keychain keeps the guest token across an uninstall, so a reinstalled app gets the same guest bag back for as long as the server keeps it (30 days after its last change). The owner chose this behaviour on 6 October 2026.
- When a guest signs in, their guest bag and wishlist move into the account (same merge rule as today: union, larger quantity per variant, caps). The guest row is then deleted.
- Signing out shows an empty guest bag. The account's items stay in the account.
- Guest checkout keeps working. The bag it reads comes from the server.
- Offline, changes cannot be saved. They roll back with "Your bag could not be updated. Please try again." (or the network message in the app).
- Guest bags untouched for 30 days are deleted daily.

## Database

Migration `202610060001_guest_shopping.sql`:

```sql
create table public.guest_shopping_state (
  guest_hash text primary key check (guest_hash ~ '^[0-9a-f]{64}$'),
  lines jsonb not null default '[]' check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) <= 50),
  wishlist uuid[] not null default '{}' check (cardinality(wishlist) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.guest_shopping_state enable row level security;
-- No policies: only the server (secret key) reads or writes guest bags.
create index guest_shopping_state_updated_at on public.guest_shopping_state (updated_at);
```

It is not added to the Realtime publication.

## Guest identity

- `guest_hash = sha256(token)` using the existing `tokenHash()`. The raw token is never stored, logged or put in a URL.
- **Web:** the `oreva_guest` cookie (64 hex chars, HttpOnly, SameSite=Lax, Secure in production, 30 days). It is created on the first shopping request that needs it, and its `maxAge` is refreshed on every write. Guest order lookup already uses the same cookie.
- **App:** a 64-hex token from `expo-crypto`, kept in SecureStore under `oreva-guest-token` and sent as `X-Guest-Token` on `/api/shopping` calls.
- The token is chosen in this order: the `X-Guest-Token` header if it is valid (64 hex characters), otherwise the cookie.
- **Same-origin check:** requests carrying `X-Guest-Token` skip it, the same way bearer requests already do. A browser cannot attach a custom header to a cross-site request without a CORS preflight, which the server never grants.

## API (`/api/shopping`)

All responses `Cache-Control: no-store`. View shape for both cases:

```json
{ "signedIn": true | false, "userId"?: "…", "updatedAt": "…" | null,
  "lines": [{ "variantId", "quantity", "product": {…}, "variant": {…} }], "wishlist": ["…"] }
```

- **`GET`**
  - **Signed in:** the account bag, as today.
  - **Guest with an identifier:** that guest's bag.
  - **No identifier:** an empty bag with `signedIn: false`.
- **`PATCH { ops }`**
  - **Signed in:** as today.
  - **Guest:** the same ops (`add`/`set`/`remove`/`wish`/`unwish`) and the same caps, applied to the guest row with the same `updated_at` conditional write and retries (409 `cart_conflict`).
  - **Guest identifier:** created on demand (web cookie), or taken from the header (app).
  - **Rate limit:** guest writes are limited to 120 per 10 minutes per IP (429).
- **`POST { action: 'merge', lines?, wishlist? }`**
  - **Signed in:** merges the guest row (if any) plus any legacy `lines`/`wishlist` from the body into the account using the conditional write, then deletes the guest row. Returns the view with `userId`.
  - **Guest:** merges any legacy `lines`/`wishlist` from the body into the guest row, creating it if needed, and returns the guest view.
  - **Legacy fields:** `lines` and `wishlist` are optional and kept for one release. They let devices that still hold an old localStorage or AsyncStorage bag hand it over once.

Fixture mode (no Supabase) uses an in-memory guest store with the same interface. Signed-in shopping is unavailable there, as today.

## Cleanup

- A new cron route, `/api/internal/guest-cleanup` (`GET`/`POST`), deletes guest rows with `updated_at` older than 30 days.
- It uses the same `CRON_SECRET` Bearer check as the email worker. That check moves into a shared `lib/cron.ts`.
- `vercel.json` adds the schedule `30 3 * * *`.

## Web provider

- **No storage:** no localStorage reads or writes for the bag, the wishlist or the owner marker.
- **On mount:** read the three legacy keys once. If the owner marker is absent, send the legacy lines and wishlist in the `merge` body; otherwise send none. Adopt the response, then delete the three keys only after a successful response.
- **Changes:** every change, guest or signed in, is a `PATCH` with optimistic state, request sequencing, and refresh-on-failure, as today.
- **Live updates:** Realtime is used only when signed in. The bag also refreshes on visibility.
- **Session ends (401):** the provider becomes a guest and refreshes. It shows "You were signed out." and the account's items are no longer shown.

## Mobile app

- **Removed:** the AsyncStorage guest bag (`guest.ts`), the guest details query and the guest queue.
- **One bag query:** keyed by identity (`['bag', userId ?? 'guest']`). It sends the bearer token when signed in and `X-Guest-Token` always.
- **Changes:** `PATCH` for guests and customers alike, with the same optimistic update, refetch guard and single refetch after the last change.
- **Sign-in:** after sign-in, `POST merge` is sent once per user with bearer and `X-Guest-Token`, then the bag refreshes.
- **One-time clean-up:** if `oreva-bag-v1` exists in AsyncStorage, its lines are sent in the first `merge` (guest or signed in), and the key is deleted after a successful response.
- **Unchanged:** Realtime is used only when signed in.

## Testing

- **Web unit and route tests:**
  - guest token resolution and the same-origin exemption;
  - guest `GET`/`PATCH`/`merge`, including the conditional write and a guest-to-account merge that deletes the guest row;
  - the guest rate limit;
  - the cron route's auth and cleanup.
- **PGlite:** the migration applies; anonymous and authenticated roles cannot select, insert, update or delete `guest_shopping_state`.
- **Web component tests:**
  - nothing is written to localStorage;
  - the legacy import sends unowned lines once, then deletes the keys;
  - owned legacy copies are dropped;
  - guest changes are sent as `PATCH`.
- **E2E:** the existing shopping specs (bag persists through reload, guest checkout, wishlist) pass on the fixture guest store.
- **Mobile:**
  - the guest token is created once and reused;
  - the guest bag reads and writes through the API with `X-Guest-Token`;
  - the merge runs once per sign-in with both credentials;
  - the AsyncStorage legacy import;
  - nothing is written to AsyncStorage.

## Rollout

1. Web PR: migration, API, provider, cleanup cron, docs and copy. Apply the migration with the deploy and set the new cron.
   - **Docs:** `AUTH.md` (guest paragraph) and `DATABASE.md` (Shopping line, Cart sync).
   - **Customer-facing copy that currently says the bag lives on the device:**
     - `features/content/information.tsx`, the "Cookies and local storage" section. Rename it "Cookies". It should say the HttpOnly guest cookie also identifies a guest's bag and wishlist, which are stored in our database and deleted after 30 days without use, and that clearing cookies starts a new guest bag.
     - `app/error.tsx`: "Your bag is still saved on this device." becomes "Your bag is still saved."
2. Mobile: changes on `feat/phase-1`, before the phone test.
