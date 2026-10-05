-- Live cart sync: deliver shopping_state changes to its owner over Supabase Realtime.
-- The own_shopping RLS policy limits each subscriber to their own row. Clients treat an event
-- as a signal and refetch GET /api/shopping.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_state'
    )
  then
    alter publication supabase_realtime add table public.shopping_state;
  end if;
end $$;
