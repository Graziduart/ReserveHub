import 'dotenv/config';
import { PrismaClient, ReservationStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/shared/crypto/password-hash';
import {
  DEMO_DEPARTMENTS,
  DEMO_RESERVATIONS,
  DEMO_RESOURCES,
  DEMO_USERS,
  SEED_RESERVATION_NOTES,
  type DemoReservation,
} from './seed-data';

function createPrisma(): { prisma: PrismaClient; pool: Pool } {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for prisma db seed');
  }
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

function slotDate(daysFromNow: number, hour: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  const { prisma, pool } = createPrisma();
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'ReserveHub1!';
  const passwordHash = hashPassword(demoPassword);

  console.log('Core seed: a popular base de demonstração…');

  const deptBySigla = new Map<string, string>();
  for (const d of DEMO_DEPARTMENTS) {
    const dept = await prisma.department.upsert({
      where: { sigla: d.sigla },
      create: {
        name: d.name,
        sigla: d.sigla,
        priority: d.priority,
        costCenterCode: d.costCenterCode,
        active: true,
      },
      update: {
        name: d.name,
        priority: d.priority,
        costCenterCode: d.costCenterCode,
        active: true,
      },
    });
    deptBySigla.set(d.sigla, dept.id);
    console.log(`  departamento: ${dept.sigla} (${dept.id})`);
  }

  const userByEmail = new Map<string, string>();
  for (const u of DEMO_USERS) {
    const departmentId = deptBySigla.get(u.departmentSigla);
    if (!departmentId) {
      throw new Error(`Departamento ${u.departmentSigla} em falta para ${u.email}`);
    }

    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        id: u.id,
        email: u.email,
        name: u.name,
        password: passwordHash,
        role: u.role,
        departmentId,
      },
      update: {
        name: u.name,
        password: passwordHash,
        role: u.role,
        departmentId,
      },
    });
    userByEmail.set(u.email, user.id);
    console.log(`  utilizador: ${user.email} (${user.role})`);
  }

  const resourceByKey = new Map<string, string>();
  for (const r of DEMO_RESOURCES) {
    const departmentId = deptBySigla.get(r.departmentSigla);
    const existing = await prisma.resource.findFirst({
      where: { name: r.name, location: r.location },
    });
    const resource = existing
      ? await prisma.resource.update({
          where: { id: existing.id },
          data: {
            type: r.type,
            requiresApproval: r.requiresApproval,
            costCenterCode: r.costCenterCode,
            departmentId,
            active: true,
          },
        })
      : await prisma.resource.create({
          data: {
            name: r.name,
            type: r.type,
            location: r.location,
            requiresApproval: r.requiresApproval,
            costCenterCode: r.costCenterCode,
            departmentId,
            active: true,
          },
        });
    resourceByKey.set(r.key, resource.id);
    console.log(`  recurso: ${resource.name}`);
  }

  const removed = await prisma.reservation.deleteMany({
    where: { notes: SEED_RESERVATION_NOTES },
  });
  if (removed.count > 0) {
    console.log(`  reservas seed anteriores removidas: ${removed.count}`);
  }

  for (const spec of DEMO_RESERVATIONS) {
    await createSeedReservation(prisma, spec, userByEmail, resourceByKey);
  }

  const counts = await Promise.all([
    prisma.department.count(),
    prisma.user.count(),
    prisma.resource.count({ where: { active: true } }),
    prisma.reservation.count(),
  ]);

  console.log('\nCore seed concluído:');
  console.log(`  ${counts[0]} departamentos, ${counts[1]} utilizadores, ${counts[2]} recursos ativos, ${counts[3]} reservas`);
  console.log(`  Password demo (todos os utilizadores): ${demoPassword}`);
  console.log('  Execute também: npm run db:seed --prefix service-iam');

  await prisma.$disconnect();
  await pool.end();
}

async function createSeedReservation(
  prisma: PrismaClient,
  spec: DemoReservation,
  userByEmail: Map<string, string>,
  resourceByKey: Map<string, string>,
) {
  const userId = userByEmail.get(spec.userEmail);
  const resourceId = resourceByKey.get(spec.resourceKey);
  if (!userId || !resourceId) {
    throw new Error(`Reserva ${spec.key}: user ou resource em falta`);
  }

  const startDate = slotDate(spec.daysFromNow, spec.startHour);
  const endDate = slotDate(spec.daysFromNow, spec.endHour);
  const approvedById = spec.approverEmail
    ? userByEmail.get(spec.approverEmail)
    : undefined;

  const approvedAt =
    spec.status === ReservationStatus.APPROVED ||
    spec.status === ReservationStatus.REJECTED
      ? new Date()
      : undefined;

  await prisma.reservation.create({
    data: {
      startDate,
      endDate,
      status: spec.status as ReservationStatus,
      notes: spec.notes ?? SEED_RESERVATION_NOTES,
      rejectReason: spec.rejectReason,
      approvedAt,
      approvedById,
      userId,
      resourceId,
    },
  });
  console.log(`  reserva: ${spec.key} → ${spec.status}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
