import { apiUrl, type ApiService } from './apiBase';

export type HealthStatus = 'healthy' | 'unhealthy' | 'checking';

export type ServiceHealthTarget = {
  id: ApiService;
  name: string;
  label: string;
  port: number;
  description: string;
};

export type HealthCheckResult = {
  id: ApiService;
  name: string;
  label: string;
  port: number;
  url: string;
  status: HealthStatus;
  httpStatus?: number;
  latencyMs?: number;
  body?: { ok?: boolean; service?: string };
  error?: string;
  checkedAt: string;
};

export const HEALTH_TARGETS: ServiceHealthTarget[] = [
  {
    id: 'iam',
    name: 'service-iam',
    label: 'IAM',
    port: 3001,
    description: 'Autenticação JWT, utilizadores e RBAC',
  },
  {
    id: 'core',
    name: 'service-core',
    label: 'Core',
    port: 3000,
    description: 'Departamentos, recursos, reservas e relatórios',
  },
  {
    id: 'data',
    name: 'service-data',
    label: 'Data',
    port: 3002,
    description: 'Agregados de dashboard (MongoDB + RabbitMQ)',
  },
  {
    id: 'audit',
    name: 'service-audit',
    label: 'Audit',
    port: 3003,
    description: 'Trilha de auditoria (MongoDB + RabbitMQ)',
  },
];

const DEFAULT_TIMEOUT_MS = 8000;

async function probeOne(target: ServiceHealthTarget): Promise<HealthCheckResult> {
  const url = apiUrl(target.id, '/health');
  const started = performance.now();
  const checkedAt = new Date().toISOString();

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    window.clearTimeout(timer);

    const latencyMs = Math.round(performance.now() - started);
    const text = await res.text();
    let body: { ok?: boolean; service?: string } | undefined;
    try {
      body = text ? (JSON.parse(text) as { ok?: boolean; service?: string }) : undefined;
    } catch {
      body = undefined;
    }

    const healthy = res.ok && body?.ok === true;
    return {
      id: target.id,
      name: target.name,
      label: target.label,
      port: target.port,
      url,
      status: healthy ? 'healthy' : 'unhealthy',
      httpStatus: res.status,
      latencyMs,
      body,
      error: healthy ? undefined : text || res.statusText || 'Resposta inválida',
      checkedAt,
    };
  } catch (e) {
    const latencyMs = Math.round(performance.now() - started);
    const message =
      e instanceof Error
        ? e.name === 'AbortError'
          ? 'Timeout — serviço não respondeu a tempo'
          : e.message
        : String(e);
    return {
      id: target.id,
      name: target.name,
      label: target.label,
      port: target.port,
      url,
      status: 'unhealthy',
      latencyMs,
      error: message,
      checkedAt,
    };
  }
}

export async function runHealthChecks(): Promise<HealthCheckResult[]> {
  const checking: HealthCheckResult[] = HEALTH_TARGETS.map((t) => ({
    id: t.id,
    name: t.name,
    label: t.label,
    port: t.port,
    url: apiUrl(t.id, '/health'),
    status: 'checking',
    checkedAt: new Date().toISOString(),
  }));

  const results = await Promise.all(HEALTH_TARGETS.map((t) => probeOne(t)));
  return results.length ? results : checking;
}

export function summarizeHealth(results: HealthCheckResult[]): {
  total: number;
  healthy: number;
  unhealthy: number;
  allHealthy: boolean;
  avgLatencyMs: number | null;
} {
  const healthy = results.filter((r) => r.status === 'healthy').length;
  const unhealthy = results.filter((r) => r.status === 'unhealthy').length;
  const latencies = results
    .map((r) => r.latencyMs)
    .filter((n): n is number => typeof n === 'number');
  const avgLatencyMs =
    latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

  return {
    total: results.length,
    healthy,
    unhealthy,
    allHealthy: results.length > 0 && healthy === results.length,
    avgLatencyMs,
  };
}
