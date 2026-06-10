import type { Role } from '@prisma/client';

export class UserResponseDto {
  id!: string;
  name!: string;
  email!: string;
  role!: Role;
  departmentId!: string;
  active!: boolean;
  createdAt!: string;
  updatedAt!: string;
  lastLoginAt?: string | null;

  constructor(p: {
    id: string;
    name: string;
    email: string;
    role: Role;
    departmentId: string;
    active: boolean;
    createdAt: Date;
    updatedAt: Date;
    lastLoginAt: Date | null;
  }) {
    this.id = p.id;
    this.name = p.name;
    this.email = p.email;
    this.role = p.role;
    this.departmentId = p.departmentId;
    this.active = p.active;
    this.createdAt = p.createdAt.toISOString();
    this.updatedAt = p.updatedAt.toISOString();
    this.lastLoginAt = p.lastLoginAt?.toISOString() ?? null;
  }
}
