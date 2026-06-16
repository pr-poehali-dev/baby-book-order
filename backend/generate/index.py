import io
import json
import os
import time
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
    buf = io.BytesIO()
    for q in (82, 70, 55, 40):
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=q)
        if buf.tell() <= max_kb * 1024:
            break
    return buf.getvalue()


def upload_to_space(data: bytes, name: str, auth: dict) -> str:
    resp = requests.post(
        f'{HF_SPACE_URL}/upload',
        headers=auth,
        files={'files': (name, data, 'image/jpeg')},
        timeout=30,
    )
    print(f'[GENERATE] upload {name}: {resp.status_code}', flush=True)
    resp.raise_for_status()
    return resp.json()[0]


def handler(event: dict, context) -> dict:
    """Face-swap через HuggingFace Space felixrosberg/face-swap (async queue).
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
    print(f'[GENERATE] start', flush=True)

    if not source_face_url or not target_image_url:
        return err('source_face_url and target_image_url required', 400)

    hf_token = os.environ.get('HUGGINGFACE_TOKEN', '')
    if not hf_token:
        return err('HUGGINGFACE_TOKEN missing')
    auth = {'Authorization': f'Bearer {hf_token}'}

    # Сжимаем и загружаем оба изображения
    try:
        src_bytes = compress(requests.get(source_face_url, timeout=15).content, max_dim=600, max_kb=250)
        source_path = upload_to_space(src_bytes, 'source.jpg', auth)
        print(f'[GENERATE] source uploaded', flush=True)
    except Exception as e:
        return err(f'Source failed: {e}')

    try:
        tgt_bytes = compress(requests.get(target_image_url, timeout=15).content, max_dim=900, max_kb=350)
        target_path = upload_to_space(tgt_bytes, 'target.jpg', auth)
        print(f'[GENERATE] target uploaded', flush=True)
    except Exception as e:
        return err(f'Target failed: {e}')

    session_hash = uuid.uuid4().hex[:8]

    # Отправляем в очередь через /queue/join
    try:
        payload = {
            'data': [
                {'path': target_path, 'meta': {'_type': 'gradio.FileData'}},
                {'path': source_path, 'meta': {'_type': 'gradio.FileData'}},
                0, 0, False,
            ],
            'fn_index': 0,
            'session_hash': session_hash,
        }
        join_resp = requests.post(
            f'{HF_SPACE_URL}/queue/join',
            headers={**auth, 'Content-Type': 'application/json'},
            json=payload,
            timeout=15,
        )
        print(f'[GENERATE] queue/join: {join_resp.status_code} {join_resp.text[:100]}', flush=True)
        join_resp.raise_for_status()
    except Exception as e:
        return err(f'Queue join failed: {e}')

    # Читаем SSE-поток /queue/data
    try:
        result_url = None
        print('[GENERATE] polling queue/data...', flush=True)
        with requests.get(
            f'{HF_SPACE_URL}/queue/data',
            headers=auth,
            params={'session_hash': session_hash},
            stream=True,
            timeout=110,
        ) as stream:
            deadline = time.time() + 105
            for line in stream.iter_lines():
                if time.time() > deadline:
                    break
                if not line:
                    continue
                text = line.decode('utf-8') if isinstance(line, bytes) else line
                if not text.startswith('data:'):
                    continue
                try:
                    msg = json.loads(text[5:].strip())
                except Exception:
                    continue
                msg_type = msg.get('msg')
                print(f'[GENERATE] msg: {msg_type} full: {json.dumps(msg)[:500]}', flush=True)
                if msg_type == 'process_completed':
                    # пробуем все возможные структуры ответа
                    output = msg.get('output') or {}
                    data_list = output.get('data') or []
                    # иногда данные прямо в msg
                    if not data_list:
                        data_list = msg.get('data') or []
                    if data_list:
                        item = data_list[0]
                        if isinstance(item, dict):
                            result_url = (
                                item.get('url') or
                                item.get('path') or
                                item.get('value') or ''
                            )
                            # путь может быть вложен в 'image'
                            if not result_url and isinstance(item.get('image'), dict):
                                result_url = item['image'].get('url') or item['image'].get('path', '')
                        else:
                            result_url = str(item or '')
                        if result_url and result_url.startswith('/'):
                            result_url = HF_SPACE_URL + result_url
                        if result_url and not result_url.startswith('http'):
                            result_url = f'{HF_SPACE_URL}/file={result_url}'
                    break
                if msg_type == 'process_errored':
                    return err(f'Space processing error: {msg}')

        if not result_url:
            return err('No result URL received from Space')
        print(f'[GENERATE] result ready', flush=True)
    except Exception as e:
        return err(f'Queue polling failed: {e}\n{traceback.format_exc()}')

    # Сохраняем в S3
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