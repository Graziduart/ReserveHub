/**
 * Para a stack ReserveHub: containers Docker + processos locais (core :3000, Vite :5173).
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { killPort } from './process-utils.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

console.log('A parar containers ReserveHub…\n');
execSync('docker compose --profile backend --profile full down', {
  cwd: root,
  stdio: 'inherit',
  shell: true,
});

console.log('\nA parar processos locais (core :3000, frontend :5173)…');
const stoppedCore = killPort(3000);
const stoppedWeb = killPort(5173);
console.log(
  stoppedCore ? '  ✓ Core local parado' : '  · Core local (porta 3000 livre)',
);
console.log(
  stoppedWeb ? '  ✓ Frontend parado' : '  · Frontend (porta 5173 livre)',
);
console.log('\nReserveHub parado.\n');
