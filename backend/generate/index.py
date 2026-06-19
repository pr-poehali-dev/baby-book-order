import base64
import io
import json
import os
import traceback
import uuid
import requests
import boto3
from PIL import Image

CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
}
H = {**CORS, 'Content-Type': 'application/json'}

OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
MODEL = 'google/gemini-3.1-flash-image'


def err(msg, code=500):
    print(f'[ERR] {msg}', flush=True)
    return {'statusCode': code, 'headers': H, 'body': json.dumps({'error': str(msg)[:400]})}


def compress_to_base64(data: bytes, max_size=512) -> str:
    img = Image.open(io.BytesIO(data)).convert('RGB')
    if img.width > max_size or img.height > max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=75)
    b64 = base64.b64encode(buf.getvalue()).decode()
    print(f'[GEN] compressed to {len(b64)} chars ({img.width}x{img.height})', flush=True)
    return b64


def handler(event: dict, context) -> dict:
    """Генерация иллюстрации через Gemini (OpenRouter): вставляет черты лица ребёнка в стиль шаблона книги."""
    print('[GEN] handler start', flush=True)
    try:
        if event.get('httpMethod') == 'OPTIONS':
            return {'statusCode': 200, 'headers': CORS, 'body': ''}

        body = json.loads(event.get('body') or '{}')
        src_url = (body.get('source_face_url') or '').strip()
        tgt_url = (body.get('target_image_url') or '').strip()
        print(f'[GEN] src_url={src_url[:60]} tgt_url={tgt_url[:60]}', flush=True)

        # Тестовый пинг модели без изображений
        if body.get('action') == 'ping':
            api_key = os.environ.get('OPENROUTER_API_KEY', '')
            if not api_key:
                return err('OPENROUTER_API_KEY missing')
            print('[GEN] ping test...', flush=True)
            resp = requests.post(
                OPENROUTER_URL,
                headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json', 'HTTP-Referer': 'https://poehali.dev'},
                json={'model': MODEL, 'messages': [{'role': 'user', 'content': 'Say "OK" and nothing else.'}], 'max_tokens': 10},
                timeout=30,
            )
            print(f'[GEN] ping status={resp.status_code} body={resp.text[:300]}', flush=True)
            return {'statusCode': 200, 'headers': H, 'body': json.dumps({'ping_status': resp.status_code, 'ping_body': resp.json()})}

        if not src_url or not tgt_url:
            return err('source_face_url and target_image_url required', 400)

        api_key = os.environ.get('OPENROUTER_API_KEY', '')
        if not api_key:
            return err('OPENROUTER_API_KEY missing')
        print(f'[GEN] api_key present: {bool(api_key)}, len={len(api_key)}', flush=True)

        # Скачиваем оба изображения
        print('[GEN] downloading src...', flush=True)
        src_bytes = requests.get(src_url, timeout=30).content
        print(f'[GEN] src downloaded: {len(src_bytes)} bytes', flush=True)

        print('[GEN] downloading tgt...', flush=True)
        tgt_bytes = requests.get(tgt_url, timeout=30).content
        print(f'[GEN] tgt downloaded: {len(tgt_bytes)} bytes', flush=True)

        src_b64 = compress_to_base64(src_bytes, max_size=512)
        tgt_b64 = compress_to_base64(tgt_bytes, max_size=512)

        prompt = (
            "You are a children's book illustrator. I will give you two images:\n"
            "1. A PHOTO of a real child (source face)\n"
            "2. An ILLUSTRATION page from a children's book (target template)\n\n"
            "Your task: recreate the illustration from image 2, but replace the main character's face "
            "with the child's likeness from image 1. Carefully preserve:\n"
            "- The child's facial features (face shape, eyes color, nose, lips, skin tone)\n"
            "- The child's hairstyle and hair color\n"
            "- The artistic style, colors, and atmosphere of the original illustration\n"
            "- All background elements, props, and composition of the template\n\n"
            "Generate a new illustration image in exactly the same style as the template, "
            "with the child as the main character. Output ONLY the generated image, no text."
        )

        payload = {
            'model': MODEL,
            'messages': [
                {
                    'role': 'user',
                    'content': [
                        {'type': 'text', 'text': prompt},
                        {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{src_b64}'}},
                        {'type': 'image_url', 'image_url': {'url': f'data:image/jpeg;base64,{tgt_b64}'}},
                    ],
                }
            ],
        }

        print('[GEN] calling OpenRouter...', flush=True)
        resp = requests.post(
            OPENROUTER_URL,
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://poehali.dev',
                'X-Title': 'Яркая фотокнига',
            },
            json=payload,
            timeout=150,
        )
        print(f'[GEN] OpenRouter status: {resp.status_code}', flush=True)

        if resp.status_code != 200:
            print(f'[GEN] error body: {resp.text[:600]}', flush=True)
            return err(f'OpenRouter {resp.status_code}: {resp.text[:300]}')

        data = resp.json()
        print(f'[GEN] response: {json.dumps(data)[:1000]}', flush=True)

        # Извлекаем изображение из ответа
        result_bytes = None
        choices = data.get('choices', [])
        if choices:
            content = choices[0].get('message', {}).get('content', '')
            if isinstance(content, list):
                for part in content:
                    if isinstance(part, dict) and part.get('type') == 'image_url':
                        img_url = part['image_url'].get('url', '')
                        if img_url.startswith('data:'):
                            result_bytes = base64.b64decode(img_url.split(',', 1)[1])
                        elif img_url.startswith('http'):
                            result_bytes = requests.get(img_url, timeout=30).content
                        break
            elif isinstance(content, str) and content.startswith('data:image'):
                result_bytes = base64.b64decode(content.split(',', 1)[1])

        if not result_bytes:
            return err('Gemini не вернул изображение')

        # Сохраняем в S3
        key = f'generated/{uuid.uuid4().hex}.jpg'
        s3 = boto3.client(
            's3',
            endpoint_url='https://bucket.poehali.dev',
            aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
            aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'],
        )
        s3.put_object(Bucket='files', Key=key, Body=result_bytes, ContentType='image/jpeg')
        cdn = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
        print(f'[GEN] done: {cdn}', flush=True)
        return {'statusCode': 200, 'headers': H, 'body': json.dumps({'url': cdn})}

    except Exception as e:
        tb = traceback.format_exc()
        print(f'[GEN] EXCEPTION: {e}\n{tb}', flush=True)
        return err(f'Внутренняя ошибка: {str(e)[:200]}')