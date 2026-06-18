import { Button } from "@/components/ui/button";
import Icon from "@/components/ui/icon";
import { Template } from "@/lib/api";
import { User } from "@/lib/api";

interface CartItem { id: number }

interface IndexViewProps {
  user: User | null;
  cartItems: CartItem[];
  templates: Template[];
  heroImage: string;
  steps: { icon: string; title: string; text: string }[];
  onOpenOrder: (t: Template) => void;
}

export default function IndexView({ user, cartItems, templates, heroImage, steps, onOpenOrder }: IndexViewProps) {
  return (
    <div className="min-h-screen overflow-x-hidden">

      {/* ======== ХЕДЕР ======== */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-background/80 border-b border-border">
        <div className="container flex items-center justify-between h-20">

          {/* Логотип */}
          <div className="flex items-center gap-2">
            <span className="text-3xl">📖</span>
            <span className="font-display font-extrabold text-2xl text-gradient">
              Яркая фотокнига
            </span>
          </div>

          {/* Навигация */}
          <nav className="hidden md:flex items-center gap-8 font-semibold text-foreground/70">
            <a href="#templates" className="hover:text-primary transition-colors">Книги</a>
            <a href="#how" className="hover:text-primary transition-colors">Как это работает</a>
          </nav>

          {/* Кнопки справа */}
          <div className="flex items-center gap-2">
            {user ? (
              <>
                {/* Корзина */}
                <a href="/cart">
                  <Button variant="outline" size="sm" className="rounded-full gap-1.5 relative">
                    <Icon name="ShoppingCart" size={16} />
                    {cartItems.length > 0 && (
                      <span className="bg-primary text-primary-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {cartItems.length}
                      </span>
                    )}
                  </Button>
                </a>
                {/* Личный кабинет */}
                <a href="/account">
                  <Button variant="ghost" size="sm" className="rounded-full gap-1.5">
                    <Icon name="User" size={16} /> {user.name || 'Кабинет'}
                  </Button>
                </a>
              </>
            ) : (
              /* Кнопка входа */
              <a href="/login">
                <Button variant="outline" size="sm" className="rounded-full gap-1.5">
                  <Icon name="LogIn" size={16} /> Войти
                </Button>
              </a>
            )}
            {/* Главная CTA-кнопка */}
            <Button onClick={() => onOpenOrder(templates[0])} className="rounded-full font-bold px-6">
              Создать книгу
            </Button>
          </div>

        </div>
      </header>

      {/* ======== ГЕРОЙ (главный экран) ======== */}
      <section className="relative bg-dots">
        {/* Декоративные элементы */}
        <div className="absolute top-20 left-[8%] text-5xl animate-float hidden md:block">⭐</div>
        <div className="absolute top-40 right-[10%] text-6xl animate-float hidden md:block" style={{ animationDelay: "1.5s" }}>🌈</div>
        <div className="absolute bottom-20 left-[15%] text-4xl animate-float hidden md:block" style={{ animationDelay: "0.8s" }}>🎈</div>

        <div className="container py-20 md:py-28 grid md:grid-cols-2 gap-12 items-center">
          {/* Левая колонка: текст */}
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
              <Button onClick={() => onOpenOrder(templates[0])} size="lg" className="rounded-full font-bold text-lg px-8 h-14 shadow-lg shadow-primary/30">
                <Icon name="Sparkles" size={20} /> Создать книгу
              </Button>
              <a href="#templates">
                <Button size="lg" variant="outline" className="rounded-full font-bold text-lg px-8 h-14 border-2">
                  Посмотреть примеры
                </Button>
              </a>
            </div>
          </div>

          {/* Правая колонка: картинка */}
          <div className="relative animate-scale-in">
            <div className="absolute -inset-4 bg-gradient-to-tr from-primary/30 via-accent/30 to-secondary/40 rounded-[3rem] blur-2xl" />
            <img
              src={heroImage}
              alt="Детская фотокнига — Прогулки с динозаврами"
              className="relative rounded-[2.5rem] shadow-2xl w-full animate-float"
            />
          </div>
        </div>
      </section>

      {/* ======== КАК ЭТО РАБОТАЕТ ======== */}
      <section id="how" className="py-20 bg-muted/40">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-4">Как это работает</h2>
          <p className="text-center text-muted-foreground text-lg mb-14">Четыре простых шага до собственной сказки</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="bg-card rounded-3xl p-7 text-center shadow-sm hover:shadow-xl hover:-translate-y-2 transition-all animate-fade-in"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
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

      {/* ======== КАТАЛОГ ШАБЛОНОВ ======== */}
      <section id="templates" className="py-20">
        <div className="container">
          <h2 className="text-4xl md:text-5xl font-extrabold text-center mb-4">Выберите историю</h2>
          <p className="text-center text-muted-foreground text-lg mb-14">Готовые иллюстрированные шаблоны книг</p>
          <div className="grid md:grid-cols-3 gap-8">
            {templates.map((t, i) => (
              <div
                key={t.id}
                className="group rounded-[2rem] bg-card overflow-hidden shadow-sm hover:shadow-2xl transition-all animate-fade-in"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                {/* Обложка */}
                <div className="overflow-hidden">
                  <img
                    src={t.cover_url}
                    alt={t.title}
                    className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                {/* Описание */}
                <div className="p-6">
                  <h3 className="font-display font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                    {t.title}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-5 line-clamp-2">{t.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-xl text-primary">{t.price}₽</span>
                    <Button onClick={() => onOpenOrder(t)} size="sm" className="rounded-full">
                      <Icon name="ArrowRight" size={16} />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ======== ФУТЕР ======== */}
      <footer className="border-t border-border bg-muted/30 py-8">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2024 Яркая фотокнига. Все права защищены.</p>
        </div>
      </footer>

    </div>
  );
}
