import json
import os
import psycopg2
import psycopg2.extras


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def generate_book(order: dict, pages: list) -> dict:
    '''Единая точка генерации книги. Сюда позже подключается AI face-swap.
    Сейчас возвращает страницы шаблона как предпросмотр (без замены лица).'''
    # TODO: здесь будет вызов AI face-swap сервиса.
    # На вход: order['child_photo_url'] + каждая страница с зоной лица (face_x/y/width/height).
    # На выход: список готовых JPEG-страниц 20x20 см.
    result_pages = [p['image_url'] for p in pages]
    return {'status': 'preview', 'pages': result_pages}


def handler(event: dict, context) -> dict:
    '''Управление заказами фотокниг. POST — создать заказ (фото ребёнка, имя, возраст) и запустить генерацию через единую точку. GET — список заказов или один по ?id=.'''
    method = event.get('httpMethod', 'GET')

    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
        'Access-Control-Max-Age': '86400',
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    headers = {**cors, 'Content-Type': 'application/json'}
    conn = get_conn()
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    params = event.get('queryStringParameters') or {}

    if method == 'GET':
        order_id = params.get('id')
        if order_id:
            cur.execute("SELECT * FROM orders WHERE id = %s", (int(order_id),))
            row = cur.fetchone()
            cur.close(); conn.close()
            if not row:
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(dict(row), default=str)}
        cur.execute("SELECT * FROM orders ORDER BY created_at DESC")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps([dict(r) for r in rows], default=str)}

    if method == 'POST':
        body = json.loads(event.get('body') or '{}')
        cur.execute(
            "INSERT INTO orders (template_id, child_name, child_age, child_photo_url, customer_email, customer_phone, status) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING *",
            (body.get('template_id'), body.get('child_name'), body.get('child_age'),
             body.get('child_photo_url'), body.get('customer_email'), body.get('customer_phone'), 'processing')
        )
        order = dict(cur.fetchone())
        conn.commit()

        pages = []
        if order.get('template_id'):
            cur.execute("SELECT * FROM template_pages WHERE template_id = %s ORDER BY page_order, id", (order['template_id'],))
            pages = [dict(p) for p in cur.fetchall()]

        gen = generate_book(order, pages)

        cur.execute("UPDATE orders SET status = %s WHERE id = %s", ('preview_ready', order['id']))
        conn.commit()
        cur.close(); conn.close()

        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'order_id': order['id'], 'generation': gen}, default=str)}

    cur.close(); conn.close()
    return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'})}
