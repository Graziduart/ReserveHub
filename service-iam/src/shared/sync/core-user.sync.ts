import { Role } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

/** Mantém `core.users` alinhado para FKs de reservas no service-core (sem replicar password). */
export async function syncUserToCore(
  prisma: PrismaService,
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    departmentId: string;
    active: boolean;
  },
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO core.users (id, email, password, name, role, "departmentId", active)
     VALUES ($1, $2, '', $3, $4::core."Role", $5, $6)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       "departmentId" = EXCLUDED."departmentId",
       active = EXCLUDED.active`,
    user.id,
    user.email,
    user.name,
    user.role,
    user.departmentId,
    user.active,
  );
}

export async function deactivateUserInCore(
  prisma: PrismaService,
  userId: string,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `UPDATE core.users SET active = false WHERE id = $1`,
    userId,
  );
}
