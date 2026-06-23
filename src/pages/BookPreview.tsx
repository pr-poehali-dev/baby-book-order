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

const MAX_REGENS = 2;

export default function BookPreview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, addToCart } = useCart();

  const [order, setOrder] = useState<OrderData | null>(null);
  const [stage, setStage] = useState<Stage>('generate');
  const [totalPages, setTotalPages] = useState(0);
  const [pages, setPages] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]); // оригинальные URL шаблона
  const [regenCount, setRegenCount] = useState<number[]>([]); // счётчик попыток на страницу
  const [regenLoading, setRegenLoading] = useState<boolean[]>([]); // спиннер на страницу
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

        const srcs: string[] = templatePages.length > 0
          ? templatePages.map((p: { image_url: string }) => p.image_url)
          : [full.cover_url || order.photoUrl];

        setTotalPages(srcs.length);
        setSources(srcs);
        setPages(srcs);
        setRegenCount(new Array(srcs.length).fill(0));
        setRegenLoading(new Array(srcs.length).fill(false));

        setStage('done');
        sessionStorage.removeItem('bookOrder');
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setErrorMsg(msg);
        setStage('error');
      }
    })();
  }, [order]);

  const handleRegen = async (pageIdx: number) => {
    if (!order) return;
    if (regenCount[pageIdx] >= MAX_REGENS) return;

    setRegenLoading(prev => { const a = [...prev]; a[pageIdx] = true; return a; });
    try {
      const newUrl = await faceSwap(order.photoUrl, sources[pageIdx]);
      setPages(prev => { const a = [...prev]; a[pageIdx] = newUrl; return a; });
      setRegenCount(prev => { const a = [...prev]; a[pageIdx]++; return a; });
    } catch {
      toast.error('Не удалось перегенерировать страницу');
    } finally {
      setRegenLoading(prev => { const a = [...prev]; a[pageIdx] = false; return a; });
    }
  };

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

  // Показываем клиенту только обложку + первые 2 разворота
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

        {/* Загрузка */}
        {stage === 'generate' && (
          <div className="text-center space-y-6 py-16">
            <div className="animate-wobble text-6xl">🪄</div>
            <h1 className="font-display font-extrabold text-3xl">
              Создаём книгу для {order?.childName}...
            </h1>
            <p className="text-muted-foreground">Это займёт несколько секунд</p>
            {totalPages > 0 && (
              <div className="max-w-xs mx-auto space-y-2">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full animate-pulse w-1/2" />
                </div>
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

            {/* Страницы */}
            <div className="space-y-6 mb-8">
              {previewPages.map((src, i) => {
                const count = regenCount[i] ?? 0;
                const loading = regenLoading[i] ?? false;
                const attemptsLeft = MAX_REGENS - count;
                const canRegen = attemptsLeft > 0;

                return (
                  <div key={i} className="rounded-2xl overflow-hidden border border-border shadow-sm">
                    <div className="relative">
                      <img src={src} alt={labels[i]} className="w-full object-contain" />
                      {loading && (
                        <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                          <div className="text-center space-y-2">
                            <Icon name="Loader2" size={32} className="animate-spin text-primary mx-auto" />
                            <p className="text-sm font-semibold">Перегенерируем...</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
                      <p className="text-xs font-semibold text-muted-foreground">{labels[i]}</p>
                      <button
                        onClick={() => handleRegen(i)}
                        disabled={!canRegen || loading}
                        className={`flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full transition-all ${
                          canRegen && !loading
                            ? 'bg-primary text-primary-foreground hover:opacity-90 shadow-sm'
                            : 'bg-muted text-muted-foreground cursor-not-allowed'
                        }`}
                      >
                        <Icon name="RefreshCw" size={14} className={loading ? 'animate-spin' : ''} />
                        {canRegen ? `Перегенерировать (осталось ${attemptsLeft})` : 'Лимит исчерпан'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Плашка об остальных разворотах */}
            {totalPages > 3 && (
              <div className="flex items-start gap-3 bg-muted/50 border border-border rounded-2xl px-5 py-4 mb-8">
                <Icon name="Lock" size={18} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold">Ещё {totalPages - 3} {totalPages - 3 === 1 ? 'разворот доступен' : 'разворота доступны'} после оформления заказа</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Все страницы книги откроются сразу после оплаты</p>
                </div>
              </div>
            )}

            {/* CTA */}
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
          <div className="text-center space-y-4 py-16">
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