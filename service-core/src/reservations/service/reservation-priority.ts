import { ReservationStatus } from '@prisma/client';
import {
  partitionConflictsByPriority,
  type ConflictWithPriority,
} from '../../shared/governance/reservation-governance';

export type OverlapRow = {
  id: string;
  status: ReservationStatus;
  startDate: Date;
  endDate: Date;
  user: {
    name: string;
    department: { priority: number } | null;
  };
};

export function toConflictsWithPriority(rows: OverlapRow[]): ConflictWithPriority[] {
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    departmentPriority: r.user.department?.priority ?? 0,
  }));
}

export function evaluatePriorityConflicts(
  requesterPriority: number,
  overlaps: OverlapRow[],
) {
  const { blocking, overridablePending } = partitionConflictsByPriority(
    requesterPriority,
    toConflictsWithPriority(overlaps),
  );
  const blockingIds = new Set(blocking.map((b) => b.id));
  const overridableIds = new Set(overridablePending.map((o) => o.id));
  return {
    blocking: overlaps.filter((o) => blockingIds.has(o.id)),
    overridable: overlaps.filter((o) => overridableIds.has(o.id)),
    canOverridePending: overridablePending.length > 0 && blocking.length === 0,
    available: overlaps.length === 0,
    blocked: blocking.length > 0,
  };
}
