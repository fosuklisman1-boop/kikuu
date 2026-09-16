-- supabase/migrations/021_preorder_stock_min_max.sql

-- Pre-order products already use the existing stock_qty column once the
-- admin form stops forcing it to 0 for pre_order status; this migration
-- only adds the new per-product min/max order quantity constraints, which
-- apply only when set (NULL = no constraint beyond the existing stock cap).
ALTER TABLE public.products
  ADD COLUMN min_order_qty integer NULL,
  ADD COLUMN max_order_qty integer NULL;

ALTER TABLE public.products
  ADD CONSTRAINT products_min_order_qty_positive CHECK (min_order_qty IS NULL OR min_order_qty > 0),
  ADD CONSTRAINT products_max_order_qty_positive CHECK (max_order_qty IS NULL OR max_order_qty > 0),
  ADD CONSTRAINT products_min_max_order_qty_order CHECK (
    min_order_qty IS NULL OR max_order_qty IS NULL OR max_order_qty >= min_order_qty
  );
