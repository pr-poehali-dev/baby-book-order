import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  Template,
  TemplatePage,
  fetchTemplates,
  fetchTemplate,
  createTemplate,
  updateTemplate,
  addPage,
  updatePageFace,
  uploadFile,
} from '@/lib/api';

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

const Admin = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [active, setActive] = useState<Template | null>(null);
  const [busy, setBusy] = useState(false);

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

      <div className="container py-8 grid lg:grid-cols-[320px_1fr] gap-8">
        <aside className="space-y-3">
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
        </aside>

        <main>
          {!active ? (
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
