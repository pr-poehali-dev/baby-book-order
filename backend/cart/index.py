import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p50926286_baby_book_order')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    }

def json_resp(data, status=200):
    return {'statusCode': status, 'headers': {**cors(), 'Content-Type': 'application/json'}, 'body': json.dumps(data, ensure_ascii=False, default=str)}

def get_user_by_session(sid: str):
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT u.id, u.phone, u.name, u.email, u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()",
        (sid,)
    )
    row = cur.fetchone()
    cur.close()
    conn.close()
    if not row:
        return None
    return {'id': row[0], 'phone': row[1], 'name': row[2], 'email': row[3], 'role': row[4]}

def handler(event: dict, context) -> dict:
    """Корзина: action = get, add, remove"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors(), 'body': ''}

    sid = (event.get('headers') or {}).get('x-session-id') or (event.get('headers') or {}).get('X-Session-Id', '')
    user = get_user_by_session(sid) if sid else None
    if not user:
        return json_resp({'error': 'Необходима авторизация'}, 401)

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    action = body.get('action', '')

    if action == 'get':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT c.id, c.child_name, c.preview_urls, c.created_at,
                   t.id, t.title, t.cover_url, t.price
            FROM cart c
            JOIN templates t ON t.id = c.template_id
            WHERE c.user_id = %s AND (c.child_name IS NULL OR c.child_name != '__deleted__')
            ORDER BY c.created_at DESC
        """, (user['id'],))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        items = [{
            'id': r[0], 'child_name': r[1],
            'preview_urls': json.loads(r[2]) if r[2] else [],
            'created_at': r[3],
            'template': {'id': r[4], 'title': r[5], 'cover_url': r[6], 'price': r[7]}
        } for r in rows]
        total = sum(i['template']['price'] for i in items)
        return json_resp({'items': items, 'total': total})

    if action == 'add':
        template_id = body.get('template_id')
        child_name = body.get('child_name', '')
        preview_urls = body.get('preview_urls', [])
        if not template_id:
            return json_resp({'error': 'Укажите шаблон'}, 400)
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO cart (user_id, template_id, child_name, preview_urls) VALUES (%s, %s, %s, %s) RETURNING id",
            (user['id'], template_id, child_name, json.dumps(preview_urls))
        )
        cart_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({'id': cart_id})

    if action == 'remove':
        item_id = body.get('id')
        if not item_id:
            return json_resp({'error': 'Укажите id'}, 400)
        conn = get_conn()
        cur = conn.cursor()
        # Помечаем как "удалённый" через обнуление child_name (физический DELETE запрещён платформой)
        cur.execute(
            "UPDATE cart SET child_name = '__deleted__' WHERE id = %s AND user_id = %s",
            (item_id, user['id'])
        )
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({'ok': True})

    return json_resp({'error': 'Неизвестное действие'}, 400)