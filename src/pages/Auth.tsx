import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Shield, Eye, EyeOff, Loader2, UserCog, UserCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

const signupSchema = loginSchema.extend({
  nome: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'),
  token: z.string().min(4, 'Token de convite é obrigatório'),
});

export default function Auth() {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [token, setToken] = useState('');
  const [permissions, setPermissions] = useState({
    access_dashboard: true,
    access_telegram: true,
    access_calls: true,
    access_rankings: true,
    access_reports: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      if (isLogin) {
        const validation = loginSchema.safeParse({ email, password });
        if (!validation.success) {
          const fieldErrors: Record<string, string> = {};
          validation.error.errors.forEach((err) => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: 'Erro de autenticação',
              description: 'Email ou senha incorretos.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Erro',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          toast({
            title: 'Bem-vindo!',
            description: 'Login realizado com sucesso.',
          });
          navigate('/dashboard');
        }
      } else {
        const validation = signupSchema.safeParse({ email, password, nome, token });
        if (!validation.success) {
          const fieldErrors: Record<string, string> = {};
          validation.error.errors.forEach((err) => {
            if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
          });
          setErrors(fieldErrors);
          setLoading(false);
          return;
        }

        const { error, data } = await signUp(email, password, nome, token);
        if (error) {
          if (error.message.includes('User already registered')) {
            toast({
              title: 'Usuário já cadastrado',
              description: 'Este email já está em uso. Tente fazer login.',
              variant: 'destructive',
            });
          } else {
            toast({
              title: 'Erro no cadastro',
              description: error.message,
              variant: 'destructive',
            });
          }
        } else {
          if (data.session) {
            // User is logged in immediately (Email confirmation disabled)

            // If newly created user is a fiscalizador (token role applied in trigger)
            // We save default set of permissions. 
            // Note: The role is applied in trigger, so here we just ensure permissions record exists.
            if (data.user) {
              const { data: profileData } = await (supabase
                .from('profiles') as any)
                .select('role')
                .eq('id', data.user.id)
                .single();

              if (profileData && profileData.role === 'fiscalizador') {
                const { error: permError } = await (supabase
                  .from('user_permissions') as any)
                  .insert({
                    user_id: data.user.id,
                    ...permissions
                  });

                if (permError) {
                  console.error('Error saving permissions:', permError);
                }
              }
            }

            toast({
              title: 'Conta criada!',
              description: 'Login realizado com sucesso.',
            });
            navigate('/dashboard');
          } else {
            // No session means Email Confirmation is still enabled in Supabase
            toast({
              title: 'Confirmação necessária',
              description: 'Para entrar direto, desative "Confirm email" no Supabase (Auth > Providers > Email). Ou verifique seu email.',
              duration: 10000,
            });
            setIsLogin(true);
          }
        }
      }
    } catch (err) {
      toast({
        title: 'Erro inesperado',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  return (
    <div className="min-h-screen w-full flex">
      {/* Left Column (Hero) - Only visible on large screens */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#050a14] relative items-center justify-center p-12 overflow-hidden border-r border-white/5">
        {/* Abstract Background Effects */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent opacity-40" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[128px] animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[128px] delay-1000" />

        <div className="relative z-10 flex flex-col items-center max-w-lg text-center space-y-8 animate-fade-in">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-green-600 flex items-center justify-center shadow-2xl shadow-primary/20 p-4 mb-4">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain brightness-0 invert" />
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl font-bold tracking-tight text-white">
              Fiscalização MSA
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Plataforma inteligente para gestão e fiscalização de processos corporativos modernos.
            </p>
          </div>
        </div>
      </div>

      {/* Right Column (Form) */}
      <div className={`w-full lg:w-1/2 flex flex-col justify-center p-8 lg:p-12 relative transition-colors duration-300 ${theme === 'dark' ? 'dark bg-[#02050b] text-white' : 'bg-white text-gray-900'}`}>
        <div className="w-full max-w-[400px] mx-auto space-y-8">

          <div className="space-y-2 text-left">
            <h2 className={`text-3xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
              {isLogin ? 'Bem-vindo de volta' : 'Crie sua conta'}
            </h2>
            <p className="text-muted-foreground">
              {isLogin
                ? 'Insira suas credenciais para acessar o painel.'
                : 'Preencha os dados abaixo para começar.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="nome" className="text-sm font-medium">Nome completo</Label>
                  <Input
                    id="nome"
                    type="text"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    disabled={loading}
                    className="bg-secondary/10 border-input/20 h-10"
                  />
                  {errors.nome && <p className="text-sm text-destructive">{errors.nome}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token" className="text-sm font-medium">Token de Convite</Label>
                  <Input
                    id="token"
                    type="text"
                    placeholder="Token de acesso"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    disabled={loading}
                    className="bg-secondary/10 border-input/20 h-10 font-mono"
                  />
                  {errors.token && <p className="text-sm text-destructive">{errors.token}</p>}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="bg-secondary/10 border-input/20 h-10"
              />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                {isLogin && (
                  <button type="button" className="text-xs text-primary hover:text-green-400 font-medium transition-colors">
                    Esqueceu a senha?
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  className="bg-secondary/10 border-input/20 h-10 pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full text-muted-foreground hover:text-white hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            {isLogin && (
              <div className="flex items-center space-x-2">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    className="h-4 w-4 rounded border-white/20 bg-secondary/10 text-primary focus:ring-primary focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 accent-primary"
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-muted-foreground"
                  >
                    Manter conectado
                  </label>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-green-600 text-black font-semibold h-11 transition-all duration-300 shadow-lg shadow-primary/20 hover:shadow-primary/40 mt-6"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : isLogin ? (
                'Entrar na conta'
              ) : (
                'Criar conta'
              )}
            </Button>
          </form>

          <div className="text-center pt-4">
            <p className="text-sm text-muted-foreground">
              {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'} {' '}
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                }}
                className="text-primary hover:text-green-400 font-medium transition-colors"
              >
                {isLogin ? 'Cadastre-se agora' : 'Faça login'}
              </button>
            </p>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground/60 uppercase tracking-wider pt-8 pb-4">
            <button
              onClick={toggleTheme}
              className={`transition-colors flex items-center gap-1 ${theme === 'dark' ? 'hover:text-white text-muted-foreground' : 'hover:text-black text-gray-600'}`}
            >
              <span className="text-sm">{theme === 'dark' ? '☀️' : '🌙'}</span> {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
