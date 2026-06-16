import json
import os
import time
import uuid
import requests
import boto3

HF_SPACE_URL = 'https://felixrosberg-face-swap.hf.space'
S3_BUCKET = 'files'


def hf_headers():
    return {'Authorization': f"Bearer {os.environ['HUGGINGFACE_TOKEN']}"}


def upload_image_to_space(image_url: str) -> str:
    """Скачивает изображение и загружает во временное хранилище Gradio Space."""
    img_resp = requests.get(image_url, timeout=20)
    img_resp.raise_for_status()

    upload_resp = requests.post(
        f'{HF_SPACE_URL}/upload',
        headers=hf_headers(),
        files={'files': ('image.jpg', img_resp.content, 'image/jpeg')},
        timeout=30,
    )
    upload_resp.raise_for_status()
    paths = upload_resp.json()
    if not paths:
        raise RuntimeError('Empty upload response from Space')
    return paths[0]


def run_face_swap(source_url: str, target_url: str) -> str:
    """Запускает face-swap: source = лицо ребёнка, target = страница шаблона."""
    source_path = upload_image_to_space(source_url)
    target_path = upload_image_to_space(target_url)

    payload = {
        'data': [
            {'path': target_path, 'meta': {'_type': 'gradio.FileData'}},
            {'path': source_path, 'meta': {'_type': 'gradio.FileData'}},
            0,    # anonymization strength
            0,    # sharpen
            False,  # show landmarks
        ]
    }

    resp = requests.post(
        f'{HF_SPACE_URL}/run/run_inference',
        headers={**hf_headers(), 'Content-Type': 'application/json'},
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    data = resp.json()

    result = data.get('data', [{}])[0]
    if isinstance(result, dict):
        result_url = result.get('url') or result.get('path', '')
    else:
        result_url = str(result)

    if not result_url:
        raise RuntimeError(f'No result URL from Space: {data}')

    if result_url.startswith('/'):
        result_url = HF_SPACE_URL + result_url

    return result_url


def save_to_s3(image_url: str) -> str:
    resp = requests.get(image_url, timeout=30)
    resp.raise_for_status()
    key = f'generated/{uuid.uuid4().hex}.jpg'
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    s3.put_object(Bucket=S3_BUCKET, Key=key, Body=resp.content, ContentType='image/jpeg')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def handler(event: dict, context) -> dict:
    """Face-swap через HuggingFace Space (felixrosberg/face-swap).
    Принимает source_face_url (фото ребёнка) и target_image_url (страница шаблона).
    Возвращает CDN URL готового изображения."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    headers = {**cors, 'Content-Type': 'application/json'}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body') or '{}')
    source_face_url = body.get('source_face_url', '').strip()
    target_image_url = body.get('target_image_url', '').strip()

    if not source_face_url or not target_image_url:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'source_face_url and target_image_url required'})}

    result_url = run_face_swap(source_face_url, target_image_url)
    cdn_url = save_to_s3(result_url)

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'url': cdn_url})}
