import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';

interface PreviewData {
  pages: string[];
  templateId: number;
  templateTitle: string;
  templatePrice: number;
  childName: string;
}

export default function BookPreview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, addToCart } = useCart();
  const [data, setData] = useState<PreviewData | null>(null);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('bookPreview');
    if (!raw) { navigate('/'); return; }
    try { setData(JSON.parse(raw)); } catch { navigate('/'); }
  }, [navigate]);

  if (!data) return null;

  const previewPages = data.pages.slice(0, 3);
  const labels = ['Обложка', 'Разворот 1', 'Разворот 2'];

  const handleAddToCart = async () => {
    if (!user) { navigate('/login'); return; }
    setAdding(true);
    try {
      await addToCart(data.templateId, data.childName, data.pages);
      toast.success('Книга добавлена в корзину!');
      sessionStorage.removeItem('bookPreview');
      navigate('/cart');
    } catch {
      toast.error('Не удалось добавить в корзину');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">

      {/* ШАПКА */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container flex items-center justify-between h-20">
          <a href="/" className="flex items-center gap-2">
            <span className="text-3xl">📖</span>
            <span className="font-display font-extrabold text-2xl text-gradient">Яркая фотокнига</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="/cart">
              <Button variant="outline" size="sm" className="rounded-full gap-1.5 relative">
                <Icon name="ShoppingCart" size={16} />
                {items.length > 0 && (
                  <span className="bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                    {items.length}
                  </span>
                )}
              </Button>
            </a>
            {user ? (
              <a href="/account">
                <Button variant="ghost" size="sm" className="rounded-full gap-1.5">
                  <Icon name="User" size={16} /> {user.name || 'Кабинет'}
                </Button>
              </a>
            ) : (
              <a href="/login">
                <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Icon name="LogIn" size={16} /> Войти
                </Button>
              </a>
            )}
          </div>
        </div>
      </header>

      {/* КОНТЕНТ */}
      <main className="flex-1 container py-10 max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🎉</div>
          <h1 className="font-display font-extrabold text-3xl mb-2">
            Книга для {data.childName} готова!
          </h1>
          <p className="text-muted-foreground">«{data.templateTitle}» · предпросмотр</p>
        </div>

        {/* Превью страниц */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {previewPages.map((src, i) => (
            <div key={i} className="rounded-2xl overflow-hidden border border-border shadow-sm">
              <img src={src} alt={labels[i]} className="w-full aspect-square object-cover" />
              <p className="text-center text-xs font-semibold text-muted-foreground py-2">{labels[i]}</p>
            </div>
          ))}
        </div>

        {/* Блок с ценой и CTA */}
        <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="font-bold text-lg">Полная книга — {data.templatePrice} ₽</p>
            <p className="text-sm text-muted-foreground">Печать + доставка включены</p>
          </div>
          <Button onClick={handleAddToCart} disabled={adding} size="lg" className="rounded-full font-bold px-8 gap-2">
            {adding ? <Icon name="Loader2" size={18} className="animate-spin" /> : <Icon name="ShoppingCart" size={18} />}
            {adding ? 'Добавляем...' : 'В корзину'}
          </Button>
        </div>

        <div className="text-center mt-4">
          <button onClick={() => navigate('/')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Вернуться к каталогу
          </button>
        </div>
      </main>

      {/* ФУТЕР */}
      <footer className="border-t border-border bg-muted/30 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 Яркая фотокнига. Все права защищены.</p>
        </div>
      </footer>

    </div>
  );
}
