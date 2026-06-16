import io
import json
import os
import uuid
import traceback

import requests
import boto3
from PIL import Image

HF_SPACE_URL = 'https://felixrosberg-face-swap.hf.space'


def compress(raw: bytes, max_dim: int = 900, max_kb: int = 350) -> bytes:
    img = Image.open(io.BytesIO(raw)).convert('RGB')
    if img.width > max_dim or img.height > max_dim:
        img.thumbnail((max_dim, max_dim), Image.LANCZOS)
    for q in (82, 70, 55, 40):
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=q)
        if buf.tell() <= max_kb * 1024:
            return buf.getvalue()
    return buf.getvalue()


def upload_to_space(data: bytes, name: str, auth: dict) -> str:
    resp = requests.post(
        f'{HF_SPACE_URL}/upload',
        headers=auth,
        files={'files': (name, data, 'image/jpeg')},
        timeout=30,
    )
    print(f'[GENERATE] upload {name}: {resp.status_code} {resp.text[:120]}', flush=True)
    resp.raise_for_status()
    return resp.json()[0]


def handler(event: dict, context) -> dict:
    """Face-swap через HuggingFace Space felixrosberg/face-swap.
    source_face_url = фото ребёнка, target_image_url = страница шаблона."""

    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    headers = {**cors, 'Content-Type': 'application/json'}

    def err(msg, status=500):
        print(f'[GENERATE ERROR] {msg}', flush=True)
        return {'statusCode': status, 'headers': headers, 'body': json.dumps({'error': msg})}

    try:
        body = json.loads(event.get('body') or '{}')
    except Exception as e:
        return err(f'Bad JSON: {e}', 400)

    source_face_url = (body.get('source_face_url') or '').strip()
    target_image_url = (body.get('target_image_url') or '').strip()
    print(f'[GENERATE] start source={source_face_url[:50]} target={target_image_url[:50]}', flush=True)

    if not source_face_url or not target_image_url:
        return err('source_face_url and target_image_url required', 400)

    hf_token = os.environ.get('HUGGINGFACE_TOKEN', '')
    if not hf_token:
        return err('HUGGINGFACE_TOKEN missing')
    auth = {'Authorization': f'Bearer {hf_token}'}

    try:
        print('[GENERATE] fetch + compress source...', flush=True)
        src_raw = requests.get(source_face_url, timeout=15).content
        src_bytes = compress(src_raw, max_dim=600, max_kb=250)
        print(f'[GENERATE] source: {len(src_raw)}→{len(src_bytes)} bytes', flush=True)
        source_path = upload_to_space(src_bytes, 'source.jpg', auth)
    except Exception as e:
        return err(f'Source step failed: {e}\n{traceback.format_exc()}')

    try:
        print('[GENERATE] fetch + compress target...', flush=True)
        tgt_raw = requests.get(target_image_url, timeout=15).content
        tgt_bytes = compress(tgt_raw, max_dim=900, max_kb=350)
        print(f'[GENERATE] target: {len(tgt_raw)}→{len(tgt_bytes)} bytes', flush=True)
        target_path = upload_to_space(tgt_bytes, 'target.jpg', auth)
    except Exception as e:
        return err(f'Target step failed: {e}\n{traceback.format_exc()}')

    try:
        payload = {
            'data': [
                {'path': target_path, 'meta': {'_type': 'gradio.FileData'}},
                {'path': source_path, 'meta': {'_type': 'gradio.FileData'}},
                0, 0, False,
            ]
        }
        print('[GENERATE] calling inference...', flush=True)
        resp = requests.post(
            f'{HF_SPACE_URL}/run/run_inference',
            headers={**auth, 'Content-Type': 'application/json'},
            json=payload,
            timeout=90,
        )
        print(f'[GENERATE] inference: {resp.status_code} {resp.text[:300]}', flush=True)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return err(f'Inference failed: {e}\n{traceback.format_exc()}')

    try:
        item = (data.get('data') or [None])[0]
        print(f'[GENERATE] result item: {str(item)[:200]}', flush=True)
        result_url = (item.get('url') or item.get('path', '')) if isinstance(item, dict) else str(item or '')
        if not result_url:
            return err(f'Empty result: {data}')
        if result_url.startswith('/'):
            result_url = HF_SPACE_URL + result_url
    except Exception as e:
        return err(f'Parse failed: {e}')

    try:
        img_data = requests.get(result_url, timeout=20).content
        key = f'generated/{uuid.uuid4().hex}.jpg'
        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        )
        s3.put_object(Bucket='files', Key=key, Body=img_data, ContentType='image/jpeg')
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f'[GENERATE] done: {cdn_url}', flush=True)
    except Exception as e:
        return err(f'S3 failed: {e}')

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'url': cdn_url})}
