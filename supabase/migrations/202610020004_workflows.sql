-- Explicit grants keep the same policy boundaries on local and hosted PostgreSQL.
grant usage on schema public to anon,authenticated,service_role;
grant select on public.categories,public.products,public.product_variants,public.product_images,public.collections,public.collection_products,public.delivery_zones,public.site_settings to anon,authenticated;
grant select on public.profiles,public.user_roles,public.addresses,public.shopping_state,public.orders,public.order_items,public.order_notes,public.reviews,public.admin_audit_logs,public.fulfilments to authenticated;
grant insert,update,delete on public.addresses,public.shopping_state,public.categories,public.collections,public.collection_products,public.delivery_zones,public.site_settings,public.reviews,public.product_images,public.order_notes to authenticated;
revoke insert,update,delete on public.products,public.product_variants,public.orders from anon,authenticated;
revoke update on public.profiles from authenticated;
grant update(display_name,phone,updated_at) on public.profiles to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;
-- Collection membership changes in one transaction.
create function public.set_collection_products(p_collection uuid,p_products uuid[]) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Forbidden';end if;
 perform id from public.collections where id=p_collection for update;if not found then raise exception 'Collection missing';end if;
 if cardinality(p_products)>500 then raise exception 'Too many products';end if;
 delete from public.collection_products where collection_id=p_collection;
 insert into public.collection_products(collection_id,product_id,position)select p_collection,id,n-1 from unnest(p_products) with ordinality as entries(id,n);
end;$$;
revoke all on function public.set_collection_products(uuid,uuid[]) from public,anon;
grant execute on function public.set_collection_products(uuid,uuid[]) to authenticated;
-- Image changes preserve at least one photograph for a published product.
create function public.reorder_images(p_product uuid,p_images uuid[])returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Forbidden';end if;
 perform id from public.products where id=p_product for update;
 if cardinality(p_images)<>(select count(*) from public.product_images where product_id=p_product) or
 (select count(distinct id) from unnest(p_images) id)<>cardinality(p_images) or
 exists(select 1 from unnest(p_images) as requested(id) where not exists(select 1 from public.product_images m where m.id=requested.id and m.product_id=p_product)) then raise exception 'Image list changed';end if;
 update public.product_images m set position=e.n-1 from unnest(p_images) with ordinality e(id,n) where m.id=e.id and m.product_id=p_product;
end;$$;
revoke all on function public.reorder_images(uuid,uuid[]) from public,anon;
grant execute on function public.reorder_images(uuid,uuid[]) to authenticated;
create function public.remove_product_image(p_product uuid,p_image uuid)returns text language plpgsql security definer set search_path='' as $$
declare p public.products; old_path text;begin
 if not public.is_admin() then raise exception 'Forbidden';end if;
 select * into p from public.products where id=p_product for update;
 if p.status='active' and (select count(*) from public.product_images where product_id=p_product)<=1 then raise exception 'Archive the product before removing its last image';end if;
 delete from public.product_images where id=p_image and product_id=p_product returning path into old_path;
 if not found then raise exception 'Image missing';end if;return old_path;
end;$$;
revoke all on function public.remove_product_image(uuid,uuid) from public,anon;
grant execute on function public.remove_product_image(uuid,uuid) to authenticated;
-- Public review projection excludes customer identifiers. Submission is moderated.
create view public.published_reviews as select id,product_id,rating,title,body,verified_purchase,created_at from public.reviews where status='published';
grant select on public.published_reviews to anon,authenticated;
revoke select on public.reviews from anon;
create function public.submit_review(p_product uuid,p_rating integer,p_title text,p_body text)returns void language plpgsql security definer set search_path='' as $$
declare verified boolean;begin
 if auth.uid() is null then raise exception 'Sign in required';end if;
 if not exists(select 1 from public.products where id=p_product and status='active')then raise exception 'Product missing';end if;
 verified:=exists(select 1 from public.orders o join public.order_items i on i.order_id=o.id where o.user_id=auth.uid() and i.product_id=p_product and o.payment_status='paid' and not o.test);
 insert into public.reviews(product_id,user_id,rating,title,body,verified_purchase,status)values(p_product,auth.uid(),p_rating,p_title,p_body,verified,'pending')
 on conflict(product_id,user_id)do update set rating=excluded.rating,title=excluded.title,body=excluded.body,verified_purchase=excluded.verified_purchase,status='pending';
end;$$;
revoke all on function public.submit_review(uuid,integer,text,text) from public,anon;
grant execute on function public.submit_review(uuid,integer,text,text) to authenticated;

-- Aggregate ranking uses real, paid, non-cancelled sales only.
create view public.best_sellers as select i.product_id,sum(i.quantity)::bigint units from public.order_items i join public.orders o on o.id=i.order_id where o.payment_status='paid' and not o.test and o.status<>'cancelled' group by i.product_id;
grant select on public.best_sellers to anon,authenticated;
