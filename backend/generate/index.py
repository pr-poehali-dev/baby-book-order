import base64
import io
import json
import os
import uuid
import traceback
import requests
import boto3


def handler(event: dict, context) -> dict:
    """Face-swap через Dentro/face-swap с gradio_client (поддержка WebSocket очереди).
    source_face_url = фото ребёнка, target_image_url = страница шаблона."""

    cors = {'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type'}

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': cors, 'body': ''}

    h = {**cors, 'Content-Type': 'application/json'}

    def err(msg, code=500):
        print(f'[ERR] {msg}', flush=True)
        return {'statusCode': code, 'headers': h, 'body': json.dumps({'error': str(msg)[:400]})}

    print('[GEN] start', flush=True)

    body = json.loads(event.get('body') or '{}')
    src_url = (body.get('source_face_url') or '').strip()
    tgt_url = (body.get('target_image_url') or '').strip()

    if not src_url or not tgt_url:
        return err('source_face_url and target_image_url required', 400)

    token = os.environ.get('HUGGINGFACE_TOKEN', '')
    if not token:
        return err('HUGGINGFACE_TOKEN missing')

    # Скачиваем изображения во временные файлы для gradio_client
    import tempfile
    from gradio_client import Client, handle_file

    try:
        print('[GEN] downloading images...', flush=True)
        src_bytes = requests.get(src_url, timeout=20).content
        tgt_bytes = requests.get(tgt_url, timeout=20).content

        # Сжимаем если нужно
        from PIL import Image
        def compress(data):
            img = Image.open(io.BytesIO(data)).convert('RGB')
            if img.width > 800 or img.height > 800:
                img.thumbnail((800, 800), Image.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format='JPEG', quality=80)
            return buf.getvalue()

        src_bytes = compress(src_bytes)
        tgt_bytes = compress(tgt_bytes)
        print(f'[GEN] src={len(src_bytes)}b tgt={len(tgt_bytes)}b', flush=True)
    except Exception as e:
        return err(f'download: {e}')

    try:
        print('[GEN] connecting to Space...', flush=True)
        client = Client('Dentro/face-swap', headers={'Authorization': f'Bearer {token}'})

        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as sf:
            sf.write(src_bytes)
            src_path = sf.name
        with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as tf:
            tf.write(tgt_bytes)
            tgt_path = tf.name

        print('[GEN] predicting...', flush=True)
        result = client.predict(
            handle_file(src_path),  # sourceImage
            0,                      # sourceFaceIndex
            handle_file(tgt_path),  # targetImage
            0,                      # targetFaceIndex
            api_name='/predict',
        )
        print(f'[GEN] result type={type(result).__name__} val={str(result)[:200]}', flush=True)
    except Exception as e:
        return err(f'inference: {e}\n{traceback.format_exc()[:500]}')

    # Извлекаем байты результата
    try:
        result_bytes = None
        if isinstance(result, str):
            if result.startswith('data:'):
                result_bytes = base64.b64decode(result.split(',', 1)[1])
            elif os.path.exists(result):
                with open(result, 'rb') as f:
                    result_bytes = f.read()
            elif result.startswith('http'):
                result_bytes = requests.get(result, timeout=20).content
        elif isinstance(result, dict):
            path = result.get('path') or result.get('url') or ''
            if path and os.path.exists(path):
                with open(path, 'rb') as f:
                    result_bytes = f.read()
            elif path.startswith('http'):
                result_bytes = requests.get(path, timeout=20).content

        if not result_bytes:
            return err(f'cannot extract image: {str(result)[:200]}')
        print(f'[GEN] image bytes: {len(result_bytes)}', flush=True)
    except Exception as e:
        return err(f'parse: {e}')

    # Сохраняем в S3
    try:
        key = f'generated/{uuid.uuid4().hex}.jpg'
        s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                          aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                          aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
        s3.put_object(Bucket='files', Key=key, Body=result_bytes, ContentType='image/jpeg')
        cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f'[GEN] done: {cdn}', flush=True)
    except Exception as e:
        return err(f's3: {e}')

    return {'statusCode': 200, 'headers': h, 'body': json.dumps({'url': cdn})}