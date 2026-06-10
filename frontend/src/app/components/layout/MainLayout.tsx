import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { cn } from '../../lib/utils';
import { useApp } from '../../context/AppContext';
import { getStoredAccessToken } from '../../lib/apiBase';

export function MainLayout() {
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { loading, error, warnings, refreshData } = useApp();

  if (!getStoredAccessToken()) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <Topbar sidebarCollapsed={sidebarCollapsed} />

      {error && (
        <div
          className={cn(
            'fixed top-16 z-50 right-0 px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-800 flex items-center justify-between gap-4',
            sidebarCollapsed ? 'left-16' : 'left-64',
          )}
        >
          <span className="truncate">{error}</span>
          <button
            type="button"
            className="shrink-0 text-red-700 underline font-medium"
            onClick={() => void refreshData()}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {!error && warnings.length > 0 && (
        <div
          className={cn(
            'fixed top-16 z-40 right-0 px-4 py-2 bg-amber-50 border-b border-amber-200 text-sm text-amber-900',
            sidebarCollapsed ? 'left-16' : 'left-64',
          )}
        >
          {warnings.join(' ')}
        </div>
      )}

      <main
        className={cn(
          'pt-16 transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64',
        )}
      >
        <div className="p-6">
          {loading && (
            <p className="text-sm text-gray-500 mb-4">A carregar dados do servidor…</p>
          )}
          <Outlet />
        </div>
      </main>
    </div>
  );
}
