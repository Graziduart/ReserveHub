import type {
  Departamento,
  Recurso,
  Reserva,
  RegistroAuditoria,
  ServicoAuditoria,
  StatusReserva,
  Usuario,
} from '../data/types';
import {
  apiUrl,
  fetchJson,
  setStoredAccessToken,
  setStoredRefreshToken,
  setStoredAuthUser,
  getStoredRefreshToken,
  clearAuthSession,
  RESERVEHUB_AUTH_EVENT,
} from './apiBase';
import {
  extractAuditActor,
  extractAuditTarget,
  formatAuditSummary,
} from './audit-display';

export type LoginResponse = {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresInSec?: number;
  user: ApiUser;
};

/** Autentica no IAM, grava token e utilizador no `localStorage` e notifica a app. */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetchJson<LoginResponse>(apiUrl('iam', '/auth/login'), {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setStoredAccessToken(res.accessToken);
  if (res.refreshToken) {
    setStoredRefreshToken(res.refreshToken);
  }
  const u = res.user;
  setStoredAuthUser({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.departmentId,
  });
  window.dispatchEvent(new Event(RESERVEHUB_AUTH_EVENT));
  return res;
}

/** Revoga refresh token no IAM (se existir) e limpa sessão local. */
export async function logout(): Promise<void> {
  const refresh = getStoredRefreshToken();
  if (refresh) {
    try {
      await fetchJson<{ ok: boolean }>(apiUrl('iam', '/auth/logout'), {
        method: 'POST',
        body: JSON.stringify({ refreshToken: refresh }),
      });
    } catch {
      /* limpa sessão local mesmo se o IAM estiver indisponível */
    }
  }
  clearAuthSession();
  window.dispatchEvent(new Event(RESERVEHUB_AUTH_EVENT));
}

export type ApiDepartment = {
  id: string;
  name: string;
  sigla: string;
  active: boolean;
  priority?: number;
  costCenterCode?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ApiResource = {
  id: string;
  name: string;
  type: string;
  location: string;
  description?: string | null;
  capacity?: number | null;
  category?: string | null;
  characteristics?: string[];
  requiresApproval: boolean;
  departmentId?: string | null;
  costCenterCode?: string | null;
  department?: { id: string; name: string; sigla: string };
  createdAt: string;
  updatedAt: string;
  active: boolean;
};

export type ApiReservation = {
  id: string;
  startDate: string;
  endDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  notes?: string | null;
  rejectReason?: string | null;
  approvedAt?: string | null;
  approvedById?: string | null;
  approvedBy?: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
  userId: string;
  resourceId: string;
  user?: {
    id: string;
    name: string;
    email: string;
    departmentId?: string;
    department?: { id: string; name: string; sigla: string };
  };
  resource?: {
    id: string;
    name: string;
    type: string;
    location: string;
    requiresApproval: boolean;
  };
};

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  departmentId: string;
  /** Preenchido pelo core; o IAM pode omitir. */
  department?: { id: string; name: string; sigla: string };
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
};

export type ApiAuditEvent = {
  _id: string;
  eventId: string;
  routingKey: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  receivedAt: string;
};

export function listDepartments() {
  return fetchJson<ApiDepartment[]>(apiUrl('core', '/departments'));
}

export function listResources() {
  return fetchJson<ApiResource[]>(apiUrl('core', '/resources'));
}

export function listReservations() {
  return fetchJson<ApiReservation[]>(apiUrl('core', '/reservations'));
}

export function listUsers() {
  return fetchJson<ApiUser[]>(apiUrl('iam', '/users'));
}

export function listAuditEvents(limit = 100) {
  return fetchJson<ApiAuditEvent[]>(
    apiUrl('audit', `/audit/events?limit=${limit}`),
  );
}

export type DashboardSummary = {
  key: string;
  departmentsActive: number;
  resourcesActive: number;
  reservationsByStatus: Record<string, number>;
  updatedAt: string | null;
};

export function getDashboardSummary() {
  return fetchJson<DashboardSummary>(apiUrl('data', '/cards/dashboard'));
}

export type ReservationsByDepartmentRow = {
  departamento: string;
  total: number;
};

export function getReservationsByDepartment() {
  return fetchJson<ReservationsByDepartmentRow[]>(
    apiUrl('core', '/reports/reservations-by-department'),
  );
}

export type CostReportRowApi = {
  departamento: string;
  sigla: string;
  centroCustoDept: string;
  centroCustoRecurso: string;
  recurso: string;
  reservasAprovadas: number;
  reservasPendentes: number;
  horasReservadas: number;
};

export function getCostAllocationReport(from?: string, to?: string) {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const suffix = q.toString() ? `?${q}` : '';
  return fetchJson<CostReportRowApi[]>(
    apiUrl('core', `/reports/cost-allocation${suffix}`),
  );
}

export function createDepartment(body: {
  name: string;
  sigla: string;
  priority?: number;
  costCenterCode?: string;
}) {
  return fetchJson<ApiDepartment>(apiUrl('core', '/departments'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateDepartment(
  id: string,
  body: { name: string; sigla: string; priority?: number; costCenterCode?: string },
) {
  return fetchJson<ApiDepartment>(apiUrl('core', `/departments/${id}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function disableDepartment(id: string) {
  return fetchJson<{ message?: string }>(apiUrl('core', `/departments/${id}`), {
    method: 'DELETE',
  });
}

export function createResource(body: {
  name: string;
  type: string;
  location: string;
  requiresApproval: boolean;
  departmentId?: string;
  costCenterCode?: string;
  description?: string;
  capacity?: number;
  category?: string;
  characteristics?: string[];
  active?: boolean;
}) {
  return fetchJson<ApiResource>(apiUrl('core', '/resources'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateResource(
  id: string,
  body: {
    name: string;
    type: string;
    location: string;
    requiresApproval: boolean;
    departmentId?: string;
    costCenterCode?: string;
    description?: string;
    capacity?: number;
    category?: string;
    characteristics?: string[];
    active?: boolean;
  },
) {
  return fetchJson<ApiResource>(apiUrl('core', `/resources/${id}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function disableResource(id: string) {
  return fetchJson<{ message?: string }>(apiUrl('core', `/resources/${id}`), {
    method: 'DELETE',
  });
}

export function checkReservationAvailability(
  resourceId: string,
  startDate: string,
  endDate: string,
) {
  const q = new URLSearchParams({ resourceId, startDate, endDate });
  return fetchJson<{ available: boolean; canOverridePending: boolean }>(
    apiUrl('core', `/reservations/availability?${q}`),
  );
}

export function createReservation(body: {
  userId?: string;
  resourceId: string;
  startDate: string;
  endDate: string;
  notes?: string;
}) {
  return fetchJson<ApiReservation>(apiUrl('core', '/reservations'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateReservation(
  id: string,
  body: { startDate?: string; endDate?: string; notes?: string },
) {
  return fetchJson<ApiReservation>(apiUrl('core', `/reservations/${id}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function approveReservation(id: string) {
  return fetchJson<ApiReservation>(apiUrl('core', `/reservations/${id}/approve`), {
    method: 'POST',
  });
}

export function rejectReservation(id: string, rejectReason: string) {
  return fetchJson<ApiReservation>(apiUrl('core', `/reservations/${id}/reject`), {
    method: 'POST',
    body: JSON.stringify({ rejectReason }),
  });
}

export function cancelReservation(id: string) {
  return fetchJson<ApiReservation>(apiUrl('core', `/reservations/${id}/cancel`), {
    method: 'POST',
  });
}

export function createUser(body: {
  name: string;
  email: string;
  password: string;
  role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
  departmentId: string;
}) {
  return fetchJson<ApiUser>(apiUrl('iam', '/users'), {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function updateUser(
  id: string,
  body: Partial<{
    name: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'EMPLOYEE';
    departmentId: string;
    active: boolean;
  }>,
) {
  return fetchJson<ApiUser>(apiUrl('iam', `/users/${id}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export function deleteUser(id: string) {
  return fetchJson<{ ok: boolean }>(apiUrl('iam', `/users/${id}`), {
    method: 'DELETE',
  });
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

const statusMap: Record<string, StatusReserva> = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

export function mapDepartment(
  d: ApiDepartment,
  userCount: number,
  gestorLabel = '—',
): Departamento {
  return {
    id: d.id,
    nome: d.name,
    sigla: d.sigla,
    gestor: gestorLabel,
    totalFuncionarios: userCount,
    ativo: d.active,
    priority: d.priority ?? 50,
    costCenterCode: d.costCenterCode ?? undefined,
  };
}

export function mapResource(r: ApiResource): Recurso {
  return {
    id: r.id,
    nome: r.name,
    tipo: r.type,
    categoria: r.category ?? r.type,
    capacidade: r.capacity ?? undefined,
    localizacao: r.location,
    descricao: r.description ?? '',
    disponivel: r.active,
    caracteristicas: r.characteristics ?? [],
    requiresApproval: r.requiresApproval,
    departmentId: r.departmentId ?? undefined,
    departmentNome: r.department?.name,
    costCenterCode: r.costCenterCode ?? undefined,
  };
}

export function mapReservation(
  r: ApiReservation,
  deptByUserId: Map<string, string>,
): Reserva {
  const start = new Date(r.startDate);
  const end = new Date(r.endDate);
  const data = `${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
  const horaInicio = `${pad2(start.getHours())}:${pad2(start.getMinutes())}`;
  const horaFim = `${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
  const created = new Date(r.createdAt);
  const dataCriacao = `${created.getFullYear()}-${pad2(created.getMonth() + 1)}-${pad2(created.getDate())} ${pad2(created.getHours())}:${pad2(created.getMinutes())}`;
  const approved = r.approvedAt ? new Date(r.approvedAt) : null;
  const dataAprovacao = approved
    ? `${approved.getFullYear()}-${pad2(approved.getMonth() + 1)}-${pad2(approved.getDate())} ${pad2(approved.getHours())}:${pad2(approved.getMinutes())}`
    : undefined;

  return {
    id: r.id,
    recursoId: r.resourceId,
    recurso: r.resource?.name ?? '',
    solicitanteId: r.userId,
    solicitante: r.user?.name ?? '',
    departamento:
      r.user?.department?.name?.trim() ||
      deptByUserId.get(r.userId)?.trim() ||
      '',
    data,
    horaInicio,
    horaFim,
    motivo: r.notes ?? '',
    status: statusMap[r.status] ?? 'pending',
    observacoes: r.rejectReason ?? undefined,
    aprovador:
      r.approvedBy?.name ??
      (r.status === 'APPROVED' || r.status === 'REJECTED' ? '—' : undefined),
    dataAprovacao,
    dataCriacao,
  };
}

function roleToCargo(role: ApiUser['role']): string {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'MANAGER') return 'Gestor';
  return 'Colaborador';
}

export function mapUser(u: ApiUser): Usuario {
  const perfil: Usuario['perfil'] =
    u.role === 'ADMIN'
      ? 'administrador'
      : u.role === 'MANAGER'
        ? 'gestor'
        : 'funcionario';
  return {
    id: u.id,
    nome: u.name,
    email: u.email,
    departamento: u.department?.name?.trim() ?? '',
    departmentId: u.departmentId,
    cargo: roleToCargo(u.role),
    perfil,
    ativo: u.active ?? true,
  };
}

function routingKeyToServico(rk: string): ServicoAuditoria {
  if (rk.startsWith('data.')) return 'data';
  if (rk.startsWith('audit.')) return 'audit';
  if (rk.startsWith('web.')) return 'web';
  return 'core';
}

export function mapAuditEvent(ev: ApiAuditEvent, index: number): RegistroAuditoria {
  const p = ev.payload ?? {};
  const payloadCompleto = JSON.stringify(p, null, 2);
  const target = extractAuditTarget(p);
  const util = extractAuditActor(p);
  const resumo = formatAuditSummary(p, ev.routingKey);
  const when = ev.receivedAt || ev.occurredAt;
  const d = new Date(when);
  const data = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
  return {
    id: ev.eventId || `${ev._id}-${index}`,
    data,
    utilizador: util,
    acao: ev.routingKey,
    entidade: target.label,
    entidadeId: target.id,
    detalhes: resumo,
    payloadCompleto,
    origemIp: undefined,
    servico: routingKeyToServico(ev.routingKey),
  };
}
