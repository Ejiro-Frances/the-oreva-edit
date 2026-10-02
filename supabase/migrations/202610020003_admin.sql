create function public.save_product(p_id uuid,p_data jsonb,p_variants jsonb,p_expected timestamptz default null) returns uuid language plpgsql security definer set search_path='' as $$
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
 update public.product_variants set sku=item->>'sku',attributes=item->'attributes',price=(item->>'price')::bigint,stock=(item->>'stock')::integer,active=(item->>'active')::boolean where id=existing_variant.id;
 else
 insert into public.product_variants(product_id,sku,attributes,price,stock,active)values(saved_product_id,item->>'sku',item->'attributes',(item->>'price')::bigint,(item->>'stock')::integer,(item->>'active')::boolean);
 end if;end loop;
 if p_data->>'status'='active' and (not exists(select 1 from public.product_variants v where v.product_id=saved_product_id and v.active) or not exists(select 1 from public.product_images i where i.product_id=saved_product_id)) then raise exception 'Cannot publish without photograph and active variant';end if;
 return saved_product_id;
end;$$;
revoke all on function public.save_product(uuid,jsonb,jsonb,timestamptz) from public,anon;
grant execute on function public.save_product(uuid,jsonb,jsonb,timestamptz) to authenticated;
create function public.make_primary_image(p_product uuid,p_image uuid)returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Forbidden';end if;
 perform id from public.products where id=p_product for update;
 if not exists(select 1 from public.product_images where id=p_image and product_id=p_product)then raise exception 'Image not found';end if;
 update public.product_images set position=position+1 where product_id=p_product;
 update public.product_images set position=0 where id=p_image;
end;$$;
revoke all on function public.make_primary_image(uuid,uuid) from public,anon;
grant execute on function public.make_primary_image(uuid,uuid) to authenticated;
