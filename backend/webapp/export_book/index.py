"""
Экспорт страниц книги в архив ZIP для печати.
Обложка: 468×246мм @ 300dpi = 5528×2906px
Разворот: 406×203мм @ 300dpi = 4795×2398px
"""
import json
import base64
import io
import zipfile
import urllib.request
from PIL import Image


# Размеры в пикселях при 300 dpi
COVER_SIZE = (5528, 2906)    # 468×246 мм
SPREAD_SIZE = (4795, 2398)   # 406×203 мм


def fetch_image(url: str) -> Image.Image:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return Image.open(io.BytesIO(resp.read())).convert('RGB')


def resize_exact(img: Image.Image, size: tuple) -> Image.Image:
    return img.resize(size, Image.LANCZOS)


def handler(event: dict, context) -> dict:
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    urls: list[str] = body.get('urls', [])
    book_name: str = body.get('book_name', 'book')

    if not urls:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'urls required'})}

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        for i, url in enumerate(urls):
            img = fetch_image(url)
            target_size = COVER_SIZE if i == 0 else SPREAD_SIZE
            img_resized = resize_exact(img, target_size)

            label = 'cover' if i == 0 else f'spread_{i:02d}'
            filename = f'{book_name}_{label}.jpg'

            img_bytes = io.BytesIO()
            img_resized.save(img_bytes, format='JPEG', quality=95, dpi=(300, 300))
            zf.writestr(filename, img_bytes.getvalue())

    zip_b64 = base64.b64encode(zip_buffer.getvalue()).decode()

    return {
        'statusCode': 200,
        'headers': {
            **cors,
            'Content-Type': 'application/zip',
            'Content-Disposition': f'attachment; filename="{book_name}.zip"',
        },
        'body': zip_b64,
        'isBase64Encoded': True,
    }
