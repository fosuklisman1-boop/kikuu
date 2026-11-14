-- supabase/migrations/026_payment_and_delivery_status.sql
-- Split order state into payment_status (set by gateways / refunds) and
-- delivery_status (set by admin, only meaningful once paid). The legacy
-- orders.status column is kept and synced by application code.

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;

-- Normalise existing rows before the new constraint is added.
UPDATE orders SET payment_status = 'pending' WHERE payment_status = 'awaiting_cod';
UPDATE orders SET payment_status = 'paid'
  WHERE payment_status = 'pending' AND status IN ('paid', 'processing', 'shipped', 'delivered');
UPDATE orders SET payment_status = 'failed'
  WHERE payment_status = 'pending' AND status = 'cancelled';
UPDATE orders SET payment_status = 'refunded' WHERE status = 'refunded';

ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check
  CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded'));

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status text NULL
  CHECK (delivery_status IS NULL OR delivery_status IN ('processing', 'shipped', 'delivered'));

UPDATE orders SET delivery_status = CASE status
    WHEN 'paid' THEN 'processing'
    WHEN 'processing' THEN 'processing'
    WHEN 'shipped' THEN 'shipped'
    WHEN 'delivered' THEN 'delivered'
  END
  WHERE payment_status = 'paid' AND delivery_status IS NULL;

CREATE INDEX IF NOT EXISTS orders_payment_delivery_created_idx
  ON orders (payment_status, delivery_status, created_at DESC);
