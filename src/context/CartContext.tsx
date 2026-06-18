import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { cartAction } from '@/lib/api';
import { useAuth } from './AuthContext';

export interface CartItem {
  id: number;
  child_name: string;
  preview_urls: string[];
  created_at: string;
  template: { id: number; title: string; cover_url: string; price: number };
}

interface CartContextType {
  items: CartItem[];
  total: number;
  loading: boolean;
  addToCart: (templateId: number, childName: string, previewUrls: string[]) => Promise<void>;
  removeFromCart: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!user) { setItems([]); setTotal(0); return; }
    setLoading(true);
    try {
      const data = await cartAction('get');
      setItems(data.items || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (templateId: number, childName: string, previewUrls: string[]) => {
    await cartAction('add', { template_id: templateId, child_name: childName, preview_urls: previewUrls });
    await refresh();
  };

  const removeFromCart = async (id: number) => {
    await cartAction('remove', { id });
    await refresh();
  };

  useEffect(() => { refresh(); }, [user]);

  return (
    <CartContext.Provider value={{ items, total, loading, addToCart, removeFromCart, refresh }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be inside CartProvider');
  return ctx;
}
