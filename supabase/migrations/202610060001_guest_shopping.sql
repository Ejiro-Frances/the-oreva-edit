-- Guest bags and wishlists live in the database, never on the device. Rows are keyed by the
-- SHA-256 of a random guest token (the HttpOnly oreva_guest cookie on the web, a SecureStore
-- token in the app). Only the server reads or writes them, so RLS is on with no policies.
create table public.guest_shopping_state (
  guest_hash text primary key check (guest_hash ~ '^[0-9a-f]{64}$'),
  lines jsonb not null default '[]'
    check (jsonb_typeof(lines) = 'array' and jsonb_array_length(lines) <= 50),
  wishlist uuid[] not null default '{}' check (cardinality(wishlist) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.guest_shopping_state enable row level security;
revoke all on public.guest_shopping_state from anon,authenticated;
grant select,insert,update,delete on public.guest_shopping_state to service_role;
create index guest_shopping_state_updated_at on public.guest_shopping_state (updated_at);
