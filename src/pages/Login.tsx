import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { authSendCode, authVerifyCode } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const YANDEX_CLIENT_ID = import.meta.env.VITE_YANDEX_CLIENT_ID || '';
const VK_CLIENT_ID = import.meta.env.VITE_VK_CLIENT_ID || '';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendCode = async () => {
    if (!phone.trim()) return setError('Введите номер телефона');
    setError('');
    setLoading(true);
    try {
      await authSendCode(phone.trim());
      setStep('code');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) return setError('Введите код из SMS');
    setError('');
    setLoading(true);
    try {
      const sid = await authVerifyCode(phone.trim(), code.trim());
      await login(sid);
      navigate('/account');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Неверный код');
    } finally {
      setLoading(false);
    }
  };

  const handleYandex = () => {
    const redirect = `${window.location.origin}/oauth/yandex`;
    window.location.href = `https://oauth.yandex.ru/authorize?response_type=code&client_id=${YANDEX_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirect)}`;
  };

  const handleVK = () => {
    const redirect = `${window.location.origin}/oauth/vk`;
    window.location.href = `https://oauth.vk.com/authorize?client_id=${VK_CLIENT_ID}&display=page&redirect_uri=${encodeURIComponent(redirect)}&response_type=code&v=5.131`;
  };

  return (
    <div className="min-h-screen bg-dots flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <a href="/" className="flex items-center gap-2 justify-center mb-8">
          <span className="text-3xl">📖</span>
          <span className="font-display font-extrabold text-2xl text-gradient">Яркая фотокнига</span>
        </a>

        <div className="bg-card rounded-3xl p-8 shadow-xl border border-border">
          <h1 className="font-display font-bold text-2xl mb-2 text-center">Войти в аккаунт</h1>
          <p className="text-muted-foreground text-sm text-center mb-6">
            {step === 'phone' ? 'Введите номер телефона' : `Код отправлен на ${phone}`}
          </p>

          {step === 'phone' ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+7 900 000 00 00"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendCode()}
                  className="mt-1"
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button onClick={handleSendCode} disabled={loading} className="w-full rounded-full font-bold" size="lg">
                {loading ? 'Отправляем...' : 'Получить код SMS'}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label htmlFor="code">Код из SMS</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  placeholder="0000"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleVerify()}
                  className="mt-1 text-center text-2xl tracking-widest"
                />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button onClick={handleVerify} disabled={loading} className="w-full rounded-full font-bold" size="lg">
                {loading ? 'Проверяем...' : 'Войти'}
              </Button>
              <Button variant="ghost" onClick={() => { setStep('phone'); setCode(''); setError(''); }} className="w-full">
                Изменить номер
              </Button>
            </div>
          )}

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">или войти через</span></div>
          </div>

          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={handleYandex} className="w-full rounded-full gap-2" disabled={!YANDEX_CLIENT_ID}>
              <span className="text-lg">Я</span> Яндекс ID
            </Button>
            <Button variant="outline" onClick={handleVK} className="w-full rounded-full gap-2" disabled={!VK_CLIENT_ID}>
              <Icon name="Users" size={18} /> ВКонтакте
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
