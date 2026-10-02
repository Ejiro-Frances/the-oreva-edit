create function public.create_test_order(p_items jsonb,p_contact jsonb,p_key uuid,p_guest_hash text,p_user_id uuid default null) returns text language plpgsql security definer set search_path='' as $$
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
  insert into public.order_items(order_id,product_id,variant_id,name,sku,attributes,image,price,quantity) values(order_id,p.id,v.id,p.name,v.sku,v.attributes,coalesce((select url from public.product_images where product_id=p.id order by position limit 1),''),unit,qty);
  update public.product_variants set stock=stock-qty where id=v.id;
 end loop;
 insert into public.email_outbox(order_id,kind,recipient,payload) values(order_id,'order_received',p_contact->>'email',jsonb_build_object('number',order_number,'test',true,'total',subtotal+delivery,'status','pending'));
 return order_number;
end;$$;
revoke all on function public.create_test_order(jsonb,jsonb,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.create_test_order(jsonb,jsonb,uuid,text,uuid) to service_role;

create function public.check_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare hits integer;begin
 delete from public.rate_limits where expires_at<now()-interval '1 day';
 insert into public.rate_limits(key,count,expires_at) values(p_key,1,now()+make_interval(secs=>p_seconds))
 on conflict(key) do update set count=case when public.rate_limits.expires_at<now() then 1 else public.rate_limits.count+1 end,expires_at=case when public.rate_limits.expires_at<now() then now()+make_interval(secs=>p_seconds) else public.rate_limits.expires_at end returning count into hits;
 return hits<=p_limit;end;$$;
revoke all on function public.check_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.check_rate_limit(text,integer,integer) to service_role;

create function public.update_fulfilment(p_order_id uuid,p_status text,p_note text default '') returns void language plpgsql security definer set search_path='' as $$
declare o public.orders;begin
 if not public.is_admin() then raise exception 'Forbidden';end if;
 select * into o from public.orders where id=p_order_id for update;if not found then raise exception 'Order not found';end if;
 if o.status='cancelled' then raise exception 'Cancelled order';end if;
 if not ((o.fulfilment_status='unfulfilled' and p_status='processing') or (o.fulfilment_status='processing' and p_status='shipped') or (o.fulfilment_status='shipped' and p_status='delivered') or (o.fulfilment_status='delivered' and p_status='returned')) then raise exception 'Invalid fulfilment transition';end if;
 if not o.test and o.payment_status<>'paid' then raise exception 'Unpaid order cannot be fulfilled';end if;
 update public.orders set fulfilment_status=p_status,updated_at=now() where id=p_order_id;
 if length(trim(p_note))>0 then insert into public.order_notes(order_id,author_id,note)values(p_order_id,auth.uid(),p_note);end if;
 insert into public.admin_audit_logs(actor_id,action,entity_id,details)values(auth.uid(),'order.fulfilment',p_order_id::text,jsonb_build_object('from',o.fulfilment_status,'to',p_status));
 insert into public.email_outbox(order_id,kind,recipient,payload)values(p_order_id,'order_'||p_status,o.contact->>'email',jsonb_build_object('number',o.number,'test',o.test,'total',o.total,'status',p_status));
end;$$;
revoke all on function public.update_fulfilment(uuid,text,text) from public,anon;
grant execute on function public.update_fulfilment(uuid,text,text) to authenticated;

create function public.audit_catalogue_change() returns trigger language plpgsql security definer set search_path='' as $$
begin insert into public.admin_audit_logs(actor_id,action,entity_id,details)values(auth.uid(),tg_table_name||'.'||lower(tg_op),coalesce(new.id,old.id)::text,jsonb_build_object('operation',tg_op));return coalesce(new,old);end;$$;
create trigger audit_product after insert or update on public.products for each row execute function public.audit_catalogue_change();
create trigger audit_inventory after insert or update on public.product_variants for each row execute function public.audit_catalogue_change();

create function public.claim_emails() returns setof public.email_outbox language sql security definer set search_path='' as $$
 update public.email_outbox set status='processing',attempts=attempts+1,available_at=now()+interval '5 minutes' where id in(select id from public.email_outbox where (status in ('pending','failed') or (status='processing' and available_at<now())) and attempts<5 and available_at<=now() order by created_at for update skip locked limit 10) returning *;
$$;
revoke all on function public.claim_emails() from public,anon,authenticated;
grant execute on function public.claim_emails() to service_role;
