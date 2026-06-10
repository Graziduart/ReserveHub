/** Routing keys publicados pelo core (exchange topic `reservehub.events`). */
export const CORE_EVENTS = {
  DEPARTMENT_CREATED: 'core.department.created',
  DEPARTMENT_UPDATED: 'core.department.updated',
  DEPARTMENT_DISABLED: 'core.department.disabled',
  RESOURCE_CREATED: 'core.resource.created',
  RESOURCE_UPDATED: 'core.resource.updated',
  RESOURCE_DISABLED: 'core.resource.disabled',
  RESERVATION_CREATED: 'core.reservation.created',
  RESERVATION_UPDATED: 'core.reservation.updated',
  RESERVATION_APPROVED: 'core.reservation.approved',
  RESERVATION_REJECTED: 'core.reservation.rejected',
  RESERVATION_CANCELLED: 'core.reservation.cancelled',
} as const;

export type CoreRoutingKey =
  (typeof CORE_EVENTS)[keyof typeof CORE_EVENTS];
