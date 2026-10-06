# Database and integrity

Versioned migrations define the commerce schema and secured transactions. Run them in filename order with Supabase CLI. The development seed is generated from the same typed fixtures used in offline preview.

## Tables

- Identity: profiles, user_roles, addresses.
- Catalogue: categories, products, product_variants, product_images, collections, collection_products.
- Shopping: shopping_state (one owned document per customer) and guest_shopping_state (server-only, keyed by the SHA-256 of the guest token, deleted 30 days after the last change). No shopping data is stored on the device.
- Commerce: delivery_zones, orders, order_items, payments, fulfilments, order_notes.
- Operations: reviews, site_settings, email_outbox, admin_audit_logs, rate_limits.

Categories form a data-managed tree, including reorder and archive, with a cycle-prevention trigger. Audience is a data field, not a finite database enum. Arbitrary option names and values are stored as a small variant attributes object; each exact combination has a unique row/SKU and its own quantity. This avoids assuming a particular shoe or age size system.

Money is integer kobo in code and bigint in PostgreSQL, limited on catalogue input to safe supported amounts. Human order references use a sequence; security always relies on session ownership or guest-secret hash. Historical order items snapshot name, SKU, attributes, price, quantity, discount and image. Orders snapshot contact/address and delivery charge. Product archival preserves foreign keys.

## RLS

All public-schema tables enable RLS. Public reads are restricted to active catalogue/categories/collections/delivery settings and published reviews through a safe projection. Authenticated reviews are always submitted pending moderation. Customers manage only own profile/address/shopping state and read own orders and order items. Customers cannot assign roles, alter stock, create financial rows directly, moderate reviews or access internal notes. Administrator policies require is_admin(), which reads the protected role table under a fixed empty search_path. Guest order lookup is a server-only privileged query including the secret hash.

create_test_order is callable only by service_role; server routes validate all input before invoking it. It locks variants in a stable order, validates availability and quantity, computes authoritative prices and delivery, inserts snapshots, decrements stock and adds an email outbox record in a single transaction. A per-idempotency-key advisory lock and unique constraint prevent duplicate orders. An idempotency retry must also match guest hash and customer UUID.

save_product is admin-only and atomic. Existing products use updated_at optimistic concurrency; variant stock must match the editor's expected stock before an adjustment. Publishing requires a photograph and active variant. Historical variants are deactivated, not deleted.

## Cart sync

Clients change the saved bag with PATCH /api/shopping line operations (`add`, `set`, `remove`, `wish`, `unwish`), never by replacing the document. The server re-reads the row, applies the operations with stock and 20-per-line caps, and writes only if `updated_at` is unchanged, retrying up to three times before answering 409 `cart_conflict`. Sign-in merges use the same conditional write. Guests use the same operations and conditional write against `guest_shopping_state`, and `POST merge` moves a guest bag into the account and then deletes it only if it is unchanged since it was read (a guest change made meanwhile survives and is merged on the next load). Capped or dropped variants are returned in `adjusted`.

`202610050002_shopping_realtime.sql` adds `shopping_state` to the `supabase_realtime` publication. RLS (`own_shopping`) limits events to the owner. Web and mobile subscribe with `user_id=eq.<uid>` and refetch GET /api/shopping on every event and when they return to the foreground.

## Colour photography

Apply `202610030001_variant_images.sql` before deploying the variant photograph editor. `product_variants.image` references a URL belonging to that same product; a composite foreign key prevents assigning another product's media. Removing an image clears variant links, while existing order snapshot URLs remain unchanged. The order transaction saves the selected variant's photograph.

In Admin products, upload the colour photographs, then select a **Photograph** for each matching variant in **Options & inventory** and save. Assign the same image to every size of that colour. Choose **Make primary** in product photography to control the colour selected when a customer opens the page. Attributes named `Colour` or `Color` (case insensitive) are recognised. Size remains an explicit choice. Single-colour legacy products use their primary photograph; ambiguous unmapped multi-colour products require a choice rather than guessing from pixels.

Fixture mode contains 32 products across women, men and kids, including 12 men's styles. The men's range covers shirts, tees, trousers, shorts, caps, sunglasses, boxers, singlets and jackets. `fixture-menswear.ts` defines the eight latest men's styles; `fixture-builder.ts` creates the shared variant combinations used by it and `fixture-expansion.ts`. Existing product, category and variant IDs remain stable when refreshing the seed.

The linen shirt, carry bag, tank, trousers, skirt, shorts, cap and singlet have multiple colours; earrings, necklaces and bracelets have gold and silver finishes. Trousers demonstrate size and length inventory and price overrides; men's trouser sizes are waist measurements in inches and lengths are inside-leg measurements. Boxer briefs add a pack option (single pair or three pairs), with price and stock per pack variant. Cart quantity counts packs, while order attributes preserve how many pairs each contains. Each combination has its own SKU, image and stock, with deliberately unavailable combinations for testing.

Caps and Sunglasses are children of Accessories. The seed persists category parents, and catalogue navigation includes populated descendant categories. Men filters and mobile navigation only show relevant categories; no code changes are needed to add a product to an existing category or add another child category through Admin.

`pnpm seed:generate` regenerates the development SQL. Reapplying that seed to a development database adds the new products/images/variants and refreshes matching fixture image, attribute and price override fields without resetting existing stock. Catalogue additions are seed data, so `supabase db push` alone does not insert these products. No additional schema migration is needed beyond `202610030001_variant_images.sql`. Never seed a production database. The edited photographs are development colour studies only; replace them with accurate product photographs before sales.

Collection membership and media reordering use atomic administrator functions. remove_product_image preserves a published product?s last photograph. manage_order records internal notes, confirms/completes valid orders, and restores stock once when an unpaid unshipped order is cancelled.

update_fulfilment enforces sequential transitions and prevents fulfilment of unpaid live orders. Test orders may exercise the status flow without a payment. Each transition writes audit and email records in the same transaction.

## Local verification and limits

Integration tests execute the migrations and seed inside PGlite PostgreSQL, with minimal auth/storage schemas substituting Supabase-owned infrastructure. They verify actual RLS policies and transaction behaviour, not SQL string matching. pgcrypto extension creation is omitted only in this embedded test environment; gen_random_uuid is built in.

A live/local Supabase smoke pass is still required for Auth, Storage, PostgREST schema cache, network failures and deployed multi-connection contention. Embedded tests cannot validate those providers. Never apply the development seed to production.

Indexes cover product visibility/category, category parents, tags/text search, variants, image order, owned records, fulfilment queues and email work. Current catalogue adapter reads at most 500 active products before URL filtering; move search/filter/pagination into indexed database queries before a larger catalogue. Admin listing screens are capped at 100 recent records.
