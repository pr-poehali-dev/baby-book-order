import io
import json
import os
import uuid
import traceback
import requests
import boto3

HF_SPACE_URL = 'https://felixrosberg-face-swap.hf.space'


def compress(raw: bytes, max_dim: int = 900, max_kb: int = 350) -> bytes:
    from PIL import Image
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    if img.width > max_dim or img.height > max_dim:
        img.thumbnail((max_dim, max_dim), Image.LANCZOS)
    buf = io.BytesIO()
    for q in (82, 70, 55, 40):
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=q)
        if buf.tell() <= max_kb * 1024:
            break
    return buf.getvalue()


def handler(event: dict, context) -> dict:
    """Face-swap через HuggingFace Space felixrosberg/face-swap."""

    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    h = {**cors, 'Content-Type': 'application/json'}

    def err(msg, code=500):
        print(f'[ERR] {msg}', flush=True)
        return {'statusCode': code, 'headers': h, 'body': json.dumps({'error': str(msg)[:300]})}

    print('[GEN] handler start', flush=True)

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
        print('[GEN] compress source', flush=True)
        src = compress(requests.get(src_url, timeout=15).content, 600, 250)
        r = requests.post(f'{HF_SPACE_URL}/upload', headers=auth, files={'files': ('s.jpg', src, 'image/jpeg')}, timeout=30)
        r.raise_for_status()
        sp = r.json()[0]
        print(f'[GEN] src path: {sp}', flush=True)
    except Exception as e:
        return err(f'src upload: {e}')

    try:
        print('[GEN] compress target', flush=True)
        tgt = compress(requests.get(tgt_url, timeout=15).content, 900, 350)
        r2 = requests.post(f'{HF_SPACE_URL}/upload', headers=auth, files={'files': ('t.jpg', tgt, 'image/jpeg')}, timeout=30)
        r2.raise_for_status()
        tp = r2.json()[0]
        print(f'[GEN] tgt path: {tp}', flush=True)
    except Exception as e:
        return err(f'tgt upload: {e}')

    try:
        print('[GEN] inference', flush=True)
        payload = {'data': [
            {'path': tp, 'meta': {'_type': 'gradio.FileData'}},
            {'path': sp, 'meta': {'_type': 'gradio.FileData'}},
            0, 0, False,
        ]}
        resp = requests.post(
            f'{HF_SPACE_URL}/run_inference',
            headers={**auth, 'Content-Type': 'application/json'},
            json=payload,
            timeout=115,
        )
        print(f'[GEN] inference {resp.status_code}: {resp.text[:300]}', flush=True)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return err(f'inference: {e}\n{traceback.format_exc()[:500]}')

    try:
        item = (data.get('data') or [None])[0]
        print(f'[GEN] item: {str(item)[:200]}', flush=True)
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
    except Exception as e:
        return err(f'parse: {e}')

    try:
        img = requests.get(ru, timeout=20).content
        key = f'generated/{uuid.uuid4().hex}.jpg'
        s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                          aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
        s3.put_object(Bucket='files', Key=key, Body=img, ContentType='image/jpeg')
        cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f'[GEN] done {cdn}', flush=True)
    except Exception as e:
        return err(f's3: {e}')

    return {'statusCode': 200, 'headers': h, 'body': json.dumps({'url': cdn})}