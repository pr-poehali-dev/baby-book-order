import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import OrderDialog from '@/components/OrderDialog';
import { Template, fetchTemplates } from '@/lib/api';

const HERO_IMAGE = 'https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/bucket/covers/6aaa3b88a97246448b38569f828c9a6c.png';

const demoTemplates: Template[] = [
  { id: -1, title: 'Прогулки с динозаврами', description: 'Захватывающее приключение в мире доисторических ящеров', cover_url: HERO_IMAGE, price: 1990, is_published: true },
  { id: -2, title: 'Космический герой', description: 'Полёт к улыбающимся планетам и звёздам', cover_url: 'https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/files/313511ae-986a-413a-9d36-3d944fe1562e.jpg', price: 1990, is_published: true },
  { id: -3, title: 'Сказочное королевство', description: 'Принцесса, дракон и волшебный замок', cover_url: 'https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/files/100f4135-e32d-431d-bde1-49d0781862a1.jpg', price: 1990, is_published: true },
];

const steps = [
  { icon: 'BookOpen', title: 'Выберите книгу', text: 'Готовые иллюстрированные истории в нежном детском стиле' },
  { icon: 'Upload', title: 'Загрузите фото', text: 'Одно фото лица малыша — остальное сделает нейросеть' },
  { icon: 'Sparkles', title: 'Волшебство AI', text: 'Лицо ребёнка появляется на каждой странице истории' },
  { icon: 'Package', title: 'Печать 20×20 см', text: 'Готовая книга в качестве для печати, формат JPEG' },
];

const Index = () => {
  const [templates, setTemplates] = useState<Template[]>(demoTemplates);
  const [selected, setSelected] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetchTemplates(true)
      .then((data) => { if (Array.isArray(data) && data.length) setTemplates(data); })
      .catch(() => {});
  }, []);

  const openOrder = (t: Template) => { setSelected(t); setOpen(true); };

  return (
    <div className="min-h-screen overflow-x-hidden">
      <OrderDialog template={selected} open={open} onClose={() => setOpen(false)} />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container flex items-center justify-between h-20">
          <div className="flex items-center gap-2">
            <span className="text-3xl">📖</span>
            <span className="font-display font-extrabold text-2xl text-gradient">Сказка с тобой</span>
          </div>
          <nav className="hidden md:flex items-center gap-8 font-semibold text-foreground/70">
            <a href="#templates" className="hover:text-primary transition-colors">Книги</a>
            <a href="#how" className="hover:text-primary transition-colors">Как это работает</a>
            <a href="/admin" className="hover:text-primary transition-colors">Админка</a>
          </nav>
          <Button onClick={() => openOrder(templates[0])} className="rounded-full font-bold px-6">Создать книгу</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative bg-dots">
        <div className="absolute top-20 left-[8%] text-5xl animate-float hidden md:block">⭐</div>
        <div className="absolute top-40 right-[10%] text-6xl animate-float hidden md:block" style={{ animationDelay: '1.5s' }}>🌈</div>
        <div className="absolute bottom-20 left-[15%] text-4xl animate-float hidden md:block" style={{ animationDelay: '0.8s' }}>🎈</div>
        <div className="container py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 bg-accent/60 text-accent-foreground rounded-full px-4 py-2 font-bold text-sm mb-6">
              <Icon name="Wand2" size={16} /> Персональная книга за пару минут
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
              Ваш малыш — <span className="text-gradient">главный герой</span> волшебной сказки
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-md">
              Нейросеть бережно вставит лицо вашего ребёнка в иллюстрации красивой книги. Печатный формат 20×20 см.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => openOrder(templates[0])} size="lg" className="rounded-full font-bold text-lg px-8 h-14 shadow-lg shadow-primary/30">
                <Icon name="Sparkles" size={20} /> Создать книгу
              </Button>
              <a href="#templates">
                <Button size="lg" variant="outline" className="rounded-full font-bold text-lg px-8 h-14 border-2">
                  Посмотреть примеры
                </Button>
              </a>
            </div>
          </div>
          <div className="relative animate-scale-in">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/30 via-accent/30 to-secondary/40 rounded-[3rem] blur-2xl" />
            <img
              src={HERO_IMAGE}
              alt="Детская фотокнига — Прогулки с динозаврами"
              className="relative rounded-[2.5rem] shadow-2xl w-full animate-float"
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-20 bg-muted/40">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-4">Как это работает</h2>
          <p className="text-center text-muted-foreground text-lg mb-14">Четыре простых шага до собственной сказки</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.title} className="bg-card rounded-3xl p-7 text-center shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/15 flex items-center justify-center mb-5">
                  <Icon name={s.icon} className="text-primary" size={30} />
                </div>
                <div className="font-display font-bold text-xl mb-2">{s.title}</div>
                <p className="text-muted-foreground text-sm">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Templates */}
      <section id="templates" className="py-20">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-4">Выберите историю</h2>
          <p className="text-center text-muted-foreground text-lg mb-14">Готовые иллюстрированные шаблоны книг</p>
          <div className="grid md:grid-cols-3 gap-8">
            {templates.map((t, i) => (
              <div key={t.id} className="group rounded-[2rem] bg-card overflow-hidden shadow-sm hover:shadow-2xl transition-all animate-fade-in" style={{ animationDelay: `${i * 0.12}s` }}>
                <div className="overflow-hidden">
                  <img src={t.cover_url} alt={t.title} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6">
                  <h3 className="font-display font-bold text-2xl mb-1">{t.title}</h3>
                  <p className="text-muted-foreground mb-3">{t.description}</p>
                  {t.price > 0 && <div className="font-display font-extrabold text-xl text-primary mb-4">{t.price} ₽</div>}
                  <Button onClick={() => openOrder(t)} className="w-full rounded-full font-bold">Выбрать эту книгу</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-muted/40">
        <div className="container max-w-2xl text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">Готовы создать сказку?</h2>
          <p className="text-muted-foreground text-lg mb-8">Выберите книгу, загрузите фото малыша — и увидите предпросмотр сразу.</p>
          <Button onClick={() => openOrder(templates[0])} size="lg" className="rounded-full font-bold text-lg px-10 h-14 shadow-lg shadow-primary/30">
            <Icon name="Sparkles" size={20} /> Начать
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-foreground text-background py-12">
        <div className="container flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📖</span>
            <span className="font-display font-extrabold text-xl">Сказка с тобой</span>
          </div>
          <p className="text-background/60 text-sm">© 2026 Сказка с тобой. Делаем детство волшебным.</p>
          <div className="flex gap-4">
            <Icon name="Mail" size={22} className="text-background/70" />
            <Icon name="Phone" size={22} className="text-background/70" />
            <Icon name="MessageCircle" size={22} className="text-background/70" />
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;