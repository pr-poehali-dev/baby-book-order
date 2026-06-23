"""
GET  / — получить настройки печати (cover + spread)
POST / — обновить настройки (только для admin)
"""
import json
import os
import psycopg2


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors(), 'body': ''}

    method = event.get('httpMethod', 'GET')

    if method == 'GET':
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT key, value_mm_w, value_mm_h, dpi FROM t_p50926286_baby_book_order.print_settings ORDER BY key"
        )
        rows = cur.fetchall()
        conn.close()
        result = {row[0]: {'mm_w': row[1], 'mm_h': row[2], 'dpi': row[3]} for row in rows}
        return {'statusCode': 200, 'headers': {**cors(), 'Content-Type': 'application/json'}, 'body': json.dumps(result)}

    if method == 'POST':
        # Проверяем токен сессии — только admin
        token = event.get('headers', {}).get('x-authorization', '').replace('Bearer ', '')
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            """SELECT u.role FROM t_p50926286_baby_book_order.sessions s
               JOIN t_p50926286_baby_book_order.users u ON u.id = s.user_id
               WHERE s.token = %s""",
            (token,)
        )
        row = cur.fetchone()
        if not row or row[0] != 'admin':
            conn.close()
            return {'statusCode': 403, 'headers': cors(), 'body': json.dumps({'error': 'Forbidden'})}

        body = json.loads(event.get('body') or '{}')
        for key in ('cover', 'spread'):
            if key not in body:
                continue
            s = body[key]
            cur.execute(
                """UPDATE t_p50926286_baby_book_order.print_settings
                   SET value_mm_w = %s, value_mm_h = %s, dpi = %s, updated_at = NOW()
                   WHERE key = %s""",
                (int(s['mm_w']), int(s['mm_h']), int(s.get('dpi', 300)), key)
            )
        conn.commit()
        conn.close()
        return {'statusCode': 200, 'headers': {**cors(), 'Content-Type': 'application/json'}, 'body': json.dumps({'ok': True})}

    return {'statusCode': 405, 'headers': cors(), 'body': ''}
