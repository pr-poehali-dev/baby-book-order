import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { API, Template, uploadFile } from '@/lib/api';
import FaceCropper from '@/components/FaceCropper';

interface Product {
  id: number; name: string; size_cm: string;
  price_modifier: number; template_ids: number[];
}

const OrderDialog = ({ template, open, onClose }: { template: Template | null; open: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [hairColor, setHairColor] = useState('');
  const [eyeColor, setEyeColor] = useState('');
  const [email, setEmail] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Фото: оригинал для кроппера, кропнутый файл — для загрузки
  const [photoPreview, setPhotoPreview] = useState('');
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!open || !template) return;
    fetch(API.products)
      .then(r => r.json())
      .then((all: Product[]) => {
        const filtered = all.filter(p => p.template_ids.includes(template.id));
        setAvailableProducts(filtered);
        if (filtered.length === 1) setSelectedProduct(filtered[0]);
        else setSelectedProduct(null);
      })
      .catch(() => {});
  }, [open, template]);

  if (!template) return null;

  const needProductChoice = availableProducts.length > 1 && !selectedProduct;

  const onPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setCroppedFile(null);
    setPhotoPreview(URL.createObjectURL(f));
  };

  const onCropConfirm = (file: File) => {
    setCroppedFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const submit = async () => {
    if (!croppedFile || !name || !age || !hairColor || !eyeColor) {
      toast.error('Заполните все поля и выделите лицо на фото');
      return;
    }
    setUploading(true);
    try {
      const photoUrl = await uploadFile(croppedFile, 'children');
      const finalPrice = template.price + (selectedProduct?.price_modifier ?? 0);
      sessionStorage.setItem('bookOrder', JSON.stringify({
        photoUrl,
        templateId: template.id,
        templateTitle: template.title,
        templatePrice: finalPrice,
        productId: selectedProduct?.id ?? null,
        productName: selectedProduct?.name ?? null,
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
    setPhotoPreview(''); setCroppedFile(null); setUploading(false);
    setSelectedProduct(null);
    onClose();
  };

  // Показываем кроппер если фото загружено, но кроп ещё не подтверждён
  const showCropper = photoPreview && !croppedFile;

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-w-2xl rounded-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {showCropper ? 'Выделите лицо ребёнка' : needProductChoice ? 'Выберите формат книги' : `Книга «${template.title}»`}
          </DialogTitle>
        </DialogHeader>

        {showCropper ? (
          <FaceCropper src={photoPreview} onCrop={onCropConfirm} />
        ) : needProductChoice ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Для этой книги доступно несколько форматов — выберите подходящий:</p>
            {availableProducts.map(p => (
              <button key={p.id} onClick={() => setSelectedProduct(p)}
                className="w-full text-left p-4 rounded-2xl border-2 border-border hover:border-primary/50 bg-card transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.size_cm} см</p>
                  </div>
                  {p.price_modifier > 0
                    ? <span className="text-sm font-bold text-primary">+{p.price_modifier}₽</span>
                    : <span className="text-sm text-muted-foreground">Базовая цена</span>
                  }
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-5">
            {/* Выбранный формат (если был выбор) */}
            {availableProducts.length > 1 && selectedProduct && (
              <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon name="Package" size={15} className="text-primary" />
                  {selectedProduct.name}
                </div>
                <button onClick={() => setSelectedProduct(null)} className="text-xs text-muted-foreground hover:text-foreground">
                  Изменить
                </button>
              </div>
            )}
            <div>
              <Label className="font-bold mb-2 block">Фото ребёнка</Label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-primary/40 rounded-2xl p-6 cursor-pointer hover:bg-primary/5">
                {croppedFile ? (
                  <div className="relative">
                    <img src={photoPreview} alt="preview" className="w-28 h-28 object-cover rounded-xl mb-2" />
                    <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold">✓</span>
                  </div>
                ) : (
                  <Icon name="ImagePlus" className="text-primary mb-2" size={36} />
                )}
                <span className="font-semibold text-sm">
                  {croppedFile ? 'Лицо выделено · нажмите чтобы изменить' : 'Загрузить фото'}
                </span>
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
        )}
      </DialogContent>
    </Dialog>
  );
};

export default OrderDialog;