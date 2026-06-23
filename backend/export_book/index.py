"""
POST / — экспорт страниц книги в ZIP-архив для печати.
Размеры берутся из БД (таблица print_settings).
Обложка (i=0): cover — по умолчанию 468×246мм @ 300dpi
Развороты (i>0): spread — по умолчанию 406×203мм @ 300dpi
"""
import json
import base64
import io
import zipfile
import urllib.request
import os
import psycopg2
from PIL import Image


SCHEMA = os.environ.get('MAIN_DB_SCHEMA', 't_p50926286_baby_book_order')

def get_conn():
    return psycopg2.connect(os.environ['DATABASE_URL'], options=f'-c search_path={SCHEMA}')


def mm_to_px(mm: int, dpi: int) -> int:
    return round(mm * dpi / 25.4)


def fetch_image(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return Image.open(io.BytesIO(resp.read())).convert('RGB')


def cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Authorization',
    }


def handler(event: dict, context) -> dict:
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors(), 'body': ''}

    # Только admin
    token = event.get('headers', {}).get('x-authorization', '').replace('Bearer ', '')
    conn = get_conn()
    cur = conn.cursor()
    cur.execute(
        "SELECT u.role FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = %s AND s.expires_at > NOW()",
        (token,)
    )
    row = cur.fetchone()
    if not row or row[0] != 'admin':
        conn.close()
        return {'statusCode': 403, 'headers': cors(), 'body': json.dumps({'error': 'Forbidden'})}

    # Читаем настройки печати из БД
    cur.execute("SELECT key, value_mm_w, value_mm_h, dpi FROM print_settings")
    settings = {r[0]: {'mm_w': r[1], 'mm_h': r[2], 'dpi': r[3]} for r in cur.fetchall()}
    conn.close()

    cover_s  = settings.get('cover',  {'mm_w': 468, 'mm_h': 246, 'dpi': 300})
    spread_s = settings.get('spread', {'mm_w': 406, 'mm_h': 203, 'dpi': 300})

    cover_size  = (mm_to_px(cover_s['mm_w'],  cover_s['dpi']),  mm_to_px(cover_s['mm_h'],  cover_s['dpi']))
    spread_size = (mm_to_px(spread_s['mm_w'], spread_s['dpi']), mm_to_px(spread_s['mm_h'], spread_s['dpi']))

    body = json.loads(event.get('body') or '{}')
    urls: list = body.get('urls', [])
    book_name: str = body.get('book_name', 'book').replace(' ', '_')

    if not urls:
        return {'statusCode': 400, 'headers': cors(), 'body': json.dumps({'error': 'urls required'})}

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, url in enumerate(urls):
            img = fetch_image(url)
            target_size = cover_size if i == 0 else spread_size
            target_dpi  = cover_s['dpi'] if i == 0 else spread_s['dpi']
            img_resized = img.resize(target_size, Image.LANCZOS)

            label = 'cover' if i == 0 else f'spread_{i:02d}'
            filename = f'{book_name}_{label}.jpg'

            img_bytes = io.BytesIO()
            img_resized.save(img_bytes, format='JPEG', quality=95, dpi=(target_dpi, target_dpi))
            zf.writestr(filename, img_bytes.getvalue())

    zip_b64 = base64.b64encode(zip_buffer.getvalue()).decode()

    return {
        'statusCode': 200,
        'headers': {
            **cors(),
            'Content-Type': 'application/zip',
            'Content-Disposition': f'attachment; filename="{book_name}.zip"',
        },
        'body': zip_b64,
        'isBase64Encoded': True,
    }