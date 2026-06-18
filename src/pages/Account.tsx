import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { useAuth } from '@/context/AuthContext';
import { profileAction } from '@/lib/api';

interface Order {
  id: number;
  child_name: string;
  status: string;
  total_price: number;
  created_at: string;
  template_title: string;
  template_cover: string;
}

interface Preview {
  id: number;
  child_name: string;
  image_urls: string[];
  created_at: string;
  template_title: string;
}

const STATUS_LABELS: Record<string, string> = {
  new: 'Новый',
  processing: 'В обработке',
  done: 'Готов',
  cancelled: 'Отменён',
};

export default function Account() {
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [previews, setPreviews] = useState<Preview[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate('/login');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    setName(user.name || '');
    setEmail(user.email || '');
    profileAction('get-orders').then(d => setOrders(d.orders || []));
    profileAction('get-previews').then(d => setPreviews(d.previews || []));
  }, [user]);

  const handleSaveProfile = async () => {
    setSaving(true);
    await profileAction('update-profile', { name, email });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <a href="/" className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-display font-extrabold text-xl text-gradient">Яркая фотокнига</span>
          </a>
          <div className="flex items-center gap-3">
            <a href="/cart">
              <Button variant="outline" size="sm" className="rounded-full gap-2">
                <Icon name="ShoppingCart" size={16} /> Корзина
              </Button>
            </a>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="rounded-full gap-2 text-muted-foreground">
              <Icon name="LogOut" size={16} /> Выйти
            </Button>
          </div>
        </div>
      </header>

      <div className="container py-8 max-w-3xl">
        <h1 className="font-display font-bold text-3xl mb-6">Личный кабинет</h1>

        <Tabs defaultValue="profile">
          <TabsList className="mb-6 rounded-full">
            <TabsTrigger value="profile" className="rounded-full">Профиль</TabsTrigger>
            <TabsTrigger value="orders" className="rounded-full">Заказы</TabsTrigger>
            <TabsTrigger value="previews" className="rounded-full">Превью</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="bg-card rounded-3xl p-6 border border-border space-y-4">
              <div>
                <Label>Телефон</Label>
                <Input value={user.phone || '—'} disabled className="mt-1 opacity-60" />
              </div>
              <div>
                <Label htmlFor="name">Имя</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Ваше имя" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" className="mt-1" />
              </div>
              <Button onClick={handleSaveProfile} disabled={saving} className="rounded-full font-bold">
                {saved ? '✓ Сохранено' : saving ? 'Сохраняем...' : 'Сохранить'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="orders">
            {orders.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Icon name="Package" size={48} className="mx-auto mb-4 opacity-30" />
                <p>Заказов пока нет</p>
                <a href="/"><Button className="mt-4 rounded-full">Выбрать книгу</Button></a>
              </div>
            ) : (
              <div className="space-y-4">
                {orders.map(o => (
                  <div key={o.id} className="bg-card rounded-2xl p-4 border border-border flex gap-4 items-center">
                    {o.template_cover && (
                      <img src={o.template_cover} alt={o.template_title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{o.template_title}</p>
                      <p className="text-sm text-muted-foreground">Для: {o.child_name}</p>
                      <p className="text-sm text-muted-foreground">{new Date(o.created_at).toLocaleDateString('ru-RU')}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-bold text-primary">{o.total_price}₽</p>
                      <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{STATUS_LABELS[o.status] || o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="previews">
            {previews.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                <Icon name="Image" size={48} className="mx-auto mb-4 opacity-30" />
                <p>Сохранённых превью нет</p>
              </div>
            ) : (
              <div className="space-y-6">
                {previews.map(p => (
                  <div key={p.id} className="bg-card rounded-2xl p-4 border border-border">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <p className="font-bold">{p.template_title}</p>
                        <p className="text-sm text-muted-foreground">Для: {p.child_name} · {new Date(p.created_at).toLocaleDateString('ru-RU')}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {p.image_urls.map((url, i) => (
                        <a key={i} href={url} download={`превью-${i + 1}.jpg`} target="_blank" rel="noreferrer">
                          <img src={url} alt={`Страница ${i + 1}`} className="rounded-xl w-full aspect-square object-cover hover:opacity-80 transition-opacity" />
                        </a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
