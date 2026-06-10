/**
 * Setup idempotente: Postgres (migrações + colunas em falta) + seeds core + iam.
 * Requer Postgres acessível (ex.: docker compose up -d postgres).
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const PG_URL =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:5432/reserveHub';
const coreUrl = process.env.CORE_DATABASE_URL ?? `${PG_URL.split('?')[0]}?schema=core`;
const iamUrl = process.env.IAM_DATABASE_URL ?? `${PG_URL.split('?')[0]}?schema=iam`;

function run(cmd, cwd, env = {}) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
}

function dockerPsql(sql) {
  const escaped = sql.replace(/"/g, '\\"');
  return execSync(
    `docker exec reserveHub-postgres psql -U postgres -d reserveHub -tAc "${escaped}"`,
    { encoding: 'utf8' },
  ).trim();
}

function dockerAvailable() {
  try {
    execSync('docker ps', { stdio: 'pipe' });
    execSync('docker inspect reserveHub-postgres', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function repairDatabase() {
  if (!dockerAvailable()) {
    console.log('Docker postgres não encontrado — a saltar reparos SQL (use migrações Prisma).');
    return;
  }

  console.log('\n=== Reparos SQL (idempotentes) ===');

  const hasNotes =
    dockerPsql(
      `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='core' AND table_name='reservations' AND column_name='notes'`,
    ) !== '0';

  if (!hasNotes) {
    const sqlPath = join(
      root,
      'service-core/prisma/migrations/20260521180000_reservation_audit_columns/migration.sql',
    );
    if (existsSync(sqlPath)) {
      console.log('Aplicar colunas em reservations…');
      execSync(
        `docker exec -i reserveHub-postgres psql -U postgres -d reserveHub < "${sqlPath.replace(/\\/g, '/')}"`,
        { shell: true, stdio: 'inherit' },
      );
    }
  } else {
    console.log('Colunas reservations OK.');
  }

  try {
    dockerPsql(
      `DELETE FROM core._prisma_migrations WHERE migration_name = '20260515120000_iam_initial' AND finished_at IS NULL`,
    );
  } catch {
    /* ignore */
  }
  console.log('Limpeza de migrações falhadas em core (se existiam).');
}

function tryMigrate(serviceDir, databaseUrl) {
  const name = serviceDir.includes('iam') ? 'iam' : 'core';
  try {
    run('npx prisma migrate deploy', serviceDir, { DATABASE_URL: databaseUrl });
  } catch (e) {
    const out = String(e.message ?? e.stdout ?? e.stderr ?? '');
    if (out.includes('P3005')) {
      console.log(`[${name}] P3005 — a marcar migrações como aplicadas…`);
      const migDir = join(serviceDir, 'prisma/migrations');
      const dirs = readdirSync(migDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^\d+_/.test(d.name))
        .map((d) => d.name);
      for (const d of dirs) {
        try {
          run(`npx prisma migrate resolve --applied ${d}`, serviceDir, {
            DATABASE_URL: databaseUrl,
          });
        } catch {
          /* já aplicada */
        }
      }
      run('npx prisma migrate deploy', serviceDir, { DATABASE_URL: databaseUrl });
    } else {
      throw e;
    }
  }
}

function validateGovernanceSchema() {
  if (!dockerAvailable()) {
    console.log('Docker postgres não encontrado — a saltar validação de schema.');
    return;
  }
  const checks = [
    { table: 'departments', column: 'priority' },
    { table: 'departments', column: 'costCenterCode' },
    { table: 'resources', column: 'departmentId' },
    { table: 'resources', column: 'description' },
    { table: 'users', column: 'active' },
  ];
  for (const { table, column } of checks) {
    const count = dockerPsql(
      `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='core' AND table_name='${table}' AND column_name='${column}'`,
    );
    if (count === '0') {
      throw new Error(
        `Coluna em falta: core.${table}.${column}. Corra migrações Prisma (service-core).`,
      );
    }
  }
  console.log('Schema de governança OK.');
}

function validateCounts() {
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM core.departments WHERE active = true) AS deps,
      (SELECT COUNT(*) FROM core.users) AS users,
      (SELECT COUNT(*) FROM core.resources WHERE active = true) AS resources,
      (SELECT COUNT(*) FROM core.reservations) AS reservations,
      (SELECT COUNT(*) FROM iam.users WHERE active = true) AS iam_users;
  `;
  try {
    const out = execSync(
      `docker exec reserveHub-postgres psql -U postgres -d reserveHub -tAc "${sql.replace(/\s+/g, ' ')}"`,
      { encoding: 'utf8' },
    ).trim();
    const [deps, users, resources, reservations, iamUsers] = out.split('|').map((s) => s.trim());
    console.log('\n=== Validação ===');
    console.log(`  departamentos ativos: ${deps}`);
    console.log(`  core.users: ${users}`);
    console.log(`  recursos ativos: ${resources}`);
    console.log(`  reservas: ${reservations}`);
    console.log(`  iam.users ativos: ${iamUsers}`);

    if (Number(deps) < 1 || Number(iamUsers) < 1) {
      throw new Error('Contagens mínimas não atingidas após seed.');
    }
  } catch (e) {
    console.warn('Validação via docker ignorada:', e.message);
  }
}

async function main() {
  console.log('ReserveHub — setup-database.mjs');
  console.log('Postgres:', PG_URL.replace(/:[^:@]+@/, ':****@'));

  await repairDatabase();

  console.log('\n=== Migrações Prisma ===');
  tryMigrate(join(root, 'service-core'), coreUrl);
  tryMigrate(join(root, 'service-iam'), iamUrl);

  console.log('\n=== Seeds ===');
  run('npx prisma db seed', join(root, 'service-core'), { DATABASE_URL: coreUrl });
  run('npx prisma db seed', join(root, 'service-iam'), { DATABASE_URL: iamUrl });

  validateGovernanceSchema();
  validateCounts();
  console.log('\nSetup da base de dados concluído.');
  console.log('Login: admin@reservehub.local / ReserveHub1! (ou SEED_DEMO_PASSWORD)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
