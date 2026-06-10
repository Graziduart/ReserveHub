import { useState, useEffect, useRef, FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { AlertCircle } from 'lucide-react';
import { login } from '../lib/api';
import { getStoredAccessToken } from '../lib/apiBase';

function parseApiError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const t = err.message;
  try {
    const j = JSON.parse(t) as { message?: string | string[] };
    if (Array.isArray(j.message)) return j.message.join(', ');
    if (typeof j.message === 'string') return j.message;
  } catch {
    /* not JSON */
  }
  return t || fallback;
}

function redirectAfterLogin(from: unknown): string {
  const loc = from as { pathname?: string } | null | undefined;
  const path = loc?.pathname;
  if (path && path !== '/login' && path.startsWith('/')) {
    return path;
  }
  return '/';
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const afterLogin = redirectAfterLogin(location.state?.from);
  const emailRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  if (getStoredAccessToken()) {
    return <Navigate to={afterLogin} replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(email.trim(), password);
      navigate(afterLogin, { replace: true });
    } catch (err) {
      setError(parseApiError(err, 'E-mail ou senha inválidos. Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-gray-900">Sistema de Reservas</h1>
          <p className="text-gray-600 mt-2">Acesse sua conta corporativa</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Entrar</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              <Input
                ref={emailRef}
                type="email"
                label="E-mail corporativo"
                placeholder="seu.email@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />

              <Input
                type="password"
                label="Senha"
                placeholder="Digite sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs font-medium text-blue-900 mb-1">Desenvolvimento:</p>
              <p className="text-xs text-blue-800">
                Execute primeiro o seed do core (departamento), depois o seed do IAM. Credenciais: admin@reservehub.local / ReserveHub1!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
