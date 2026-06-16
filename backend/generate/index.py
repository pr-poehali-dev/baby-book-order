import io
import json
import os
import uuid
import traceback
import requests
import boto3

HF_SPACE_URL = 'https://felixrosberg-face-swap.hf.space'


def handler(event: dict, context) -> dict:
    """Face-swap через HuggingFace Space felixrosberg/face-swap.
    Передаём URL изображений напрямую без предзагрузки."""

    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    h = {**cors, 'Content-Type': 'application/json'}

    def err(msg, code=500):
        print(f'[ERR] {msg}', flush=True)
        return {'statusCode': code, 'headers': h, 'body': json.dumps({'error': str(msg)[:300]})}

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

    # Передаём URL напрямую — Space сам скачает изображения
    try:
        print(f'[GEN] calling inference with URLs...', flush=True)
        payload = {
            'data': [
                {'url': tgt_url, 'meta': {'_type': 'gradio.FileData'}},  # target
                {'url': src_url, 'meta': {'_type': 'gradio.FileData'}},  # source
                0, 0, False,
            ],
            'api_name': '/run_inference',
        }
        resp = requests.post(
            f'{HF_SPACE_URL}/run/predict',
            headers={**auth, 'Content-Type': 'application/json'},
            json=payload,
            timeout=115,
        )
        print(f'[GEN] response {resp.status_code}: {resp.text[:400]}', flush=True)
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
            return err(f'no url in result: {data}')
        if ru.startswith('/'):
            ru = HF_SPACE_URL + ru
        if not ru.startswith('http'):
            ru = f'{HF_SPACE_URL}/file={ru}'
        print(f'[GEN] result url: {ru}', flush=True)
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
        print(f'[GEN] saved: {cdn}', flush=True)
    except Exception as e:
        return err(f's3: {e}')

    return {'statusCode': 200, 'headers': h, 'body': json.dumps({'url': cdn})}
