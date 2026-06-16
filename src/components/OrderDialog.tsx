import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Template, uploadFile, createOrder, fetchTemplate } from '@/lib/api';

type Step = 'form' | 'processing' | 'preview';

const OrderDialog = ({ template, open, onClose }: { template: Template | null; open: boolean; onClose: () => void }) => {
  const [step, setStep] = useState<Step>('form');
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [pages, setPages] = useState<string[]>([]);

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
    try {
      const photoUrl = await uploadFile(photo, 'children');
      const res = await createOrder({
        template_id: template.id,
        child_name: name,
        child_age: +age,
        child_photo_url: photoUrl,
        customer_email: email,
      });
      const full = await fetchTemplate(template.id);
      setPages(res.generation?.pages || full.pages?.map((p) => p.image_url) || []);
      setStep('preview');
    } catch {
      toast.error('Что-то пошло не так, попробуйте ещё раз');
      setStep('form');
    }
  };

  const reset = () => {
    setStep('form'); setName(''); setAge(''); setEmail('');
    setPhoto(null); setPhotoPreview(''); setPages([]);
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
          <div className="py-16 text-center">
            <div className="animate-wobble text-6xl mb-4">🪄</div>
            <p className="font-display font-bold text-xl">Создаём вашу книгу...</p>
            <p className="text-muted-foreground text-sm mt-2">Вставляем {name} в волшебную историю</p>
          </div>
        )}

        {step === 'preview' && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Так выглядит ваша книга 20×20 см. После оплаты пришлём финальные страницы в JPEG.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {pages.map((src, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-border">
                  <img src={src} alt={`Страница ${i + 1}`} className="w-full aspect-square object-cover" />
                </div>
              ))}
            </div>
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
