# Owner handoff — The Oreva Edit

Implementation verified locally on 2 October 2026. This is a payment-free commerce implementation with explicit fixture and Supabase modes. It is **not approved for real trading** until the business, service and payment dependencies below are resolved.

## 1. What was built

Editorial storefront, data-driven categories/collections, searchable/filterable catalogue, product galleries and variants, persistent guest bag/wishlist, guest unpaid test checkout, private order confirmation/tracking, Supabase customer accounts, authorised staff management, media storage, review moderation, transactional email boundary/outbox, legal drafts and automated verification.

## 2. Architecture

Next.js 16.3.8 App Router, React 19.2.8, strict TypeScript and Tailwind CSS. Server-rendered pages with client islands; Supabase PostgreSQL/Auth/Storage; React Hook Form/Zod; native-fetch Mailgun adapter; Vitest/Testing Library/PGlite and Playwright. Domain features are separated from shared infrastructure.

Money is integer kobo. Database transactions own prices, stock, snapshots and order idempotency. Google sessions do not grant administrator privileges.

## 3. Design decisions

Warm ivory, ink and oxblood; self-hosted Cormorant Garamond/Manrope; Lucide SVG icons; open image grids; asymmetrical editorial composition; restrained motion and reduced-motion support. Responsive layouts have been exercised at 320, 375, 390, 768, 1024, 1280 and 1440 pixels.

Wordmark, favicon, editorial/product photographs and catalogue content remain development assets. IMAGE_SOURCES.md records licences and origin. No fabricated reviews, discounts or payment claims were added.

## 4. Routes

- Shopping: /, /shop, /women, /men, /kids, /girls, /boys, /shoes, /accessories, /jewellery, /new-in, /best-sellers, /sale, /collections/[slug], /products/[slug], /search.
- Purchase journey: /wishlist, /cart, /checkout, /order-confirmation/[number], /track-order.
- Identity: /login, /auth/callback, /account, /account/orders, /account/orders/[id], /account/profile, /account/addresses, /account/wishlist.
- Information: /about, /contact, /faq, /delivery, /returns, /privacy, /terms.
- Staff: /admin, /admin/products, /admin/products/new, /admin/products/[id], /admin/categories, /admin/collections, /admin/orders, /admin/orders/[id], /admin/customers, /admin/customers/[id], /admin/reviews, /admin/delivery, /admin/site.
- Database-created category slugs also resolve without code changes. API/auth/metadata routes are included in the build.

## 5. Database

Five ordered SQL migrations define 21 tables: profiles, user_roles, addresses, categories, products, product_variants, product_images, collections, collection_products, shopping_state, delivery_zones, orders, order_items, payments, fulfilments, order_notes, reviews, site_settings, email_outbox, admin_audit_logs and rate_limits. Catalogue, published_reviews and best_sellers are views. The schema uses UUIDs, foreign keys, checks, indexes and RLS.

Arbitrary variant attributes support size/colour/age/shoe systems without separate hardcoded size tables. A single owned shopping_state document holds cart and wishlist data. See DATABASE.md for transaction and authorisation details.

## 6. Authentication status

Supabase SSR sessions, Google OAuth initiation/callback, safe redirects, refresh proxy, sign-out, page guards and server/API role checks are implemented. Google Cloud consent/provider settings and real Supabase credentials have not been configured in this workspace. Login displays an explicit unavailable state without them.

## 7. Email status

Mailgun HTTPS adapter, HTML/plaintext order templates, local capture, transactional outbox, leasing/retry worker and protected scheduler endpoint are implemented. Real sending/DNS has not been configured or tested. Fixture checkout does not send email. Welcome/refund/contact event adapters remain extensions of the same service boundary.

## 8. Tests created

Domain calculations/validation/search/cart, interactive selectors, real PostgreSQL constraints/RLS/transactions, Playwright desktop/mobile commerce and accessibility, and optional genuine local Supabase customer/staff/media scenarios.

## 9. Actual results

