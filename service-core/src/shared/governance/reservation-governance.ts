import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ReservationStatus, Role } from '@prisma/client';
import type { JwtUserPayload } from '../../auth/jwt-user.payload';

/** RN-04: prazo mínimo antes do início para cancelamento (horas). */
export const CANCEL_MIN_LEAD_HOURS = 1;

const CANCEL_MIN_LEAD_MS = CANCEL_MIN_LEAD_HOURS * 60 * 60 * 1000;

/** Verifica se ainda é permitido cancelar (≥ 1 h antes do início). */
export function canCancelBeforeDeadline(
  startDate: Date,
  now: Date = new Date(),
): boolean {
  return startDate.getTime() - now.getTime() >= CANCEL_MIN_LEAD_MS;
}

/** RN-04: bloqueia cancelamento dentro do prazo mínimo. */
export function assertCancelDeadline(
  startDate: Date,
  now: Date = new Date(),
): void {
  if (!canCancelBeforeDeadline(startDate, now)) {
    throw new BadRequestException(
      `Reservas só podem ser canceladas até ${CANCEL_MIN_LEAD_HOURS} hora(s) antes do início`,
    );
  }
}

export type ConflictWithPriority = {
  id: string;
  status: ReservationStatus;
  departmentPriority: number;
};

/** Separa conflitos bloqueantes vs pendentes que podem ser sobrepostos por prioridade maior. */
export function partitionConflictsByPriority(
  requesterPriority: number,
  conflicts: ConflictWithPriority[],
): { blocking: ConflictWithPriority[]; overridablePending: ConflictWithPriority[] } {
  const blocking: ConflictWithPriority[] = [];
  const overridablePending: ConflictWithPriority[] = [];
  for (const c of conflicts) {
    if (c.status === ReservationStatus.APPROVED) {
      blocking.push(c);
    } else if (c.status === ReservationStatus.PENDING) {
      if (requesterPriority > c.departmentPriority) {
        overridablePending.push(c);
      } else {
        blocking.push(c);
      }
    }
  }
  return { blocking, overridablePending };
}

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
    throw new ForbiddenException('Colaboradores só podem reservar para si mesmos');
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
