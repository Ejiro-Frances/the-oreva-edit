-- Associate each variant photograph with its own product; deleting media clears the link.
-- Historical order snapshots deliberately retain their original URL.
update public.product_variants v set image=null
where image is not null and not exists (
  select 1 from public.product_images i where i.product_id=v.product_id and i.url=v.image
);
create unique index product_images_product_url on public.product_images(product_id,url);
alter table public.product_variants add constraint variant_image_product
  foreign key(product_id,image) references public.product_images(product_id,url)
  on delete set null (image);

create or replace function public.save_product(p_id uuid,p_data jsonb,p_variants jsonb,p_expected timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
declare saved_product_id uuid; current_product public.products; item jsonb; existing_variant public.product_variants;
begin
 if not public.is_admin() then raise exception 'Forbidden';end if;
 if jsonb_typeof(p_variants)<>'array' or jsonb_array_length(p_variants)>200 then raise exception 'Invalid variants';end if;
 if p_id is not null then
 perform id from public.product_variants where product_variants.product_id=p_id order by id for update;
 select * into current_product from public.products where id=p_id for update;
 if not found then raise exception 'Product not found';end if;
 if p_expected is null or current_product.updated_at<>p_expected then raise exception 'Product changed';end if;
 saved_product_id:=p_id;
 update public.products set name=p_data->>'name',slug=p_data->>'slug',description=p_data->>'description',short_description=p_data->>'short_description',category_id=(p_data->>'category_id')::uuid,audience=p_data->>'audience',price=(p_data->>'price')::bigint,compare_at=(p_data->>'compare_at')::bigint,status=p_data->>'status',tags=array(select jsonb_array_elements_text(p_data->'tags')),featured=(p_data->>'featured')::boolean,details=array(select jsonb_array_elements_text(p_data->'details')),care=p_data->>'care',seo_title=p_data->>'seo_title',seo_description=p_data->>'seo_description',updated_at=clock_timestamp() where id=p_id;
 else
 insert into public.products(name,slug,description,short_description,category_id,audience,price,compare_at,status,tags,featured,details,care,seo_title,seo_description)values(p_data->>'name',p_data->>'slug',p_data->>'description',p_data->>'short_description',(p_data->>'category_id')::uuid,p_data->>'audience',(p_data->>'price')::bigint,(p_data->>'compare_at')::bigint,p_data->>'status',array(select jsonb_array_elements_text(p_data->'tags')),(p_data->>'featured')::boolean,array(select jsonb_array_elements_text(p_data->'details')),p_data->>'care',p_data->>'seo_title',p_data->>'seo_description')returning id into saved_product_id;
 end if;
 for item in select * from jsonb_array_elements(p_variants) loop
 if item->>'id' is not null then
 select * into existing_variant from public.product_variants where id=(item->>'id')::uuid and product_variants.product_id=saved_product_id;
 if not found then raise exception 'Variant ownership mismatch';end if;
 if item->>'expectedStock' is null or existing_variant.stock<>(item->>'expectedStock')::integer then raise exception 'Stock changed';end if;
 update public.product_variants set sku=item->>'sku',attributes=item->'attributes',price=(item->>'price')::bigint,stock=(item->>'stock')::integer,active=(item->>'active')::boolean,image=case when item ? 'image' then nullif(item->>'image','') else existing_variant.image end where id=existing_variant.id;
 else
 insert into public.product_variants(product_id,sku,attributes,price,stock,active,image)values(saved_product_id,item->>'sku',item->'attributes',(item->>'price')::bigint,(item->>'stock')::integer,(item->>'active')::boolean,nullif(item->>'image',''));
 end if;end loop;
 if p_data->>'status'='active' and (not exists(select 1 from public.product_variants v where v.product_id=saved_product_id and v.active) or not exists(select 1 from public.product_images i where i.product_id=saved_product_id)) then raise exception 'Cannot publish without photograph and active variant';end if;
 return saved_product_id;
end;$$;
revoke all on function public.save_product(uuid,jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.save_product(uuid,jsonb,jsonb,timestamptz) to authenticated;

-- Preserve the chosen colour photograph at order creation.
create or replace function public.create_test_order(p_items jsonb,p_contact jsonb,p_key uuid,p_guest_hash text,p_user_id uuid default null) returns text language plpgsql security definer set search_path='' as $$
declare existing public.orders; item jsonb; v public.product_variants; p public.products; z public.delivery_zones; order_id uuid; order_number text; subtotal bigint:=0; delivery bigint; qty integer; unit bigint;
begin
 if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 50 or length(p_guest_hash)<>64 then raise exception 'Invalid order';end if;
 if (p_contact->>'acceptTest') is distinct from 'true' then raise exception 'Test acknowledgement required';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
 select * into existing from public.orders where idempotency_key=p_key;
 if found then if existing.guest_hash<>p_guest_hash or existing.user_id is distinct from p_user_id then raise exception 'Idempotency ownership conflict';end if;return existing.number;end if;
 if (select count(*) from jsonb_array_elements(p_items))<>(select count(distinct x->>'variantId') from jsonb_array_elements(p_items) x) then raise exception 'Duplicate variant';end if;
 -- Lock in stable order, then re-check inventory while holding the locks.
 perform id from public.product_variants where id in(select (x->>'variantId')::uuid from jsonb_array_elements(p_items) x) order by id for update;
 for item in select * from jsonb_array_elements(p_items) loop
  qty:=(item->>'quantity')::integer;if qty not between 1 and 20 then raise exception 'Invalid quantity';end if;
  select * into v from public.product_variants where id=(item->>'variantId')::uuid and active;if not found or v.stock<qty then raise exception 'Insufficient stock';end if;
  select * into p from public.products where id=v.product_id and status='active' for share;if not found then raise exception 'Product unavailable';end if;
  if not exists(select 1 from public.categories where id=p.category_id and active) then raise exception 'Category unavailable';end if;
  subtotal:=subtotal+coalesce(v.price,p.price)*qty;
 end loop;
 select * into z from public.delivery_zones where active and p_contact->>'state'=any(states) order by rate,id limit 1 for share;if not found then raise exception 'Delivery unavailable';end if;
 delivery:=case when z.free_threshold is not null and subtotal>=z.free_threshold then 0 else z.rate end;
 insert into public.orders(user_id,guest_hash,idempotency_key,contact,subtotal,delivery,total,test) values(p_user_id,p_guest_hash,p_key,p_contact,subtotal,delivery,subtotal+delivery,true) returning id,number into order_id,order_number;
 for item in select * from jsonb_array_elements(p_items) loop
  qty:=(item->>'quantity')::integer;select * into v from public.product_variants where id=(item->>'variantId')::uuid;select * into p from public.products where id=v.product_id;unit:=coalesce(v.price,p.price);
  insert into public.order_items(order_id,product_id,variant_id,name,sku,attributes,image,price,quantity) values(order_id,p.id,v.id,p.name,v.sku,v.attributes,coalesce(v.image,(select other.image from public.product_variants other where other.product_id=p.id and other.active and other.image is not null and exists(select 1 from jsonb_each_text(v.attributes) opt where lower(opt.key) in ('colour','color') and other.attributes->>opt.key=opt.value) order by other.id limit 1),(select url from public.product_images where product_id=p.id order by position limit 1),''),unit,qty);
  update public.product_variants set stock=stock-qty where id=v.id;
 end loop;
 insert into public.email_outbox(order_id,kind,recipient,payload) values(order_id,'order_received',p_contact->>'email',jsonb_build_object('number',order_number,'test',true,'total',subtotal+delivery,'status','pending'));
 return order_number;
end;$$;
revoke all on function public.create_test_order(jsonb,jsonb,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_test_order(jsonb,jsonb,uuid,text,uuid) to service_role;

