import { useEffect, useState, type FormEvent } from 'react';
import { Bell, LogOut, Search } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { logout } from '../../lib/api';
import {
  getStoredAuthUser,
  RESERVEHUB_AUTH_EVENT,
  type StoredAuthUser,
} from '../../lib/apiBase';
import { Button } from '../ui/button';

interface TopbarProps {
  sidebarCollapsed: boolean;
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function roleLabel(role: string): string {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'MANAGER') return 'Gestor';
  if (role === 'EMPLOYEE') return 'Funcionário';
  return role;
}

export function Topbar({ sidebarCollapsed }: TopbarProps) {
  const navigate = useNavigate();
  const { notificacoes, reservas, recursos, usuarios } = useApp();
  const naoLidas = notificacoes.filter((n) => !n.lida).length;
  const [authUser, setAuthUser] = useState<StoredAuthUser | null>(() => getStoredAuthUser());
  const [search, setSearch] = useState('');

  useEffect(() => {
    const sync = () => setAuthUser(getStoredAuthUser());
    window.addEventListener(RESERVEHUB_AUTH_EVENT, sync);
    return () => window.removeEventListener(RESERVEHUB_AUTH_EVENT, sync);
  }, []);

  const displayName = authUser?.name ?? 'Utilizador';
  const displayRole = authUser ? roleLabel(authUser.role) : '—';

  const handleLogout = () => {
    void logout().then(() => navigate('/login', { replace: true }));
  };

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    const lower = q.toLowerCase();
    const matchReserva = reservas.some((r) =>
      [r.recurso, r.solicitante, r.departamento, r.motivo].join(' ').toLowerCase().includes(lower),
    );
    const matchRecurso = recursos.some((r) =>
      [r.nome, r.tipo, r.localizacao, r.categoria].join(' ').toLowerCase().includes(lower),
    );
    const matchUsuario = usuarios.some((u) =>
      [u.nome, u.email, u.departamento].join(' ').toLowerCase().includes(lower),
    );
    if (matchReserva) {
      navigate(`/reservas?busca=${encodeURIComponent(q)}`);
    } else if (matchRecurso) {
      navigate(`/recursos?busca=${encodeURIComponent(q)}`);
    } else if (matchUsuario) {
      navigate(`/usuarios?busca=${encodeURIComponent(q)}`);
    } else {
      navigate(`/reservas?busca=${encodeURIComponent(q)}`);
    }
  };

  return (
    <header
      className={cn(
        'fixed top-0 right-0 h-16 bg-white border-b border-gray-200 transition-all duration-300 z-30',
        sidebarCollapsed ? 'left-16' : 'left-64',
      )}
    >
      <div className="h-full px-6 flex items-center justify-between">
        <form className="flex-1 max-w-md" onSubmit={handleSearch}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar reservas, recursos ou utilizadores…"
              className="w-full h-10 pl-10 pr-4 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </form>

        <div className="flex items-center gap-4">
          <Link
            to="/notificacoes"
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label={`Notificações${naoLidas ? `, ${naoLidas} não lidas` : ''}`}
          >
            <Bell className="w-5 h-5 text-gray-600" />
            {naoLidas > 0 && (
              <span className="absolute top-1.5 right-1.5 min-w-[8px] h-2 px-0.5 bg-red-500 rounded-full" />
            )}
          </Link>

          <div className="flex items-center gap-3 pl-4 border-l border-gray-200">
            <div className="text-right">
              <div className="font-medium text-sm text-gray-900">{displayName}</div>
              <div className="text-xs text-gray-500">{displayRole}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="font-medium text-white text-sm">
                {initialsFromName(displayName)}
              </span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-gray-600"
              onClick={handleLogout}
              aria-label="Sair"
              title="Sair"
            >
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
