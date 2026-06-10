import type { Role } from '@prisma/client';

export type JwtUserPayload = {
  sub: string;
  email: string;
  role: Role;
  departmentId: string;
};
