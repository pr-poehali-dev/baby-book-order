import json
import os
import psycopg2
import psycopg2.extras


def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'])


def handler(event: dict, context) -> dict:
    '''Управление шаблонами книг и их страницами с зоной лица. GET — список шаблонов (опц. ?id= с страницами), POST — создать шаблон, PUT — обновить, добавить страницы и разметку зоны лица.'''
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
        tpl_id = params.get('id')
        if tpl_id:
            cur.execute("SELECT * FROM templates WHERE id = %s", (int(tpl_id),))
            tpl = cur.fetchone()
            if not tpl:
                cur.close(); conn.close()
                return {'statusCode': 404, 'headers': headers, 'body': json.dumps({'error': 'Not found'})}
            cur.execute("SELECT * FROM template_pages WHERE template_id = %s ORDER BY page_order, id", (int(tpl_id),))
            pages = cur.fetchall()
            result = dict(tpl)
            result['pages'] = [dict(p) for p in pages]
            cur.close(); conn.close()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps(result, default=str)}

        only_published = params.get('published') == '1'
        if only_published:
            cur.execute("SELECT * FROM templates WHERE is_published = TRUE ORDER BY created_at DESC")
        else:
            cur.execute("SELECT * FROM templates ORDER BY created_at DESC")
        rows = cur.fetchall()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps([dict(r) for r in rows], default=str)}

    body = json.loads(event.get('body') or '{}')

    if method == 'POST':
        cur.execute(
            "INSERT INTO templates (title, description, cover_url, price, is_published) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (body.get('title', 'Новая книга'), body.get('description', ''), body.get('cover_url', ''), int(body.get('price', 0)), bool(body.get('is_published', False)))
        )
        new_id = cur.fetchone()['id']
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'id': new_id})}

    if method == 'PUT':
        action = body.get('action')
        if action == 'add_page':
            cur.execute(
                "INSERT INTO template_pages (template_id, page_order, image_url, face_x, face_y, face_width, face_height) VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id",
                (int(body['template_id']), int(body.get('page_order', 0)), body['image_url'],
                 body.get('face_x'), body.get('face_y'), body.get('face_width'), body.get('face_height'))
            )
            page_id = cur.fetchone()['id']
            conn.commit()
            cur.close(); conn.close()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'id': page_id})}

        if action == 'update_page_face':
            cur.execute(
                "UPDATE template_pages SET face_x=%s, face_y=%s, face_width=%s, face_height=%s WHERE id=%s",
                (body.get('face_x'), body.get('face_y'), body.get('face_width'), body.get('face_height'), int(body['page_id']))
            )
            conn.commit()
            cur.close(); conn.close()
            return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True})}

        tpl_id = int(body['id'])
        cur.execute(
            "UPDATE templates SET title=%s, description=%s, cover_url=%s, price=%s, is_published=%s WHERE id=%s",
            (body.get('title'), body.get('description'), body.get('cover_url'), int(body.get('price', 0)), bool(body.get('is_published', False)), tpl_id)
        )
        conn.commit()
        cur.close(); conn.close()
        return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'ok': True})}

    cur.close(); conn.close()
    return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'})}
