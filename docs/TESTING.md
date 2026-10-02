# Testing

## Default suite

`pnpm test` runs Vitest with React Testing Library and PGlite. Domain cases cover NGN formatting, integer totals, delivery thresholds/coverage, schema rejection, valid Nigerian numbers, cart merge, search/filter behavior, sold-out choices and status transitions. Component tests exercise quantity boundaries and required variant selection. Email tests verify escaping and explicit unpaid labels.

The integration suite executes all migrations and the real seed in PostgreSQL via PGlite. Minimal Supabase-owned auth/storage schemas and auth.uid are supplied by the harness. It tests actual grants/RLS, customer privacy, privilege escalation, authoritative snapshots, stock decrement/rollback, idempotency, category cycles, staff publishing, stale stock writes, last-image protection and moderated reviews. It does not replace networked Auth/Storage or concurrent-connection tests.

## Browser tests

Install Chromium, then run `pnpm test:e2e`. The configuration starts a local fixture server at **http://localhost:3100**, not port 3000. It uses an isolated development order filename and runs sequentially to preserve controlled stock.

Desktop Chromium and a mobile Chromium viewport based on iPhone 13 cover homepage/category, search/empty results, URL filters, unavailable sizes, required selection, add/edit/remove bag, reload persistence, wishlist, checkout errors, guest order completion and privacy, account/admin rejection, dialog focus, route overflow and missing products. Axe scans key storefront pages against WCAG tags; automated results do not establish full WCAG conformance.

On Windows when browser downloads must remain in the workspace:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/ms-playwright'
corepack pnpm exec playwright install chromium
corepack pnpm test:e2e
```

To test a production build, use a dedicated terminal with the same environment at build AND start:

```powershell
$env:DATA_MODE='fixture'
$env:ALLOW_TEST_ORDERS='true'
$env:NEXT_PUBLIC_SITE_URL='http://localhost:3100'
$env:FIXTURE_ORDER_FILE='.data/e2e-orders.json'
corepack pnpm build
corepack pnpm exec next start --port 3100
```

In a second terminal set `PLAYWRIGHT_EXTERNAL_SERVER=true` and run `pnpm test:e2e`. This also avoids Windows development-child teardown issues. All production hostnames must match NEXT_PUBLIC_SITE_URL. Test artifacts are ignored by Git.

Fixture inventory persists. For a repeat run after stock is exhausted, stop the server and remove **only the disposable .data/e2e-orders.json test file**, then restart. This never resets Supabase or real inventory.

## Real local Supabase

Run Docker and `supabase start`; a new local database receives the migrations and seed. Export the local URL, publishable key and secret key. Set `E2E_SUPABASE=true`, `E2E_DATA_MODE=supabase`, `DATA_MODE=supabase`, then run:

```sh
pnpm exec playwright test authenticated.spec.ts --project=desktop
```

These tests reject non-loopback Supabase hosts. They create synthetic customers/staff through the local Auth API, obtain genuine SSR cookies without adding a login backdoor, test profile/wishlist persistence, account access, staff draft creation/editing and malformed image rejection. They do not automate Google's external consent screen. Their records belong only in a disposable local stack.

The GitHub Actions Supabase job provisions these services without production secrets. It has not been executed by this local workspace merely because the workflow file exists.

## Manual release pass

Use an isolated staging domain with correctly configured Google OAuth and Mailgun. Verify Google callback/session refresh/sign-out, staff/nonstaff separation, address selection, actual image upload/reorder/delete, order operations, capture/real email delivery, rejected media, and simultaneous last-unit checkouts with two connections. Check small phones, tablet, laptop and large desktop with keyboard and a screen reader.

Record device/browser, environment, commit, findings and provider message IDs (never credentials) for business acceptance. See HANDOFF.md for this implementation's actual results and remaining external checks.
