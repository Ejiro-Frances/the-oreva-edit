# Security boundaries

- Public product reads use a publishable Supabase key and active-row RLS; product details never contain server credentials.
- Account and staff pages verify identity independently of layouts. Every staff mutation checks user_roles server-side and privileged SQL checks is_admin.
- Customers cannot mutate role, inventory, orders or another customer's records. Profile updates are column-limited. Public review projection omits customer identifiers; moderation and verified-purchase flags are database controlled.
- Browser writes require an Origin equal to NEXT_PUBLIC_SITE_URL. JSON and multipart bodies are byte limited before parsing. Schema errors return actionable messages, unexpected failures return generic errors with redacted event logging.
- OAuth uses Supabase PKCE and restricted local return paths. Guest orders require a random 256-bit HttpOnly cookie; only its SHA-256 hash is persisted. Order numbers alone grant no access.
- Server order creation ignores client prices. PostgreSQL locks variant rows in stable order, validates active inventory and delivery, writes snapshots and outbox atomically and binds idempotency to guest/customer ownership.
- Media upload authenticates before reading the body, verifies decoded format and dimensions, normalises orientation and strips metadata through re-encoding, uses random WebP paths and a restricted Storage bucket.
- Last-photo deletion and stale product stock updates are rejected. Cancellation of an unpaid unshipped order restores inventory transactionally; paid refunds remain outside this phase.
- Mailgun and privileged database credentials live only in server modules. Scheduler uses a bearer secret with constant-time comparison. Optional analytics is not installed.

## Verified versus pending

The automated PostgreSQL suite checks grants/RLS, role escalation, order privacy, atomic rollback, snapshots, idempotency, staff publishing and moderation. Browser tests exercise cross-origin and unauthorised requests. This is not a penetration-test or legal-compliance certification.

Before launch: configure provider MFA and secrets, edge/IP rate limits, audit dependency advisories, perform Google/session/Storage tests against staging, exercise concurrent last-unit orders, review retention and backups, and resolve OWNER_ACTION_REQUIRED.md.

Known deliberate limits: baseline CSP rather than strict script nonces; cookie-based guest tracking only on the original browser; per-guest checkout rate limits are supplemented by hosting controls; at-least-once email delivery; local fixture storage is single-process only. Never infer a real payment from an order number or email.
