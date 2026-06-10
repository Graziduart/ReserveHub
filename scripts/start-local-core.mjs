/**
 * Compila e inicia service-core localmente na porta 3000 (Windows/dev).
 * Para o container Docker reserveHub-core se estiver a correr.
 */
import { execSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { killPort, portInUse } from './process-utils.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function stopDockerCore() {
  try {
    execSync('docker compose --profile backend stop service-core', {
      cwd: root,
      stdio: 'pipe',
      shell: true,
    });
  } catch {
    /* container pode não existir */
  }
}

export async function waitCoreHealthy(maxAttempts = 30, delayMs = 2000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch('http://127.0.0.1:3000/health', {
        signal: AbortSignal.timeout(3000),
      });
      if (res.ok) return true;
    } catch {
      /* retry */
    }
    if (i % 5 === 0) console.log(`  core local: tentativa ${i}/${maxAttempts}…`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function isCoreHealthy() {
  try {
    const res = await fetch('http://127.0.0.1:3000/health', {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function startLocalCore({ build = true, restart = false } = {}) {
  const healthy = await isCoreHealthy();
  if (healthy && !restart) {
    console.log('Core já em execução (health OK) — a manter.');
    return;
  }

  if (portInUse(3000) || restart) {
    killPort(3000);
    await new Promise((r) => setTimeout(r, 800));
  }

  if (build) {
    console.log('\n▶ npm run build --prefix service-core\n');
    execSync('npm run build --prefix service-core', {
      cwd: root,
      stdio: 'inherit',
      shell: true,
    });
  }

  stopDockerCore();

  const logsDir = join(root, 'logs');
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, 'core-dev.log');
  const logFd = openSync(logPath, 'a');

  const coreEnv = {
    ...process.env,
    PORT: '3000',
    DATABASE_URL:
      process.env.CORE_DATABASE_URL ??
      'postgresql://postgres:postgres@127.0.0.1:5432/reserveHub?schema=core',
    JWT_SECRET:
      process.env.JWT_SECRET ?? 'reservehub-iam-docker-secret-change-me',
    RABBITMQ_URL: process.env.RABBITMQ_URL ?? 'amqp://guest:guest@127.0.0.1:5672',
    RABBITMQ_EXCHANGE: process.env.RABBITMQ_EXCHANGE ?? 'reservehub.events',
  };

  spawn(process.execPath, ['dist/src/main.js'], {
    cwd: join(root, 'service-core'),
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: coreEnv,
    shell: false,
  }).unref();

  console.log('Core local: http://127.0.0.1:3000 (log: logs/core-dev.log)');
}

if (process.argv[1]?.includes('start-local-core')) {
  await startLocalCore({ build: true, restart: true });
  const ok = await waitCoreHealthy();
  if (!ok) {
    console.error('Core local não respondeu. Veja logs/core-dev.log');
    process.exit(1);
  }
  const probe = await fetch('http://127.0.0.1:3000/reports/cost-allocation');
  console.log(
    probe.status === 404
      ? 'AVISO: /reports/cost-allocation ainda devolve 404'
      : `OK: /reports/cost-allocation → HTTP ${probe.status}`,
  );
}
