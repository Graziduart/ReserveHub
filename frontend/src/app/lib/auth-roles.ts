import { getStoredAuthUser } from './apiBase';

export type AuthRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export function currentAuthRole(): AuthRole | null {
  const u = getStoredAuthUser();
  if (!u) return null;
  if (u.role === 'ADMIN' || u.role === 'MANAGER' || u.role === 'EMPLOYEE') {
    return u.role;
  }
  return null;
}

export function canManageUsers(): boolean {
  return currentAuthRole() === 'ADMIN';
}

export function canApproveReservations(): boolean {
  const r = currentAuthRole();
  return r === 'ADMIN' || r === 'MANAGER';
}

export function canManageDepartments(): boolean {
  return currentAuthRole() === 'ADMIN';
}

export function canViewCostReports(): boolean {
  const r = currentAuthRole();
  return r === 'ADMIN' || r === 'MANAGER';
}

export function canManageResources(): boolean {
  return currentAuthRole() === 'ADMIN';
}

export function canViewAudit(): boolean {
  const r = currentAuthRole();
  return r === 'ADMIN' || r === 'MANAGER';
}
