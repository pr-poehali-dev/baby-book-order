import json
import os
import random
import secrets
import string
import urllib.request
import urllib.parse
import psycopg2

SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p50926286_baby_book_order')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')

def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    }

def json_resp(data, status=200):
    return {'statusCode': status, 'headers': {**cors(), 'Content-Type': 'application/json'}, 'body': json.dumps(data, ensure_ascii=False)}

def make_session(user_id: int) -> str:
    sid = secrets.token_hex(32)
    conn = get_conn()
    cur = conn.cursor()
    cur.execute("INSERT INTO sessions (id, user_id, expires_at) VALUES (%s, %s, NOW() + INTERVAL '30 days')", (sid, user_id))
    conn.commit()
    cur.close()
    conn.close()
    return sid

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

def send_sms(phone: str, code: str):
    login = os.environ.get('TERASMS_LOGIN', '')
    password = os.environ.get('TERASMS_PASSWORD', '')
    text = f'Ваш код входа: {code}'
    params = urllib.parse.urlencode({'login': login, 'password': password, 'phones': phone, 'mes': text, 'sender': 'Fotokn'})
    url = f'https://www.terasms.ru/index/get/?{params}'
    urllib.request.urlopen(urllib.request.Request(url), timeout=10)

def handler(event: dict, context) -> dict:
    """Авторизация: SMS-код, Яндекс ID, ВК ID, проверка сессии. action в теле: me, send-code, verify-code, oauth-yandex, oauth-vk, logout"""
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors(), 'body': ''}

    body = {}
    if event.get('body'):
        try:
            body = json.loads(event['body'])
        except Exception:
            pass

    action = body.get('action', '')
    sid = (event.get('headers') or {}).get('x-session-id') or (event.get('headers') or {}).get('X-Session-Id', '')

    if action == 'me':
        user = get_user_by_session(sid) if sid else None
        return json_resp({'user': user})

    if action == 'send-code':
        phone = body.get('phone', '').strip()
        if not phone:
            return json_resp({'error': 'Укажите телефон'}, 400)
        code = ''.join(random.choices(string.digits, k=4))
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO sms_codes (phone, code, expires_at) VALUES (%s, %s, NOW() + INTERVAL '10 minutes')",
            (phone, code)
        )
        conn.commit()
        cur.close()
        conn.close()
        try:
            send_sms(phone, code)
        except Exception as e:
            print(f'[SMS ERROR] {e}', flush=True)
        return json_resp({'ok': True})

    if action == 'verify-code':
        phone = body.get('phone', '').strip()
        code = body.get('code', '').strip()
        if not phone or not code:
            return json_resp({'error': 'Укажите телефон и код'}, 400)
        conn = get_conn()
        cur = conn.cursor()
        cur.execute(
            "SELECT id FROM sms_codes WHERE phone = %s AND code = %s AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
            (phone, code)
        )
        row = cur.fetchone()
        if not row:
            cur.close()
            conn.close()
            return json_resp({'error': 'Неверный или просроченный код'}, 400)
        cur.execute("UPDATE sms_codes SET used = TRUE WHERE id = %s", (row[0],))
        cur.execute("SELECT id FROM users WHERE phone = %s", (phone,))
        user_row = cur.fetchone()
        if user_row:
            user_id = user_row[0]
        else:
            cur.execute("INSERT INTO users (phone) VALUES (%s) RETURNING id", (phone,))
            user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({'session_id': make_session(user_id)})

    if action == 'oauth-yandex':
        code = body.get('code', '')
        redirect_uri = body.get('redirect_uri', '')
        if not code:
            return json_resp({'error': 'Нет кода'}, 400)
        client_id = os.environ.get('YANDEX_CLIENT_ID', '')
        client_secret = os.environ.get('YANDEX_CLIENT_SECRET', '')
        token_data = urllib.parse.urlencode({
            'grant_type': 'authorization_code', 'code': code,
            'client_id': client_id, 'client_secret': client_secret,
            'redirect_uri': redirect_uri
        }).encode()
        req = urllib.request.Request('https://oauth.yandex.ru/token', data=token_data)
        resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
        access_token = resp.get('access_token')
        if not access_token:
            return json_resp({'error': 'Ошибка получения токена Яндекс'}, 400)
        req2 = urllib.request.Request('https://login.yandex.ru/info?format=json', headers={'Authorization': f'OAuth {access_token}'})
        profile = json.loads(urllib.request.urlopen(req2, timeout=10).read())
        yandex_id = str(profile.get('id', ''))
        name = profile.get('real_name') or profile.get('display_name', '')
        email = profile.get('default_email', '')
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE yandex_id = %s", (yandex_id,))
        row = cur.fetchone()
        if row:
            user_id = row[0]
            cur.execute("UPDATE users SET name = %s, email = %s WHERE id = %s", (name, email, user_id))
        else:
            cur.execute("INSERT INTO users (yandex_id, name, email) VALUES (%s, %s, %s) RETURNING id", (yandex_id, name, email))
            user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({'session_id': make_session(user_id)})

    if action == 'oauth-vk':
        code = body.get('code', '')
        redirect_uri = body.get('redirect_uri', '')
        if not code:
            return json_resp({'error': 'Нет кода'}, 400)
        client_id = os.environ.get('VK_CLIENT_ID', '')
        client_secret = os.environ.get('VK_CLIENT_SECRET', '')
        params = urllib.parse.urlencode({
            'client_id': client_id, 'client_secret': client_secret,
            'redirect_uri': redirect_uri, 'code': code
        })
        req = urllib.request.Request(f'https://oauth.vk.com/access_token?{params}')
        resp = json.loads(urllib.request.urlopen(req, timeout=10).read())
        access_token = resp.get('access_token')
        vk_user_id = str(resp.get('user_id', ''))
        vk_email = resp.get('email', '')
        if not access_token:
            return json_resp({'error': 'Ошибка получения токена ВК'}, 400)
        params2 = urllib.parse.urlencode({'user_ids': vk_user_id, 'fields': 'first_name,last_name', 'access_token': access_token, 'v': '5.131'})
        req2 = urllib.request.Request(f'https://api.vk.com/method/users.get?{params2}')
        profile = json.loads(urllib.request.urlopen(req2, timeout=10).read())
        vk_info = profile.get('response', [{}])[0]
        name = f"{vk_info.get('first_name', '')} {vk_info.get('last_name', '')}".strip()
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT id FROM users WHERE vk_id = %s", (vk_user_id,))
        row = cur.fetchone()
        if row:
            user_id = row[0]
            cur.execute("UPDATE users SET name = %s, email = %s WHERE id = %s", (name, vk_email, user_id))
        else:
            cur.execute("INSERT INTO users (vk_id, name, email) VALUES (%s, %s, %s) RETURNING id", (vk_user_id, name, vk_email))
            user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        return json_resp({'session_id': make_session(user_id)})

    if action == 'logout':
        if sid:
            conn = get_conn()
            cur = conn.cursor()
            cur.execute("UPDATE sessions SET expires_at = NOW() WHERE id = %s", (sid,))
            conn.commit()
            cur.close()
            conn.close()
        return json_resp({'ok': True})

    return json_resp({'error': 'Неизвестное действие'}, 400)
