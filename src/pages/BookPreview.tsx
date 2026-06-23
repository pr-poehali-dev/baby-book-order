import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { toast } from 'sonner';
import { createOrder, fetchTemplate, faceSwap } from '@/lib/api';

interface OrderData {
  photoUrl: string;
  templateId: number;
  templateTitle: string;
  templatePrice: number;
  childName: string;
  childAge: number;
  hairColor: string;
  eyeColor: string;
  email: string;
}

type Stage = 'generate' | 'done' | 'error';

export default function BookPreview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, addToCart } = useCart();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [stage, setStage] = useState<Stage>('generate');
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const started = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem('bookOrder');
    if (!raw) { navigate('/'); return; }
    try {
      const data: OrderData = JSON.parse(raw);
      setOrder(data);
    } catch { navigate('/'); }
  }, [navigate]);

  useEffect(() => {
    if (!order || started.current) return;
    started.current = true;

    (async () => {
      try {
        await createOrder({
          template_id: order.templateId,
          child_name: order.childName,
          child_age: order.childAge,
          child_photo_url: order.photoUrl,
          customer_email: order.email,
        });

        const full = await fetchTemplate(order.templateId);
        const templatePages = full.pages?.filter((p: { image_url?: string }) => p.image_url) || [];

        const sources: string[] = templatePages.length > 0
          ? templatePages.map((p: { image_url: string }) => p.image_url)
          : [full.cover_url || order.photoUrl];

        setTotalPages(sources.length);

        const resultPages: string[] = [];
        for (let i = 0; i < sources.length; i++) {
          setCurrentPage(i + 1);
          const swapped = await faceSwap(order.photoUrl, sources[i]);
          resultPages.push(swapped);
          setPages([...resultPages]);
        }

        setStage('done');
        sessionStorage.removeItem('bookOrder');
        sessionStorage.setItem('bookPreview', JSON.stringify({
          pages: resultPages,
          templateId: order.templateId,
          templateTitle: order.templateTitle,
          templatePrice: order.templatePrice,
          childName: order.childName,
        }));
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
        setStage('error');
      }
    })();
  }, [order]);

  const handleAddToCart = async () => {
    if (!user) { navigate('/login'); return; }
    if (!order) return;
    setAdding(true);
    try {
      await addToCart(order.templateId, order.childName, pages);
      toast.success('Книга добавлена в корзину!');
      sessionStorage.removeItem('bookPreview');
      navigate('/cart');
    } catch {
      toast.error('Не удалось добавить в корзину');
    } finally {
      setAdding(false);
    }
  };

  const previewPages = pages.slice(0, 3);
  const labels = ['Обложка', 'Разворот 1', 'Разворот 2'];

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

        {/* Генерация */}
        {stage === 'generate' && (
          <div className="text-center space-y-8">
            <div className="animate-wobble text-6xl">🪄</div>
            <div>
              <h1 className="font-display font-extrabold text-3xl mb-2">
                Создаём книгу для {order?.childName}...
              </h1>
              <p className="text-muted-foreground">Это займёт около минуты</p>
            </div>

            {/* Прогресс страниц */}
            {totalPages > 0 && (
              <div className="max-w-xs mx-auto space-y-2">
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>Страниц обработано</span>
                  <span>{currentPage} / {totalPages}</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(currentPage / totalPages) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Страницы появляются по мере генерации */}
            {previewPages.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {previewPages.map((src, i) => (
                  <div key={i} className="rounded-2xl overflow-hidden border border-border shadow-sm">
                    <img src={src} alt={labels[i]} className="w-full aspect-square object-cover" />
                    <p className="text-center text-xs font-semibold text-muted-foreground py-2">{labels[i]}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Готово */}
        {stage === 'done' && (
          <>
            <div className="text-center mb-8">
              <div className="text-4xl mb-3">🎉</div>
              <h1 className="font-display font-extrabold text-3xl mb-2">
                Книга для {order?.childName} готова!
              </h1>
              <p className="text-muted-foreground">«{order?.templateTitle}» · предпросмотр</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              {previewPages.map((src, i) => (
                <div key={i} className="rounded-2xl overflow-hidden border border-border shadow-sm">
                  <img src={src} alt={labels[i]} className="w-full aspect-square object-cover" />
                  <p className="text-center text-xs font-semibold text-muted-foreground py-2">{labels[i]}</p>
                </div>
              ))}
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="font-bold text-lg">Полная книга — {order?.templatePrice} ₽</p>
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
          </>
        )}

        {/* Ошибка */}
        {stage === 'error' && (
          <div className="text-center space-y-4">
            <div className="text-5xl">😔</div>
            <h1 className="font-display font-bold text-2xl">Что-то пошло не так</h1>
            <p className="text-muted-foreground text-sm">{errorMsg}</p>
            <Button onClick={() => navigate('/')} variant="outline" className="rounded-full">
              ← Вернуться к каталогу
            </Button>
          </div>
        )}

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
