/** Rótulos amigáveis para routing keys do Rabbit / audit. */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  'core.department.created': 'Departamento criado',
  'core.department.updated': 'Departamento atualizado',
  'core.department.disabled': 'Departamento desativado',
  'core.resource.created': 'Recurso criado',
  'core.resource.updated': 'Recurso atualizado',
  'core.resource.disabled': 'Recurso desativado',
  'core.reservation.created': 'Reserva criada',
  'core.reservation.updated': 'Reserva atualizada',
  'core.reservation.approved': 'Reserva aprovada',
  'core.reservation.rejected': 'Reserva rejeitada',
  'core.reservation.cancelled': 'Reserva cancelada',
};

export function labelForRoutingKey(key: string, payload?: Record<string, unknown>): string {
  if (key.includes('reservation.cancelled') && payload?.supersededByPriority) {
    return 'Reserva cancelada por prioridade de departamento';
  }
  return AUDIT_ACTION_LABELS[key] ?? key;
}

export type ActivityLogTipo =
  | 'reserva_criada'
  | 'reserva_aprovada'
  | 'reserva_rejeitada'
  | 'reserva_cancelada'
  | 'recurso_criado'
  | 'usuario_criado'
  | 'departamento'
  | 'auditoria';

export function routingKeyToLogTipo(key: string): ActivityLogTipo {
  if (key.includes('reservation.created')) return 'reserva_criada';
  if (key.includes('reservation.approved')) return 'reserva_aprovada';
  if (key.includes('reservation.rejected')) return 'reserva_rejeitada';
  if (key.includes('reservation.cancelled')) return 'reserva_cancelada';
  if (key.includes('resource.')) return 'recurso_criado';
  if (key.includes('department.')) return 'departamento';
  return 'auditoria';
}
