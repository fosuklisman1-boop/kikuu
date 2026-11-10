-- supabase/migrations/023_category_below_min_topup.sql

-- Per-category flat GHS top-up added to each unit when a customer buys a
-- pre-order product in a quantity below its min_order_qty. NULL / 0 = no
-- surcharge (below-minimum purchases are still allowed at the plain price).
ALTER TABLE public.categories
  ADD COLUMN below_min_topup numeric(10,2) NULL
  CHECK (below_min_topup IS NULL OR below_min_topup >= 0);
