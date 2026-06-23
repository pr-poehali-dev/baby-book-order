import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Template, uploadFile, createOrder, fetchTemplate, faceSwap } from '@/lib/api';

type Step = 'form' | 'processing';
type ProcessStage = 'upload' | 'generate' | 'done';

const OrderDialog = ({ template, open, onClose }: { template: Template | null; open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('form');
  const [stage, setStage] = useState<ProcessStage>('upload');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  if (!template) return null;

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhoto(f);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    if (!photo || !name || !age || !hairColor || !eyeColor) {
      toast.error('Заполните все поля и загрузите фото');
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

      let resultPages: string[] = [];
      if (templatePages.length > 0) {
        for (let i = 0; i < templatePages.length; i++) {
          setCurrentPage(i + 1);
          const swapped = await faceSwap(photoUrl, templatePages[i].image_url);
          resultPages.push(swapped);
        }
      } else {
        const swapped = await faceSwap(photoUrl, template.cover_url || photoUrl);
        resultPages = [swapped];
      }

      setCurrentPage(0);
      setStage('done');

      sessionStorage.setItem('bookPreview', JSON.stringify({
        pages: resultPages,
        templateId: template.id,
        templateTitle: template.title,
        templatePrice: template.price,
        childName: name,
      }));

      onClose();
      navigate('/book-preview');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Ошибка: ${msg}`);
      setStep('form');
    }
  };

  const reset = () => {
    setStep('form'); setStage('upload'); setName(''); setAge(''); setHairColor(''); setEyeColor(''); setEmail('');
    setPhoto(null); setPhotoPreview(''); setCurrentPage(0);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {`Книга «${template.title}»`}
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
              <Label className="font-bold mb-2 block">Цвет волос</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { label: 'Блонд',  dot: '#F5E6A3' },
                  { label: 'Русый',  dot: '#C8A96E' },
                  { label: 'Брюнет', dot: '#3B2314' },
                  { label: 'Шатен',  dot: '#7B4A2D' },
                  { label: 'Рыжий',  dot: '#C1440E' },
                ] as { label: string; dot: string }[]).map(({ label, dot }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setHairColor(label)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${hairColor === label ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: dot }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="font-bold mb-2 block">Цвет глаз</Label>
              <div className="flex flex-wrap gap-2">
                {([
                  { label: 'Карие',   dot: '#6B3A2A' },
                  { label: 'Голубые', dot: '#7BB8D4' },
                  { label: 'Зелёные', dot: '#4A8C5C' },
                  { label: 'Серые',   dot: '#9AA5B1' },
                  { label: 'Другой',  dot: '#D1B3E8' },
                ] as { label: string; dot: string }[]).map(({ label, dot }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setEyeColor(label)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${eyeColor === label ? 'bg-primary text-primary-foreground border-primary' : 'border-border hover:border-primary/50'}`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-black/10 flex-shrink-0" style={{ backgroundColor: dot }} />
                    {label}
                  </button>
                ))}
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
      </DialogContent>
    </Dialog>
  );
};

export default OrderDialog;
