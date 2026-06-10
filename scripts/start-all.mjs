/**
 * Sobe ReserveHub de uma vez: infra Docker → backends → frontend (Vite).
 *
 * Uso (na pasta reserveHub):
 *   node scripts/start-all.mjs
 *   node scripts/start-all.mjs --seed        # inclui migrações + seeds demo
 *   node scripts/start-all.mjs --build       # rebuild imagens Docker
 *   node scripts/start-all.mjs --no-web      # só backends
 *   node scripts/start-all.mjs --integration # no fim corre verify + smoke
 *   node scripts/start-all.mjs --docker-core   # força core em Docker (Linux/CI)
 */
import { execSync, spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, openSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startLocalCore } from './start-local-core.mjs';
import { killPort, urlOk } from './process-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const args = new Set(process.argv.slice(2));
const withSeed = args.has('--seed');
const withBuild = args.has('--build');
const noWeb = args.has('--no-web');
const withIntegration = args.has('--integration');

const preferLocalCore =
  !args.has('--docker-core') &&
  (args.has('--local-core') || process.platform === 'win32');

const BACKEND_DOCKER = 'service-iam service-data service-audit';

const endpoints = [
  { name: 'IAM', url: 'http://127.0.0.1:3001/health' },
  { name: 'Core', url: 'http://127.0.0.1:3000/health' },
  { name: 'Data', url: 'http://127.0.0.1:3002/health' },
  { name: 'Audit', url: 'http://127.0.0.1:3003/health' },
];

function run(cmd, opts = {}) {
  console.log(`\n▶ ${cmd}\n`);
  execSync(cmd, {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    ...opts,
  });
}

/** 404 = imagem Docker do core desatualizada; 401/403 = rota existe. */
async function coreHasCostReportRoute() {
  try {
    const res = await fetch('http://127.0.0.1:3000/reports/cost-allocation', {
      signal: AbortSignal.timeout(4000),
    });
    return res.status !== 404;
  } catch {
    return false;
  }
}

function buildCoreForDocker() {
  console.log('\n▶ Compilar service-core (dist/)…\n');
  run('npm run build --prefix service-core');
}

async function rebuildCoreImage(extraDockerArgs = '') {
  buildCoreForDocker();
  run(
    `docker compose --profile backend build ${extraDockerArgs} service-core`.trim(),
  );
  run('docker compose --profile backend up -d service-core');
}

async function ensureCoreReportsRoute() {
  if (await coreHasCostReportRoute()) return true;

  if (preferLocalCore) {
    console.log(
      '\n⚠ Core sem rota de relatórios — a reiniciar service-core local…\n',
    );
    await startLocalCore({ restart: true });
    return waitHealthy(30, 2000);
  }

  console.log(
    '\n⚠ Core sem GET /reports/cost-allocation (imagem antiga). A reconstruir service-core…\n',
  );
  try {
    await rebuildCoreImage();
  } catch {
    console.log('\n⚠ Build Docker falhou — a usar core local…\n');
    await startLocalCore();
    return waitHealthy(30, 2000);
  }

  if (await coreHasCostReportRoute()) return true;

  console.log('\n⚠ Imagem Docker ainda desatualizada — a usar core local…\n');
  await startLocalCore();
  return waitHealthy(30, 2000);
}

