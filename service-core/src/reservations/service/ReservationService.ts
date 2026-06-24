import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ReservationStatus, Role } from '@prisma/client';
import type { JwtUserPayload } from '../../auth/jwt-user.payload';
import { PrismaService } from '../../shared/database/prisma.service';
import { RabbitPublisherService } from '../../shared/events/rabbit.publisher';
import { CORE_EVENTS } from '../../shared/events/event-routing';
import { toEventJson } from '../../shared/events/event-serialize';
import {
  applyReservationListScope,
  assertCanApproveOrReject,
  assertCanCancel,
  assertCancelDeadline,
  assertManagerCanBookForUser,
  resolveBookingUserId,
} from '../../shared/governance/reservation-governance';
import { evaluatePriorityConflicts, type OverlapRow } from './reservation-priority';
import { ReservationRequestDto } from '../dtos/ReservationRequest.dto';
import { ReservationResponseDto } from '../dtos/ReservationResponse.dto';
import { ReservationUpdateDto } from '../dtos/ReservationUpdate.dto';

const blockingStatuses: ReservationStatus[] = [
  ReservationStatus.PENDING,
  ReservationStatus.APPROVED,
];

const reservationInclude = {
  user: {
    select: {
      id: true,
      name: true,
      email: true,
      departmentId: true,
      department: { select: { id: true, name: true, sigla: true, active: true } },
    },
  },
  approvedBy: { select: { id: true, name: true, email: true } },
  resource: {
    select: {
      id: true,
      name: true,
      type: true,
      location: true,
      requiresApproval: true,
      departmentId: true,
      costCenterCode: true,
    },
  },
} satisfies Prisma.ReservationInclude;

export type ReservationListFilters = {
  resourceId?: string;
  userId?: string;
  departmentId?: string;
  status?: ReservationStatus;
  from?: string;
  to?: string;
};

