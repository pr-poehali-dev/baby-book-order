import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { authLoginPassword, authRegister, authSendCode, authVerifyCode } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

const YANDEX_CLIENT_ID = import.meta.env.VITE_YANDEX_CLIENT_ID || '';
const VK_CLIENT_ID = import.meta.env.VITE_VK_CLIENT_ID || '';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Вход по паролю
  const [loginVal, setLoginVal] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Регистрация
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regPass2, setRegPass2] = useState('');

  // SMS
  const [smsPhone, setSmsPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [smsStep, setSmsStep] = useState<'phone' | 'code'>('phone');

  const go = async (sid: string) => { await login(sid); navigate('/account'); };

  const handleLoginPassword = async () => {
    setError('');
    if (!loginVal || !loginPass) return setError('Заполните все поля');
    setLoading(true);
    try { go(await authLoginPassword(loginVal, loginPass)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const handleRegister = async () => {
    setError('');
    if (!regName || !regPass) return setError('Укажите имя и пароль');
    if (!regEmail && !regPhone) return setError('Укажите email или телефон');
    if (regPass !== regPass2) return setError('Пароли не совпадают');
    setLoading(true);
    try { go(await authRegister({ name: regName, email: regEmail, phone: regPhone, password: regPass })); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const handleSmsSend = async () => {
    setError('');
    if (!smsPhone) return setError('Введите номер телефона');
    setLoading(true);
    try { await authSendCode(smsPhone); setSmsStep('code'); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Ошибка'); }
    finally { setLoading(false); }
  };

  const handleSmsVerify = async () => {
    setError('');
    if (!smsCode) return setError('Введите код из SMS');
    setLoading(true);
    try { go(await authVerifyCode(smsPhone, smsCode)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Неверный код'); }
    finally { setLoading(false); }
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
          <Tabs defaultValue="login" onValueChange={() => setError('')}>
            <TabsList className="w-full mb-6 rounded-full">
              <TabsTrigger value="login" className="flex-1 rounded-full">Войти</TabsTrigger>
              <TabsTrigger value="register" className="flex-1 rounded-full">Регистрация</TabsTrigger>
              <TabsTrigger value="sms" className="flex-1 rounded-full">SMS</TabsTrigger>
            </TabsList>

            {/* ── ВХОД ПО ПАРОЛЮ ─────────────────────────── */}
            <TabsContent value="login" className="space-y-4">
              <div>
                <Label htmlFor="login-val">Email или телефон</Label>
                <Input id="login-val" value={loginVal} onChange={e => setLoginVal(e.target.value)}
                  placeholder="email@example.com" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="login-pass">Пароль</Label>
                <Input id="login-pass" type="password" value={loginPass} onChange={e => setLoginPass(e.target.value)}
                  placeholder="••••••••" className="mt-1"
                  onKeyDown={e => e.key === 'Enter' && handleLoginPassword()} />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button onClick={handleLoginPassword} disabled={loading} className="w-full rounded-full font-bold" size="lg">
                {loading ? 'Входим...' : 'Войти'}
              </Button>
            </TabsContent>

            {/* ── РЕГИСТРАЦИЯ ────────────────────────────── */}
            <TabsContent value="register" className="space-y-4">
              <div>
                <Label htmlFor="reg-name">Имя пользователя *</Label>
                <Input id="reg-name" value={regName} onChange={e => setRegName(e.target.value)}
                  placeholder="Иван Иванов" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" type="email" value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  placeholder="email@example.com" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="reg-phone">Телефон</Label>
                <Input id="reg-phone" type="tel" value={regPhone} onChange={e => setRegPhone(e.target.value)}
                  placeholder="+7 900 000 00 00" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="reg-pass">Пароль *</Label>
                <Input id="reg-pass" type="password" value={regPass} onChange={e => setRegPass(e.target.value)}
                  placeholder="Минимум 6 символов" className="mt-1" />
              </div>
              <div>
                <Label htmlFor="reg-pass2">Повторите пароль *</Label>
                <Input id="reg-pass2" type="password" value={regPass2} onChange={e => setRegPass2(e.target.value)}
                  placeholder="••••••••" className="mt-1"
                  onKeyDown={e => e.key === 'Enter' && handleRegister()} />
              </div>
              {error && <p className="text-destructive text-sm">{error}</p>}
              <Button onClick={handleRegister} disabled={loading} className="w-full rounded-full font-bold" size="lg">
                {loading ? 'Создаём аккаунт...' : 'Зарегистрироваться'}
              </Button>
            </TabsContent>

            {/* ── ВХОД ПО SMS ────────────────────────────── */}
            <TabsContent value="sms" className="space-y-4">
              {smsStep === 'phone' ? (
                <>
                  <div>
                    <Label htmlFor="sms-phone">Номер телефона</Label>
                    <Input id="sms-phone" type="tel" value={smsPhone} onChange={e => setSmsPhone(e.target.value)}
                      placeholder="+7 900 000 00 00" className="mt-1"
                      onKeyDown={e => e.key === 'Enter' && handleSmsSend()} />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button onClick={handleSmsSend} disabled={loading} className="w-full rounded-full font-bold" size="lg">
                    {loading ? 'Отправляем...' : 'Получить код SMS'}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground text-center">Код отправлен на {smsPhone}</p>
                  <div>
                    <Label htmlFor="sms-code">Код из SMS</Label>
                    <Input id="sms-code" inputMode="numeric" maxLength={6} value={smsCode}
                      onChange={e => setSmsCode(e.target.value)}
                      placeholder="0000" className="mt-1 text-center text-2xl tracking-widest"
                      onKeyDown={e => e.key === 'Enter' && handleSmsVerify()} />
                  </div>
                  {error && <p className="text-destructive text-sm">{error}</p>}
                  <Button onClick={handleSmsVerify} disabled={loading} className="w-full rounded-full font-bold" size="lg">
                    {loading ? 'Проверяем...' : 'Войти'}
                  </Button>
                  <Button variant="ghost" onClick={() => { setSmsStep('phone'); setSmsCode(''); setError(''); }} className="w-full">
                    Изменить номер
                  </Button>
                </>
              )}
            </TabsContent>
          </Tabs>

          {/* Соцсети */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center text-xs text-muted-foreground"><span className="bg-card px-2">или войти через</span></div>
          </div>
          <div className="flex flex-col gap-3">
            <Button variant="outline" onClick={handleYandex} className="w-full rounded-full gap-2" disabled={!YANDEX_CLIENT_ID}>
              <span className="text-lg font-bold">Я</span> Яндекс ID
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
