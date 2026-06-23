CREATE TABLE IF NOT EXISTS t_p50926286_baby_book_order.print_settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(64) UNIQUE NOT NULL,
  value_mm_w INTEGER NOT NULL,
  value_mm_h INTEGER NOT NULL,
  dpi INTEGER NOT NULL DEFAULT 300,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO t_p50926286_baby_book_order.print_settings (key, value_mm_w, value_mm_h, dpi)
VALUES
  ('cover',  468, 246, 300),
  ('spread', 406, 203, 300)
ON CONFLICT (key) DO NOTHING;
