INSERT INTO t_p50926286_baby_book_order.users (name, email, phone, password_hash, role)
VALUES (
  'Елена Смирнова',
  'sme@yarkiy.ru',
  '89112821673',
  encode(sha256('4616258'::bytea), 'hex'),
  'admin'
);
