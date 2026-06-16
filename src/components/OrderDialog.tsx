import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Template, uploadFile, createOrder, fetchTemplate, faceSwap } from '@/lib/api';

type Step = 'form' | 'processing' | 'preview';
type ProcessStage = 'upload' | 'generate' | 'done';

const OrderDialog = ({ template, open, onClose }: { template: Template | null; open: boolean; onClose: () => void }) => {
  const [step, setStep] = useState<Step>('form');
  const [stage, setStage] = useState<ProcessStage>('upload');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [pages, setPages] = useState<string[]>([]);
  const [generatedUrl, setGeneratedUrl] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  if (!template) return null;

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!photo || !name || !age) {
      toast.error('Загрузите фото, укажите имя и возраст');
      return;
    }
    setStep('processing');
    setStage('upload');
    try {
      const photoUrl = await uploadFile(photo, 'children');

      await createOrder({
        template_id: template.id,
        child_name: name,
        child_age: +age,
        child_photo_url: photoUrl,
        customer_email: email,
      });

      const full = await fetchTemplate(template.id);
      const templatePages = full.pages?.filter(p => p.image_url) || [];

      setStage('generate');

      if (templatePages.length > 0) {
        const resultPages: string[] = [];
        for (let i = 0; i < templatePages.length; i++) {
          setCurrentPage(i + 1);
          const swapped = await faceSwap(photoUrl, templatePages[i].image_url);
          resultPages.push(swapped);
          if (i === 0) setGeneratedUrl(swapped);
        }
        setPages(resultPages);
      } else {
        const swapped = await faceSwap(photoUrl, template.cover_url || photoUrl);
        setGeneratedUrl(swapped);
        setPages([swapped]);
      }

      setCurrentPage(0);
      setStage('done');
      setStep('preview');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Ошибка: ${msg}`);
      setStep('form');
    }
  };

  const reset = () => {
    setStep('form'); setStage('upload'); setName(''); setAge(''); setEmail('');
    setPhoto(null); setPhotoPreview(''); setPages([]); setGeneratedUrl(''); setCurrentPage(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {step === 'preview' ? 'Предпросмотр книги' : `Книга «${template.title}»`}
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-5">
            <div>
              <Label className="font-bold mb-2 block">Фото ребёнка</Label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-primary/40 rounded-2xl p-6 cursor-pointer hover:bg-primary/5">
                {photoPreview ? (
                  <img src={photoPreview} alt="preview" className="w-28 h-28 object-cover rounded-xl mb-2" />
                ) : (
                  <Icon name="ImagePlus" className="text-primary mb-2" size={36} />
                )}
                <span className="font-semibold text-sm">{photo ? photo.name : 'Загрузить фото'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label className="font-bold mb-2 block">Имя ребёнка</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Соня" className="rounded-xl" />
              </div>
              <div>
                <Label className="font-bold mb-2 block">Возраст</Label>
                <Input type="number" value={age} onChange={(e) => setAge(e.target.value)} placeholder="5" className="rounded-xl" />
              </div>
            </div>
            <div>
              <Label className="font-bold mb-2 block">Email для готовой книги</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="mail@example.com" className="rounded-xl" />
            </div>
            <Button onClick={submit} size="lg" className="w-full rounded-full font-bold text-lg h-13">
              <Icon name="Sparkles" size={20} /> Создать книгу
            </Button>
          </div>
        )}

        {step === 'processing' && (
          <div className="py-12 text-center space-y-6">
            <div className="animate-wobble text-6xl">🪄</div>
            <div>
              <p className="font-display font-bold text-xl mb-1">Создаём книгу для {name}...</p>
              <p className="text-muted-foreground text-sm">Это займёт около минуты</p>
            </div>
            <div className="space-y-3 text-left max-w-xs mx-auto">
              {[
                { key: 'upload', label: 'Загружаем фото', icon: '📤' },
                { key: 'generate', label: currentPage > 0 ? `Вставляем лицо: стр. ${currentPage}` : 'Нейросеть вставляет лицо', icon: '🤖' },
                { key: 'done', label: 'Собираем книгу', icon: '📚' },
              ].map((s) => {
                const stageOrder = { upload: 0, generate: 1, done: 2 };
                const currentOrder = stageOrder[stage];
                const itemOrder = stageOrder[s.key as ProcessStage];
                const isDone = itemOrder < currentOrder;
                const isActive = itemOrder === currentOrder;
                return (
                  <div key={s.key} className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${isActive ? 'bg-primary/10 font-semibold' : isDone ? 'opacity-50' : 'opacity-30'}`}>
                    <span className="text-xl">{isDone ? '✅' : s.icon}</span>
                    <span className="text-sm">{s.label}</span>
                    {isActive && <span className="ml-auto animate-pulse text-primary">●</span>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-5">
            <div className="bg-primary/5 rounded-2xl p-4 text-center">
              <p className="text-sm font-bold mb-1">🎉 Книга для {name} готова!</p>
              <p className="text-xs text-muted-foreground">Нейросеть вставила лицо на {pages.length} {pages.length === 1 ? 'страницу' : 'страниц'}</p>
            </div>
            {pages.length > 0 && (
              <div className="grid grid-cols-2 gap-3">
                {pages.map((src, i) => (
                  <div key={i} className="rounded-xl overflow-hidden border border-border relative">
                    <img src={src} alt={`Страница ${i + 1}`} className="w-full aspect-square object-cover" />
                    <span className="absolute bottom-2 left-2 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">{i + 1}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">Формат 20×20 см, выгрузка в JPEG после оплаты</p>
            <Button onClick={reset} size="lg" className="w-full rounded-full font-bold">
              <Icon name="ShoppingCart" size={18} /> Оформить заказ
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrderDialog;