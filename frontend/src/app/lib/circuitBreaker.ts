/** Falha rápida quando o circuito está aberto (serviço em cooldown). */
export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;

  constructor(retryAfterMs: number, message?: string) {
    super(
      message ??
        `Serviço temporariamente indisponível. Tente novamente em ${Math.ceil(retryAfterMs / 1000)}s.`,
    );
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
  }
}

type CircuitState = 'closed' | 'open' | 'half-open';

function envInt(name: string, fallback: number): number {
  const v = import.meta.env[name];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Erros 4xx (exceto 429) não devem abrir o circuito — são problemas de pedido/cliente. */
export function shouldTripCircuit(e: unknown): boolean {
  if (e instanceof CircuitOpenError) return false;
  if (e instanceof TypeError) return true;
  if (e && typeof e === 'object' && 'status' in e) {
    const s = (e as { status?: number }).status;
    if (typeof s === 'number') {
      if (s >= 400 && s < 500 && s !== 429) return false;
      if (s >= 500) return true;
    }
  }
  return true;
}

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures = 0;
  private halfOpenSuccesses = 0;
  private nextAttemptAt = 0;

  constructor(
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number,
    private readonly halfOpenSuccessTarget: number,
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === 'open') {
      if (now < this.nextAttemptAt) {
        throw new CircuitOpenError(this.nextAttemptAt - now);
      }
      this.state = 'half-open';
      this.halfOpenSuccesses = 0;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (e) {
      if (shouldTripCircuit(e)) {
        this.recordFailure();
      }
      throw e;
    }
  }

  private recordSuccess(): void {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses >= this.halfOpenSuccessTarget) {
        this.state = 'closed';
      }
    } else {
      this.state = 'closed';
    }
  }

  private recordFailure(): void {
    if (this.state === 'half-open') {
      this.state = 'open';
      this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
      this.failures = this.failureThreshold;
      return;
    }
    this.failures += 1;
    if (this.failures >= this.failureThreshold) {
      this.state = 'open';
      this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
    }
  }
}

const breakers = new Map<string, CircuitBreaker>();

function getBreaker(key: string): CircuitBreaker {
  let b = breakers.get(key);
  if (!b) {
    const threshold = envInt('VITE_CB_FAILURE_THRESHOLD', 5);
    const resetMs = envInt('VITE_CB_RESET_MS', 30_000);
    const halfOpenOk = envInt('VITE_CB_HALF_OPEN_SUCCESSES', 1);
    b = new CircuitBreaker(threshold, resetMs, halfOpenOk);
    breakers.set(key, b);
  }
  return b;
}

/** Extrai chave estável: `core` | `iam` | `data` | `audit` | origem absoluta. */
export function circuitKeyFromUrl(url: string): string {
  const proxy = url.match(/\/proxy\/(core|iam|data|audit)(?:\/|$)/);
  if (proxy?.[1]) return proxy[1];
  try {
    const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
    return u.origin;
  } catch {
    return 'default';
  }
}

export async function withCircuit<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return getBreaker(key).execute(fn);
}
