import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { Template, uploadFile } from '@/lib/api';

const OrderDialog = ({ template, open, onClose }: { template: Template | null; open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [email, setEmail] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploading, setUploading] = useState(false);

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
    setUploading(true);
    try {
      const photoUrl = await uploadFile(photo, 'children');
      sessionStorage.setItem('bookOrder', JSON.stringify({
        photoUrl,
        templateId: template.id,
        templateTitle: template.title,
        templatePrice: template.price,
        childName: name,
        childAge: +age,
        hairColor,
        eyeColor,
        email,
      }));
      onClose();
      navigate('/book-preview');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Ошибка загрузки фото: ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setName(''); setAge(''); setHairColor(''); setEyeColor(''); setEmail('');
    setPhoto(null); setPhotoPreview(''); setUploading(false);
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
          <Button onClick={submit} disabled={uploading} size="lg" className="w-full rounded-full font-bold text-lg h-13">
            {uploading
              ? <><Icon name="Loader2" size={20} className="animate-spin" /> Загружаем фото...</>
              : <><Icon name="Sparkles" size={20} /> Создать книгу</>
            }
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDialog;
