import json
import os
import sys
import uuid
import traceback

import requests
import boto3

HF_SPACE_URL = 'https://felixrosberg-face-swap.hf.space'


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

    # --- читаем входные данные ---
    try:
        body = json.loads(event.get('body') or '{}')
    except Exception as e:
        return err(f'Bad JSON body: {e}', 400)

    source_face_url = (body.get('source_face_url') or '').strip()
    target_image_url = (body.get('target_image_url') or '').strip()
    print(f'[GENERATE] source={source_face_url[:60]} target={target_image_url[:60]}', flush=True)

    if not source_face_url or not target_image_url:
        return err('source_face_url and target_image_url required', 400)

    # --- токен ---
    hf_token = os.environ.get('HUGGINGFACE_TOKEN', '')
    if not hf_token:
        return err('HUGGINGFACE_TOKEN secret is missing')

    auth = {'Authorization': f'Bearer {hf_token}'}

    # --- шаг 1: скачать и загрузить source (лицо) ---
    try:
        print('[GENERATE] downloading source face...', flush=True)
        r = requests.get(source_face_url, timeout=20)
        r.raise_for_status()
        print(f'[GENERATE] source downloaded: {len(r.content)} bytes', flush=True)

        up = requests.post(
            f'{HF_SPACE_URL}/upload',
            headers=auth,
            files={'files': ('source.jpg', r.content, 'image/jpeg')},
            timeout=30,
        )
        print(f'[GENERATE] source upload status: {up.status_code} body: {up.text[:200]}', flush=True)
        up.raise_for_status()
        source_path = up.json()[0]
        print(f'[GENERATE] source_path: {source_path}', flush=True)
    except Exception as e:
        return err(f'Source upload failed: {e}\n{traceback.format_exc()}')

    # --- шаг 2: скачать и загрузить target (страница) ---
    try:
        print('[GENERATE] downloading target image...', flush=True)
        r2 = requests.get(target_image_url, timeout=20)
        r2.raise_for_status()
        print(f'[GENERATE] target downloaded: {len(r2.content)} bytes', flush=True)

        up2 = requests.post(
            f'{HF_SPACE_URL}/upload',
            headers=auth,
            files={'files': ('target.jpg', r2.content, 'image/jpeg')},
            timeout=30,
        )
        print(f'[GENERATE] target upload status: {up2.status_code} body: {up2.text[:200]}', flush=True)
        up2.raise_for_status()
        target_path = up2.json()[0]
        print(f'[GENERATE] target_path: {target_path}', flush=True)
    except Exception as e:
        return err(f'Target upload failed: {e}\n{traceback.format_exc()}')

    # --- шаг 3: запустить inference ---
    try:
        payload = {
            'data': [
                {'path': target_path, 'meta': {'_type': 'gradio.FileData'}},
                {'path': source_path, 'meta': {'_type': 'gradio.FileData'}},
                0, 0, False,
            ]
        }
        print(f'[GENERATE] calling /run/run_inference...', flush=True)
        resp = requests.post(
            f'{HF_SPACE_URL}/run/run_inference',
            headers={**auth, 'Content-Type': 'application/json'},
            json=payload,
            timeout=120,
        )
        print(f'[GENERATE] inference status: {resp.status_code} body: {resp.text[:400]}', flush=True)
        resp.raise_for_status()
        data = resp.json()
    except Exception as e:
        return err(f'Inference failed: {e}\n{traceback.format_exc()}')

    # --- шаг 4: извлечь URL результата ---
    try:
        result = (data.get('data') or [None])[0]
        print(f'[GENERATE] result item: {str(result)[:300]}', flush=True)
        if isinstance(result, dict):
            result_url = result.get('url') or result.get('path', '')
        else:
            result_url = str(result or '')

        if not result_url:
            return err(f'No URL in result: {data}')

        if result_url.startswith('/'):
            result_url = HF_SPACE_URL + result_url
        print(f'[GENERATE] result_url: {result_url}', flush=True)
    except Exception as e:
        return err(f'Result parse failed: {e}')

    # --- шаг 5: сохранить в S3 ---
    try:
        img = requests.get(result_url, timeout=30)
        img.raise_for_status()
        key = f'generated/{uuid.uuid4().hex}.jpg'
        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        )
        s3.put_object(Bucket='files', Key=key, Body=img.content, ContentType='image/jpeg')
        cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f'[GENERATE] saved to S3: {cdn_url}', flush=True)
    except Exception as e:
        return err(f'S3 save failed: {e}')

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'url': cdn_url})}
