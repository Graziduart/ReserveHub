import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DeptCostAggregate } from '../../lib/cost-report';

const COLORS = [
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#65a30d',
  '#ea580c',
];

type CostReportChartsProps = {
  byDept: DeptCostAggregate[];
};

function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string;
  unit?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 shadow-lg text-sm">
      <p className="font-medium text-gray-900 mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-gray-600 flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          {entry.name}:{' '}
          <span className="font-semibold text-gray-900">
            {entry.value}
            {unit ?? ''}
          </span>
        </p>
      ))}
    </div>
  );
}

export function CostReportCharts({ byDept }: CostReportChartsProps) {
  if (byDept.length === 0) return null;

  const hoursData = byDept.map((d) => ({
    name: d.departamento,
    sigla: d.sigla,
    horas: Number(d.horas.toFixed(1)),
  }));

  const statusData = byDept.map((d) => ({
    name: d.sigla || d.departamento.slice(0, 8),
    fullName: d.departamento,
    Aprovadas: d.aprovadas,
    Pendentes: d.pendentes,
  }));

  const totalHoras = hoursData.reduce((s, d) => s + d.horas, 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <div className="rounded-xl border border-gray-100 bg-gradient-to-b from-white to-slate-50/50 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Distribuição de horas</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Partilha por departamento · {totalHoras.toFixed(1)}h no total
          </p>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={hoursData}
                dataKey="horas"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={58}
                outerRadius={88}
                paddingAngle={2}
                stroke="white"
                strokeWidth={2}
              >
                {hoursData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => (
                  <ChartTooltip
                    active={active}
                    payload={payload?.map((p) => ({
                      name: 'Horas',
                      value: p.value as number,
                      color: p.payload?.fill as string,
                    }))}
                    label={payload?.[0]?.payload?.name as string}
                    unit="h"
                  />
                )}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-xs text-gray-600">{String(value)}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-gray-100 bg-gradient-to-b from-white to-slate-50/50 p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">Estado das reservas</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Aprovadas vs pendentes por departamento
          </p>
        </div>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={statusData}
              margin={{ top: 8, right: 12, left: -8, bottom: 0 }}
              barGap={4}
              barCategoryGap="18%"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={{ stroke: '#e5e7eb' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#6b7280' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  const full =
                    statusData.find((d) => d.name === label)?.fullName ?? label;
                  return (
                    <ChartTooltip
                      active={active}
                      payload={payload?.map((p) => ({
                        name: p.name as string,
                        value: p.value as number,
                        color: p.color,
                      }))}
                      label={full}
                    />
                  );
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 12 }}
                formatter={(value) => (
                  <span className="text-xs text-gray-600">{String(value)}</span>
                )}
              />
              <Bar dataKey="Aprovadas" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="Pendentes" fill="#d97706" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
