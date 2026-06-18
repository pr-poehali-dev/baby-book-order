import json
import os
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p50926286_baby_book_order')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
    """Личный кабинет: action = get-profile, update-profile, get-orders, get-previews, save-preview"""
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

    action = body.get('action', '') or (event.get('queryStringParameters') or {}).get('action', '')

    if action == 'get-profile':
        return json_resp({'user': user})

    if action == 'update-profile':
        name = body.get('name', '').strip()
        email = body.get('email', '').strip()
        conn = get_conn()
        cur = conn.cursor()
        if name:
            cur.execute("UPDATE users SET name = %s WHERE id = %s", (name, user['id']))
        if email:
            cur.execute("UPDATE users SET email = %s WHERE id = %s", (email, user['id']))
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({'ok': True})

    if action == 'get-orders':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT o.id, o.child_name, o.status, o.total_price, o.created_at,
                   t.title, t.cover_url
            FROM orders o
            LEFT JOIN templates t ON t.id = o.template_id
            WHERE o.user_id = %s
            ORDER BY o.created_at DESC
        """, (user['id'],))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        orders = [{'id': r[0], 'child_name': r[1], 'status': r[2], 'total_price': r[3],
                   'created_at': r[4], 'template_title': r[5], 'template_cover': r[6]} for r in rows]
        return json_resp({'orders': orders})

    if action == 'get-previews':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("""
            SELECT p.id, p.child_name, p.image_urls, p.created_at, t.title
            FROM previews p
            LEFT JOIN templates t ON t.id = p.template_id
            WHERE p.user_id = %s
            ORDER BY p.created_at DESC
        """, (user['id'],))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        previews = [{'id': r[0], 'child_name': r[1],
                     'image_urls': json.loads(r[2]) if r[2] else [],
                     'created_at': r[3], 'template_title': r[4]} for r in rows]
        return json_resp({'previews': previews})

    if action == 'save-preview':
        template_id = body.get('template_id')
        child_name = body.get('child_name', '')
        image_urls = body.get('image_urls', [])
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO previews (user_id, template_id, child_name, image_urls) VALUES (%s, %s, %s, %s) RETURNING id",
            (user['id'], template_id, child_name, json.dumps(image_urls))
        )
        preview_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({'id': preview_id})

    return json_resp({'error': 'Неизвестное действие'}, 400)
