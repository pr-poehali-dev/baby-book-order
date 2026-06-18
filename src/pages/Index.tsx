import { useEffect, useState } from "react";
import OrderDialog from "@/components/OrderDialog";
import { Template, fetchTemplates } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import IndexView from "./IndexView";

// ======== КАРТИНКИ ========
const HERO_IMAGE =
  "https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/bucket/covers/6aaa3b88a97246448b38569f828c9a6c.png";

// ======== ШАБЛОНЫ-ЗАГЛУШКИ (пока не загрузились с сервера) ========
const demoTemplates: Template[] = [
  {
    id: -1,
    title: "Прогулки с динозаврами",
    description: "Захватывающее приключение в мире доисторических ящеров",
    cover_url: HERO_IMAGE,
    price: 1990,
    is_published: true,
  },
  {
    id: -2,
    title: "Космический герой",
    description: "Полёт к улыбающимся планетам и звёздам",
    cover_url:
      "https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/files/313511ae-986a-413a-9d36-3d944fe1562e.jpg",
    price: 1990,
    is_published: true,
  },
  {
    id: -3,
    title: "Сказочное королевство",
    description: "Принцесса, дракон и волшебный замок",
    cover_url:
      "https://cdn.poehali.dev/projects/df9297ce-0250-4216-8aa4-94bdb09db7dc/files/100f4135-e32d-431d-bde1-49d0781862a1.jpg",
    price: 1990,
    is_published: true,
  },
];

// ======== ШАГИ "КАК ЭТО РАБОТАЕТ" ========
const steps = [
  { icon: "BookOpen", title: "Выберите книгу",   text: "Готовые иллюстрированные истории в нежном детском стиле" },
  { icon: "Upload",   title: "Загрузите фото",   text: "Одно фото лица малыша — остальное сделает нейросеть" },
  { icon: "Sparkles", title: "Волшебство AI",     text: "Лицо ребёнка появляется на каждой странице истории" },
  { icon: "Package",  title: "Печать 20×20 см",  text: "Готовая книга в качестве для печати, формат JPEG" },
];

// ======== ЛОГИКА СТРАНИЦЫ ========
const Index = () => {
  const { user } = useAuth();
  const { items } = useCart();
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
    <>
      <OrderDialog template={selected} open={open} onClose={() => setOpen(false)} />
      <IndexView
        user={user}
        cartItems={items}
        templates={templates}
        heroImage={HERO_IMAGE}
        steps={steps}
        onOpenOrder={openOrder}
      />
    </>
  );
};

export default Index;
