import io
import json
import os
import uuid
import traceback
import requests
import boto3

HF_SPACE_URL = 'https://tonyassi-face-swap.hf.space'


def upload_image(image_url: str, filename: str, auth: dict) -> str:
    """Скачивает изображение и загружает в Space, возвращает путь."""
    raw = requests.get(image_url, timeout=20)
    raw.raise_for_status()
    content = raw.content
    if len(content) > 500_000:
        from PIL import Image
        img = Image.open(io.BytesIO(content)).convert('RGB')
        if img.width > 800 or img.height > 800:
            img.thumbnail((800, 800), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=75)
        content = buf.getvalue()
    resp = requests.post(
        f'{HF_SPACE_URL}/upload',
        headers=auth,
        files={'files': (filename, content, 'image/jpeg')},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()[0]


def handler(event: dict, context) -> dict:
    """Face-swap через HuggingFace Space tonyassi/face-swap (insightface).
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
        print('[GEN] uploading source...', flush=True)
        src_path = upload_image(src_url, 'source.jpg', auth)
        print(f'[GEN] src: {src_path}', flush=True)
    except Exception as e:
        return err(f'src upload: {e}')

    try:
        print('[GEN] uploading target...', flush=True)
        tgt_path = upload_image(tgt_url, 'target.jpg', auth)
        print(f'[GEN] tgt: {tgt_path}', flush=True)
    except Exception as e:
        return err(f'tgt upload: {e}')

    try:
        print('[GEN] calling swap_faces...', flush=True)
        payload = {
            'data': [
                {'path': src_path, 'meta': {'_type': 'gradio.FileData'}},
                {'path': tgt_path, 'meta': {'_type': 'gradio.FileData'}},
            ],
            'api_name': '/swap_faces',
        }
        resp = requests.post(
            f'{HF_SPACE_URL}/run/predict',
            headers={**auth, 'Content-Type': 'application/json'},
            json=payload,
            timeout=115,
        )
        print(f'[GEN] {resp.status_code}: {resp.text[:400]}', flush=True)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return err(f'inference: {e}\n{traceback.format_exc()[:500]}')

    try:
        item = (data.get('data') or [None])[0]
        print(f'[GEN] item: {str(item)[:300]}', flush=True)
        if isinstance(item, dict):
            ru = item.get('url') or item.get('path', '')
        else:
            ru = str(item or '')
        if not ru:
            return err(f'no url: {data}')
        if ru.startswith('/'):
            ru = HF_SPACE_URL + ru
        if not ru.startswith('http'):
            ru = f'{HF_SPACE_URL}/file={ru}'
        print(f'[GEN] result: {ru}', flush=True)
    except Exception as e:
        return err(f'parse: {e}')

    try:
        img = requests.get(ru, headers=auth, timeout=20).content
        key = f'generated/{uuid.uuid4().hex}.jpg'
        s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                          aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
        s3.put_object(Bucket='files', Key=key, Body=img, ContentType='image/jpeg')
        cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f'[GEN] done: {cdn}', flush=True)
    except Exception as e:
        return err(f's3: {e}')

    return {'statusCode': 200, 'headers': h, 'body': json.dumps({'url': cdn})}
