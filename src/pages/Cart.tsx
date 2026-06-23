import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { useCart } from '@/context/CartContext';
import { API, getSessionId } from '@/lib/api';
import { CartItem } from '@/context/CartContext';
import { toast } from 'sonner';

async function downloadBookZip(item: CartItem) {
  const bookName = `${item.child_name}_${item.template.title}`;
  const res = await fetch(API.export_book, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getSessionId()}` },
    body: JSON.stringify({ urls: item.preview_urls, book_name: bookName }),
  });
  if (!res.ok) { toast.error('Ошибка выгрузки'); return; }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${bookName}.zip`; a.click();
  URL.revokeObjectURL(url);
}

export default function Cart() {
  const { user, loading } = useAuth();
  const { items, total, removeFromCart, refresh } = useCart();
  const navigate = useNavigate();
  const [exportingId, setExportingId] = useState<number | null>(null);

  const handleExport = async (item: CartItem) => {
    setExportingId(item.id);
    await downloadBookZip(item);
    setExportingId(null);
  };

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  useEffect(() => { refresh(); }, []);

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-display font-extrabold text-xl text-gradient">Яркая фотокнига</span>
          </a>
          <a href="/account">
            <Button variant="ghost" size="sm" className="rounded-full gap-2">
              <Icon name="User" size={16} /> Кабинет
            </Button>
          </a>
        </div>
      </header>

      <div className="container py-8 max-w-2xl">
        <h1 className="font-display font-bold text-3xl mb-6">Корзина</h1>

        {items.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Icon name="ShoppingCart" size={48} className="mx-auto mb-4 opacity-30" />
            <p className="mb-4">Корзина пуста</p>
            <a href="/"><Button className="rounded-full">Выбрать книгу</Button></a>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-6">
              {items.map(item => (
                <div key={item.id} className="bg-card rounded-2xl p-4 border border-border flex gap-4 items-center">
                  <img
                    src={item.preview_urls[0] || item.template.cover_url}
                    alt={item.template.title}
                    className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{item.template.title}</p>
                    <p className="text-sm text-muted-foreground">Для: {item.child_name}</p>
                    <p className="text-sm font-bold text-primary mt-1">{item.template.price}₽</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {user?.role === 'admin' && (
                      <Button
                        variant="outline"
                        size="icon"
                        title="Выгрузить для печати (ZIP)"
                        disabled={exportingId === item.id}
                        onClick={() => handleExport(item)}
                        className="text-muted-foreground"
                      >
                        {exportingId === item.id
                          ? <Icon name="Loader2" size={16} className="animate-spin" />
                          : <Icon name="Download" size={16} />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => removeFromCart(item.id)}
                    >
                      <Icon name="Trash2" size={18} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card rounded-2xl p-6 border border-border">
              <div className="flex justify-between items-center mb-4">
                <span className="text-muted-foreground">Итого ({items.length} {items.length === 1 ? 'книга' : 'книги'}):</span>
                <span className="font-display font-bold text-2xl text-primary">{total}₽</span>
              </div>
              <Button className="w-full rounded-full font-bold" size="lg">
                <Icon name="CreditCard" size={18} /> Оформить заказ
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3">Формат 20×20 см · JPEG для печати</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}