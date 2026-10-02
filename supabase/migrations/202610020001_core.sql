-- Versioned schema. Monetary values are integer kobo. No production seed data.
create extension if not exists pgcrypto;
create table public.profiles (
 id uuid primary key references auth.users on delete cascade,
 display_name text not null default '' check(length(display_name)<=120),
 email text not null default '', phone text not null default '',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.user_roles (
 user_id uuid references auth.users on delete cascade, role text not null check(role in ('admin')),
 primary key(user_id,role)
);
create function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.user_roles where user_id=auth.uid() and role='admin');
$$;
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.profiles(id,email,display_name) values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),120));return new;end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
create table public.addresses(id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users on delete cascade,label text not null check(length(label) between 1 and 60),details jsonb not null check(jsonb_typeof(details)='object'),created_at timestamptz not null default now());
create index addresses_owner on public.addresses(user_id);
create table public.categories(id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 1 and 100),slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),parent_id uuid references public.categories on delete restrict,position integer not null default 0,active boolean not null default true,check(parent_id is distinct from id));
create index category_parent on public.categories(parent_id,position);
create function public.prevent_category_cycle() returns trigger language plpgsql set search_path='' as $$ begin
 if exists(with recursive parents as(select id,parent_id from public.categories where id=new.parent_id union all select c.id,c.parent_id from public.categories c join parents p on c.id=p.parent_id) select 1 from parents where id=new.id) then raise exception 'Category relationship would create a cycle';end if;return new;end; $$;
