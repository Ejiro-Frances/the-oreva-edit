create function public.manage_order(p_order uuid,p_action text,p_note text default '')returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; next_status text;begin
 if not public.is_admin() then raise exception 'Forbidden';end if;
 select * into o from public.orders where id=p_order for update;if not found then raise exception 'Order missing';end if;
 if p_action='note' then
  if length(trim(p_note))=0 then raise exception 'Write a note';end if;
 elsif p_action='confirm' and o.status='pending' then
  if not o.test and o.payment_status<>'paid' then raise exception 'Unpaid order';end if;
  next_status:='confirmed';
 elsif p_action='complete' and o.status='confirmed' and o.fulfilment_status='delivered' then next_status:='completed';
 elsif p_action='cancel' and o.status in ('pending','confirmed') and o.fulfilment_status in ('unfulfilled','processing') then
  if o.payment_status not in ('unpaid','failed') then raise exception 'Paid cancellations require the future refund workflow';end if;
  perform id from public.product_variants where id in(select variant_id from public.order_items where order_id=p_order) order by id for update;
  update public.product_variants v set stock=v.stock+i.quantity from public.order_items i where i.order_id=p_order and v.id=i.variant_id;
  next_status:='cancelled';
 else raise exception 'Invalid order action';end if;
 if next_status is not null then update public.orders set status=next_status,updated_at=now() where id=p_order;
 insert into public.email_outbox(order_id,kind,recipient,payload)values(p_order,'order_'||next_status,o.contact->>'email',jsonb_build_object('number',o.number,'test',o.test,'total',o.total,'status',next_status));end if;
 if length(trim(p_note))>0 then insert into public.order_notes(order_id,author_id,note)values(p_order,auth.uid(),p_note);end if;
 insert into public.admin_audit_logs(actor_id,action,entity_id,details)values(auth.uid(),'order.'||p_action,p_order::text,jsonb_build_object('previous',o.status,'next',next_status));
end;$$;
revoke all on function public.manage_order(uuid,text,text) from public,anon;
grant execute on function public.manage_order(uuid,text,text) to authenticated;
