CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    cover_url TEXT,
    price INTEGER DEFAULT 0,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS template_pages (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES templates(id),
    page_order INTEGER NOT NULL DEFAULT 0,
    image_url TEXT NOT NULL,
    face_x REAL,
    face_y REAL,
    face_width REAL,
    face_height REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    template_id INTEGER REFERENCES templates(id),
    child_name VARCHAR(100),
    child_age INTEGER,
    child_photo_url TEXT,
    customer_email VARCHAR(200),
    customer_phone VARCHAR(50),
    status VARCHAR(30) DEFAULT 'new',
    result_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_template_pages_template ON template_pages(template_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);