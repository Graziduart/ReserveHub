import { Role } from '@prisma/client';

/** Payload do JWT emitido pelo service-iam. */
export type JwtUserPayload = {
  sub: string;
  email: string;
  role: Role;
  departmentId: string;
};
