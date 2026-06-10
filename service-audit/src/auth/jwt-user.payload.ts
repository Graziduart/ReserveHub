export type AuthRole = 'ADMIN' | 'MANAGER' | 'EMPLOYEE';

export type JwtUserPayload = {
  sub: string;
  email: string;
  role: AuthRole;
  departmentId: string;
};
