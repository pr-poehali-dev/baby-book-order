
CREATE TABLE IF NOT EXISTS t_p50926286_baby_book_order.users (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) UNIQUE,
  name VARCHAR(200),
  email VARCHAR(200),
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  yandex_id VARCHAR(100) UNIQUE,
  vk_id VARCHAR(100) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p50926286_baby_book_order.sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p50926286_baby_book_order.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS t_p50926286_baby_book_order.sms_codes (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(6) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS t_p50926286_baby_book_order.cart (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p50926286_baby_book_order.users(id),
  template_id INTEGER NOT NULL REFERENCES t_p50926286_baby_book_order.templates(id),
  child_name VARCHAR(200),
  preview_urls TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS t_p50926286_baby_book_order.previews (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES t_p50926286_baby_book_order.users(id),
  template_id INTEGER REFERENCES t_p50926286_baby_book_order.templates(id),
  child_name VARCHAR(200),
  image_urls TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
