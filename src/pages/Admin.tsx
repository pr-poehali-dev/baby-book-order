import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  API,
  Template,
  TemplatePage,
  fetchTemplates,
  fetchTemplate,
  createTemplate,
  updateTemplate,
  addPage,
  updatePageFace,
  uploadFile,
  getSessionId,
} from '@/lib/api';

interface PrintSetting { mm_w: number; mm_h: number; dpi: number }
interface PrintSettings { cover: PrintSetting; spread: PrintSetting }

const PrintSettingsPanel = () => {
  const [settings, setSettings] = useState<PrintSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(API.print_settings).then(r => r.json()).then(setSettings);
  }, []);

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    const res = await fetch(API.print_settings, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getSessionId()}` },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (res.ok) toast.success('Настройки печати сохранены');
    else toast.error('Ошибка сохранения');
  };

  const upd = (type: 'cover' | 'spread', field: keyof PrintSetting, val: number) =>
    setSettings(s => s ? { ...s, [type]: { ...s[type], [field]: val } } : s);

  if (!settings) return <div className="text-xs text-muted-foreground py-2">Загрузка...</div>;

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
      <div className="flex items-center gap-2 font-bold text-sm">
        <Icon name="Printer" size={16} className="text-primary" /> Настройки печати
      </div>

      {(['cover', 'spread'] as const).map(type => (
        <div key={type} className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {type === 'cover' ? 'Обложка' : 'Разворот'}
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Ш, мм</Label>
              <Input type="number" value={settings[type].mm_w} onChange={e => upd(type, 'mm_w', +e.target.value)} className="rounded-lg h-8 text-sm mt-0.5" />
            </div>
            <div>
              <Label className="text-xs">В, мм</Label>
              <Input type="number" value={settings[type].mm_h} onChange={e => upd(type, 'mm_h', +e.target.value)} className="rounded-lg h-8 text-sm mt-0.5" />
            </div>
            <div>
              <Label className="text-xs">DPI</Label>
              <Input type="number" value={settings[type].dpi} onChange={e => upd(type, 'dpi', +e.target.value)} className="rounded-lg h-8 text-sm mt-0.5" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            → {Math.round(settings[type].mm_w * settings[type].dpi / 25.4)} × {Math.round(settings[type].mm_h * settings[type].dpi / 25.4)} px
          </p>
        </div>
      ))}

      <Button onClick={save} disabled={saving} size="sm" className="w-full rounded-full font-bold">
        {saving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Save" size={14} />}
        Сохранить
      </Button>
    </div>
  );
};

const FaceMarker = ({ page, onSave }: { page: TemplatePage; onSave: () => void }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const [rect, setRect] = useState({
    x: page.face_x ?? 0.4,
    y: page.face_y ?? 0.15,
    w: page.face_width ?? 0.2,
    h: page.face_height ?? 0.25,
  });
  const dragging = useRef(false);
  const start = useRef({ mx: 0, my: 0, x: 0, y: 0 });

  const onDown = (e: React.MouseEvent) => {
    dragging.current = true;
    start.current = { mx: e.clientX, my: e.clientY, x: rect.x, y: rect.y };
  };
  const onMove = (e: React.MouseEvent) => {
    if (!dragging.current || !boxRef.current) return;
    const b = boxRef.current.getBoundingClientRect();
    const dx = (e.clientX - start.current.mx) / b.width;
    const dy = (e.clientY - start.current.my) / b.height;
    setRect((r) => ({
      ...r,
      x: Math.min(Math.max(start.current.x + dx, 0), 1 - r.w),
      y: Math.min(Math.max(start.current.y + dy, 0), 1 - r.h),
    }));
  };
  const onUp = () => { dragging.current = false; };

  const save = async () => {
    await updatePageFace({
      page_id: page.id,
      face_x: rect.x,
      face_y: rect.y,
      face_width: rect.w,
      face_height: rect.h,
    });
    toast.success('Зона лица сохранена');
    onSave();
  };

  return (
    <div className="space-y-3">
      <div
        ref={boxRef}
        className="relative select-none rounded-2xl overflow-hidden border-2 border-border"
        onMouseMove={onMove}
        onMouseUp={onUp}
        onMouseLeave={onUp}
      >
        <img src={page.image_url} alt="page" className="w-full block pointer-events-none" />
        <div
          onMouseDown={onDown}
          className="absolute border-[3px] border-primary bg-primary/20 cursor-move rounded-lg"
          style={{
            left: `${rect.x * 100}%`,
            top: `${rect.y * 100}%`,
            width: `${rect.w * 100}%`,
            height: `${rect.h * 100}%`,
          }}
        >
          <span className="absolute -top-7 left-0 bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-md whitespace-nowrap">
            Лицо героя
          </span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">Ширина зоны
          <input type="range" min={0.05} max={0.6} step={0.01} value={rect.w}
            onChange={(e) => setRect((r) => ({ ...r, w: +e.target.value }))} className="w-full" />
        </label>
        <label className="text-sm">Высота зоны
          <input type="range" min={0.05} max={0.6} step={0.01} value={rect.h}
            onChange={(e) => setRect((r) => ({ ...r, h: +e.target.value }))} className="w-full" />
        </label>
      </div>
      <Button onClick={save} size="sm" className="rounded-full font-bold w-full">
        <Icon name="Save" size={16} /> Сохранить зону лица
      </Button>
    </div>
  );
};

interface Product {
  id: number; name: string; size_cm: string;
  cover_mm_w: number; cover_mm_h: number;
  spread_mm_w: number; spread_mm_h: number;
  dpi: number; price_modifier: number; is_active: boolean;
  template_ids: number[];
}

const EMPTY_PRODUCT: Omit<Product, 'id' | 'template_ids' | 'is_active'> = {
  name: '', size_cm: '', cover_mm_w: 468, cover_mm_h: 246,
  spread_mm_w: 406, spread_mm_h: 203, dpi: 300, price_modifier: 0,
};

const ProductsPanel = ({ templates }: { templates: Template[] }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetch(API.products).then(r => r.json()).then(setProducts);

  useEffect(() => { load(); }, []);

  const authHeader = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${getSessionId()}`,
  });

  const saveProduct = async () => {
    if (!editing) return;
    setSaving(true);
    const method = editing.id ? 'PUT' : 'POST';
    await fetch(API.products, { method, headers: authHeader(), body: JSON.stringify(editing) });
    await load();
    setEditing(null);
    setSaving(false);
    toast.success(editing.id ? 'Продукт обновлён' : 'Продукт создан');
  };

  const toggleTemplate = async (productId: number, templateId: number, linked: boolean) => {
    await fetch(`${API.products}/link`, {
      method: 'POST', headers: authHeader(),
      body: JSON.stringify({ product_id: productId, template_id: templateId, action: linked ? 'remove' : 'add' }),
    });
    await load();
  };

  const mmToPx = (mm: number, dpi: number) => Math.round(mm * dpi / 25.4);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-xl">Форматы книг</h3>
        <Button size="sm" className="rounded-full font-bold gap-1.5"
          onClick={() => setEditing({ ...EMPTY_PRODUCT })}>
          <Icon name="Plus" size={15} /> Новый формат
        </Button>
      </div>

      {/* Форма создания/редактирования */}
      {editing && (
        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 space-y-3">
          <p className="font-bold text-sm">{editing.id ? 'Редактировать' : 'Новый'} формат</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold">Название</Label>
              <Input value={editing.name ?? ''} onChange={e => setEditing(p => ({...p!, name: e.target.value}))} placeholder="Книга 25×25 см" className="rounded-xl h-8 text-sm mt-0.5" />
            </div>
            <div>
              <Label className="text-xs font-semibold">Размер (см)</Label>
              <Input value={editing.size_cm ?? ''} onChange={e => setEditing(p => ({...p!, size_cm: e.target.value}))} placeholder="25x25" className="rounded-xl h-8 text-sm mt-0.5" />
            </div>
          </div>
          <p className="text-xs font-semibold text-muted-foreground">Обложка (мм)</p>
          <div className="grid grid-cols-3 gap-2">
            {(['cover_mm_w','cover_mm_h','dpi'] as const).map(f => (
              <div key={f}>
                <Label className="text-xs">{f === 'cover_mm_w' ? 'Ш' : f === 'cover_mm_h' ? 'В' : 'DPI'}</Label>
                <Input type="number" value={(editing as Record<string,number>)[f] ?? 0} onChange={e => setEditing(p => ({...p!, [f]: +e.target.value}))} className="rounded-lg h-8 text-sm mt-0.5" />
              </div>
            ))}
          </div>
          <p className="text-xs font-semibold text-muted-foreground">Разворот (мм)</p>
          <div className="grid grid-cols-2 gap-2">
            {(['spread_mm_w','spread_mm_h'] as const).map(f => (
              <div key={f}>
                <Label className="text-xs">{f === 'spread_mm_w' ? 'Ш' : 'В'}</Label>
                <Input type="number" value={(editing as Record<string,number>)[f] ?? 0} onChange={e => setEditing(p => ({...p!, [f]: +e.target.value}))} className="rounded-lg h-8 text-sm mt-0.5" />
              </div>
            ))}
          </div>
          <div>
            <Label className="text-xs font-semibold">Надбавка к цене, ₽</Label>
            <Input type="number" value={editing.price_modifier ?? 0} onChange={e => setEditing(p => ({...p!, price_modifier: +e.target.value}))} className="rounded-xl h-8 text-sm mt-0.5 w-32" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveProduct} disabled={saving} className="rounded-full font-bold">
              {saving ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Save" size={14} />} Сохранить
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(null)} className="rounded-full">Отмена</Button>
          </div>
        </div>
      )}

      {/* Список продуктов */}
      {products.map(p => (
        <div key={p.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                Обложка: {p.cover_mm_w}×{p.cover_mm_h}мм · Разворот: {p.spread_mm_w}×{p.spread_mm_h}мм · {p.dpi}dpi
              </p>
              <p className="text-xs text-muted-foreground">
                Обложка: {mmToPx(p.cover_mm_w, p.dpi)}×{mmToPx(p.cover_mm_h, p.dpi)}px
              </p>
              {p.price_modifier > 0 && <p className="text-xs text-primary font-semibold">+{p.price_modifier}₽ к цене</p>}
            </div>
            <Button size="sm" variant="outline" onClick={() => setEditing({...p})} className="rounded-full">
              <Icon name="Pencil" size={14} />
            </Button>
          </div>

          {/* Привязка шаблонов */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Доступные шаблоны:</p>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => {
                const linked = p.template_ids.includes(t.id);
                return (
                  <button key={t.id} onClick={() => toggleTemplate(p.id, t.id, linked)}
                    className={`text-xs px-2.5 py-1 rounded-full border font-semibold transition-all ${linked ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}>
                    {linked ? '✓ ' : ''}{t.title}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

const Admin = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [active, setActive] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);
  const [adminTab, setAdminTab] = useState<'templates' | 'products'>('templates');

  const load = async () => setTemplates(await fetchTemplates());
  useEffect(() => { load(); }, []);

  const openTemplate = async (id: number) => setActive(await fetchTemplate(id));

  const newTemplate = async () => {
    const { id } = await createTemplate({ title: 'Новая книга', description: '' });
    await load();
    openTemplate(id);
    toast.success('Шаблон создан');
  };

  const saveMeta = async () => {
    if (!active) return;
    await updateTemplate({
      id: active.id,
      title: active.title,
      description: active.description,
      cover_url: active.cover_url,
      price: active.price,
      is_published: active.is_published,
    });
    await load();
    toast.success('Сохранено');
  };

  const onCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!active || !e.target.files?.[0]) return;
    setBusy(true);
    const url = await uploadFile(e.target.files[0], 'covers');
    setActive({ ...active, cover_url: url });
    setBusy(false);
  };

  const onAddPages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!active || !e.target.files) return;
    setBusy(true);
    const files = Array.from(e.target.files);
    let order = active.pages?.length ?? 0;
    for (const f of files) {
      const url = await uploadFile(f, 'pages');
      await addPage({ template_id: active.id, page_order: order++, image_url: url });
    }
    await openTemplate(active.id);
    setBusy(false);
    toast.success('Страницы добавлены');
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-card border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <Icon name="Settings" className="text-primary" />
            <span className="font-display font-extrabold text-xl">Админка шаблонов</span>
          </div>
          <a href="/" className="text-sm font-semibold text-muted-foreground hover:text-primary">На сайт →</a>
        </div>
      </header>

      <div className="container py-8 grid lg:grid-cols-[280px_1fr] gap-8">
        <aside className="space-y-2">
          {/* Вкладки */}
          <div className="flex rounded-2xl bg-muted p-1 gap-1 mb-3">
            <button onClick={() => setAdminTab('templates')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-xl transition-all ${adminTab === 'templates' ? 'bg-card shadow' : 'text-muted-foreground'}`}>
              Шаблоны
            </button>
            <button onClick={() => setAdminTab('products')}
              className={`flex-1 py-1.5 text-sm font-bold rounded-xl transition-all ${adminTab === 'products' ? 'bg-card shadow' : 'text-muted-foreground'}`}>
              Форматы
            </button>
          </div>

          {adminTab === 'templates' && (
            <>
              <Button onClick={newTemplate} className="w-full rounded-full font-bold">
                <Icon name="Plus" size={18} /> Новый шаблон
              </Button>
              {templates.map((t) => (
                <button key={t.id} onClick={() => openTemplate(t.id)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${active?.id === t.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40'}`}>
                  <div className="font-bold">{t.title}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                    {t.is_published ? <span className="text-green-600">● Опубликован</span> : <span>○ Черновик</span>}
                  </div>
                </button>
              ))}
            </>
          )}
        </aside>

        <main>
          {adminTab === 'products' ? (
            <div className="bg-card rounded-3xl p-6">
              <ProductsPanel templates={templates} />
            </div>
          ) : !active ? (
            <div className="bg-card rounded-3xl p-16 text-center text-muted-foreground">
              <Icon name="BookOpen" size={48} className="mx-auto mb-4 text-primary/40" />
              Выберите шаблон слева или создайте новый
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-card rounded-3xl p-6 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="font-bold">Название</Label>
                    <Input value={active.title} onChange={(e) => setActive({ ...active, title: e.target.value })} className="rounded-xl mt-1" />
                  </div>
                  <div>
                    <Label className="font-bold">Цена, ₽</Label>
                    <Input type="number" value={active.price} onChange={(e) => setActive({ ...active, price: +e.target.value })} className="rounded-xl mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="font-bold">Описание</Label>
                  <Textarea value={active.description || ''} onChange={(e) => setActive({ ...active, description: e.target.value })} className="rounded-xl mt-1" />
                </div>
                <div className="flex items-center gap-3">
                  <Label className="font-bold">Обложка</Label>
                  {active.cover_url && <img src={active.cover_url} className="w-16 h-16 object-cover rounded-xl" alt="cover" />}
                  <label className="cursor-pointer text-sm font-semibold text-primary">
                    Загрузить
                    <input type="file" accept="image/*" className="hidden" onChange={onCover} />
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Switch checked={active.is_published} onCheckedChange={(v) => setActive({ ...active, is_published: v })} />
                    <span className="font-semibold">Опубликовать на сайте</span>
                  </div>
                  <Button onClick={saveMeta} className="rounded-full font-bold">
                    <Icon name="Save" size={16} /> Сохранить
                  </Button>
                </div>
              </div>

              <div className="bg-card rounded-3xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-bold text-xl">Страницы книги ({active.pages?.length ?? 0})</h3>
                  <label className="cursor-pointer">
                    <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-bold px-4 py-2 rounded-full text-sm">
                      <Icon name="Upload" size={16} /> {busy ? 'Загрузка...' : 'Добавить страницы'}
                    </span>
                    <input type="file" accept="image/*" multiple className="hidden" onChange={onAddPages} disabled={busy} />
                  </label>
                </div>
                <p className="text-sm text-muted-foreground mb-5">
                  Перетащите рамку на лицо героя — туда нейросеть вставит лицо ребёнка.
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  {active.pages?.map((p) => (
                    <div key={p.id} className="space-y-2">
                      <div className="text-sm font-bold">Страница {p.page_order + 1}</div>
                      <FaceMarker page={p} onSave={() => openTemplate(active.id)} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Admin;