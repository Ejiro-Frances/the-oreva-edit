# Database and integrity

Five versioned migrations define the commerce schema and secured transactions; later migrations add incremental changes. Run them in filename order with Supabase CLI. The development seed is generated from the same typed fixtures used in offline preview.

## Tables

- Identity: profiles, user_roles, addresses.
- Catalogue: categories, products, product_variants, product_images, collections, collection_products.
- Shopping: shopping_state (one owned document of variant quantities and wishlist UUIDs per customer; guest choices use local storage).
- Commerce: delivery_zones, orders, order_items, payments, fulfilments, order_notes.
- Operations: reviews, site_settings, email_outbox, admin_audit_logs, rate_limits.

Categories form a data-managed tree, including reorder and archive, with a cycle-prevention trigger. Audience is a data field, not a finite database enum. Arbitrary option names and values are stored as a small variant attributes object; each exact combination has a unique row/SKU and its own quantity. This avoids assuming a particular shoe or age size system.

Money is integer kobo in code and bigint in PostgreSQL, limited on catalogue input to safe supported amounts. Human order references use a sequence; security always relies on session ownership or guest-secret hash. Historical order items snapshot name, SKU, attributes, price, quantity, discount and image. Orders snapshot contact/address and delivery charge. Product archival preserves foreign keys.

## RLS

All public-schema tables enable RLS. Public reads are restricted to active catalogue/categories/collections/delivery settings and published reviews through a safe projection. Authenticated reviews are always submitted pending moderation. Customers manage only own profile/address/shopping state and read own orders and order items. Customers cannot assign roles, alter stock, create financial rows directly, moderate reviews or access internal notes. Administrator policies require is_admin(), which reads the protected role table under a fixed empty search_path. Guest order lookup is a server-only privileged query including the secret hash.

create_test_order is callable only by service_role; server routes validate all input before invoking it. It locks variants in a stable order, validates availability and quantity, computes authoritative prices and delivery, inserts snapshots, decrements stock and adds an email outbox record in a single transaction. A per-idempotency-key advisory lock and unique constraint prevent duplicate orders. An idempotency retry must also match guest hash and customer UUID.

save_product is admin-only and atomic. Existing products use updated_at optimistic concurrency; variant stock must match the editor's expected stock before an adjustment. Publishing requires a photograph and active variant. Historical variants are deactivated, not deleted.

Collection membership and media reordering use atomic administrator functions. remove_product_image preserves a published product?s last photograph. manage_order records internal notes, confirms/completes valid orders, and restores stock once when an unpaid unshipped order is cancelled.

update_fulfilment enforces sequential transitions and prevents fulfilment of unpaid live orders. Test orders may exercise the status flow without a payment. Each transition writes audit and email records in the same transaction.

## Local verification and limits

Integration tests execute the migrations and seed inside PGlite PostgreSQL, with minimal auth/storage schemas substituting Supabase-owned infrastructure. They verify actual RLS policies and transaction behaviour, not SQL string matching. pgcrypto extension creation is omitted only in this embedded test environment; gen_random_uuid is built in.

A live/local Supabase smoke pass is still required for Auth, Storage, PostgREST schema cache, network failures and deployed multi-connection contention. Embedded tests cannot validate those providers. Never apply the development seed to production.

Indexes cover product visibility/category, category parents, tags/text search, variants, image order, owned records, fulfilment queues and email work. Current catalogue adapter reads at most 500 active products before URL filtering; move search/filter/pagination into indexed database queries before a larger catalogue. Admin listing screens are capped at 100 recent records.
