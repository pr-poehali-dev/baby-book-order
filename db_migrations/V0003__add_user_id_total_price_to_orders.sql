ALTER TABLE t_p50926286_baby_book_order.orders
  ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES t_p50926286_baby_book_order.users(id),
  ADD COLUMN IF NOT EXISTS total_price INTEGER DEFAULT 0;
