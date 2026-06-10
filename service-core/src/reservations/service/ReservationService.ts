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
  assertManagerCanBookForUser,
  resolveBookingUserId,
} from '../../shared/governance/reservation-governance';
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

  /** Conflitos: APPROVED bloqueia; PENDING pode ser cancelada se prioridade do departamento for maior. */
  private async assertBookingAllowed(
    resourceId: string,
    start: Date,
    end: Date,
    requesterDepartmentId: string,
    excludeReservationId?: string,
  ) {
    const conflicts = await this.prisma.reservation.findMany({
      where: {
        resourceId,
        id: excludeReservationId ? { not: excludeReservationId } : undefined,
        status: { in: blockingStatuses },
        AND: [{ startDate: { lt: end } }, { endDate: { gt: start } }],
      },
      include: {
        user: { include: { department: { select: { priority: true } } } },
      },
    });

    if (conflicts.length === 0) {
      return;
    }

    if (
      conflicts.some((c) => c.status === ReservationStatus.APPROVED)
    ) {
      throw new ConflictException(
        'Resource is already booked (approved reservation in this period)',
      );
    }

    const requesterDept = await this.prisma.department.findUnique({
      where: { id: requesterDepartmentId },
      select: { priority: true },
    });
    const requesterPriority = requesterDept?.priority ?? 0;

    const pending = conflicts.filter(
      (c) => c.status === ReservationStatus.PENDING,
    );
    const maxOther = Math.max(
      ...pending.map((c) => c.user.department.priority),
      -1,
    );

    if (requesterPriority > maxOther) {
      for (const c of pending) {
        const cancelled = await this.prisma.reservation.update({
          where: { id: c.id },
          data: {
            status: ReservationStatus.CANCELLED,
            rejectReason:
              'Cancelada automaticamente: reserva de departamento com prioridade superior',
            approvedAt: null,
          },
          include: reservationInclude,
        });
        this.events.publish(CORE_EVENTS.RESERVATION_CANCELLED, {
          reservation: toEventJson(cancelled),
          previousStatus: ReservationStatus.PENDING,
          reason: 'department_priority_override',
        });
      }
      return;
    }

    throw new ConflictException(
      'Horário indisponível: existe reserva em conflito e a prioridade do seu departamento não permite substituir',
    );
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

    await this.assertBookingAllowed(
      resource.id,
      start,
      end,
      user.departmentId,
    );

    const status = resource.requiresApproval
      ? ReservationStatus.PENDING
      : ReservationStatus.APPROVED;

    const row = await this.prisma.reservation.create({
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

    await this.assertBookingAllowed(
      current.resourceId,
      start,
      end,
      current.user.departmentId,
      id,
    );

    const timesChanged =
      dto.startDate !== undefined || dto.endDate !== undefined;
    let status = current.status;
    let approvedAt: Date | null = current.approvedAt;

    if (timesChanged && current.resource.requiresApproval) {
      status = ReservationStatus.PENDING;
      approvedAt = null;
    }

    const row = await this.prisma.reservation.update({
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
    await this.assertBookingAllowed(
      current.resourceId,
      current.startDate,
      current.endDate,
      current.user.departmentId,
      id,
    );

    const nextStage = current.approvalStage + 1;
    const fullyApproved = nextStage >= current.approvalLevelRequired;
    const row = await this.prisma.reservation.update({
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
  ): Promise<{ available: boolean; canOverridePending: boolean }> {
    const start = new Date(startDate);
    const end = new Date(endDate);
    this.assertValidRange(start, end);

    const resource = await this.prisma.resource.findUnique({
      where: { id: resourceId },
    });
    if (!resource || !resource.active) {
      throw new NotFoundException('Resource not found or inactive');
    }

    const conflicts = await this.prisma.reservation.findMany({
      where: {
        resourceId,
        status: { in: blockingStatuses },
        AND: [{ startDate: { lt: end } }, { endDate: { gt: start } }],
      },
      include: {
        user: { include: { department: { select: { priority: true } } } },
      },
    });

    if (conflicts.length === 0) {
      return { available: true, canOverridePending: false };
    }

    if (
      conflicts.some((c) => c.status === ReservationStatus.APPROVED)
    ) {
      return { available: false, canOverridePending: false };
    }

    const actorDept = await this.prisma.department.findUnique({
      where: { id: actor.departmentId },
      select: { priority: true },
    });
    const actorPriority = actorDept?.priority ?? 0;
    const maxPending = Math.max(
      ...conflicts
        .filter((c) => c.status === ReservationStatus.PENDING)
        .map((c) => c.user.department.priority),
      -1,
    );

    return {
      available: actorPriority > maxPending,
      canOverridePending: actorPriority > maxPending,
    };
  }
}
