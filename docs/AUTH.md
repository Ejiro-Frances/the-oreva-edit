# Authentication and authorisation

Supabase Auth owns identity. Google OAuth uses PKCE with an HTTP-only server-controlled flow initiation, cookie-backed SSR, exchangeCodeForSession in /auth/callback and the current @supabase/ssr client. The Supabase refresh proxy calls getClaims; protected pages and mutation guards independently call getUser and query user_roles. Proxy is not the authorisation boundary.

Configure Google Cloud's web OAuth client redirect to https://PROJECT.supabase.co/auth/v1/callback. Put the Google client ID/secret in Supabase's Google provider configuration. Set the Supabase Site URL to the deployed NEXT_PUBLIC_SITE_URL and allow the exact /auth/callback URLs for staging and production. Do not permit arbitrary preview domains in production. The callback accepts only internal account/admin/wishlist/checkout destinations and never trusts a user-provided origin.

No credentials means a visible unavailable sign-in state. There is no fixture login, hardcoded administrator, test-password endpoint or client-side role grant. Email auth can be added through Supabase without changing profile ownership.

After a verified staff user signs in, the project owner can assign admin from the SQL editor:

```sql
insert into public.user_roles(user_id, role)
values ('REPLACE_WITH_VERIFIED_STAFF_AUTH_USER_UUID', 'admin');
```

Never grant this role from raw_user_meta_data, email suffix, profile fields or browser input. Removing the role revokes protected operations on the next server check.

Customers own profiles, addresses, shopping state and orders through RLS. The app additionally filters owner UUID on private queries. Guest order access uses a random 256-bit HttpOnly SameSite=Lax cookie and SHA-256 hash in the order; an order number is not sufficient. Guest order access is available for 30 days while that browser cookie remains; there is no email recovery link yet. Never put guest secrets in URLs or logs.

Guest cart/wishlist survive reload. On sign-in, merge the union of variant IDs using the greater quantity per variant (not addition, so repeated sign-in cannot duplicate quantities), cap by stock/20 and merge wishlist IDs. A server-side save persists the resulting state. Sign-out removes Supabase session cookies; local device shopping choices persist, as documented in privacy copy.
