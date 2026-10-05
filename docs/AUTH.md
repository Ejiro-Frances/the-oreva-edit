# Authentication and authorisation

Supabase Auth owns identity. Google sign-in returns to the store domain, not the Supabase domain: POST /auth/login starts a server-controlled Google authorization-code flow with PKCE, a random state and a hashed nonce held in a short-lived HttpOnly cookie scoped to /auth/google. GET /auth/google verifies the state, exchanges the code server-side with the Google client secret, then calls signInWithIdToken so Supabase verifies the ID token signature, audience and nonce and issues the normal cookie-backed session through the current @supabase/ssr client. /auth/callback remains for Supabase PKCE code exchanges. The Supabase refresh proxy calls getClaims; protected pages and mutation guards independently call getUser and query user_roles. Proxy is not the authorisation boundary.

Create a Google Cloud web OAuth client with Authorised JavaScript origin https://STORE_DOMAIN and Authorised redirect URI https://STORE_DOMAIN/auth/google (add http://localhost:3000 equivalents for local work). Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET as server-only environment variables. In Supabase, enable the Google provider and add the same client ID to Authorized Client IDs so signInWithIdToken accepts the token; keep nonce checks on. Set the Supabase Site URL to the deployed NEXT_PUBLIC_SITE_URL and allow the exact /auth/callback URLs for staging and production. Do not permit arbitrary preview domains in production. The callback accepts only internal account/admin/wishlist/checkout destinations and never trusts a user-provided origin.

No credentials means a visible unavailable sign-in state. There is no fixture login, hardcoded administrator, test-password endpoint or client-side role grant.

## Email and password

/login has Sign in and Create account tabs (`?mode=signup`) beside Google. Sign-up asks for first name, last name, email, password (8–72 characters, one field with a show/hide toggle) and an optional Nigerian mobile number; customers are signed in immediately. Errors keep everything typed except the password. Sign-in failures always say "Email or password is incorrect" so the form cannot be used to discover accounts; the one exception is sign-up, which says an account already exists and links to sign-in and reset.

Supabase **Confirm email stays off**, so Supabase marks every address confirmed. Ownership is tracked in `profiles.email_verified_at`, which customers cannot write (no column grant); only the server sets it with the secret key:

- Account pages show a non-blocking "Please verify your email" banner. Its button calls POST /api/account/verify-email (1 per minute), which uses Supabase signInWithOtp (Magic Link template, no account creation).
- Every emailed link goes to GET /auth/confirm, which checks the one-time token_hash with verifyOtp on the server, sets email_verified_at, then redirects (verification → /account?verified=1, reset → /reset-password). Invalid or expired links redirect with a friendly error.
- A password reset link also proves ownership, so it verifies the address too. Google sign-in marks the address verified.
- Pre-account takeover: because Supabase treats every password sign-up as confirmed, someone could register an address they do not own, and Supabase would later link the owner's Google sign-in to that account. On Google sign-in, if the profile was never verified and the account has a password, the server replaces the password with a random one and signs out every other session before marking the address verified (`claimAccountWithGoogle`). If that fails, the Google sign-in is refused. An owner who had set that password themselves can set it again with Forgot password.
- Unverified accounts are not restricted in any way.

Forgot password: /forgot-password always shows the same confirmation whether or not the account exists. /reset-password sets the new password for the session created by the reset link.

Rate limits: sign-in 10 per 10 minutes per IP and email; sign-up 20 and forgot password 10 per 10 minutes per IP (generous because mobile carriers share addresses); verification email 1 per minute per account. Supabase applies its own email limits as well.

### Hosted Supabase setup (once per project)

1. Authentication → Sign In / Providers → Email: enable, **turn Confirm email off**, minimum password length 8.
2. Authentication → URL Configuration: Site URL = NEXT_PUBLIC_SITE_URL; add `https://STORE_DOMAIN/auth/confirm` (and `http://localhost:3000/auth/confirm` for local work) to Redirect URLs. Emailed links fall back to the Site URL root if this is missing, and will not work.
3. Authentication → Email Templates: paste `supabase/templates/verify-email.html` into **Magic Link** (subject "Verify your email for The Oreva Edit") and `supabase/templates/reset-password.html` into **Reset Password** (subject "Reset your password for The Oreva Edit"). Local Supabase uses these files automatically via config.toml.
4. Apply the migration `202610050001_email_password_auth.sql` (`supabase db push`).
5. Delivery: without custom SMTP, Supabase only sends to members of the project team and about 2 emails per hour. For customers, set Authentication → SMTP Settings to Mailgun (host smtp.mailgun.org, port 587, an SMTP credential for your own sending domain). No code change is needed.

After a verified staff user signs in, the project owner can assign admin from the SQL editor:

```sql
insert into public.user_roles(user_id, role)
values ('REPLACE_WITH_VERIFIED_STAFF_AUTH_USER_UUID', 'admin');
```

Never grant this role from raw_user_meta_data, email suffix, profile fields or browser input. Removing the role revokes protected operations on the next server check.

## Mobile app sessions

The mobile app (`the-oreva-edit-mobile`) uses the same Supabase accounts. It sends `client: "mobile"` to POST /api/auth/sign-in, /sign-up and /forgot-password; those requests skip the same-origin check, set no cookies and return `{ session: { access_token, refresh_token, expires_at } }` with `Cache-Control: no-store`. Rate limits and error copy are identical to the web. The app stores the session in the device keychain/keystore and refreshes it with supabase-js.

Every other API call from the app sends `Authorization: Bearer <access token>`. `requestSession()` verifies it with Supabase `getUser` and never falls back to cookies; a missing, malformed or rejected token is 401 `session_expired`. Bearer requests skip the origin check because browsers cannot attach that header cross-site. Cookie requests keep it.

Customers own profiles, addresses, shopping state and orders through RLS. The app additionally filters owner UUID on private queries. Guest order access uses a random 256-bit HttpOnly SameSite=Lax cookie and SHA-256 hash in the order; an order number is not sufficient. Guest order access is available for 30 days while that browser cookie remains; there is no email recovery link yet. Never put guest secrets in URLs or logs.

Guest cart/wishlist survive reload. On sign-in, merge the union of variant IDs using the greater quantity per variant (not addition, so repeated sign-in cannot duplicate quantities), cap by stock/20 and merge wishlist IDs. A server-side save persists the resulting state. Sign-out removes Supabase session cookies; local device shopping choices persist, as documented in privacy copy.
