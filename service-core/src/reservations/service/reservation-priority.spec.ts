import { ReservationStatus } from '@prisma/client';
import {
  partitionConflictsByPriority,
  type ConflictWithPriority,
} from '../../shared/governance/reservation-governance';
import {
  evaluatePriorityConflicts,
  toConflictsWithPriority,
  type OverlapRow,
} from './reservation-priority';

describe('partitionConflictsByPriority', () => {
  const pending = (id: string, priority: number): ConflictWithPriority => ({
    id,
    status: ReservationStatus.PENDING,
    departmentPriority: priority,
  });

  it('bloqueia reservas aprovadas independentemente da prioridade', () => {
    const { blocking, overridablePending } = partitionConflictsByPriority(100, [
      { id: 'a1', status: ReservationStatus.APPROVED, departmentPriority: 10 },
    ]);
    expect(blocking).toHaveLength(1);
    expect(overridablePending).toHaveLength(0);
  });

  it('permite sobrepor pendente de departamento com menor prioridade', () => {
    const { blocking, overridablePending } = partitionConflictsByPriority(80, [
      pending('p1', 50),
    ]);
    expect(blocking).toHaveLength(0);
    expect(overridablePending).toHaveLength(1);
  });

  it('bloqueia pendente de departamento com prioridade igual ou maior', () => {
    const { blocking } = partitionConflictsByPriority(50, [pending('p1', 50)]);
    expect(blocking).toHaveLength(1);

    const r2 = partitionConflictsByPriority(50, [pending('p2', 90)]);
    expect(r2.blocking).toHaveLength(1);
  });
});

describe('evaluatePriorityConflicts', () => {
  const overlap = (
    id: string,
    status: ReservationStatus,
    priority: number,
  ): OverlapRow => ({
    id,
    status,
    startDate: new Date('2026-07-01T10:00:00Z'),
    endDate: new Date('2026-07-01T11:00:00Z'),
    user: { name: 'Ana', department: { priority } },
  });

  it('marca available quando não há conflitos', () => {
    const r = evaluatePriorityConflicts(80, []);
    expect(r.available).toBe(true);
    expect(r.canOverridePending).toBe(false);
  });

  it('canOverridePending quando só há pendentes de menor prioridade', () => {
    const r = evaluatePriorityConflicts(90, [
      overlap('1', ReservationStatus.PENDING, 40),
    ]);
    expect(r.canOverridePending).toBe(true);
    expect(r.blocked).toBe(false);
    expect(r.overridable).toHaveLength(1);
  });

  it('blocked quando há reserva aprovada', () => {
    const r = evaluatePriorityConflicts(100, [
      overlap('1', ReservationStatus.APPROVED, 10),
    ]);
    expect(r.blocked).toBe(true);
    expect(r.canOverridePending).toBe(false);
  });
});

describe('toConflictsWithPriority', () => {
  it('usa prioridade 0 quando departamento ausente', () => {
    const rows: OverlapRow[] = [
      {
        id: 'x',
        status: ReservationStatus.PENDING,
        startDate: new Date(),
        endDate: new Date(),
        user: { name: 'B', department: null },
      },
    ];
    expect(toConflictsWithPriority(rows)[0].departmentPriority).toBe(0);
  });
});
