import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { JwtUserPayload } from '../../auth/jwt-user.payload';

export function resolveBookingUserId(
  actor: JwtUserPayload,
  requestedUserId?: string,
): string {
  if (actor.role === Role.ADMIN) {
    if (!requestedUserId) {
      return actor.sub;
    }
    return requestedUserId;
  }
  if (actor.role === Role.MANAGER) {
    if (!requestedUserId || requestedUserId === actor.sub) {
      return actor.sub;
    }
    return requestedUserId;
  }
  if (requestedUserId && requestedUserId !== actor.sub) {
    throw new ForbiddenException('Employees can only book for themselves');
  }
  return actor.sub;
}

/** Gestor só pode reservar para utilizadores do mesmo departamento (validar após carregar user). */
export function assertManagerCanBookForUser(
  actor: JwtUserPayload,
  targetUser: { id: string; departmentId: string },
): void {
  if (actor.role === Role.ADMIN) {
    return;
  }
  if (actor.role === Role.MANAGER && targetUser.departmentId === actor.departmentId) {
    return;
  }
  if (actor.role === Role.EMPLOYEE && targetUser.id === actor.sub) {
    return;
  }
  throw new ForbiddenException(
    'You cannot create reservations for users outside your department',
  );
}

export function assertCanApproveOrReject(
  actor: JwtUserPayload,
  reservationUser: { departmentId: string },
): void {
  if (actor.role === Role.ADMIN) {
    return;
  }
  if (
    actor.role === Role.MANAGER &&
    reservationUser.departmentId === actor.departmentId
  ) {
    return;
  }
  throw new ForbiddenException(
    'Only managers of the requester department or administrators can approve',
  );
}

export function assertCanCancel(
  actor: JwtUserPayload,
  reservation: { userId: string; user: { departmentId: string } },
): void {
  if (actor.role === Role.ADMIN) {
    return;
  }
  if (actor.sub === reservation.userId) {
    return;
  }
  if (
    actor.role === Role.MANAGER &&
    reservation.user.departmentId === actor.departmentId
  ) {
    return;
  }
  throw new ForbiddenException('You cannot cancel this reservation');
}

export function applyReservationListScope(
  actor: JwtUserPayload,
  filters: { userId?: string; departmentId?: string },
): { userId?: string; departmentId?: string } {
  if (actor.role === Role.ADMIN) {
    return filters;
  }
  if (actor.role === Role.EMPLOYEE) {
    return { userId: actor.sub };
  }
  return { departmentId: actor.departmentId, userId: filters.userId };
}
