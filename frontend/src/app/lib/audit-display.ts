import type { RegistroAuditoria, ServicoAuditoria } from '../data/types';
import {
  labelForRoutingKey,
  routingKeyToLogTipo,
  type ActivityLogTipo,
} from './audit-labels';

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function extractAuditActor(payload: Record<string, unknown>): string {
  const direct = pickString(
    payload.actorEmail,
    payload.approvedByEmail,
    payload.rejectedByEmail,
    payload.userEmail,
  );
  if (direct) return direct;

  const reservation = asRecord(payload.reservation);
  const user = reservation ? asRecord(reservation.user) : null;
  const fromReservation = pickString(user?.email, user?.name);
  if (fromReservation) return fromReservation;

  const actorId = pickString(
    payload.actorId,
    payload.approvedById,
    payload.rejectedById,
    payload.cancelledById,
    payload.userId,
  );
  if (actorId) return actorId;

  return 'Sistema';
}

export function extractAuditTarget(
  payload: Record<string, unknown>,
): { label: string; id?: string } {
  const department = asRecord(payload.department);
  if (department) {
    const name = pickString(department.name) ?? 'Departamento';
    const sigla = pickString(department.sigla);
    return {
      label: sigla ? `${name} (${sigla})` : name,
      id: pickString(department.id),
    };
  }

  const resource = asRecord(payload.resource);
  if (resource) {
    return {
      label: pickString(resource.name, resource.type) ?? 'Recurso',
      id: pickString(resource.id),
    };
  }

  const reservation = asRecord(payload.reservation);
  if (reservation) {
    const nestedResource = asRecord(reservation.resource);
    const resourceName = pickString(nestedResource?.name) ?? 'Reserva';
    const start = pickString(reservation.startDate);
    const end = pickString(reservation.endDate);
    const status = pickString(reservation.status);
    const parts = [resourceName];
    if (start) parts.push(formatDateShort(start));
    if (end && end !== start) parts.push(`→ ${formatDateShort(end)}`);
    if (status) parts.push(status);
    return {
      label: parts.join(' · '),
      id: pickString(reservation.id),
    };
  }

  return {
    label: pickString(payload.entity) ?? '—',
    id: pickString(payload.entityId, payload.reservationId),
  };
}

export function formatAuditSummary(
  payload: Record<string, unknown>,
  routingKey: string,
): string {
  const parts: string[] = [];

  const previousStatus = pickString(payload.previousStatus);
  const reservation = asRecord(payload.reservation);
  const currentStatus = pickString(reservation?.status);
  if (previousStatus && currentStatus && previousStatus !== currentStatus) {
    parts.push(`${previousStatus} → ${currentStatus}`);
  } else if (currentStatus) {
    parts.push(`Estado: ${currentStatus}`);
  }

  const reason = pickString(payload.reason, payload.rejectReason, reservation?.rejectReason);
  if (reason) parts.push(`Motivo: ${reason}`);

  if (payload.supersededByPriority === true) {
    parts.push('Substituída por departamento com maior prioridade');
  }

  const notes = pickString(reservation?.notes);
  if (notes) parts.push(notes.length > 80 ? `${notes.slice(0, 80)}…` : notes);

  if (parts.length === 0) {
    if (routingKey.includes('department.')) return 'Alteração registada no departamento.';
    if (routingKey.includes('resource.')) return 'Alteração registada no recurso.';
    if (routingKey.includes('reservation.')) return 'Alteração registada na reserva.';
  }

  return parts.join(' · ') || '—';
}

export type AuditTableRow = {
  id: string;
  data: string;
  utilizador: string;
  acao: string;
  acaoLabel: string;
  tipo: ActivityLogTipo;
  alvo: string;
  entidadeId?: string;
  resumo: string;
  payloadCompleto: string;
  servico: ServicoAuditoria;
  origemIp?: string;
};

export function toAuditTableRow(record: RegistroAuditoria): AuditTableRow {
  let payload: Record<string, unknown> | undefined;
  if (record.payloadCompleto) {
    try {
      payload = JSON.parse(record.payloadCompleto) as Record<string, unknown>;
    } catch {
      payload = undefined;
    }
  }
  return {
    id: record.id,
    data: record.data,
    utilizador: record.utilizador,
    acao: record.acao,
    acaoLabel: labelForRoutingKey(record.acao, payload),
    tipo: routingKeyToLogTipo(record.acao),
    alvo: record.entidade,
    entidadeId: record.entidadeId,
    resumo: record.detalhes,
    payloadCompleto: record.payloadCompleto ?? record.detalhes,
    servico: record.servico,
    origemIp: record.origemIp,
  };
}