- 50 Vitest domain/component/database cases passed.
- 38 production-build browser cases passed in Chromium desktop/mobile.
- 12 browser cases skipped: ten require local Supabase (five scenarios × two projects); two are intentionally applicable only to one viewport project.
- Axe scans found no serious/critical violations on the tested home, catalogue and product pages.
- Overflow checks passed from small phone through large desktop.
- Dependency audit reported no known vulnerabilities at verification time.

No Google consent flow, live Mailgun delivery, hosted Storage upload, multi-connection stock contention or GitHub-hosted workflow run is claimed as verified. Local Supabase was unavailable because Docker/services were not installed/configured.

## 10. Build and code checks

Production build passed with DATA_MODE=fixture and the test origin configured. Strict TypeScript passed. ESLint and Prettier checks passed. The build includes all page/API route families. Reproduce checks using README.md and TESTING.md.

## 11. Known limitations

Catalogue snapshot filtering currently covers 500 active products; staff lists show 100 recent records; collection editing covers 500 products. Individual product lookup is direct. Larger catalogues need indexed server-side facets/pagination and slimmer header/cart payloads.

Fixture storage is single-process/local only. Guest order tracking works in the original browser; cross-device email verification is a later feature. Mail delivery is at-least-once. Contact channels and size measurements remain explicit owner-supplied content. Cookie consent is not shown because no optional tracking is installed.

## 12. Security

RLS, separate protected roles, server guards, same-origin mutations, payload limits, decoded image validation, secret isolation, hashed guest tokens, authoritative pricing, stock locks, idempotency and staff audit events are implemented. Paid orders cannot be fulfilled without a paid state. Payment initiation/verification/webhooks/refunds are deliberately absent. See SECURITY.md for verified boundaries and deployment hardening.

## 13. Performance

Local production Chromium measurements (unthrottled loopback, warmed server/image optimiser): mobile 390px LCP 128ms, CLS 0, resource transfer about 473KB; desktop 1440px LCP 120ms, CLS 0, resource transfer about 564KB. Script transfer about 236KB. These are local diagnostics, **not real-user Core Web Vitals guarantees**.

Responsive next/image, fixed aspect ratios, local variable fonts, server pages and no third-party tracking reduce avoidable work. Measure again on the deployed host and realistic Nigerian mobile networks.

## 14. Exact owner actions

Supply approved SVG/dark/light/email logos, favicon/social image; real products/photographs/SKUs/stock/prices/measurements; legal entity/CAC/address; support email/phone/WhatsApp; approved delivery zones/rates/timelines; return address/window/refund rules; professionally reviewed Nigerian legal/privacy policies. Replace development content before real sales.

OWNER_ACTION_REQUIRED.md maps every item to its purpose, source, project destination and whether it blocks development or launch.

## 15. External settings

Create separate staging/production Supabase projects, apply migrations, set URL/publishable/server keys and bootstrap a named administrator. Configure Google Cloud web OAuth client/consent and Supabase provider/callback allowlists. Verify Mailgun sending-domain DNS/SPF/DKIM and sender/region; configure the protected email scheduler. Confirm hosting, domain/DNS/TLS, backups, provider MFA and branch protection. Paystack/business verification belongs to the next phase.

## 16. Run locally

Node.js 24 and Corepack/pnpm 10.32.1:

```sh
corepack pnpm install --frozen-lockfile
# Copy .env.example to .env.local (PowerShell: Copy-Item .env.example .env.local)
corepack pnpm dev
```

Open http://localhost:3000. Fixture preview works without credentials. Use synthetic details only. README.md documents every environment variable and command.

## 17. Deploy

Follow DEPLOYMENT.md: inspect migration target, use approved staging data, configure services/HTTPS/canonical origin, run CI and manual service tests, build and deploy to a Next-compatible Node host. Public production uses DATA_MODE=supabase and ALLOW_TEST_ORDERS=false. Do not deploy .data files or development seed as real inventory.

## 18. Recommended next phase

Run owner/staff acceptance against configured staging, replace provisional content and secure legal/service approvals. Then implement the payment boundary with Paystack verification, raw signed webhooks, expiring stock reservations, idempotency, reconciliation and refunds. PAYMENT_INTEGRATION.md specifies the required connections and failure cases.
