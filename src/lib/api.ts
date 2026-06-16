export const API = {
  upload: 'https://functions.poehali.dev/1af676dc-f92d-4a52-b85c-6c1f09d7c787',
  orders: 'https://functions.poehali.dev/23c3de0f-8e9f-4727-ab16-8e0abe2b793b',
  templates: 'https://functions.poehali.dev/78819c1d-e507-4a37-8c83-63d58af77ccd',
  generate: 'https://functions.poehali.dev/e82e9202-9c82-418b-a294-9827d695fcad',
};

export async function faceSwap(sourceFaceUrl: string, targetImageUrl: string): Promise<string> {
  const res = await fetch(API.generate, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source_face_url: sourceFaceUrl, target_image_url: targetImageUrl }),
  });
  const data = await res.json();
  if (!data.url) throw new Error(data.error || 'Generation failed');
  return data.url as string;
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

export async function uploadFile(file: File, folder: string): Promise<string> {
  const b64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const res = await fetch(API.upload, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: b64, folder, contentType: file.type }),
  });
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