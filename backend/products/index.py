"""
GET  /          — список всех активных продуктов с привязанными шаблонами
POST /          — создать продукт (admin)
PUT  /          — обновить продукт (admin)
POST /link      — привязать/отвязать шаблон от продукта (admin)
"""
import json
import os
import psycopg2
import psycopg2.extras

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p50926286_baby_book_order')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
    }

def ok(data):
    return {'statusCode': 200, 'headers': {**cors(), 'Content-Type': 'application/json'}, 'body': json.dumps(data, ensure_ascii=False, default=str)}

def err(msg, status=400):
    return {'statusCode': status, 'headers': cors(), 'body': json.dumps({'error': msg})}

def get_admin_role(cur, token: str):
    cur.execute(
        "SELECT u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()",
        (token,)
    )
    row = cur.fetchone()
    return row[0] if row else None

def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors(), 'body': ''}

    method = event.get('httpMethod', 'GET')
    path = event.get('path', '/')

    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    # GET — список продуктов с привязанными template_ids
    if method == 'GET':
        cur.execute("""
            SELECT p.*, COALESCE(
                json_agg(pt.template_id) FILTER (WHERE pt.template_id IS NOT NULL), '[]'
            ) AS template_ids
            FROM products p
            LEFT JOIN product_templates pt ON pt.product_id = p.id
            GROUP BY p.id
            ORDER BY p.id
        """)
        rows = cur.fetchall()
        conn.close()
        return ok([dict(r) for r in rows])

    # Все остальные методы — только для admin
    token = event.get('headers', {}).get('x-authorization', '').replace('Bearer ', '')
    role = get_admin_role(cur, token)
    if role != 'admin':
        conn.close()
        return err('Forbidden', 403)

    body = json.loads(event.get('body') or '{}')

    # POST /link — привязать/отвязать шаблон
    if method == 'POST' and 'link' in path:
        product_id = int(body.get('product_id', 0))
        template_id = int(body.get('template_id', 0))
        action = body.get('action', 'add')  # 'add' | 'remove'

        if action == 'add':
            cur.execute("""
                INSERT INTO product_templates (product_id, template_id, is_active)
                VALUES (%s, %s, TRUE)
                ON CONFLICT (product_id, template_id) DO UPDATE SET is_active = TRUE
            """, (product_id, template_id))
        else:
            cur.execute(
                "UPDATE product_templates SET is_active = FALSE WHERE product_id = %s AND template_id = %s",
                (product_id, template_id)
            )
        conn.commit()
        conn.close()
        return ok({'ok': True})

    # POST — создать продукт
    if method == 'POST':
        cur.execute("""
            INSERT INTO products (name, size_cm, cover_mm_w, cover_mm_h, spread_mm_w, spread_mm_h, dpi, price_modifier)
            VALUES (%(name)s, %(size_cm)s, %(cover_mm_w)s, %(cover_mm_h)s, %(spread_mm_w)s, %(spread_mm_h)s, %(dpi)s, %(price_modifier)s)
            RETURNING id
        """, {
            'name': body.get('name', ''),
            'size_cm': body.get('size_cm', ''),
            'cover_mm_w': int(body.get('cover_mm_w', 468)),
            'cover_mm_h': int(body.get('cover_mm_h', 246)),
            'spread_mm_w': int(body.get('spread_mm_w', 406)),
            'spread_mm_h': int(body.get('spread_mm_h', 203)),
            'dpi': int(body.get('dpi', 300)),
            'price_modifier': int(body.get('price_modifier', 0)),
        })
        new_id = cur.fetchone()['id']
        conn.commit()
        conn.close()
        return ok({'id': new_id})

    # PUT — обновить продукт
    if method == 'PUT':
        pid = int(body.get('id', 0))
        cur.execute("""
            UPDATE products SET
              name = %(name)s, size_cm = %(size_cm)s,
              cover_mm_w = %(cover_mm_w)s, cover_mm_h = %(cover_mm_h)s,
              spread_mm_w = %(spread_mm_w)s, spread_mm_h = %(spread_mm_h)s,
              dpi = %(dpi)s, price_modifier = %(price_modifier)s,
              is_active = %(is_active)s
            WHERE id = %(id)s
        """, {
            'id': pid,
            'name': body.get('name', ''),
            'size_cm': body.get('size_cm', ''),
            'cover_mm_w': int(body.get('cover_mm_w', 468)),
            'cover_mm_h': int(body.get('cover_mm_h', 246)),
            'spread_mm_w': int(body.get('spread_mm_w', 406)),
            'spread_mm_h': int(body.get('spread_mm_h', 203)),
            'dpi': int(body.get('dpi', 300)),
            'price_modifier': int(body.get('price_modifier', 0)),
            'is_active': bool(body.get('is_active', True)),
        })
        conn.commit()
        conn.close()
        return ok({'ok': True})

    conn.close()
    return err('Method not allowed', 405)