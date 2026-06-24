import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Package,
  CheckCircle,
  Users,
  Building2,
  History,
  ChevronLeft,
  ChevronRight,
  Bell,
  Shield,
  PieChart,
  Activity,
} from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { cn } from '../../lib/utils';
import {
  canApproveReservations,
  canManageDepartments,
  canManageUsers,
  canViewCostReports,
  canViewHealthChecks,
  currentAuthRole,
} from '../../lib/auth-roles';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: null as string[] | null },
  { icon: Calendar, label: 'Agenda', path: '/agenda', roles: null },
  { icon: ClipboardList, label: 'Reservas', path: '/reservas', roles: null },
  { icon: Package, label: 'Recursos', path: '/recursos', roles: null },
  {
    icon: CheckCircle,
    label: 'Aprovações',
    path: '/aprovacoes',
    roles: ['ADMIN', 'MANAGER'],
  },
  { icon: Users, label: 'Usuários', path: '/usuarios', roles: ['ADMIN'] },
  { icon: Building2, label: 'Departamentos', path: '/departamentos', roles: ['ADMIN'] },
  { icon: History, label: 'Histórico', path: '/historico', roles: null },
  { icon: Bell, label: 'Notificações', path: '/notificacoes', roles: null },
  { icon: Shield, label: 'Auditoria', path: '/auditoria', roles: ['ADMIN', 'MANAGER'] },
  {
    icon: PieChart,
    label: 'Relatórios',
    path: '/relatorios',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    icon: Activity,
    label: 'Health Checks',
    path: '/health',
    roles: ['ADMIN'],
  },
];

function canSeeItem(roles: string[] | null): boolean {
  if (!roles) return true;
  const r = currentAuthRole();
  if (!r) return false;
  return roles.includes(r);
}

export function Sidebar({ collapsed, onToggleCollapse }: SidebarProps) {
  const location = useLocation();

  const visibleItems = menuItems.filter((item) => {
    if (item.path === '/aprovacoes') return canApproveReservations();
    if (item.path === '/usuarios') return canManageUsers();
    if (item.path === '/departamentos') return canManageDepartments();
    if (item.path === '/auditoria' || item.path === '/relatorios') {
      return canViewCostReports();
    }
    if (item.path === '/health') return canViewHealthChecks();
    return canSeeItem(item.roles);
  });

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-screen bg-white border-r border-gray-200 transition-all duration-300 z-40',
        collapsed ? 'w-16' : 'w-64',
      )}
    >
      <div className="flex flex-col h-full">
        <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
          {!collapsed && (
            <span className="font-semibold text-gray-900">Sistema Reservas</span>
          )}
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
            aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'}
          >
            {collapsed ? (
              <ChevronRight className="w-5 h-5 text-gray-600" />
            ) : (
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-3">
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;

              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group',
                      isActive
                        ? 'bg-blue-50 text-blue-600'
                        : 'text-gray-700 hover:bg-gray-100',
                    )}
                  >
                    <Icon className="w-5 h-5 shrink-0" />
                    {!collapsed && <span className="font-medium">{item.label}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </aside>
  );
}
