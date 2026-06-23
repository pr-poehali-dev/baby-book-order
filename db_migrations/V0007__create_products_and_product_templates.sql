CREATE TABLE IF NOT EXISTS t_p50926286_baby_book_order.products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  size_cm VARCHAR(32) NOT NULL,
  cover_mm_w INTEGER NOT NULL DEFAULT 468,
  cover_mm_h INTEGER NOT NULL DEFAULT 246,
  spread_mm_w INTEGER NOT NULL DEFAULT 406,
  spread_mm_h INTEGER NOT NULL DEFAULT 203,
  dpi INTEGER NOT NULL DEFAULT 300,
  price_modifier INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p50926286_baby_book_order.product_templates (
  product_id INTEGER NOT NULL REFERENCES t_p50926286_baby_book_order.products(id),
  template_id INTEGER NOT NULL REFERENCES t_p50926286_baby_book_order.templates(id),
  PRIMARY KEY (product_id, template_id)
);

INSERT INTO t_p50926286_baby_book_order.products (name, size_cm, cover_mm_w, cover_mm_h, spread_mm_w, spread_mm_h, dpi)
SELECT 'Книга 20×20 см', '20x20', 468, 246, 406, 203, 300
WHERE NOT EXISTS (SELECT 1 FROM t_p50926286_baby_book_order.products WHERE size_cm = '20x20');

INSERT INTO t_p50926286_baby_book_order.product_templates (product_id, template_id)
SELECT p.id, t.id
FROM t_p50926286_baby_book_order.products p, t_p50926286_baby_book_order.templates t
WHERE p.size_cm = '20x20'
AND NOT EXISTS (
  SELECT 1 FROM t_p50926286_baby_book_order.product_templates pt
  WHERE pt.product_id = p.id AND pt.template_id = t.id
);
