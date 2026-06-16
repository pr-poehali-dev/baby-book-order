import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';

const templates = [
  {
    title: 'Волшебный лес',
    desc: 'Приключение среди добрых лесных зверят',
    img: 'https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/files/0cbcbed0-f539-487a-8567-b8431c4f7610.jpg',
  },
  {
    title: 'Космический герой',
    desc: 'Полёт к улыбающимся планетам и звёздам',
    img: 'https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/files/313511ae-986a-413a-9d36-3d944fe1562e.jpg',
  },
  {
    title: 'Сказочное королевство',
    desc: 'Принцесса, дракон и волшебный замок',
    img: 'https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/files/100f4135-e32d-431d-bde1-49d0781862a1.jpg',
  },
];

const steps = [
  { icon: 'BookOpen', title: 'Выберите книгу', text: 'Готовые иллюстрированные истории в нежном детском стиле' },
  { icon: 'Upload', title: 'Загрузите фото', text: 'Одно фото лица малыша — остальное сделает нейросеть' },
  { icon: 'Sparkles', title: 'Волшебство AI', text: 'Лицо ребёнка появляется на каждой странице истории' },
  { icon: 'Package', title: 'Печать 20×20 см', text: 'Готовая книга в качестве для печати, формат JPEG' },
];

const Index = () => {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [fileName, setFileName] = useState('');

  return (
    <div className="min-h-screen overflow-x-hidden">
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
            <a href="#create" className="hover:text-primary transition-colors">Создать</a>
          </nav>
          <Button className="rounded-full font-bold px-6">Войти</Button>
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
              <Button size="lg" className="rounded-full font-bold text-lg px-8 h-14 shadow-lg shadow-primary/30">
                <Icon name="Sparkles" size={20} /> Создать книгу
              </Button>
              <Button size="lg" variant="outline" className="rounded-full font-bold text-lg px-8 h-14 border-2">
                Посмотреть примеры
              </Button>
            </div>
          </div>
          <div className="relative animate-scale-in">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/30 via-accent/30 to-secondary/40 rounded-[3rem] blur-2xl" />
            <img
              src="https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/files/0cbcbed0-f539-487a-8567-b8431c4f7610.jpg"
              alt="Детская фотокнига"
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
              <div key={t.title} className="group rounded-[2rem] bg-card overflow-hidden shadow-sm hover:shadow-2xl transition-all animate-fade-in" style={{ animationDelay: `${i * 0.12}s` }}>
                <div className="overflow-hidden">
                  <img src={t.img} alt={t.title} className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6">
                  <h3 className="font-display font-bold text-2xl mb-1">{t.title}</h3>
                  <p className="text-muted-foreground mb-5">{t.desc}</p>
                  <Button className="w-full rounded-full font-bold">Выбрать эту книгу</Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Create form */}
      <section id="create" className="py-20 bg-muted/40">
        <div className="container max-w-2xl">
          <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-4">Создайте свою книгу</h2>
          <p className="text-center text-muted-foreground text-lg mb-12">Загрузите фото и расскажите немного о малыше</p>
          <div className="bg-card rounded-[2.5rem] p-8 md:p-10 shadow-xl">
            <Label className="font-bold text-base mb-3 block">Фото ребёнка</Label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-primary/40 rounded-3xl p-10 cursor-pointer hover:bg-primary/5 transition-colors mb-6">
              <Icon name="ImagePlus" className="text-primary mb-3" size={40} />
              <span className="font-semibold text-foreground/80">{fileName || 'Нажмите, чтобы загрузить фото'}</span>
              <span className="text-sm text-muted-foreground mt-1">JPG или PNG, хорошо видно лицо</span>
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name || '')} />
            </label>
            <div className="grid sm:grid-cols-2 gap-5 mb-8">
              <div>
                <Label className="font-bold text-base mb-2 block">Имя ребёнка</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Например, Соня" className="rounded-2xl h-12 border-2" />
              </div>
              <div>
                <Label className="font-bold text-base mb-2 block">Возраст</Label>
                <Input value={age} onChange={(e) => setAge(e.target.value)} type="number" placeholder="5" className="rounded-2xl h-12 border-2" />
              </div>
            </div>
            <Button size="lg" className="w-full rounded-full font-bold text-lg h-14 shadow-lg shadow-primary/30">
              <Icon name="Sparkles" size={20} /> Создать книгу с AI
            </Button>
          </div>
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
