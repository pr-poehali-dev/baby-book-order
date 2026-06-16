import base64
import io
import json
import os
import uuid
import traceback
import requests
import boto3

HF_SPACE_URL = 'https://tonyassi-face-swap.hf.space'


def to_b64(image_url: str) -> str:
    """Скачивает изображение, сжимает и возвращает base64 data URL."""
    raw = requests.get(image_url, timeout=20)
    raw.raise_for_status()
    content = raw.content
    from PIL import Image
    img = Image.open(io.BytesIO(content)).convert('RGB')
    if img.width > 800 or img.height > 800:
        img.thumbnail((800, 800), Image.LANCZOS)
    quality = 80
    buf = io.BytesIO()
    while True:
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=quality)
        if buf.tell() < 400_000 or quality <= 40:
            break
        quality -= 15
    b64 = base64.b64encode(buf.getvalue()).decode()
    return f'data:image/jpeg;base64,{b64}'


def handler(event: dict, context) -> dict:
    """Face-swap через tonyassi/face-swap (Gradio 6, base64).
    source_face_url = фото ребёнка, target_image_url = страница шаблона."""

    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    h = {**cors, 'Content-Type': 'application/json'}

    def err(msg, code=500):
        print(f'[ERR] {msg}', flush=True)
        return {'statusCode': code, 'headers': h, 'body': json.dumps({'error': str(msg)[:400]})}

    print('[GEN] start', flush=True)

    body = json.loads(event.get('body') or '{}')
    src_url = (body.get('source_face_url') or '').strip()
    tgt_url = (body.get('target_image_url') or '').strip()

    if not src_url or not tgt_url:
        return err('source_face_url and target_image_url required', 400)

    token = os.environ.get('HUGGINGFACE_TOKEN', '')
    if not token:
        return err('HUGGINGFACE_TOKEN missing')

    auth = {'Authorization': f'Bearer {token}'}

    try:
        print('[GEN] preparing source...', flush=True)
        src_b64 = to_b64(src_url)
        print(f'[GEN] src size: {len(src_b64)}', flush=True)
    except Exception as e:
        return err(f'src: {e}')

    try:
        print('[GEN] preparing target...', flush=True)
        tgt_b64 = to_b64(tgt_url)
        print(f'[GEN] tgt size: {len(tgt_b64)}', flush=True)
    except Exception as e:
        return err(f'tgt: {e}')

    try:
        print('[GEN] calling swap_faces...', flush=True)
        payload = {'data': [src_b64, tgt_b64], 'api_name': '/swap_faces'}
        resp = requests.post(
            f'{HF_SPACE_URL}/run/predict',
            headers={**auth, 'Content-Type': 'application/json'},
            json=payload,
            timeout=115,
        )
        print(f'[GEN] {resp.status_code}: {resp.text[:300]}', flush=True)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return err(f'inference: {e}\n{traceback.format_exc()[:400]}')

    try:
        item = (data.get('data') or [None])[0]
        print(f'[GEN] item: {str(item)[:150]}', flush=True)
        result_bytes = None
        if isinstance(item, str):
            if item.startswith('data:'):
                result_bytes = base64.b64decode(item.split(',', 1)[1])
            elif item.startswith('http'):
                result_bytes = requests.get(item, timeout=20).content
            elif item.startswith('/'):
                result_bytes = requests.get(f'{HF_SPACE_URL}{item}', headers=auth, timeout=20).content
        elif isinstance(item, dict):
            ru = item.get('url') or item.get('path', '')
            if ru and not ru.startswith('http'):
                ru = f'{HF_SPACE_URL}/file={ru}'
            if ru:
                result_bytes = requests.get(ru, headers=auth, timeout=20).content
        if not result_bytes:
            return err(f'cannot extract image: {str(item)[:200]}')
        print(f'[GEN] result: {len(result_bytes)} bytes', flush=True)
    except Exception as e:
        return err(f'parse: {e}')

    try:
        key = f'generated/{uuid.uuid4().hex}.jpg'
        s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                          aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
        s3.put_object(Bucket='files', Key=key, Body=result_bytes, ContentType='image/jpeg')
        cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f'[GEN] done: {cdn}', flush=True)
    except Exception as e:
        return err(f's3: {e}')

    return {'statusCode': 200, 'headers': h, 'body': json.dumps({'url': cdn})}