async function waitHealthy(maxAttempts = 45, delayMs = 2000) {
  console.log('\n⏳ A aguardar backends (health)…\n');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let ok = 0;
    for (const ep of endpoints) {
      try {
        const res = await fetch(ep.url, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          ok++;
          process.stdout.write(`  ✓ ${ep.name}  `);
        }
      } catch {
        /* retry */
      }
    }
    if (ok === endpoints.length) {
      console.log('\n\nTodos os serviços responderam.\n');
      return true;
    }
    console.log(`\n  tentativa ${attempt}/${maxAttempts} (${ok}/${endpoints.length} OK)`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

function ensureFrontendEnv() {
  const envPath = join(root, 'frontend', '.env');
  const example = join(root, 'frontend', '.env.example');
  if (!existsSync(envPath) && existsSync(example)) {
    copyFileSync(example, envPath);
    console.log('Criado frontend/.env a partir de .env.example');
  }
}

const FRONTEND_URL = 'http://127.0.0.1:5173/';

async function waitFrontend(maxAttempts = 60, delayMs = 2000) {
  console.log('\n⏳ A aguardar frontend (Vite)…\n');
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      const res = await fetch(FRONTEND_URL, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status === 304) {
        console.log('  ✓ Frontend OK em', FRONTEND_URL, '\n');
        return true;
      }
    } catch {
      /* retry */
    }
    if (i % 5 === 0) console.log(`  tentativa ${i}/${maxAttempts}…`);
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return false;
}

async function startFrontend() {
  ensureFrontendEnv();

  if (await urlOk(FRONTEND_URL)) {
    console.log(`Frontend já em execução: ${FRONTEND_URL}`);
    return;
  }

  const frontendDir = join(root, 'frontend');
  const logsDir = join(root, 'logs');
  if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });
  const logPath = join(logsDir, 'vite-dev.log');

  if (process.platform === 'win32') {
    // npm.cmd + stdio custom falha no Windows (EINVAL); usar cmd com redirect.
    spawn('cmd.exe', ['/d', '/s', '/c', `npm run dev >> "${logPath}" 2>&1`], {
      cwd: frontendDir,
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    }).unref();
  } else {
    const logFd = openSync(logPath, 'a');
    spawn('npm', ['run', 'dev'], {
      cwd: frontendDir,
      detached: true,
      stdio: ['ignore', logFd, logFd],
      shell: false,
    }).unref();
  }

  console.log(`Frontend: npm run dev (log: logs/vite-dev.log)`);
}

function printSummary() {
  const frontendBlock = noWeb
    ? `  Frontend:  (não iniciado)
  → noutro terminal: cd frontend && npm run dev
     ou na raiz:     npm run dev:web`
    : `  Frontend:  http://127.0.0.1:5173/`;

  console.log(`
══════════════════════════════════════════
  ReserveHub — em execução
══════════════════════════════════════════
${frontendBlock}
  Login:     admin@reservehub.local / ReserveHub1!

  IAM:       http://127.0.0.1:3001/health
  Core:      http://127.0.0.1:3000/health${preferLocalCore ? ' (processo local)' : ''}
  Data:      http://127.0.0.1:3002/health
  Audit:     http://127.0.0.1:3003/health
  Rabbit UI: http://localhost:15672  (guest/guest)

  Parar tudo:  npm run stop:all
  Logs Docker: npm run docker:logs
══════════════════════════════════════════
`);
}

async function main() {
  console.log('ReserveHub — start-all\n');

  try {
    execSync('docker info', { stdio: 'pipe', shell: true });
  } catch {
    console.error('Docker não está a correr. Inicie o Docker Desktop e tente de novo.');
    process.exit(1);
  }

  run('docker compose up -d postgres rabbitmq mongo');

  if (withSeed) {
    run('node scripts/setup-database.mjs');
  } else {
    console.log('\n(Dica: primeira vez ou DB vazia → npm run start:all -- --seed)\n');
  }

  if (withBuild && !preferLocalCore) {
    buildCoreForDocker();
  }

  const buildFlag = withBuild && !preferLocalCore ? '--build' : '';
  run(`docker compose --profile backend up -d ${BACKEND_DOCKER} ${buildFlag}`.trim());

  if (preferLocalCore) {
    await startLocalCore();
  } else {
    run(`docker compose --profile backend up -d service-core ${buildFlag}`.trim());
  }

  let healthy = await waitHealthy();
  if (!healthy) {
    console.error(
      'Alguns serviços não responderam a tempo. Verifique: npm run docker:logs',
    );
    process.exit(1);
  }

  healthy = await ensureCoreReportsRoute();
  if (!healthy || !(await coreHasCostReportRoute())) {
    console.error(
      'service-core não expõe /reports/cost-allocation. Veja logs/core-dev.log ou npm run docker:logs',
    );
    process.exit(1);
  }

  if (!noWeb) {
    await startFrontend();
    const webOk = await waitFrontend();
    if (!webOk) {
      console.error(
        'Frontend não respondeu em 127.0.0.1:5173. Veja logs/vite-dev.log ou execute: npm run dev:web',
      );
      process.exit(1);
    }
  }

  printSummary();

  if (withIntegration) {
    run('npm run integration');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
