import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, authMe, authLogout, setSessionId, clearSessionId } from '@/lib/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (sessionId: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const u = await authMe();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (sessionId: string) => {
    setSessionId(sessionId);
    await refresh();
  };

  const logout = async () => {
    await authLogout();
    clearSessionId();
    setUser(null);
  };

  useEffect(() => { refresh(); }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
