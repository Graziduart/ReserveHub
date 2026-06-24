import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Clock,
  ExternalLink,
  RefreshCw,
  Server,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { RequireRole } from '../components/auth/RequireRole';
import { apiUrl } from '../lib/apiBase';
import {
  HEALTH_TARGETS,
  runHealthChecks,
  summarizeHealth,
  type HealthCheckResult,
} from '../lib/health-check';
import { CircuitBreakerPanel } from '../components/ops/CircuitBreakerPanel';
import { cn } from '../lib/utils';

const AUTO_REFRESH_MS = 15_000;

function StatusPill({ status }: { status: HealthCheckResult['status'] }) {
  if (status === 'checking') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
        <RefreshCw className="w-3 h-3 animate-spin" />
        A verificar…
      </span>
    );
  }
  if (status === 'healthy') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-200">
        <CheckCircle2 className="w-3 h-3" />
        Online
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-800 border border-red-200">
      <XCircle className="w-3 h-3" />
      Indisponível
    </span>
  );
}

function HealthChecksPage() {
  const [results, setResults] = useState<HealthCheckResult[]>(() =>
    HEALTH_TARGETS.map((t) => ({
      id: t.id,
      name: t.name,
      label: t.label,
      port: t.port,
      url: apiUrl(t.id, '/health'),
      status: 'checking',
      checkedAt: new Date().toISOString(),
    })),
  );
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const next = await runHealthChecks();
      setResults(next);
      setLastRun(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = window.setInterval(() => {
      void refresh();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, refresh]);

  const summary = summarizeHealth(results);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-blue-600" />
            Health Checks
          </h1>
          <p className="text-gray-600 mt-1 max-w-2xl">
            Monitorização em tempo real dos microserviços ReserveHub via{' '}
            <code className="text-sm bg-gray-100 px-1 rounded">GET /health</code>. Equivalente
            ao script <code className="text-sm bg-gray-100 px-1 rounded">npm run verify</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300"
            />
            Auto ({AUTO_REFRESH_MS / 1000}s)
          </label>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refresh()}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            Atualizar
          </Button>
        </div>
      </div>

      <div
        className={cn(
          'rounded-lg border px-4 py-3 flex flex-wrap items-center gap-3',
          summary.allHealthy
            ? 'bg-green-50 border-green-200 text-green-900'
            : summary.unhealthy > 0
              ? 'bg-red-50 border-red-200 text-red-900'
              : 'bg-blue-50 border-blue-200 text-blue-900',
        )}
      >
        {summary.allHealthy ? (
          <CheckCircle2 className="w-5 h-5 shrink-0" />
        ) : summary.unhealthy > 0 ? (
          <XCircle className="w-5 h-5 shrink-0" />
        ) : (
          <RefreshCw className="w-5 h-5 shrink-0 animate-spin" />
        )}
        <span className="font-medium">
          {summary.allHealthy
            ? 'Todos os serviços estão operacionais'
            : summary.unhealthy > 0
              ? `${summary.unhealthy} de ${summary.total} serviço(s) indisponível(is)`
              : 'A verificar serviços…'}
        </span>
        {summary.avgLatencyMs != null && (
          <span className="text-sm opacity-80 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Latência média: {summary.avgLatencyMs} ms
          </span>
        )}
        {lastRun && (
          <span className="text-sm opacity-80 ml-auto">
            Última verificação: {lastRun.toLocaleTimeString('pt-PT')}
          </span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {results.map((row) => {
          const meta = HEALTH_TARGETS.find((t) => t.id === row.id);
          return (
            <Card
              key={row.id}
              className={cn(
                'transition-shadow',
                row.status === 'healthy' && 'border-green-200',
                row.status === 'unhealthy' && 'border-red-200',
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'p-2 rounded-lg shrink-0',
                        row.status === 'healthy'
                          ? 'bg-green-100 text-green-700'
                          : row.status === 'unhealthy'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-blue-100 text-blue-700',
                      )}
                    >
                      <Server className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base">{row.label}</CardTitle>
                      <p className="text-sm text-gray-500 font-mono truncate">{row.name}</p>
                    </div>
                  </div>
                  <StatusPill status={row.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                {meta && (
                  <p className="text-sm text-gray-600">{meta.description}</p>
                )}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <div>
                    <dt className="text-gray-500">Porta</dt>
                    <dd className="font-medium text-gray-900">{row.port}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">HTTP</dt>
                    <dd className="font-medium text-gray-900">
                      {row.httpStatus ?? '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Latência</dt>
                    <dd className="font-medium text-gray-900">
                      {row.latencyMs != null ? `${row.latencyMs} ms` : '—'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Payload</dt>
                    <dd className="font-medium text-gray-900 font-mono text-xs">
                      {row.body
                        ? `ok: ${String(row.body.ok)}, ${row.body.service ?? '—'}`
                        : '—'}
                    </dd>
                  </div>
                </dl>
                {row.error && row.status === 'unhealthy' && (
                  <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2 break-words">
                    {row.error.length > 280 ? `${row.error.slice(0, 280)}…` : row.error}
                  </p>
                )}
                {row.url && (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    {row.url}
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <CircuitBreakerPanel />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Infraestrutura (Docker Compose)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-600 mb-4">
            Componentes de suporte verificados indiretamente pelos serviços acima.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                name: 'PostgreSQL',
                port: 5432,
                deps: ['iam', 'core'],
                hint: 'IAM + Core online',
              },
              {
                name: 'MongoDB',
                port: 27017,
                deps: ['data', 'audit'],
                hint: 'Data + Audit online',
              },
              {
                name: 'RabbitMQ',
                port: '5672 / 15672',
                deps: ['core', 'data', 'audit'],
                hint: 'Core publica; Data/Audit consomem',
              },
            ].map((infra) => {
              const depsOk = infra.deps.every((id) =>
                results.find((r) => r.id === id && r.status === 'healthy'),
              );
              return (
                <div
                  key={infra.name}
                  className={cn(
                    'rounded-lg border px-4 py-3',
                    depsOk ? 'border-green-200 bg-green-50/50' : 'border-gray-200',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{infra.name}</span>
                    {depsOk ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">:{infra.port}</p>
                  <p className="text-xs text-gray-600 mt-2">{infra.hint}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function HealthChecks() {
  return (
    <RequireRole roles={['ADMIN']}>
      <HealthChecksPage />
    </RequireRole>
  );
}
