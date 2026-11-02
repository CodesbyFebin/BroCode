export const SAFE_MIGRATION = `BEGIN;
CREATE TABLE IF NOT EXISTS customers (
  id serial PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  customer_id integer NOT NULL REFERENCES customers(id),
  total numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders (customer_id);
COMMIT;`;

export const DANGEROUS_MIGRATION = `ALTER TABLE customers DROP COLUMN email;
ALTER TABLE orders ADD COLUMN gst_number text NOT NULL;
DROP TABLE audit_log;
CREATE TABLE payments (
  id serial PRIMARY KEY,
  order_id integer REFERENCES orders(id),
  card_number text,
  amount numeric(10,2)
);`;
