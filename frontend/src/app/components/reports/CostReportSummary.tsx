import { CheckCircle2, Clock, Layers, Timer } from 'lucide-react';
import { Card, CardContent } from '../ui/Card';

type CostReportSummaryProps = {
  aprovadas: number;
  pendentes: number;
  horas: number;
  departamentos: number;
  linhas: number;
};

const items = [
  {
    key: 'aprovadas',
    label: 'Reservas aprovadas',
    icon: CheckCircle2,
    iconBg: 'bg-emerald-500',
    valueClass: 'text-emerald-600',
  },
  {
    key: 'pendentes',
    label: 'Reservas pendentes',
    icon: Clock,
    iconBg: 'bg-amber-500',
    valueClass: 'text-amber-600',
  },
  {
    key: 'horas',
    label: 'Horas reservadas',
    icon: Timer,
    iconBg: 'bg-blue-500',
    valueClass: 'text-blue-600',
    format: (v: number) => `${v.toFixed(1)}h`,
  },
  {
    key: 'departamentos',
    label: 'Departamentos',
    icon: Layers,
    iconBg: 'bg-violet-500',
    valueClass: 'text-violet-600',
  },
] as const;

export function CostReportSummary({
  aprovadas,
  pendentes,
  horas,
  departamentos,
  linhas,
}: CostReportSummaryProps) {
  const values: Record<string, number> = {
    aprovadas,
    pendentes,
    horas,
    departamentos,
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {items.map((item) => {
          const Icon = item.icon;
          const raw = values[item.key];
          const display =
            'format' in item && item.format ? item.format(raw) : String(raw);
          return (
            <Card key={item.key} className="border-gray-200/80 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{item.label}</p>
                    <p className={`text-3xl font-semibold mt-1 tracking-tight ${item.valueClass}`}>
                      {display}
                    </p>
                  </div>
                  <div
                    className={`w-11 h-11 rounded-xl ${item.iconBg} flex items-center justify-center shrink-0 shadow-sm`}
                  >
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-gray-500 px-1">
        {linhas} linha{linhas === 1 ? '' : 's'} de detalhe consolidadas no período analisado.
      </p>
    </div>
  );
}
