-- Add free_shipping coupon type.
-- The 'value' column is ignored for free_shipping coupons (shipping fee is waived entirely).
-- We relax the check constraint to allow value = 0 for this type.

alter table public.coupons
  drop constraint if exists coupons_type_check;

alter table public.coupons
  add constraint coupons_type_check
  check (type in ('percentage', 'fixed', 'free_shipping'));

-- Allow value = 0 for free_shipping coupons (value is irrelevant for them)
alter table public.coupons
  drop constraint if exists coupons_value_check;

alter table public.coupons
  add constraint coupons_value_check
  check (
    (type = 'free_shipping' and value >= 0) or
    (type <> 'free_shipping' and value > 0)
  );
