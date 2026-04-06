-- ============================================================
-- 008: Pre-order system + Cash on Delivery (COD)
-- ============================================================

-- 1. Extend products status to include 'pre_order'
ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('active', 'draft', 'out_of_stock', 'pre_order'));

-- 2. Add expected ship date column for pre-order products
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS preorder_ship_date date NULL;

CREATE INDEX IF NOT EXISTS products_preorder_idx
  ON public.products (preorder_ship_date)
  WHERE status = 'pre_order';

-- 3. Update products RLS: expose pre_order products to anon users
DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products
  FOR SELECT USING (status IN ('active', 'pre_order'));

-- 4. Add pre-order + COD columns to orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_preorder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pre_order_ship_date date NULL,
  ADD COLUMN IF NOT EXISTS payment_type text NOT NULL DEFAULT 'paystack'
    CHECK (payment_type IN ('paystack', 'cod')),
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'awaiting_cod'));

-- 5. Add 'confirmed' to order status (used for COD orders placed successfully)
ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_status_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_status_check
  CHECK (status IN ('pending', 'confirmed', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'));

CREATE INDEX IF NOT EXISTS orders_is_preorder_idx
  ON public.orders (is_preorder) WHERE is_preorder = true;

CREATE INDEX IF NOT EXISTS orders_payment_type_idx
  ON public.orders (payment_type);

-- 6. Update decrement_stock to never touch pre_order products
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
  WHERE id = p_product_id
    AND status != 'pre_order';
END;
$$;