@Injectable()
export class ReservationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: RabbitPublisherService,
  ) {}

  private assertValidRange(start: Date, end: Date) {
    if (!(start.getTime() < end.getTime())) {
      throw new BadRequestException('endDate must be after startDate');
    }
  }

  private assertResourceDepartmentAccess(
    actor: JwtUserPayload,
    resource: { departmentId: string | null },
    user: { departmentId: string },
  ) {
    if (!resource.departmentId) {
      return;
    }
    if (actor.role === Role.ADMIN) {
      return;
    }
    if (resource.departmentId === user.departmentId) {
      return;
    }
    throw new ForbiddenException(
      'This resource is assigned to another department',
    );
  }

  /** Sobreposições activas (pendente ou aprovada) no mesmo recurso. */
  private async findOverlappingReservations(
    resourceId: string,
    start: Date,
    end: Date,
    excludeReservationId?: string,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<OverlapRow[]> {
    return db.reservation.findMany({
      where: {
        resourceId,
        id: excludeReservationId ? { not: excludeReservationId } : undefined,
        status: { in: blockingStatuses },
        AND: [{ startDate: { lt: end } }, { endDate: { gt: start } }],
      },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        user: {
          select: {
            name: true,
            department: { select: { priority: true } },
          },
        },
      },
      orderBy: { startDate: 'asc' },
    });
  }

  private throwBookingConflict(overlaps: OverlapRow[]): never {
    const first = overlaps[0];
    const fmt = (d: Date) =>
      d.toLocaleString('pt-PT', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    const period =
      overlaps.length === 1
        ? `${fmt(first.startDate)} – ${fmt(first.endDate)}`
        : `${overlaps.length} reservas no período`;
    const state =
      first.status === ReservationStatus.APPROVED ? 'aprovada' : 'pendente';
    throw new ConflictException(
      `Este recurso já está reservado (${state}) de ${period}. Escolha outro horário ou outro dia.`,
    );
  }

  /** Cancela reservas pendentes de menor prioridade para libertar o slot. */
  private async cancelOverriddenPending(
    ids: string[],
    actor: JwtUserPayload,
    requesterPriority: number,
    tx: Prisma.TransactionClient,
  ) {
    for (const id of ids) {
      const row = await tx.reservation.update({
        where: { id },
        data: {
          status: ReservationStatus.CANCELLED,
          approvedAt: null,
          notes: 'Cancelada automaticamente: prioridade de departamento inferior.',
        },
        include: reservationInclude,
      });
      this.events.publish(CORE_EVENTS.RESERVATION_CANCELLED, {
        reservation: toEventJson(row),
        previousStatus: ReservationStatus.PENDING,
        cancelledById: actor.sub,
        cancelledByEmail: actor.email,
        supersededByPriority: true,
        requesterDepartmentPriority: requesterPriority,
      });
    }
  }

  private async resolveOverlapsForBooking(
    overlaps: OverlapRow[],
    requesterPriority: number,
    actor: JwtUserPayload,
    tx: Prisma.TransactionClient,
  ) {
    const { blocking, overridable } = evaluatePriorityConflicts(
      requesterPriority,
      overlaps,
    );
    if (blocking.length > 0) {
      this.throwBookingConflict(blocking);
    }
    if (overridable.length > 0) {
      await this.cancelOverriddenPending(
        overridable.map((o) => o.id),
        actor,
        requesterPriority,
        tx,
      );
    }
  }

  async create(
    dto: ReservationRequestDto,
    actor: JwtUserPayload,
  ): Promise<ReservationResponseDto> {
    const start = new Date(dto.startDate);
    const end = new Date(dto.endDate);
    this.assertValidRange(start, end);

    const userId = resolveBookingUserId(actor, dto.userId);

    const [user, resource] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        include: { department: true },
      }),
      this.prisma.resource.findUnique({ where: { id: dto.resourceId } }),
    ]);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (!user.departmentId || !user.department?.name?.trim()) {
      throw new BadRequestException(
        'O solicitante deve ter um departamento válido para criar reservas',
      );
    }
    if (!user.department.active) {
      throw new BadRequestException(
        'O departamento do solicitante está inativo',
      );
    }
    assertManagerCanBookForUser(actor, user);
    if (!resource || !resource.active) {
      throw new NotFoundException('Resource not found or inactive');
    }
    this.assertResourceDepartmentAccess(actor, resource, user);

    // Colaboradores passam sempre por aprovação (gestor/admin), mesmo em recursos sem flag.
    const status =
      actor.role === Role.EMPLOYEE || resource.requiresApproval
        ? ReservationStatus.PENDING
        : ReservationStatus.APPROVED;

    const row = await this.prisma.$transaction(async (tx) => {
      const overlaps = await this.findOverlappingReservations(
        resource.id,
        start,
        end,
        undefined,
        tx,
      );
      await this.resolveOverlapsForBooking(
        overlaps,
        user.department.priority,
        actor,
        tx,
      );

      return tx.reservation.create({
        data: {
          userId,
          resourceId: dto.resourceId,
          startDate: start,
          endDate: end,
          notes: dto.notes,
          status,
          approvedAt: status === ReservationStatus.APPROVED ? new Date() : null,
          approvedById:
            status === ReservationStatus.APPROVED ? actor.sub : null,
        },
        include: reservationInclude,
      });
    });
    this.events.publish(CORE_EVENTS.RESERVATION_CREATED, {
      reservation: toEventJson(row),
      actorId: actor.sub,
      actorEmail: actor.email,
    });
    return new ReservationResponseDto(row);
  }

  async findAll(
    query: ReservationListFilters,
    actor: JwtUserPayload,
  ): Promise<ReservationResponseDto[]> {
    const scope = applyReservationListScope(actor, {
      userId: query.userId,
      departmentId: query.departmentId,
    });

    const where: Prisma.ReservationWhereInput = {};

    if (query.resourceId) {
      where.resourceId = query.resourceId;
    }
    if (scope.userId) {
      where.userId = scope.userId;
    }
    if (scope.departmentId) {
      where.user = { departmentId: scope.departmentId };
    }
    if (query.status) {
      where.status = query.status;
    }
    if (query.from || query.to) {
      const from = query.from ? new Date(query.from) : undefined;
      const to = query.to ? new Date(query.to) : undefined;
      if (from && to) {
        this.assertValidRange(from, to);
        where.AND = [{ startDate: { lt: to } }, { endDate: { gt: from } }];
      } else if (from) {
        where.endDate = { gt: from };
      } else if (to) {
        where.startDate = { lt: to };
      }
    }

    const rows = await this.prisma.reservation.findMany({
      where,
      orderBy: [{ startDate: 'asc' }],
      include: reservationInclude,
    });
    return rows.map((r) => new ReservationResponseDto(r));
  }

  async findById(
    id: string,
    actor: JwtUserPayload,
  ): Promise<ReservationResponseDto> {
    const row = await this.prisma.reservation.findUnique({
      where: { id },
      include: reservationInclude,
    });
    if (!row) {
      throw new NotFoundException('Reservation not found');
    }
    if (actor.role === Role.EMPLOYEE && row.userId !== actor.sub) {
      throw new ForbiddenException();
    }
    if (
      actor.role === Role.MANAGER &&
      row.user.departmentId !== actor.departmentId
    ) {
      throw new ForbiddenException();
    }
    return new ReservationResponseDto(row);
  }

  async update(
    id: string,
    dto: ReservationUpdateDto,
    actor: JwtUserPayload,
  ): Promise<ReservationResponseDto> {
    if (
      dto.startDate === undefined &&
      dto.endDate === undefined &&
      dto.notes === undefined
    ) {
      throw new BadRequestException('Nothing to update');
    }

    const current = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        resource: true,
        user: { select: { id: true, departmentId: true } },
      },
    });
    if (!current) {
      throw new NotFoundException('Reservation not found');
    }
    if (current.userId !== actor.sub && actor.role === Role.EMPLOYEE) {
      throw new ForbiddenException();
    }
    if (
      actor.role === Role.MANAGER &&
      current.user.departmentId !== actor.departmentId
    ) {
      throw new ForbiddenException();
    }
    if (current.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending reservations can be rescheduled',
      );
    }

    const start =
      dto.startDate !== undefined ? new Date(dto.startDate) : current.startDate;
    const end =
      dto.endDate !== undefined ? new Date(dto.endDate) : current.endDate;
    this.assertValidRange(start, end);

    const timesChanged =
      dto.startDate !== undefined || dto.endDate !== undefined;
    let status = current.status;
    let approvedAt: Date | null = current.approvedAt;

    if (timesChanged && current.resource.requiresApproval) {
      status = ReservationStatus.PENDING;
      approvedAt = null;
    }

    const row = await this.prisma.$transaction(async (tx) => {
      if (timesChanged) {
        const requester = await tx.user.findUnique({
          where: { id: current.userId },
          include: { department: true },
        });
        const priority = requester?.department?.priority ?? 0;
        const overlaps = await this.findOverlappingReservations(
          current.resourceId,
          start,
          end,
          id,
          tx,
        );
        await this.resolveOverlapsForBooking(overlaps, priority, actor, tx);
      }

      return tx.reservation.update({
        where: { id },
        data: {
          ...(dto.startDate !== undefined ? { startDate: start } : {}),
          ...(dto.endDate !== undefined ? { endDate: end } : {}),
          ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
          status,
          approvedAt,
          rejectReason: null,
          approvedById: null,
        },
        include: reservationInclude,
      });
    });
    this.events.publish(CORE_EVENTS.RESERVATION_UPDATED, {
      reservation: toEventJson(row),
      previousStatus: current.status,
      actorId: actor.sub,
    });
    return new ReservationResponseDto(row);
  }

  async approve(
    id: string,
    actor: JwtUserPayload,
  ): Promise<ReservationResponseDto> {
    const current = await this.prisma.reservation.findUnique({
      where: { id },
      include: {
        resource: true,
        user: { select: { departmentId: true } },
      },
    });
    if (!current) {
      throw new NotFoundException('Reservation not found');
    }
    assertCanApproveOrReject(actor, current.user);
    if (!current.resource.active) {
      throw new BadRequestException('Cannot approve for an inactive resource');
    }
    if (current.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'Only pending reservations can be approved',
      );
    }
    const nextStage = current.approvalStage + 1;
    const fullyApproved = nextStage >= current.approvalLevelRequired;

    const row = await this.prisma.$transaction(async (tx) => {
      const conflicts = await this.findOverlappingReservations(
        current.resourceId,
        current.startDate,
        current.endDate,
        id,
        tx,
      );
      if (conflicts.length > 0) {
        this.throwBookingConflict(conflicts);
      }

      return tx.reservation.update({
        where: { id },
        data: {
          status: fullyApproved
            ? ReservationStatus.APPROVED
            : ReservationStatus.PENDING,
          approvalStage: nextStage,
          approvedAt: fullyApproved ? new Date() : null,
          rejectReason: null,
          approvedById: fullyApproved ? actor.sub : null,
        },
        include: reservationInclude,
      });
    });
    if (fullyApproved) {
      this.events.publish(CORE_EVENTS.RESERVATION_APPROVED, {
        reservation: toEventJson(row),
        previousStatus: ReservationStatus.PENDING,
        approvedById: actor.sub,
        approvedByEmail: actor.email,
      });
    } else {
      this.events.publish(CORE_EVENTS.RESERVATION_UPDATED, {
        reservation: toEventJson(row),
        previousStatus: ReservationStatus.PENDING,
        actorId: actor.sub,
        approvalStage: nextStage,
      });
    }
    return new ReservationResponseDto(row);
  }

  async reject(
    id: string,
    dto: ReservationUpdateDto,
    actor: JwtUserPayload,
  ): Promise<ReservationResponseDto> {
    const current = await this.prisma.reservation.findUnique({
      where: { id },
      include: { user: { select: { departmentId: true } } },
    });
    if (!current) {
      throw new NotFoundException('Reservation not found');
    }
    assertCanApproveOrReject(actor, current.user);
    if (current.status !== ReservationStatus.PENDING) {
      throw new BadRequestException('Only pending reservations can be rejected');
    }

    const row = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.REJECTED,
        rejectReason: dto.rejectReason ?? null,
        approvedAt: null,
        approvedById: actor.sub,
      },
      include: reservationInclude,
    });
    this.events.publish(CORE_EVENTS.RESERVATION_REJECTED, {
      reservation: toEventJson(row),
      previousStatus: ReservationStatus.PENDING,
      rejectedById: actor.sub,
      rejectedByEmail: actor.email,
    });
    return new ReservationResponseDto(row);
  }

  async cancel(
    id: string,
    actor: JwtUserPayload,
  ): Promise<ReservationResponseDto> {
    const current = await this.prisma.reservation.findUnique({
      where: { id },
      include: { user: { select: { id: true, departmentId: true } } },
    });
    if (!current) {
      throw new NotFoundException('Reservation not found');
    }
    assertCanCancel(actor, {
      userId: current.userId,
      user: current.user,
    });
    if (
      current.status !== ReservationStatus.PENDING &&
      current.status !== ReservationStatus.APPROVED
    ) {
      throw new BadRequestException(
        'Only pending or approved reservations can be cancelled',
      );
    }
    assertCancelDeadline(current.startDate);

    const row = await this.prisma.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CANCELLED,
        approvedAt: null,
      },
      include: reservationInclude,
    });
    this.events.publish(CORE_EVENTS.RESERVATION_CANCELLED, {
      reservation: toEventJson(row),
      previousStatus: current.status,
      cancelledById: actor.sub,
    });
    return new ReservationResponseDto(row);
  }

  async checkAvailability(
    resourceId: string,
    startDate: string,
    endDate: string,
    actor: JwtUserPayload,
  ): Promise<{
    available: boolean;
    canOverridePending: boolean;
    blocked: boolean;
    conflicts: Array<{
      status: ReservationStatus;
      startDate: string;
      endDate: string;
      solicitante: string;
    }>;
  }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    this.assertValidRange(start, end);

    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource || !resource.active) {
      throw new NotFoundException('Resource not found or inactive');
    }

    const requester = await this.prisma.user.findUnique({
      where: { id: actor.sub },
      include: { department: true },
    });
    const requesterPriority = requester?.department?.priority ?? 0;

    const overlaps = await this.findOverlappingReservations(
      resourceId,
      start,
      end,
    );

    const evaluation = evaluatePriorityConflicts(requesterPriority, overlaps);

    return {
      available: evaluation.available || evaluation.canOverridePending,
      canOverridePending: evaluation.canOverridePending,
      blocked: evaluation.blocked,
      conflicts: overlaps.map((c) => ({
        status: c.status,
        startDate: c.startDate.toISOString(),
        endDate: c.endDate.toISOString(),
        solicitante: c.user.name,
      })),
    };
  }
}
