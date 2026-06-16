import json
import os
import time
import base64
import uuid
import requests
import boto3


FUSIONBRAIN_URL = 'https://api-key.fusionbrain.ai/'


def fb_headers():
    return {
        'X-Key': f"Key {os.environ['FUSIONBRAIN_API_KEY']}",
        'X-Secret': f"Secret {os.environ['FUSIONBRAIN_SECRET_KEY']}",
    }


def get_pipeline_id():
    resp = requests.get(FUSIONBRAIN_URL + 'key/api/v1/pipelines', headers=fb_headers(), timeout=15)
    data = resp.json()
    return data[0]['id']


def run_generation(pipeline_id: str, prompt: str, style: str = 'DEFAULT', width: int = 1024, height: int = 1024) -> str:
    params = {
        'type': 'GENERATE',
        'numImages': 1,
        'width': width,
        'height': height,
        'style': style,
        'generateParams': {'query': prompt},
    }
    resp = requests.post(
        FUSIONBRAIN_URL + 'key/api/v1/pipeline/run',
        headers=fb_headers(),
        files={
            'pipeline_id': (None, str(pipeline_id)),
            'params': (None, json.dumps(params), 'application/json'),
        },
        timeout=30,
    )
    return resp.json()['uuid']


def poll_result(task_uuid: str, max_wait: int = 55) -> str | None:
    deadline = time.time() + max_wait
    while time.time() < deadline:
        resp = requests.get(
            FUSIONBRAIN_URL + f'key/api/v1/pipeline/status/{task_uuid}',
            headers=fb_headers(),
            timeout=15,
        )
        data = resp.json()
        if data.get('status') == 'DONE':
            images = data.get('result', {}).get('files') or data.get('images', [])
            if images:
                return images[0]
            return None
        if data.get('status') in ('FAIL', 'ERROR'):
            return None
        time.sleep(3)
    return None


def upload_to_s3(b64_data: str) -> str:
    raw = base64.b64decode(b64_data)
    key = f"generated/{uuid.uuid4().hex}.jpg"
    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    s3.put_object(Bucket='files', Key=key, Body=raw, ContentType='image/jpeg')
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def handler(event: dict, context) -> dict:
    '''Генерация персонажа детской книги через FusionBrain (Kandinsky). Принимает: child_name, child_age, style_prompt (описание стиля шаблона). Возвращает URL готового изображения в S3.'''
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
    child_name = body.get('child_name', 'ребёнок')
    child_age = body.get('child_age', 5)
    style_prompt = body.get('style_prompt', 'детская иллюстрация, мультяшный стиль')

    prompt = (
        f"Детская книжная иллюстрация. Главный герой — ребёнок {child_age} лет по имени {child_name}. "
        f"Стиль: {style_prompt}. "
        f"Яркие пастельные цвета, добрый мультяшный стиль, высокое качество, формат 20x20 см."
    )

    pipeline_id = get_pipeline_id()
    task_uuid = run_generation(pipeline_id, prompt, style='ANIME', width=1024, height=1024)
    b64 = poll_result(task_uuid, max_wait=55)

    if not b64:
        return {'statusCode': 504, 'headers': headers, 'body': json.dumps({'error': 'Generation timeout or failed'})}

    url = upload_to_s3(b64)
    return {'statusCode': 200, 'headers': headers, 'body': json.dumps({'url': url})}
