export const API = {
  upload: 'https://functions.poehali.dev/1af676dc-f92d-4a52-b85c-6c1f09d7c787',
  orders: 'https://functions.poehali.dev/23c3de0f-8e9f-4727-ab16-8e0abe2b793b',
  templates: 'https://functions.poehali.dev/78819c1d-e507-4a37-8c83-63d58af77ccd',
  generate: 'https://functions.poehali.dev/e82e9202-9c82-418b-a294-9827d695fcad',
  auth: 'https://functions.poehali.dev/7ec8b743-919f-451c-a25c-728e9fb2e156',
  profile: 'https://functions.poehali.dev/be831ec0-2776-496b-9a79-b9cd76aa3f90',
  cart: 'https://functions.poehali.dev/33d547bf-4dab-4e3b-9c8f-084b4f2b5a2b',
  print_settings: 'https://functions.poehali.dev/c0466e44-d22a-4d05-87a3-ddc5ce94a10b',
  export_book: 'https://functions.poehali.dev/1767c0de-d907-4318-a2e7-4f5f5a65777d',
  products: 'https://functions.poehali.dev/7c381b83-c6be-49ef-bf93-9345882f2f5c',
};

export function getSessionId(): string {
  return localStorage.getItem('session_id') || '';
}

export function setSessionId(sid: string) {
  localStorage.setItem('session_id', sid);
}

export function clearSessionId() {
  localStorage.removeItem('session_id');
}

function authHeaders() {
  return { 'Content-Type': 'application/json', 'X-Session-Id': getSessionId() };
}

export interface User {
  id: number;
  phone: string | null;
  name: string | null;
  email: string | null;
  role: string;
}

export async function authMe(): Promise<User | null> {
  const sid = getSessionId();
  if (!sid) return null;
  const res = await fetch(API.auth, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'me' }),
  });
  const data = await res.json();
  return data.user || null;
}

export async function authRegister(data: { name: string; email: string; phone: string; password: string }): Promise<string> {
  const res = await fetch(API.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'register', ...data }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || 'Ошибка регистрации');
  return d.session_id;
}

export async function authLoginPassword(login: string, password: string): Promise<string> {
  const res = await fetch(API.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', login, password }),
  });
  const d = await res.json();
  if (!res.ok || d.error) throw new Error(d.error || 'Неверный логин или пароль');
  return d.session_id;
}

export async function authSendCode(phone: string): Promise<void> {
  const res = await fetch(API.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'send-code', phone }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Ошибка отправки');
}

export async function authVerifyCode(phone: string, code: string): Promise<string> {
  const res = await fetch(API.auth, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify-code', phone, code }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Неверный код');
  return data.session_id;
}

export async function authLogout(): Promise<void> {
  await fetch(API.auth, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action: 'logout' }),
  });
  clearSessionId();
}

export async function profileAction(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(API.profile, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}

export async function cartAction(action: string, body: Record<string, unknown> = {}) {
  const res = await fetch(API.cart, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action, ...body }),
  });
  return res.json();
}

export async function faceSwap(sourceFaceUrl: string, targetImageUrl: string): Promise<string> {
  const res = await fetch(API.generate, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_face_url: sourceFaceUrl, target_image_url: targetImageUrl }),
  });
  const text = await res.text();
  let data: Record<string, string> = {};
  try { data = JSON.parse(text); } catch { throw new Error(`Server error: ${text.slice(0, 100)}`); }
  if (!res.ok || !data.url) throw new Error(data.error || `HTTP ${res.status}`);
  return data.url;
}

export interface TemplatePage {
  id: number;
  template_id: number;
  page_order: number;
  image_url: string;
  face_x: number | null;
  face_y: number | null;
  face_width: number | null;
  face_height: number | null;
}

export interface Template {
  id: number;
  title: string;
  description: string;
  cover_url: string;
  price: number;
  is_published: boolean;
  pages?: TemplatePage[];
}

async function compressImage(file: File, maxSizeKb = 700): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let quality = 0.85;
      let scale = 1;
      const MAX_DIM = 1200;
      if (img.width > MAX_DIM || img.height > MAX_DIM) {
        scale = MAX_DIM / Math.max(img.width, img.height);
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const tryEncode = () => {
        const b64 = canvas.toDataURL('image/jpeg', quality);
        const sizeKb = (b64.length * 0.75) / 1024;
        if (sizeKb > maxSizeKb && quality > 0.3) {
          quality -= 0.1;
          tryEncode();
        } else {
          resolve(b64);
        }
      };
      tryEncode();
    };
    img.onerror = reject;
    img.src = url;
  });
}

export async function uploadFile(file: File, folder: string): Promise<string> {
  const b64 = await compressImage(file, 700);
  const res = await fetch(API.upload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: b64, folder, contentType: 'image/jpeg' }),
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data.url as string;
}

export async function fetchTemplates(publishedOnly = false): Promise<Template[]> {
  const url = publishedOnly ? `${API.templates}?published=1` : API.templates;
  const res = await fetch(url);
  return res.json();
}

export async function fetchTemplate(id: number): Promise<Template> {
  const res = await fetch(`${API.templates}?id=${id}`);
  return res.json();
}

export async function createTemplate(data: Partial<Template>): Promise<{ id: number }> {
  const res = await fetch(API.templates, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateTemplate(data: Partial<Template> & { id: number }) {
  const res = await fetch(API.templates, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function addPage(data: {
  template_id: number;
  page_order: number;
  image_url: string;
  face_x?: number;
  face_y?: number;
  face_width?: number;
  face_height?: number;
}) {
  const res = await fetch(API.templates, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'add_page', ...data }),
  });
  return res.json();
}

export async function updatePageFace(data: {
  page_id: number;
  face_x: number;
  face_y: number;
  face_width: number;
  face_height: number;
}) {
  const res = await fetch(API.templates, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'update_page_face', ...data }),
  });
  return res.json();
}

export async function createOrder(data: {
  template_id: number;
  child_name: string;
  child_age: number;
  child_photo_url: string;
  customer_email?: string;
  customer_phone?: string;
}) {
  const res = await fetch(API.orders, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}