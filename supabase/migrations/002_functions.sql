-- Decrement product stock after successful payment
create or replace function public.decrement_stock(p_product_id uuid, p_qty integer)
returns void language plpgsql security definer as $$
begin
  update public.products
  set
    stock_qty = greatest(stock_qty - p_qty, 0),
    status = case when stock_qty - p_qty <= 0 then 'out_of_stock' else status end
  where id = p_product_id;
end;
$$;

-- Validate and apply coupon (returns discount amount or 0)
create or replace function public.validate_coupon(
  p_code text,
  p_subtotal numeric
)
returns numeric language plpgsql security definer as $$
declare
  v_coupon record;
  v_discount numeric := 0;
begin
  select * into v_coupon
  from public.coupons
  where code = upper(p_code)
    and active = true
    and (expires_at is null or expires_at > now())
    and (max_uses is null or used_count < max_uses)
    and (min_order_amount is null or p_subtotal >= min_order_amount)
  limit 1;

  if not found then
    return 0;
  end if;

  if v_coupon.type = 'percentage' then
    v_discount := round((p_subtotal * v_coupon.value / 100)::numeric, 2);
  else
    v_discount := least(v_coupon.value, p_subtotal);
  end if;

  -- Increment used count
  update public.coupons set used_count = used_count + 1 where id = v_coupon.id;

  return v_discount;
end;
$$;
