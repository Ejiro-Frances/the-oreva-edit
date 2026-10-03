# Transactional email

lib/email/service.ts is server-only. Mailgun is called over HTTPS using native fetch and multipart form data, so no overlapping email SDK is installed. EMAIL_MODE=capture writes local previews to ignored .data/emails; it sends nothing. Production capture mode does not write ephemeral files and is not a substitute for real delivery.

## Delivery

Orders and fulfilment changes enqueue email_outbox records in their database transaction, so a provider failure never rolls back an order. lib/email/outbox.ts processes the queue:

- Immediately: after checkout (POST /api/orders) and admin order actions, `deliverQueuedEmailsSoon` uses Next.js `after` to send due emails once the response has been sent. Customers do not wait for a scheduler.
- Backstop: /api/internal/email-worker (GET for Vercel Cron, POST for external schedulers) requires a constant-time checked `Authorization: Bearer CRON_SECRET`. vercel.json schedules it daily, the most frequent interval on the Vercel Hobby plan. Any later checkout or admin action also retries due failures. For faster retries, point a free external scheduler (for example cron-job.org) at the POST endpoint every few minutes.

claim_emails uses SKIP LOCKED, a lease, a retry count and exponential backoff, so the immediate path and the worker can run concurrently. After five attempts a staff member should investigate failed rows. A stable Message-ID helps trace retries but Mailgun delivery is at-least-once: an ambiguous provider response can still lead to a duplicate. Do not claim exactly-once external delivery. In production, sending only runs when EMAIL_MODE=mailgun; otherwise rows stay pending instead of burning retries.

## Template

lib/email/template.ts renders matching HTML and plain text for received, confirmed, processing, shipped, delivered, completed, cancelled and returned. The worker loads the order and its line items at send time; if that lookup fails, a summary email is still sent.

The layout follows established transactional patterns (Postmark's open-source receipt, Litmus and Klaviyo order-journey guidance): hidden preheader, text wordmark, a text test-order banner, serif headline with the customer's first name, order number and date, a five-step progress tracker that uses ✓ ● ○ markers as well as colour, one primary button to the prefilled order tracker, line items with thumbnails, totals, delivery address and "what happens next" for orders still in progress, help links and footer.

Email-client rules: nested presentation tables at 600px, inline styles with a style block only for mobile and dark mode (`prefers-color-scheme` plus Outlook `data-ogsc`/`data-ogsb`), no flex/grid or CSS background images, Georgia/Arial fallbacks behind the brand fonts, absolute image URLs with alt text and fixed dimensions, and HTML well under Gmail's ~102KB clipping limit. All interpolated values are escaped. Open/click tracking is disabled.

Refund/welcome/contact adapters can be added behind the same boundary when those business events exist; no pretend welcome or refund messages are sent. Never include auth tokens, guest secrets, passwords, recipients or addresses in logs.

## Owner setup

Mailgun account, sending domain, API key, MAILGUN_FROM_EMAIL, MAILGUN_REGION (US/EU), EMAIL_MODE=mailgun and CRON_SECRET. Mailgun's sandbox domain only delivers to up to five verified Authorized Recipients; emailing any customer needs a custom domain whose DNS you control (SPF and DKIM records). A *.vercel.app address cannot be used as a sending domain. Google OAuth emails continue to be managed by Supabase/Google. The fixture order adapter intentionally does not send email to entered addresses.
