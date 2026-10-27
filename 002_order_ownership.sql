ALTER TABLE cod_orders ADD COLUMN IF NOT EXISTS user_id TEXT;
CREATE INDEX IF NOT EXISTS cod_orders_user_created_idx ON cod_orders (user_id, created_at DESC);