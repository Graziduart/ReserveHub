import type { Notificacao, RegistroAuditoria, Reserva, TipoNotificacao } from '../data/types';
import { labelForRoutingKey } from './audit-labels';
import { getStoredAuthUser } from './apiBase';
import { canApproveReservations } from './auth-roles';

const READ_KEY = 'reservehub.notifications.read';

function readIds(): Set<string> {
  try {
    const raw = localStorage.getItem(READ_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

export function markNotificationRead(id: string): void {
  const set = readIds();
  set.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

export function markAllNotificationsRead(ids: string[]): void {
  const set = readIds();
  for (const id of ids) set.add(id);
  localStorage.setItem(READ_KEY, JSON.stringify([...set]));
}

function tipoFromRoutingKey(key: string): TipoNotificacao {
  if (key.includes('rejected') || key.includes('cancelled')) return 'alerta';
  if (key.includes('approved')) return 'sucesso';
  if (key.includes('reservation')) return 'reserva';
  return 'info';
}

function linkFromRoutingKey(key: string): string | undefined {
  if (key.includes('reservation')) {
    if (key.includes('approved') || key.includes('rejected')) return '/reservas';
    return '/aprovacoes';
  }
  if (key.includes('resource')) return '/recursos';
  if (key.includes('department')) return '/departamentos';
  return '/auditoria';
}

function parseAuditPayload(reg: RegistroAuditoria): Record<string, unknown> | undefined {
  if (!reg.payloadCompleto) return undefined;
  try {
    return JSON.parse(reg.payloadCompleto) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function priorityOverrideNotifications(
  registros: RegistroAuditoria[],
  read: Set<string>,
): Notificacao[] {
  const auth = getStoredAuthUser();
  if (!auth) return [];
  const out: Notificacao[] = [];
  for (const r of registros) {
    if (!r.acao.includes('reservation.cancelled')) continue;
    const p = parseAuditPayload(r);
    if (!p?.supersededByPriority) continue;
    const reservation = p.reservation as { user?: { email?: string } } | undefined;
    const email = reservation?.user?.email;
    if (email && email.toLowerCase() === auth.email.toLowerCase()) {
      const id = `priority-override-${r.id}`;
      out.push({
        id,
        titulo: 'A sua reserva foi substituída',
        mensagem:
          'Uma reserva pendente sua foi cancelada porque outro departamento com maior prioridade reservou o mesmo horário.',
        tipo: 'alerta',
        lida: read.has(id),
        data: r.data,
        link: '/reservas',
      });
    }
  }
  return out.slice(0, 10);
}

function notificationsFromAudit(
  registros: RegistroAuditoria[],
  read: Set<string>,
): Notificacao[] {
  return registros.slice(0, 40).map((r) => {
    const payload = parseAuditPayload(r);
    return {
      id: r.id,
      titulo: labelForRoutingKey(r.acao, payload),
      mensagem: r.detalhes.length > 160 ? `${r.detalhes.slice(0, 160)}…` : r.detalhes,
      tipo: tipoFromRoutingKey(r.acao),
      lida: read.has(r.id),
      data: r.data,
      link: linkFromRoutingKey(r.acao),
    };
  });
}

function pendingApprovalNotifications(
  reservas: Reserva[],
  read: Set<string>,
): Notificacao[] {
  if (!canApproveReservations()) return [];
  const pendentes = reservas.filter((r) => r.status === 'pending');
  if (pendentes.length === 0) return [];

  const id = 'pending-approvals-summary';
  return [
    {
      id,
      titulo: 'Reservas pendentes de aprovação',
      mensagem: `${pendentes.length} reserva(s) aguardam a sua análise.`,
      tipo: 'reserva',
      lida: read.has(id),
      data: new Date().toISOString().replace('T', ' ').substring(0, 16),
      link: '/aprovacoes',
    },
  ];
}

function myReservationNotifications(
  reservas: Reserva[],
  read: Set<string>,
): Notificacao[] {
  const auth = getStoredAuthUser();
  if (!auth) return [];
  const mine = reservas.filter((r) => r.solicitanteId === auth.id);
  const out: Notificacao[] = [];

  for (const r of mine) {
    if (r.status === 'approved') {
      const id = `my-approved-${r.id}`;
      out.push({
        id,
        titulo: 'Reserva aprovada',
        mensagem: `${r.recurso} em ${r.data} foi aprovada.`,
        tipo: 'sucesso',
        lida: read.has(id),
        data: r.dataAprovacao ?? r.dataCriacao,
        link: '/reservas',
      });
    }
    if (r.status === 'rejected') {
      const id = `my-rejected-${r.id}`;
      out.push({
        id,
        titulo: 'Reserva rejeitada',
        mensagem: r.observacoes ?? `Reserva de ${r.recurso} foi rejeitada.`,
        tipo: 'alerta',
        lida: read.has(id),
        data: r.dataCriacao,
        link: '/reservas',
      });
    }
  }
  return out.slice(0, 15);
}

/** Notificações in-app derivadas de auditoria, reservas e governança (sem mock). */
export function buildNotifications(
  registrosAuditoria: RegistroAuditoria[],
  reservas: Reserva[],
): Notificacao[] {
  const read = readIds();
  const fromAudit = notificationsFromAudit(registrosAuditoria, read);
  const pending = pendingApprovalNotifications(reservas, read);
  const mine = myReservationNotifications(reservas, read);
  const priority = priorityOverrideNotifications(registrosAuditoria, read);

  const merged = [...pending, ...priority, ...mine, ...fromAudit];
  const seen = new Set<string>();
  return merged.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}
