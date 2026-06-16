import json
import os
import time
import uuid
import requests
import boto3


FAL_QUEUE_URL = 'https://queue.fal.run'
# fal-ai/face-swap: swap_image_url = лицо-донор, base_image_url = целевое изображение
FACE_SWAP_MODEL = 'fal-ai/face-swap'


def fal_auth():
    return {'Authorization': f"Key {os.environ['FAL_API_KEY']}"}


def submit_job(swap_image_url: str, base_image_url: str) -> str:
    resp = requests.post(
        f"{FAL_QUEUE_URL}/{FACE_SWAP_MODEL}",
        headers={**fal_auth(), 'Content-Type': 'application/json'},
        json={
            'swap_image_url': swap_image_url,
            'base_image_url': base_image_url,
        },
        timeout=20,
    )
    if not resp.ok:
        raise RuntimeError(f"FAL submit error {resp.status_code}: {resp.text[:300]}")
    data = resp.json()
    request_id = data.get('request_id')
    if not request_id:
        raise RuntimeError(f"No request_id in response: {data}")
    return request_id


def poll_result(request_id: str, max_wait: int = 110) -> dict:
    deadline = time.time() + max_wait
    while time.time() < deadline:
        resp = requests.get(
            f"{FAL_QUEUE_URL}/{FACE_SWAP_MODEL}/requests/{request_id}/status",
            headers=fal_auth(),
            timeout=10,
        )
        data = resp.json()
        status = data.get('status')
        if status == 'COMPLETED':
            result_resp = requests.get(
                f"{FAL_QUEUE_URL}/{FACE_SWAP_MODEL}/requests/{request_id}",
                headers=fal_auth(),
                timeout=15,
            )
            return result_resp.json()
        if status in ('FAILED', 'ERROR'):
            raise RuntimeError(f"FAL job failed: {data}")
        time.sleep(4)
    raise RuntimeError('FAL job timeout')


def extract_url(result: dict) -> str:
    # fal-ai/face-swap возвращает {"image": {"url": "..."}}
    if isinstance(result.get('image'), dict):
        return result['image']['url']
    # fallback: images list
    images = result.get('images') or []
    if images:
        img = images[0]
        return img['url'] if isinstance(img, dict) else img
    raise RuntimeError(f"Cannot extract URL from result: {list(result.keys())}")


def save_to_s3(image_url: str) -> str:
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


def handler(event: dict, context) -> dict:
    """Face-swap через fal.ai: вставляет лицо ребёнка (source_face_url) в страницу шаблона (target_image_url). Сохраняет результат в S3 и возвращает CDN URL."""
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
    source_face_url = body.get('source_face_url', '').strip()
    target_image_url = body.get('target_image_url', '').strip()

    if not source_face_url or not target_image_url:
        return {'statusCode': 400, 'headers': headers, 'body': json.dumps({'error': 'source_face_url and target_image_url required'})}

    request_id = submit_job(
        swap_image_url=source_face_url,
        base_image_url=target_image_url,
    )

    result = poll_result(request_id, max_wait=110)
    result_url = extract_url(result)
    cdn_url = save_to_s3(result_url)

    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'url': cdn_url})}
