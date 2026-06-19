import base64
import io
import json
import os
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


def compress_to_base64(data: bytes, max_size=1024) -> str:
    img = Image.open(io.BytesIO(data)).convert('RGB')
    if img.width > max_size or img.height > max_size:
        img.thumbnail((max_size, max_size), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=85)
    return base64.b64encode(buf.getvalue()).decode()


def handler(event: dict, context) -> dict:
    """Генерация иллюстрации через Gemini (OpenRouter): вставляет черты лица ребёнка в стиль шаблона книги.
    Принимает: source_face_url (фото ребёнка), target_image_url (страница шаблона).
    Возвращает: url готовой иллюстрации в S3."""

    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS, 'body': ''}

    body = json.loads(event.get('body') or '{}')
    src_url = (body.get('source_face_url') or '').strip()
    tgt_url = (body.get('target_image_url') or '').strip()

    if not src_url or not tgt_url:
        return err('source_face_url and target_image_url required', 400)

    api_key = os.environ.get('OPENROUTER_API_KEY', '')
    if not api_key:
        return err('OPENROUTER_API_KEY missing')

    # Скачиваем оба изображения
    print('[GEN] downloading images...', flush=True)
    src_bytes = requests.get(src_url, timeout=30).content
    tgt_bytes = requests.get(tgt_url, timeout=30).content

    src_b64 = compress_to_base64(src_bytes, max_size=768)
    tgt_b64 = compress_to_base64(tgt_bytes, max_size=1024)
    print(f'[GEN] src={len(src_b64)} tgt={len(tgt_b64)} chars', flush=True)

    # Запрос к Gemini через OpenRouter
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
        'modalities': ['text', 'image'],
    }

    print('[GEN] calling Gemini via OpenRouter...', flush=True)
    resp = requests.post(
        OPENROUTER_URL,
        headers={
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://poehali.dev',
            'X-Title': 'Яркая фотокнига',
        },
        json=payload,
        timeout=120,
    )

    print(f'[GEN] OpenRouter status: {resp.status_code}', flush=True)
    if resp.status_code != 200:
        print(f'[GEN] OpenRouter error body: {resp.text[:500]}', flush=True)
        return err(f'OpenRouter error {resp.status_code}: {resp.text[:300]}')

    data = resp.json()
    print(f'[GEN] response keys: {list(data.keys())}', flush=True)
    print(f'[GEN] full response: {json.dumps(data)[:800]}', flush=True)

    # Извлекаем сгенерированное изображение из ответа
    result_bytes = None
    choices = data.get('choices', [])
    if choices:
        content = choices[0].get('message', {}).get('content', '')
        # Gemini может вернуть контент как список или строку
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
        print(f'[GEN] raw response: {json.dumps(data)[:500]}', flush=True)
        return err('Gemini не вернул изображение. Проверьте модель или попробуйте снова.')

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