# Transactional email

lib/email/service.ts is server-only. Mailgun is called over HTTPS using native fetch and multipart form data, so no overlapping email SDK is installed. EMAIL_MODE=capture writes local previews to ignored .data/emails; it sends nothing. Production capture mode does not write ephemeral files and is not a substitute for real delivery.

orderEmail creates matching HTML and plaintext, escapes interpolated fields, uses absolute URLs and includes a clear test/unpaid label. Open/click tracking is explicitly disabled. The sender comes from MAILGUN_FROM_EMAIL; configure a recognisable approved address, and verify the domain's SPF/DKIM. MAILGUN_REGION selects the US/EU API endpoint.

Orders and fulfilment changes enqueue email_outbox records in their database transaction. POST /api/internal/email-worker requires a constant-time checked CRON_SECRET bearer token. The claim function uses SKIP LOCKED, a lease, retry count and exponential backoff. Provider failures do not roll back orders. Failed rows need an operations alert; after five attempts a staff member should investigate. A stable Message-ID helps trace retries but Mailgun delivery is at-least-once: an ambiguous provider response can still lead to a duplicate. Do not claim exactly-once external delivery.

Supported order template subjects: received, confirmed, processing, shipped, delivered, cancelled and returned. Refund/welcome/contact adapters can be added behind the same boundary when those business events exist; no pretend welcome or refund messages are sent. Never include auth tokens, guest secrets, passwords or full addresses in logs.

Required owner setup: Mailgun account, approved sending domain, DNS verification, API key, from identity, region and a secure scheduled worker. Google OAuth emails continue to be managed by Supabase/Google. The fixture order adapter intentionally does not send email to entered addresses.
