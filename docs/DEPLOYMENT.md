# Deployment and operations

## Hosting contract

Use a Node.js 24-compatible Next.js host (for example Vercel or a managed Node service), with server execution, Sharp image support and environment secrets. This is not a static-export application. Install from pnpm-lock.yaml, run `pnpm build`, then `pnpm start` for a Node host. Prefer provider-managed HTTPS.

Create separate Supabase projects for staging and production. Run versioned migrations against the inspected target with Supabase CLI. Never push the development seed to production. Upload approved images through the admin media flow.

Build and runtime must use the same public environment values. Set the exact HTTPS NEXT_PUBLIC_SITE_URL for the deployment domain; mutation origin checks intentionally reject another hostname. Set DATA_MODE=supabase. Use current publishable/secret keys and restrict dashboard access to authorised staff with MFA. Never place the secret key in a NEXT_PUBLIC variable.

## Release sequence

1. Supply approved branding, real product content, stock/SKUs, size information, legal policies, customer support and delivery settings.
2. Configure Supabase Auth URLs, Google provider and production callback; bootstrap a staff role using AUTH.md.
3. Apply migrations, verify RLS and Storage bucket policies, test a restore from backup on staging.
4. Configure Mailgun domain/DNS, region and sender. Use EMAIL_MODE=mailgun only after controlled delivery verification. Keep capture mode local.
5. Set a strong CRON_SECRET. Schedule POST /api/internal/email-worker every minute with Authorization: Bearer YOUR_SECRET. Keep the secret in the scheduler's secret store.
6. Run all checks and browser tests, then the manual staging acceptance list in TESTING.md. Configure branch protection for both CI jobs.
7. Set ALLOW_TEST_ORDERS=false on a public deployment. This phase has no payment provider, so real checkout remains unavailable.
8. Deploy the reviewed build, verify canonical origin/robots/sitemap, OAuth, security headers and customer/admin access.

## Email reliability

The worker leases ten messages, retries failed deliveries with backoff and stops after five attempts. Alert on failed rows and ageing pending work. Monitor provider bounces/complaints and sender reputation through Mailgun. Do not log recipient addresses or email bodies in application logs. Capture files can contain personal data; never deploy them.

Mailgun delivery is at-least-once: a process crash after provider acceptance but before saving status may resend. Stable Message-Id assists tracing but is not a provider-level idempotency guarantee. Resolve exhausted messages through a reviewed operational process.

## Security and operations

Use HTTPS and configured trusted origins; set HSTS at the HTTPS host after confirming all subdomains support it. The app sends frame, MIME, referrer and permissions headers plus a baseline CSP. A strict script nonce CSP is a separate deployment hardening task requiring compatibility checks with Next.js streaming.

Enforce edge/IP abuse controls in addition to application user/token rate limits. Review dependency audit results at releases. Retain only operational logs with event/type/IDs; add monitoring through the existing boundary if required. Define retention and deletion policies with the legal adviser.

Enable database backups and an appropriate recovery objective. Exercise inventory conflict and duplicate-order handling on a multi-connection staging database. Check migration compatibility before rollout; prefer forward migrations and a tested backup-based recovery plan.

The local fixture file adapter is single-process development storage. It must not serve real commerce or run on an ephemeral/multi-instance deployment.

## Capacity boundaries

The current catalogue snapshot adapter supports the first 500 active pieces, with URL filters and pages of 12; individual product lookup is direct. Admin lists show up to 100 recent records, and collection editing loads up to 500 products. Before exceeding those limits, move facets/search/pagination into indexed server queries and add cursor pagination to staff lists. Do not silently expand the client payload to an unbounded catalogue.

Measure deployed Core Web Vitals with realistic devices and Nigerian mobile networks. Local screenshots and browser tests are not field performance measurements. Review image transfer size, hydration cost and the full catalogue header payload as inventory grows.
