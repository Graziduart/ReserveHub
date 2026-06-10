import { Navigate } from 'react-router';
import type { AuthRole } from '../../lib/auth-roles';
import { currentAuthRole } from '../../lib/auth-roles';

type RequireRoleProps = {
  roles: AuthRole[];
  children: React.ReactNode;
  redirectTo?: string;
};

/** Redireciona se o utilizador não tiver um dos papéis exigidos. */
export function RequireRole({
  roles,
  children,
  redirectTo = '/',
}: RequireRoleProps) {
  const role = currentAuthRole();
  if (!role || !roles.includes(role)) {
    return <Navigate to={redirectTo} replace />;
  }
  return <>{children}</>;
}
