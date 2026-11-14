-- supabase/migrations/025_product_below_min_topup.sql
-- Per-product override of the category single-purchase top-up.
-- NULL = use the category's top-up; a number (including 0) replaces it.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS below_min_topup numeric(10,2) NULL
  CHECK (below_min_topup IS NULL OR below_min_topup >= 0);
