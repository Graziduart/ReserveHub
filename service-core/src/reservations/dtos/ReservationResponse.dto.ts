import { ReservationStatus } from '@prisma/client';

/** Payload de retorno das operações com reserva */
export class ReservationResponseDto {
  id: string;
  startDate: Date;
  endDate: Date;
  status: ReservationStatus;
  notes?: string | null;
  rejectReason?: string | null;
  approvedAt?: Date | null;
  approvedById?: string | null;
  approvedBy?: { id: string; name: string; email: string } | null;
  createdAt: Date;
  updatedAt: Date;
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

  constructor(
    data: {
      id: string;
      startDate: Date;
      endDate: Date;
      status: ReservationStatus;
      notes?: string | null;
      rejectReason?: string | null;
      approvedAt?: Date | null;
      approvedById?: string | null;
      approvedBy?: { id: string; name: string; email: string } | null;
      createdAt: Date;
      updatedAt: Date;
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
    },
  ) {
    Object.assign(this, {
      ...data,
      ...(data.user
        ? { user: { ...data.user } }
        : { user: undefined }),
      ...(data.resource
        ? { resource: { ...data.resource } }
        : { resource: undefined }),
    });
  }
}
