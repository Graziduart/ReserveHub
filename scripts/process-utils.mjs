import { execSync } from 'node:child_process';

/** Indica se algo escuta na porta (TCP LISTEN). */
export function portInUse(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr ":${port}" | findstr LISTENING`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        shell: true,
      });
      return out.trim().length > 0;
    }
    execSync(`lsof -iTCP:${port} -sTCP:LISTEN`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

/** Liberta a porta (processos locais core / Vite). */
export function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr ":${port}" | findstr LISTENING`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
        shell: true,
      });
      const pids = new Set(
        out
          .split('\n')
          .map((line) => line.trim().split(/\s+/).pop())
          .filter((pid) => pid && pid !== '0'),
      );
      for (const pid of pids) {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', shell: true });
      }
      return pids.size > 0;
    }
    execSync(`lsof -ti:${port} | xargs kill -9`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

export async function urlOk(url, timeoutMs = 3000) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok || res.status === 304;
  } catch {
    return false;
  }
}
