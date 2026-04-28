-- 015: Replace fixed preorder_ship_date with relative day offset
-- Adds preorder_days (integer) and preorder_note (text) to products.
-- Drops preorder_ship_date. Orders table unchanged.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS preorder_days integer NULL,
  ADD COLUMN IF NOT EXISTS preorder_note text NULL;

DROP INDEX IF EXISTS products_preorder_idx;

ALTER TABLE public.products
  DROP COLUMN IF EXISTS preorder_ship_date;