create trigger category_cycle before insert or update on public.categories for each row execute function public.prevent_category_cycle();
create table public.products (
 id uuid primary key default gen_random_uuid(),name text not null check(length(name) between 3 and 150),slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 description text not null default '',short_description text not null default '',brand text,category_id uuid not null references public.categories on delete restrict,
 audience text not null, tags text[] not null default '{}',status text not null default 'draft' check(status in ('draft','active','archived')),
 price bigint not null check(price>=0 and price<=1000000000),compare_at bigint check(compare_at>price),details text[] not null default '{}',care text not null default '',
 featured boolean not null default false,fixture boolean not null default false,seo_title text,seo_description text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index products_public on public.products(status,created_at desc);
create index products_category on public.products(category_id,audience,status);
create index products_search on public.products using gin(to_tsvector('english',name||' '||description));
create index products_tags on public.products using gin(tags);
create table public.product_variants(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products on delete restrict,sku text not null unique check(length(sku) between 1 and 80),attributes jsonb not null check(jsonb_typeof(attributes)='object' and attributes<>'{}'),price bigint check(price>=0 and price<=1000000000),stock integer not null default 0 check(stock>=0),active boolean not null default true,image text,unique(product_id,attributes));
create index variants_product on public.product_variants(product_id);
create index low_stock on public.product_variants(stock) where active;
create table public.product_images(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products on delete cascade,path text not null,url text not null,alt text not null default '',position integer not null default 0,created_at timestamptz not null default now());
create index images_product on public.product_images(product_id,position);
create table public.collections(id uuid primary key default gen_random_uuid(),name text not null,slug text not null unique,description text not null default '',active boolean not null default true,position integer not null default 0);
create table public.collection_products(collection_id uuid references public.collections on delete cascade,product_id uuid references public.products on delete cascade,position integer not null default 0,primary key(collection_id,product_id));
create index collection_product_lookup on public.collection_products(product_id);
create table public.shopping_state(user_id uuid primary key references auth.users on delete cascade,lines jsonb not null default '[]' check(jsonb_typeof(lines)='array' and jsonb_array_length(lines)<=50),wishlist uuid[] not null default '{}' check(cardinality(wishlist)<=500),updated_at timestamptz not null default now());
create table public.delivery_zones(id uuid primary key default gen_random_uuid(),name text not null,states text[] not null check(cardinality(states)>0),rate bigint not null check(rate>=0),free_threshold bigint check(free_threshold>=0),min_days integer not null check(min_days>=0),max_days integer not null check(max_days>=min_days),active boolean not null default false,fixture boolean not null default false);
create sequence public.order_number_seq;
create table public.orders (
 id uuid primary key default gen_random_uuid(),number text not null unique default ('ORE-'||extract(year from now())::text||'-'||lpad(nextval('public.order_number_seq')::text,6,'0')),
 user_id uuid references auth.users on delete set null,guest_hash text not null check(length(guest_hash)=64),idempotency_key uuid not null unique,
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled','completed')),
 payment_status text not null default 'unpaid' check(payment_status in ('unpaid','pending','paid','failed','refunded','partially_refunded')),
 fulfilment_status text not null default 'unfulfilled' check(fulfilment_status in ('unfulfilled','processing','shipped','delivered','returned')),
 contact jsonb not null check(jsonb_typeof(contact)='object'),subtotal bigint not null check(subtotal>=0),delivery bigint not null check(delivery>=0),
 total bigint not null check(total=subtotal+delivery),currency text not null default 'NGN' check(currency='NGN'),test boolean not null default true,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index orders_owner on public.orders(user_id,created_at desc);
create index orders_guest on public.orders(number,guest_hash);
create index orders_fulfilment on public.orders(fulfilment_status,created_at desc);
create table public.order_items(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders on delete restrict,product_id uuid not null references public.products on delete restrict,variant_id uuid not null references public.product_variants on delete restrict,name text not null,sku text not null,attributes jsonb not null,image text not null default '',price bigint not null check(price>=0),quantity integer not null check(quantity between 1 and 20),discount bigint not null default 0 check(discount>=0 and discount<=price*quantity),unique(order_id,variant_id));
create index items_order on public.order_items(order_id);
create table public.payments(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders on delete restrict,provider text not null,reference text unique,idempotency_key uuid not null unique,status text not null check(status in ('unpaid','pending','paid','failed','refunded','partially_refunded')),amount bigint not null check(amount>=0),currency text not null default 'NGN',created_at timestamptz not null default now());
create index payments_order on public.payments(order_id);
create table public.fulfilments(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders on delete restrict,carrier text,tracking_reference text,created_at timestamptz not null default now());
create table public.order_notes(id uuid primary key default gen_random_uuid(),order_id uuid not null references public.orders on delete cascade,author_id uuid references auth.users on delete set null,note text not null check(length(note) between 1 and 2000),created_at timestamptz not null default now());
create table public.reviews(id uuid primary key default gen_random_uuid(),product_id uuid not null references public.products on delete restrict,user_id uuid references auth.users on delete set null,rating integer not null check(rating between 1 and 5),title text not null check(length(title)<=120),body text not null check(length(body) between 10 and 2000),verified_purchase boolean not null default false,status text not null default 'pending' check(status in ('pending','published','hidden')),created_at timestamptz not null default now(),unique(product_id,user_id));
create index reviews_public on public.reviews(product_id,status);
create table public.site_settings(key text primary key,value jsonb not null,updated_at timestamptz not null default now());
create table public.email_outbox(id uuid primary key default gen_random_uuid(),order_id uuid references public.orders on delete restrict,kind text not null,recipient text not null,payload jsonb not null,status text not null default 'pending' check(status in ('pending','processing','sent','failed')),attempts integer not null default 0,available_at timestamptz not null default now(),created_at timestamptz not null default now(),sent_at timestamptz,provider_id text);
create index outbox_pending on public.email_outbox(status,available_at);
create table public.admin_audit_logs(id uuid primary key default gen_random_uuid(),actor_id uuid references auth.users on delete set null,action text not null,entity_id text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
create table public.rate_limits(key text primary key,count integer not null,expires_at timestamptz not null);

-- RLS: no public writes to financial, inventory, roles or email tables.
do $$ declare t text;begin foreach t in array array['profiles','user_roles','addresses','categories','products','product_variants','product_images','collections','collection_products','shopping_state','delivery_zones','orders','order_items','payments','fulfilments','order_notes','reviews','site_settings','email_outbox','admin_audit_logs','rate_limits'] loop execute format('alter table public.%I enable row level security',t);end loop;end $$;
create policy profile_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_admin());
create policy profile_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy own_role_read on public.user_roles for select to authenticated using(user_id=auth.uid());
create policy own_addresses on public.addresses for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy own_shopping on public.shopping_state for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy category_read on public.categories for select using(active or public.is_admin());
create policy product_read on public.products for select using(status='active' or public.is_admin());
create policy variant_read on public.product_variants for select using((active and exists(select 1 from public.products p where p.id=product_id and p.status='active')) or public.is_admin());
create policy image_read on public.product_images for select using(exists(select 1 from public.products p where p.id=product_id and p.status='active') or public.is_admin());
create policy collection_read on public.collections for select using(active or public.is_admin());
create policy collection_products_read on public.collection_products for select using(exists(select 1 from public.collections c where c.id=collection_id and c.active) or public.is_admin());
create policy delivery_read on public.delivery_zones for select using(active or public.is_admin());
create policy settings_read on public.site_settings for select using(key in ('announcement','featured_collection') or public.is_admin());
create policy own_orders on public.orders for select to authenticated using(user_id=auth.uid() or public.is_admin());
create policy own_items on public.order_items for select to authenticated using(exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));
create policy reviews_read on public.reviews for select using(status='published' or user_id=auth.uid() or public.is_admin());
do $$ declare t text;begin foreach t in array array['categories','products','product_variants','product_images','collections','collection_products','delivery_zones','orders','order_notes','reviews','site_settings','fulfilments'] loop execute format('create policy admin_manage on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);end loop;end $$;
create policy admin_audit_read on public.admin_audit_logs for select to authenticated using(public.is_admin());
create policy admin_notes_read on public.order_notes for select to authenticated using(public.is_admin());
-- Immutable order line snapshots and payment records are mutated only by secured functions/service clients.
create view public.catalogue with(security_invoker=true) as
select p.id,p.name,p.slug,p.seo_title,p.seo_description,p.description,p.short_description,c.name category,c.slug category_slug,p.audience,
 p.tags||coalesce((select array_agg(co.slug) from public.collection_products cp join public.collections co on co.id=cp.collection_id where cp.product_id=p.id and co.active),'{}') tags,
 p.status,p.price,p.compare_at,p.details,p.care,p.featured,p.created_at,p.fixture,
 coalesce((select array_agg(i.url order by i.position) from public.product_images i where i.product_id=p.id),array['/images/placeholder.svg']) images,
 coalesce((select i.alt from public.product_images i where i.product_id=p.id order by i.position limit 1),p.name) alt,
 coalesce((select jsonb_agg(jsonb_build_object('id',v.id,'sku',v.sku,'attributes',v.attributes,'price',v.price,'stock',v.stock,'image',v.image) order by v.sku) from public.product_variants v where v.product_id=p.id and v.active),'[]'::jsonb) variants
from public.products p join public.categories c on c.id=p.category_id where p.status='active' and c.active;
grant select on public.catalogue to anon,authenticated;
-- Supabase Storage: public product photography only. Write access is administrator-only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy image_public_read on storage.objects for select using(bucket_id='product-images');
create policy admin_image_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and public.is_admin());
create policy admin_image_update on storage.objects for update to authenticated using(bucket_id='product-images' and public.is_admin()) with check(bucket_id='product-images' and public.is_admin());
create policy admin_image_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and public.is_admin());
