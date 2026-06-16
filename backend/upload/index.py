import json
import os
import base64
import uuid
import boto3


def handler(event: dict, context) -> dict:
    '''Загрузка изображений (фото ребёнка, страницы шаблонов) в облачное хранилище. Принимает base64, возвращает публичную ссылку CDN.'''
    method = event.get('httpMethod', 'GET')

    cors = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-User-Id, X-Auth-Token, X-Session-Id',
        'Access-Control-Max-Age': '86400',
    }

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    if method != 'POST':
        return {'statusCode': 405, 'headers': cors, 'body': json.dumps({'error': 'Method not allowed'})}

    body = json.loads(event.get('body') or '{}')
    file_b64 = body.get('file', '')
    folder = body.get('folder', 'uploads')
    content_type = body.get('contentType', 'image/jpeg')

    if not file_b64:
        return {'statusCode': 400, 'headers': cors, 'body': json.dumps({'error': 'No file provided'})}

    if ',' in file_b64 and file_b64.strip().startswith('data:'):
        file_b64 = file_b64.split(',', 1)[1]

    data = base64.b64decode(file_b64)

    ext = 'jpg'
    if 'png' in content_type:
        ext = 'png'
    elif 'webp' in content_type:
        ext = 'webp'

    safe_folder = ''.join(c for c in folder if c.isalnum() or c in ('-', '_'))
    key = f"{safe_folder}/{uuid.uuid4().hex}.{ext}"

    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
    )
    s3.put_object(Bucket='files', Key=key, Body=data, ContentType=content_type)

    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"

    return {
        'statusCode': 200,
        'headers': {**cors, 'Content-Type': 'application/json'},
        'body': json.dumps({'url': cdn_url}),
    }
