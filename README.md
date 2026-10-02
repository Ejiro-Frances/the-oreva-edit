# The Oreva Edit

An editorial Nigerian fashion storefront and commerce workspace built with Next.js App Router, React, strict TypeScript, Tailwind CSS and Supabase PostgreSQL/Auth/Storage. Currency is NGN; monetary values are integer kobo.

**This phase does not collect payments.** Development checkout creates explicitly unpaid test orders. Real trading requires approved inventory, policies, delivery rates, external configuration and the future payment phase. See [owner actions](docs/OWNER_ACTION_REQUIRED.md).

## Run locally

Prerequisites: Node.js 24 LTS, pnpm 10.32.1 through Corepack, and a modern browser. Docker/Supabase CLI are optional for fixture preview and required for full local Auth/Storage tests.

```sh
corepack pnpm install --frozen-lockfile
cp .env.example .env.local
corepack pnpm dev
```

On PowerShell, replace the copy command with `Copy-Item .env.example .env.local`. Open http://localhost:3000. The checked-in example selects fixture mode; do not enter real personal data. No database account is needed to browse, search, filter, save pieces or place an unpaid guest test order.

The licensed temporary photographs and OFL fonts are already local. An internet connection is not required to fetch design assets at runtime. Optional asset download scripts are provenance/recovery tools, not build steps.

## Commands

| Command                       | Purpose                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `corepack pnpm dev`           | Local development server                                 |
| `corepack pnpm build`         | Optimised production build, using configured environment |
| `corepack pnpm start`         | Serve the production build                               |
| `corepack pnpm lint`          | ESLint / Next / TypeScript rules                         |
| `corepack pnpm typecheck`     | Strict TypeScript check                                  |
| `corepack pnpm test`          | Domain, component and PostgreSQL/RLS tests               |
| `corepack pnpm test:e2e`      | Desktop and mobile Playwright tests                      |
| `corepack pnpm format:check`  | Formatting gate                                          |
| `corepack pnpm format`        | Format source/docs                                       |
| `corepack pnpm seed:generate` | Regenerate development SQL from typed fixtures           |

Install Chromium once with `corepack pnpm exec playwright install chromium`. CI uses `--with-deps` on Linux. See [testing](docs/TESTING.md) for Windows, production-server testing and local Supabase scenarios.

## Configure Supabase

1. Install Docker and Supabase CLI 2.119.0 using the official platform instructions.
2. Run `supabase start` from this project. Committed `supabase/config.toml` configures the local stack; migrations and development seed apply to its new database.
3. Copy the local project URL, publishable/anon key and server secret/service-role key from `supabase status` into `.env.local`.
4. Set `DATA_MODE=supabase` and restart Next.js.
5. Configure Google OAuth and the staff role as described in [AUTH.md](docs/AUTH.md).

For a hosted staging project, use `supabase link --project-ref YOUR_STAGING_REF`, inspect the target, then `supabase db push`. Apply the development seed only to an isolated staging/local database. **Never seed production with fictional catalogue/stock/rates.** `supabase db reset` deletes local data; use only when intentionally resetting your disposable stack.

All schema changes live in numbered migrations. No dashboard-created tables are required. PostgreSQL handles authoritative order prices, snapshots, stock locks, idempotency, fulfilment transitions, publishing and audit records. [DATABASE.md](docs/DATABASE.md) explains entities and RLS.

## Environment

| Variable                                              | Purpose                                                                                          |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| DATA_MODE                                             | `fixture` for isolated preview, `supabase` for durable services                                  |
| NEXT_PUBLIC_SITE_URL                                  | Exact canonical origin, including protocol and local port; used for origin checks, OAuth and SEO |
| NEXT_PUBLIC_SUPABASE_URL                              | Supabase project API URL                                                                         |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY                  | Public publishable key; local legacy anon key also supported                                     |
| SUPABASE_SECRET_KEY                                   | Server-only privileged API key; legacy service_role also supported                               |
| ALLOW_TEST_ORDERS                                     | Set `true` only in isolated synthetic-data preview/staging; `false` for public launch            |
| FIXTURE_ORDER_FILE                                    | Local development order filename under .data; never a production storage mechanism               |
| EMAIL_MODE                                            | `capture` locally or `mailgun` after domain verification                                         |
| MAILGUN_API_KEY / MAILGUN_DOMAIN / MAILGUN_FROM_EMAIL | Server-side delivery credentials and sender                                                      |
| MAILGUN_REGION                                        | US or EU                                                                                         |
| CRON_SECRET                                           | Strong random bearer credential for the email worker                                             |

Google client credentials belong in Supabase provider settings, not source code. No payment keys exist in this phase. Never commit `.env.local`, captured email or order data.

## Structure and architecture

- `app/`: server routes, protected account/admin areas, API boundaries, metadata and error states.
- `features/`: catalogue, cart, checkout, orders, wishlist, reviews, account, administration, content and future payment boundary.
- `components/`: shared layout and small semantic UI primitives.
- `lib/`: validation, money, Supabase clients, security, rate limiting, email and analytics boundary.
- `supabase/`: migrations, local configuration, reproducible development seed.
- `tests/`: domain/component, embedded PostgreSQL, desktop/mobile and optional real-service browser coverage.
- `docs/`: design, operational setup, limitations and launch requirements.

Server Components compose pages. Client islands handle selectors, forms, cart/wishlist and native focus-managed dialogs. Supabase SSR sessions are verified server-side; an actual protected role grants staff access. Guest order access requires an HttpOnly random token whose hash is stored with the order.

## Design

Warm ivory, ink and oxblood; Cormorant Garamond with Manrope; one Lucide SVG icon family; open photographic grids and restrained motion. The temporary wordmark, licensed development photography and sample catalogue are explicitly provisional. See [design system](docs/DESIGN_SYSTEM.md) and [image register](docs/IMAGE_SOURCES.md).

## Email, deployment and CI

Mailgun sits behind a server-only adapter. A transactional outbox preserves delivery work if the email provider fails; a bearer-protected worker claims and retries it. Capture mode writes local previews without sending. See [EMAIL.md](docs/EMAIL.md).

[DEPLOYMENT.md](docs/DEPLOYMENT.md) covers environment separation, staging validation, scheduler configuration and production safeguards. GitHub Actions checks formatting, lint, types, tests, a production build and fixture browser flows; a second job starts isolated local Supabase for customer/admin/storage scenarios. No production credentials are used. Enable these checks in branch protection.

## Project status and next phase

The implementation includes the full storefront route family, guest shopping/test checkout, durable Supabase commerce paths, customer pages, staff management, storage/email adapters, starter policies and automated tests. Google, hosted Supabase, Mailgun DNS and final business content require owner configuration. Review [HANDOFF.md](docs/HANDOFF.md) and [OWNER_ACTION_REQUIRED.md](docs/OWNER_ACTION_REQUIRED.md) before launch.

The next phase is staging acceptance with real approved catalogue and service settings, followed by verified payment initiation/webhooks, inventory reservations and refunds. Payment work is deliberately isolated in [PAYMENT_INTEGRATION.md](docs/PAYMENT_INTEGRATION.md).
