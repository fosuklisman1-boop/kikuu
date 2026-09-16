-- supabase/migrations/022_preorder_stock_decrement.sql

-- Migration 008 made decrement_stock a no-op for pre_order products
-- (`WHERE ... AND status != 'pre_order'`), since pre-order stock used to be
-- purely cosmetic and never real. Pre-order products now use stock_qty as a
-- real cap on how many units of the batch are available, so the decrement
-- must apply to them too. The CASE branch that keeps status pinned at
-- 'pre_order' regardless of remaining stock is unchanged — hitting 0 does
-- NOT flip a pre-order product to 'out_of_stock' (the UI layer treats
-- stock_qty = 0 on a pre_order product as "Pre-order Sold Out" instead).
CREATE OR REPLACE FUNCTION public.decrement_stock(p_product_id uuid, p_qty integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.products
  SET
    stock_qty = GREATEST(stock_qty - p_qty, 0),
    status = CASE
      WHEN status = 'pre_order' THEN 'pre_order'
      WHEN stock_qty - p_qty <= 0 THEN 'out_of_stock'
      ELSE status
    END
  WHERE id = p_product_id;
END;
$$;
