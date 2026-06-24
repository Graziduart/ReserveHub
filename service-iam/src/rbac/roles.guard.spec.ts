import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

function mockContext(user?: { role: Role }): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as ExecutionContext;
}

describe('RolesGuard', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const guard = new RolesGuard(reflector);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('permite quando não há roles exigidas', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue(undefined);
    expect(guard.canActivate(mockContext())).toBe(true);
  });

  it('permite quando role do utilizador está na lista', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN, Role.MANAGER]);
    expect(
      guard.canActivate(mockContext({ role: Role.MANAGER })),
    ).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('bloqueia sem utilizador autenticado', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(mockContext())).toThrow(ForbiddenException);
  });

  it('bloqueia role insuficiente', () => {
    (reflector.getAllAndOverride as jest.Mock).mockReturnValue([Role.ADMIN]);
    expect(() =>
      guard.canActivate(mockContext({ role: Role.EMPLOYEE })),
    ).toThrow('Insufficient role');
  });
});
