import { useEffect, useState, FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { AlertCircle, Building2, CalendarDays } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { getIdpConfig, login, loginWithGoogle } from '../lib/api';
import type { IdPConfig } from '../lib/api';
import { clearAuthSession, getStoredAccessToken } from '../lib/apiBase';
import { resetAllCircuits } from '../lib/circuitBreaker';
import type { AuthRole } from '../lib/auth-roles';
import { cn } from '../lib/utils';

const DEMO_PASSWORD = 'ReserveHub1!';

type DemoProfile = {
  role: AuthRole;
  tabLabel: string;
  loginLabel: string;
  email: string;
};

const DEMO_PROFILES: DemoProfile[] = [
  {
    role: 'ADMIN',
    tabLabel: 'Admin',
    loginLabel: 'Administrador',
    email: 'admin@reservehub.local',
  },
  {
    role: 'MANAGER',
    tabLabel: 'Gestor',
    loginLabel: 'Gestor',
    email: 'gestor.rh@reservehub.local',
  },
  {
    role: 'EMPLOYEE',
    tabLabel: 'Colaborador',
    loginLabel: 'Colaborador',
    email: 'ana.silva@reservehub.local',
  },
];

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

function ReserveHubLogo() {
  return (
    <div className="mb-6 flex flex-col items-center">
      <div className="flex items-center gap-3">
        <div
          className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 shadow-lg shadow-slate-900/25"
          aria-hidden
        >
          <CalendarDays className="h-6 w-6 text-white" strokeWidth={2} />
          <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-blue-500 ring-2 ring-white" />
        </div>
        <div className="text-left">
          <p className="text-[1.75rem] font-bold leading-none tracking-tight">
            <span className="text-slate-900">Reserve</span>
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Hub
            </span>
          </p>
          <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
            Reservas corporativas
          </p>
        </div>
      </div>
    </div>
  );
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

  const [activeProfile, setActiveProfile] = useState<DemoProfile>(DEMO_PROFILES[0]);
  const [email, setEmail] = useState(DEMO_PROFILES[0].email);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [idp, setIdp] = useState<IdPConfig | null>(null);

  useEffect(() => {
    getIdpConfig()
      .then(setIdp)
      .catch(() => setIdp(null));
  }, []);

  if (getStoredAccessToken()) {
    return <Navigate to={afterLogin} replace />;
  }

  const selectProfile = (profile: DemoProfile) => {
    setActiveProfile(profile);
    setEmail(profile.email);
    setPassword('');
    setError('');
  };

  const submitLogin = async (loginEmail: string, loginPassword: string) => {
    setError('');
    setIsLoading(true);
    try {
      clearAuthSession();
      resetAllCircuits();
      await login(loginEmail.trim(), loginPassword);
      navigate(afterLogin, { replace: true });
    } catch (err) {
      setError(parseApiError(err, 'E-mail ou senha inválidos. Tente novamente.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submitLogin(email, password);
  };

  const handleQuickLogin = () => {
    setEmail(activeProfile.email);
    setPassword(DEMO_PASSWORD);
    void submitLogin(activeProfile.email, DEMO_PASSWORD);
  };

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() ?? '';
  const showGoogleLogin = Boolean(googleClientId || idp?.googleEnabled);

  const handleGoogleSuccess = async (credential: string) => {
    setError('');
    setIsLoading(true);
    try {
      clearAuthSession();
      resetAllCircuits();
      await loginWithGoogle(credential);
      navigate(afterLogin, { replace: true });
    } catch (err) {
      setError(
        parseApiError(
          err,
          'Não foi possível entrar com Google. Verifique se o seu e-mail está registado no sistema.',
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50/50 to-indigo-100/60 px-4 py-10">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-20 -right-16 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-24 -left-20 h-80 w-80 rounded-full bg-indigo-600/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[28rem] w-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/[0.04] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="rounded-3xl border border-blue-100/80 bg-white/95 px-8 py-10 shadow-[0_8px_40px_rgba(30,58,138,0.12)] backdrop-blur-sm">
          <ReserveHubLogo />

          <header className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Entrar na plataforma
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {idp?.enabled
                ? 'Utilize as credenciais corporativas (gestor de identidade)'
                : 'Acesse sua conta para gerenciar reservas corporativas'}
            </p>
          </header>

          {idp?.enabled && idp.authorizationUrl && (
            <a
              href={idp.authorizationUrl}
              className="mb-6 flex h-11 w-full items-center justify-center rounded-lg border border-blue-200 bg-white text-sm font-medium text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50/80"
            >
              Entrar com {idp.provider === 'keycloak' ? 'Keycloak' : 'SSO corporativo'}
            </a>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-semibold text-slate-800">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="username"
                className="h-11 w-full rounded-lg border border-slate-200/80 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-sm font-semibold text-slate-800">
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                autoComplete="current-password"
                className="h-11 w-full rounded-lg border border-slate-200/80 bg-slate-50 px-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/25 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="h-11 w-full rounded-lg bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-700 text-sm font-semibold text-white shadow-md shadow-blue-900/25 transition-all hover:from-slate-800 hover:via-blue-800 hover:to-indigo-600 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'A entrar…' : 'Entrar'}
            </button>
          </form>

          {showGoogleLogin && googleClientId && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-400">ou</span>
                </div>
              </div>
              <div className="flex flex-col items-center gap-3">
                <GoogleLogin
                  onSuccess={(res) => {
                    if (res.credential) {
                      void handleGoogleSuccess(res.credential);
                    }
                  }}
                  onError={() => {
                    setError('Falha ao autenticar com Google. Tente novamente.');
                  }}
                  theme="outline"
                  size="large"
                  text="continue_with"
                  shape="rectangular"
                  locale="pt-BR"
                  width={320}
                />
                <p className="text-center text-xs text-slate-500">
                  O e-mail da conta Google precisa estar registado no ReserveHub.
                </p>
              </div>
            </>
          )}

          <div className="mt-8 space-y-4">
            <p className="text-center text-sm text-slate-500">
              Acesso rápido para demonstração:
            </p>

            <div className="flex rounded-full bg-slate-100/90 p-1 ring-1 ring-slate-200/60">
              {DEMO_PROFILES.map((profile) => (
                <button
                  key={profile.role}
                  type="button"
                  onClick={() => selectProfile(profile)}
                  disabled={isLoading}
                  className={cn(
                    'flex-1 rounded-full py-2 text-sm font-medium transition-all',
                    activeProfile.role === profile.role
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm shadow-blue-500/30'
                      : 'text-slate-500 hover:text-slate-700',
                  )}
                >
                  {profile.tabLabel}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleQuickLogin}
              disabled={isLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-blue-200 bg-white text-sm font-medium text-slate-800 transition-colors hover:border-indigo-300 hover:bg-blue-50/60 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Building2 className="h-4 w-4 text-blue-600" />
              Login como {activeProfile.loginLabel}
            </button>
          </div>

        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          © {new Date().getFullYear()}{' '}
          <span className="font-semibold text-slate-600">Reserve</span>
          <span className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Hub
          </span>
          . Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
}
