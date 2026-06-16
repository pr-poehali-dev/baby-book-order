import json
import os
import time
import uuid
import requests
import boto3


FAL_URL = 'https://fal.run'
FAL_QUEUE_URL = 'https://queue.fal.run'
FACE_SWAP_MODEL = 'half-moon-ai/ai-face-swap/faceswapimage'


def fal_headers():
    return {
        'Authorization': f"Key {os.environ['FAL_API_KEY']}",
        'Content-Type': 'application/json',
    }


def upload_image_to_fal(image_url: str) -> str:
    """Загружает изображение по URL в хранилище fal.ai и возвращает fal-cdn URL."""
    resp = requests.get(image_url, timeout=20)
    resp.raise_for_status()
    content_type = resp.headers.get('content-type', 'image/jpeg')
    upload_resp = requests.post(
        'https://rest.alpha.fal.ai/storage/upload/initiate',
        headers={
            'Authorization': f"Key {os.environ['FAL_API_KEY']}",
            'Content-Type': 'application/json',
        },
        json={'content_type': content_type, 'file_name': f"{uuid.uuid4().hex}.jpg"},
        timeout=15,
    )
    if upload_resp.status_code != 200:
        return image_url

    upload_data = upload_resp.json()
    upload_url = upload_data.get('upload_url')
    if not upload_url:
        return image_url

    put_resp = requests.put(
        upload_url,
        data=resp.content,
        headers={'Content-Type': content_type},
        timeout=30,
    )
    if put_resp.status_code not in (200, 204):
        return image_url

    return upload_data.get('file_url', image_url)


def run_face_swap_sync(source_face_url: str, target_image_url: str) -> dict:
    """Запускает face-swap синхронно через fal.run."""
    resp = requests.post(
        f"{FAL_URL}/{FACE_SWAP_MODEL}",
        headers=fal_headers(),
        json={
            'source_face_url': source_face_url,
            'target_image_url': target_image_url,
        },
        timeout=55,
    )
    resp.raise_for_status()
    return resp.json()


def run_face_swap_queue(source_face_url: str, target_image_url: str) -> str | None:
    """Запускает face-swap через очередь и ждёт результата."""
    submit = requests.post(
        f"{FAL_QUEUE_URL}/{FACE_SWAP_MODEL}",
        headers=fal_headers(),
        json={
            'source_face_url': source_face_url,
            'target_image_url': target_image_url,
        },
        timeout=20,
    )
    submit.raise_for_status()
    data = submit.json()
    request_id = data.get('request_id')
    if not request_id:
        return None

    deadline = time.time() + 55
    while time.time() < deadline:
        status_resp = requests.get(
            f"{FAL_QUEUE_URL}/{FACE_SWAP_MODEL}/requests/{request_id}/status",
            headers={'Authorization': f"Key {os.environ['FAL_API_KEY']}"},
            timeout=10,
        )
        status_data = status_resp.json()
        if status_data.get('status') == 'COMPLETED':
            result_resp = requests.get(
                f"{FAL_QUEUE_URL}/{FACE_SWAP_MODEL}/requests/{request_id}",
                headers={'Authorization': f"Key {os.environ['FAL_API_KEY']}"},
                timeout=10,
            )
            return result_resp.json()
        if status_data.get('status') == 'FAILED':
            return None
        time.sleep(3)
    return None


def upload_result_to_s3(image_url: str) -> str:
    """Скачивает готовое изображение и сохраняет в наш S3."""
    resp = requests.get(image_url, timeout=30)
    resp.raise_for_status()
    key = f"generated/{uuid.uuid4().hex}.jpg"
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    s3.put_object(Bucket='files', Key=key, Body=resp.content, ContentType='image/jpeg')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def extract_image_url(result: dict) -> str | None:
    """Извлекает URL результата из разных форматов ответа fal.ai."""
    if not result:
        return None
    if isinstance(result.get('image'), dict):
        return result['image'].get('url')
    if isinstance(result.get('images'), list) and result['images']:
        img = result['images'][0]
        return img.get('url') if isinstance(img, dict) else img
    if result.get('output'):
        out = result['output']
        if isinstance(out, str):
            return out
        if isinstance(out, list) and out:
            return out[0]
    return None


def handler(event: dict, context) -> dict:
    """Face-swap через fal.ai: вставляет лицо ребёнка (source_face_url) в страницу шаблона (target_image_url). Возвращает URL готового изображения в нашем S3."""
    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
    }

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    headers = {**cors, 'Content-Type': 'application/json'}

    if event.get('httpMethod') != 'POST':
        return {'statusCode': 405, 'headers': headers, 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body') or '{}')
    source_face_url = body.get('source_face_url', '')
    target_image_url = body.get('target_image_url', '')

    if not source_face_url or not target_image_url:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'source_face_url and target_image_url are required'})}

    result = None
    try:
        data = run_face_swap_sync(source_face_url, target_image_url)
        result = data
    except Exception:
        result = run_face_swap_queue(source_face_url, target_image_url)

    result_url = extract_image_url(result) if result else None

    if not result_url:
        return {'statusCode': 504, 'headers': headers, 'body': json.dumps({'error': 'Generation failed or timeout', 'raw': str(result)})}

    cdn_url = upload_result_to_s3(result_url)
    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'url': cdn_url})}
