import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { hashPassword } from '../src/shared/crypto/password-hash';
import { DEMO_USERS } from '../../service-core/prisma/seed-data';

async function syncUserToCore(
  prisma: PrismaClient,
  user: {
    id: string;
    email: string;
    password: string;
    name: string;
    role: Role;
    departmentId: string;
  },
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `INSERT INTO core.users (id, email, password, name, role, "departmentId")
     VALUES ($1, $2, $3, $4, $5::core."Role", $6)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       password = EXCLUDED.password,
       name = EXCLUDED.name,
       role = EXCLUDED.role,
       "departmentId" = EXCLUDED."departmentId"`,
    user.id,
    user.email,
    user.password,
    user.name,
    user.role,
    user.departmentId,
  );
}

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

async function main() {
  const { prisma, pool } = createPrisma();
  const demoPassword = process.env.SEED_DEMO_PASSWORD ?? 'ReserveHub1!';
  const hashed = hashPassword(demoPassword);

  const deptRows = await prisma.$queryRawUnsafe<Array<{ id: string; sigla: string }>>(
    `SELECT id, sigla FROM core.departments WHERE active = true`,
  );
  const deptBySigla = new Map(deptRows.map((d) => [d.sigla, d.id]));

  if (deptBySigla.size === 0) {
    console.warn(
      'IAM seed: sem departamentos em core. Execute primeiro: npm run db:seed --prefix service-core',
    );
    await prisma.$disconnect();
    await pool.end();
    return;
  }

  console.log('IAM seed: a sincronizar utilizadores de demonstração…');

  for (const u of DEMO_USERS) {
    const departmentId = deptBySigla.get(u.departmentSigla);
    if (!departmentId) {
      console.warn(`  ignorado ${u.email}: dept ${u.departmentSigla} não existe`);
      continue;
    }

    const saved = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        id: u.id,
        email: u.email,
        password: hashed,
        name: u.name,
        role: u.role as Role,
        departmentId,
        active: true,
      },
      update: {
        name: u.name,
        password: hashed,
        role: u.role as Role,
        departmentId,
        active: true,
      },
    });

    await syncUserToCore(prisma, {
      id: saved.id,
      email: saved.email,
      password: hashed,
      name: saved.name,
      role: saved.role,
      departmentId: saved.departmentId,
    });
    console.log(`  iam + core: ${u.email} (${u.role})`);
  }

  console.log(`\nIAM seed concluído. Password demo: ${demoPassword}`);

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
