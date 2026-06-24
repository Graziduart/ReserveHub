/** Falha rápida quando o circuito está aberto (serviço em cooldown). */
export class CircuitOpenError extends Error {
  readonly retryAfterMs: number;
  readonly serviceKey: string;

  constructor(retryAfterMs: number, serviceKey: string, message?: string) {
    super(
      message ??
        `Serviço temporariamente indisponível. Tente novamente em ${Math.ceil(retryAfterMs / 1000)}s.`,
    );
    this.name = 'CircuitOpenError';
    this.retryAfterMs = retryAfterMs;
    this.serviceKey = serviceKey;
  }
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export type CircuitServiceId = 'core' | 'iam' | 'data' | 'audit';

export type CircuitBreakerStatus = {
  key: CircuitServiceId;
  label: string;
  state: CircuitState;
  failures: number;
  failureThreshold: number;
  resetTimeoutMs: number;
  retryAfterMs: number | null;
  nextAttemptAt: string | null;
};

export const CIRCUIT_SERVICES: { key: CircuitServiceId; label: string }[] = [
  { key: 'iam', label: 'IAM' },
  { key: 'core', label: 'Core' },
  { key: 'data', label: 'Data' },
  { key: 'audit', label: 'Audit' },
];

/** Disparado quando o estado de algum circuito muda (para atualizar UI). */
export const CIRCUIT_CHANGED_EVENT = 'reservehub:circuit-changed';

function notifyCircuitChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(CIRCUIT_CHANGED_EVENT));
  }
}

type CircuitStateInternal = CircuitState;

function envInt(name: string, fallback: number): number {
  const v = import.meta.env[name];
  if (v === undefined || v === '') return fallback;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function getCircuitConfig() {
  return {
    failureThreshold: envInt('VITE_CB_FAILURE_THRESHOLD', 5),
    resetTimeoutMs: envInt('VITE_CB_RESET_MS', 30_000),
    halfOpenSuccessTarget: envInt('VITE_CB_HALF_OPEN_SUCCESSES', 1),
  };
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
  private state: CircuitStateInternal = 'closed';
  private failures = 0;
  private halfOpenSuccesses = 0;
  private nextAttemptAt = 0;

  constructor(
    private readonly key: string,
    private readonly failureThreshold: number,
    private readonly resetTimeoutMs: number,
    private readonly halfOpenSuccessTarget: number,
  ) {}

  getSnapshot(): Omit<CircuitBreakerStatus, 'key' | 'label'> {
    const now = Date.now();
    const retryAfterMs =
      this.state === 'open' && this.nextAttemptAt > now
        ? this.nextAttemptAt - now
        : null;
    return {
      state: this.state,
      failures: this.failures,
      failureThreshold: this.failureThreshold,
      resetTimeoutMs: this.resetTimeoutMs,
      retryAfterMs,
      nextAttemptAt:
        this.state === 'open' && this.nextAttemptAt > now
          ? new Date(this.nextAttemptAt).toISOString()
          : null,
    };
  }

  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.halfOpenSuccesses = 0;
    this.nextAttemptAt = 0;
    notifyCircuitChanged();
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === 'open') {
      if (now < this.nextAttemptAt) {
        throw new CircuitOpenError(
          this.nextAttemptAt - now,
          this.key,
        );
      }
      this.state = 'half-open';
      this.halfOpenSuccesses = 0;
      notifyCircuitChanged();
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
    const prev = this.state;
    this.failures = 0;
    if (this.state === 'half-open') {
      this.halfOpenSuccesses += 1;
      if (this.halfOpenSuccesses >= this.halfOpenSuccessTarget) {
        this.state = 'closed';
      }
    } else {
      this.state = 'closed';
    }
    if (prev !== this.state) notifyCircuitChanged();
  }

  private recordFailure(): void {
    const prev = this.state;
    if (this.state === 'half-open') {
      this.state = 'open';
      this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
      this.failures = this.failureThreshold;
    } else {
      this.failures += 1;
      if (this.failures >= this.failureThreshold) {
        this.state = 'open';
        this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
      }
    }
    if (prev !== this.state || this.state === 'open') notifyCircuitChanged();
  }
}

const breakers = new Map<string, CircuitBreaker>();

function getBreaker(key: string): CircuitBreaker {
  let b = breakers.get(key);
  if (!b) {
    const cfg = getCircuitConfig();
    b = new CircuitBreaker(
      key,
      cfg.failureThreshold,
      cfg.resetTimeoutMs,
      cfg.halfOpenSuccessTarget,
    );
    breakers.set(key, b);
  }
  return b;
}

function ensureKnownBreakers(): void {
  for (const svc of CIRCUIT_SERVICES) {
    getBreaker(svc.key);
  }
}

/** Estado atual dos circuitos por microserviço (frontend). */
export function getCircuitStatuses(): CircuitBreakerStatus[] {
  ensureKnownBreakers();
  return CIRCUIT_SERVICES.map((svc) => ({
    key: svc.key,
    label: svc.label,
    ...getBreaker(svc.key).getSnapshot(),
  }));
}

/** Repõe um circuito (admin — força estado fechado). */
export function resetCircuit(key: CircuitServiceId): void {
  getBreaker(key).reset();
}

/** Repõe todos os circuitos. */
export function resetAllCircuits(): void {
  ensureKnownBreakers();
  for (const svc of CIRCUIT_SERVICES) {
    getBreaker(svc.key).reset();
  }
}

/** Extrai chave estável: `core` | `iam` | `data` | `audit` | origem absoluta. */
export function circuitKeyFromUrl(url: string): string {
  const proxy = url.match(/\/proxy\/(core|iam|data|audit)(?:\/|$)/);
  if (proxy?.[1]) return proxy[1];
  try {
    const u = new URL(
      url,
      typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
    );
    const portMap: Record<string, CircuitServiceId> = {
      '3000': 'core',
      '3001': 'iam',
      '3002': 'data',
      '3003': 'audit',
    };
    const port = u.port;
    if (port && portMap[port]) return portMap[port];
    return u.origin;
  } catch {
    return 'default';
  }
}

const SERVICE_LABELS: Record<string, string> = {
  core: 'Core',
  iam: 'IAM',
  data: 'Data',
  audit: 'Audit',
};

export function circuitServiceLabel(key: string): string {
  return SERVICE_LABELS[key] ?? key;
}

export async function withCircuit<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return getBreaker(key).execute(fn);
}
