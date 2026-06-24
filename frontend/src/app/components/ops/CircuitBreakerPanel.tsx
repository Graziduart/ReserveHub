import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, RotateCcw, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/button';
import {
  CIRCUIT_CHANGED_EVENT,
  getCircuitConfig,
  getCircuitStatuses,
  resetAllCircuits,
  resetCircuit,
  type CircuitBreakerStatus,
  type CircuitServiceId,
} from '../../lib/circuitBreaker';
import { cn } from '../../lib/utils';

function stateLabel(state: CircuitBreakerStatus['state']): string {
  switch (state) {
    case 'closed':
      return 'Fechado';
    case 'open':
      return 'Aberto';
    case 'half-open':
      return 'Meio-aberto';
  }
}

function StateBadge({ state }: { state: CircuitBreakerStatus['state'] }) {
  if (state === 'closed') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-800 border border-green-200">
        <CheckCircle2 className="w-3 h-3" />
        Fechado
      </span>
    );
  }
  if (state === 'half-open') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
        <RefreshCw className="w-3 h-3" />
        Meio-aberto
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-800 border border-red-200">
      <AlertTriangle className="w-3 h-3" />
      Aberto
    </span>
  );
}

type CircuitBreakerPanelProps = {
  autoRefreshMs?: number;
  compact?: boolean;
};

export function CircuitBreakerPanel({
  autoRefreshMs = 2000,
  compact = false,
}: CircuitBreakerPanelProps) {
  const [statuses, setStatuses] = useState<CircuitBreakerStatus[]>(() =>
    getCircuitStatuses(),
  );
  const cfg = getCircuitConfig();

  const refresh = useCallback(() => {
    setStatuses(getCircuitStatuses());
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(CIRCUIT_CHANGED_EVENT, onChange);
    const id = window.setInterval(refresh, autoRefreshMs);
    return () => {
      window.removeEventListener(CIRCUIT_CHANGED_EVENT, onChange);
      window.clearInterval(id);
    };
  }, [autoRefreshMs, refresh]);

  const anyOpen = statuses.some((s) => s.state !== 'closed');

  return (
    <Card className={cn(anyOpen && 'border-amber-200')}>
      <CardHeader className={cn(compact && 'pb-3')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-600" />
            <div>
              <CardTitle className="text-base">Circuit Breaker (frontend)</CardTitle>
              {!compact && (
                <p className="text-sm text-gray-600 mt-1 font-normal">
                  Protege chamadas à API: após {cfg.failureThreshold} falhas de servidor, o
                  circuito abre por {cfg.resetTimeoutMs / 1000}s e bloqueia novos pedidos.
                </p>
              )}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              resetAllCircuits();
              refresh();
            }}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Repor todos
          </Button>
        </div>
      </CardHeader>
      <CardContent className={cn(compact && 'pt-0')}>
        <div className="grid gap-3 sm:grid-cols-2">
          {statuses.map((row) => (
            <div
              key={row.key}
              className={cn(
                'rounded-lg border px-4 py-3',
                row.state === 'closed' && 'border-gray-200',
                row.state === 'half-open' && 'border-amber-200 bg-amber-50/40',
                row.state === 'open' && 'border-red-200 bg-red-50/40',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-gray-900">{row.label}</span>
                <StateBadge state={row.state} />
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                <div>
                  <dt className="text-gray-500">Falhas</dt>
                  <dd className="font-medium text-gray-900">
                    {row.failures} / {row.failureThreshold}
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Estado</dt>
                  <dd className="font-medium text-gray-900">{stateLabel(row.state)}</dd>
                </div>
                {row.retryAfterMs != null && (
                  <div className="col-span-2">
                    <dt className="text-gray-500">Nova tentativa em</dt>
                    <dd className="font-medium text-red-700">
                      {Math.ceil(row.retryAfterMs / 1000)}s
                    </dd>
                  </div>
                )}
              </dl>
              {row.state !== 'closed' && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-8 text-xs"
                  onClick={() => {
                    resetCircuit(row.key as CircuitServiceId);
                    refresh();
                  }}
                >
                  Repor circuito
                </Button>
              )}
            </div>
          ))}
        </div>
        {!compact && (
          <p className="text-xs text-gray-500 mt-4">
            Erros 4xx (ex.: 403) não abrem o circuito. Falhas de rede e HTTP 5xx contam.
            Configuração: <code className="bg-gray-100 px-1 rounded">VITE_CB_FAILURE_THRESHOLD</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">VITE_CB_RESET_MS</code>.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
