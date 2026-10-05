-- Email and password accounts. Supabase "Confirm email" stays off so customers can sign in
-- immediately; email ownership is recorded here, only by the server, when an emailed link is used.
alter table public.profiles
  add column first_name text not null default '' check(length(first_name)<=60),
  add column last_name text not null default '' check(length(last_name)<=60),
  add column email_verified_at timestamptz;

-- Explicit names come from email sign-up; providers such as Google only send a full name.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data,'{}'::jsonb);
  full_name text := btrim(coalesce(meta->>'full_name',''));
  first text := btrim(coalesce(meta->>'first_name',''));
  last text := btrim(coalesce(meta->>'last_name',''));
begin
  if first = '' and full_name <> '' then
    first := split_part(full_name,' ',1);
    last := btrim(substr(full_name,length(first)+1));
  end if;
  if full_name = '' then full_name := btrim(first||' '||last); end if;
  insert into public.profiles(id,email,display_name,first_name,last_name)
  values(new.id,coalesce(new.email,''),left(full_name,120),left(first,60),left(last,60));
  return new;
end;
$$;

-- Existing profiles: derive names from the display name; Google has already verified its addresses.
update public.profiles set
  first_name=left(split_part(btrim(display_name),' ',1),60),
  last_name=left(btrim(substr(btrim(display_name),length(split_part(btrim(display_name),' ',1))+1)),60)
where first_name='' and btrim(display_name)<>'';
update public.profiles set email_verified_at=now()
where email_verified_at is null and id in(select user_id from auth.identities where provider='google');

-- email_verified_at is deliberately not granted: customers cannot verify themselves.
grant update(first_name,last_name) on public.profiles to authenticated;
