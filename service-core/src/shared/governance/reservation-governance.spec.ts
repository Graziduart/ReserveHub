import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { Role } from '@prisma/client';
import type { JwtUserPayload } from '../../auth/jwt-user.payload';
import {
  applyReservationListScope,
  assertCanApproveOrReject,
  assertCanCancel,
  assertCancelDeadline,
  canCancelBeforeDeadline,
  assertManagerCanBookForUser,
  CANCEL_MIN_LEAD_HOURS,
  resolveBookingUserId,
} from './reservation-governance';
const admin: JwtUserPayload = {
  sub: 'admin-1',
  email: 'admin@test.local',
  role: Role.ADMIN,
  departmentId: 'dept-adm',
};

const manager: JwtUserPayload = {
  sub: 'mgr-1',
  email: 'mgr@test.local',
  role: Role.MANAGER,
  departmentId: 'dept-rh',
};

const employee: JwtUserPayload = {
  sub: 'emp-1',
  email: 'emp@test.local',
  role: Role.EMPLOYEE,
  departmentId: 'dept-rh',
};

describe('resolveBookingUserId', () => {
  it('admin sem userId usa o próprio sub', () => {
    expect(resolveBookingUserId(admin)).toBe('admin-1');
  });

  it('admin com userId usa o solicitado', () => {
    expect(resolveBookingUserId(admin, 'other-1')).toBe('other-1');
  });

  it('gestor sem userId usa o próprio sub', () => {
    expect(resolveBookingUserId(manager)).toBe('mgr-1');
  });

  it('gestor pode indicar outro userId', () => {
    expect(resolveBookingUserId(manager, 'emp-2')).toBe('emp-2');
  });

  it('colaborador usa sempre o próprio sub', () => {
    expect(resolveBookingUserId(employee)).toBe('emp-1');
  });

  it('colaborador não pode reservar para outro', () => {
    expect(() => resolveBookingUserId(employee, 'emp-2')).toThrow(
      ForbiddenException,
    );
  });
});

describe('assertManagerCanBookForUser', () => {
  it('admin pode reservar para qualquer utilizador', () => {
    expect(() =>
      assertManagerCanBookForUser(admin, { id: 'x', departmentId: 'outro' }),
    ).not.toThrow();
  });

  it('gestor pode reservar para colega do mesmo departamento', () => {
    expect(() =>
      assertManagerCanBookForUser(manager, { id: 'emp-2', departmentId: 'dept-rh' }),
    ).not.toThrow();
  });

  it('gestor não pode reservar para outro departamento', () => {
    expect(() =>
      assertManagerCanBookForUser(manager, { id: 'emp-2', departmentId: 'dept-ti' }),
    ).toThrow(ForbiddenException);
  });

  it('colaborador só pode reservar para si', () => {
    expect(() =>
      assertManagerCanBookForUser(employee, { id: 'emp-1', departmentId: 'dept-rh' }),
    ).not.toThrow();
    expect(() =>
      assertManagerCanBookForUser(employee, { id: 'emp-2', departmentId: 'dept-rh' }),
    ).toThrow(ForbiddenException);
  });
});

describe('assertCanApproveOrReject', () => {
  it('admin pode aprovar qualquer departamento', () => {
    expect(() =>
      assertCanApproveOrReject(admin, { departmentId: 'dept-ti' }),
    ).not.toThrow();
  });

  it('gestor aprova no próprio departamento', () => {
    expect(() =>
      assertCanApproveOrReject(manager, { departmentId: 'dept-rh' }),
    ).not.toThrow();
  });

  it('gestor não aprova fora do departamento', () => {
    expect(() =>
      assertCanApproveOrReject(manager, { departmentId: 'dept-ti' }),
    ).toThrow(ForbiddenException);
  });

  it('colaborador não aprova', () => {
    expect(() =>
      assertCanApproveOrReject(employee, { departmentId: 'dept-rh' }),
    ).toThrow(ForbiddenException);
  });
});

describe('assertCanCancel', () => {
  const reservation = {
    userId: 'emp-1',
    user: { departmentId: 'dept-rh' },
  };

  it('admin cancela qualquer reserva', () => {
    expect(() => assertCanCancel(admin, reservation)).not.toThrow();
  });

  it('solicitante cancela a própria reserva', () => {
    expect(() => assertCanCancel(employee, reservation)).not.toThrow();
  });

  it('gestor cancela reserva do departamento', () => {
    expect(() => assertCanCancel(manager, reservation)).not.toThrow();
  });

  it('outro colaborador não cancela', () => {
    const other: JwtUserPayload = { ...employee, sub: 'emp-99' };
    expect(() => assertCanCancel(other, reservation)).toThrow(ForbiddenException);
  });
});

describe('applyReservationListScope', () => {
  it('admin mantém filtros', () => {
    expect(
      applyReservationListScope(admin, { userId: 'u1', departmentId: 'd1' }),
    ).toEqual({ userId: 'u1', departmentId: 'd1' });
  });

  it('colaborador vê só as próprias reservas', () => {
    expect(applyReservationListScope(employee, { departmentId: 'd1' })).toEqual({
      userId: 'emp-1',
    });
  });

  it('gestor filtra por departamento', () => {
    expect(applyReservationListScope(manager, { userId: 'u1' })).toEqual({
      departmentId: 'dept-rh',
      userId: 'u1',
    });
  });
});

describe('assertCancelDeadline (RN-04)', () => {
  const start = new Date('2030-06-15T14:00:00');

  it('permite cancelar com mais de 1 hora de antecedência', () => {
    const now = new Date('2030-06-15T12:00:00');
    expect(canCancelBeforeDeadline(start, now)).toBe(true);
    expect(() => assertCancelDeadline(start, now)).not.toThrow();
  });

  it('bloqueia cancelar dentro de 1 hora do início', () => {
    const now = new Date('2030-06-15T13:30:00');
    expect(canCancelBeforeDeadline(start, now)).toBe(false);
    expect(() => assertCancelDeadline(start, now)).toThrow(BadRequestException);
  });

  it('mensagem menciona o prazo mínimo', () => {
    const now = new Date('2030-06-15T13:59:00');
    try {
      assertCancelDeadline(start, now);
    } catch (e) {
      expect(e).toBeInstanceOf(BadRequestException);
      expect((e as BadRequestException).message).toContain(
        String(CANCEL_MIN_LEAD_HOURS),
      );
    }
  });
});