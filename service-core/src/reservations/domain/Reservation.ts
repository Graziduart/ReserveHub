import { ReservationStatus } from '@prisma/client';

export class Reservation {
  id: string;
  startDate: Date;
  endDate: Date;
  status: ReservationStatus;
  notes?: string | null;
  rejectReason?: string | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  resourceId: string;
}
