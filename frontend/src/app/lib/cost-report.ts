import type { Departamento, Recurso, Reserva } from '../data/types';

export type CostReportRow = {
  departamento: string;
  sigla: string;
  centroCustoDept: string;
  centroCustoRecurso: string;
  recurso: string;
  reservasAprovadas: number;
  reservasPendentes: number;
  horasReservadas: number;
};

function hoursBetween(data: string, hi: string, hf: string): number {
  const hiNorm = hi.length === 5 ? `${hi}:00` : hi;
  const hfNorm = hf.length === 5 ? `${hf}:00` : hf;
  const start = new Date(`${data}T${hiNorm}`).getTime();
  const end = new Date(`${data}T${hfNorm}`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return (end - start) / (1000 * 60 * 60);
}

export function buildCostReport(
  reservas: Reserva[],
  recursos: Recurso[],
  departamentos: Departamento[],
): CostReportRow[] {
  const deptById = new Map(departamentos.map((d) => [d.id, d]));
  const resourceById = new Map(recursos.map((r) => [r.id, r]));
  const map = new Map<string, CostReportRow>();

  for (const r of reservas) {
    if (r.status === 'cancelled' || r.status === 'rejected') continue;

    const dept = [...departamentos].find((d) => d.nome === r.departamento);
    const res = resourceById.get(r.recursoId);
    const deptId = dept?.id ?? res?.departmentId ?? '—';
    const d = dept ?? (deptId !== '—' ? deptById.get(deptId) : undefined);
    const key = `${deptId}|${r.recursoId}|${res?.costCenterCode ?? d?.costCenterCode ?? '—'}`;

    let row = map.get(key);
    if (!row) {
      row = {
        departamento: d?.nome ?? r.departamento,
        sigla: d?.sigla ?? '—',
        centroCustoDept: d?.costCenterCode ?? '—',
        centroCustoRecurso: res?.costCenterCode ?? '—',
        recurso: r.recurso,
        reservasAprovadas: 0,
        reservasPendentes: 0,
        horasReservadas: 0,
      };
      map.set(key, row);
    }

    const h = hoursBetween(r.data, r.horaInicio, r.horaFim);
    row.horasReservadas += h;
    if (r.status === 'approved') row.reservasAprovadas += 1;
    if (r.status === 'pending') row.reservasPendentes += 1;
  }

  return [...map.values()].sort((a, b) =>
    a.departamento.localeCompare(b.departamento),
  );
}

/** Dimensões lógicas (CSS px) — gráficos exportados com pixelRatio 3× para email/PDF nítidos. */
export const CHART_EXPORT = {
  width: 592,
  doughnutHeight: 340,
  barHeight: 380,
  pixelRatio: 3,
} as const;

export type DeptCostAggregate = {
  departamento: string;
  sigla: string;
  horas: number;
  aprovadas: number;
  pendentes: number;
};

export function aggregateCostReportByDepartment(
  rows: CostReportRow[],
): DeptCostAggregate[] {
  const map = new Map<string, DeptCostAggregate>();
  for (const r of rows) {
    const key = r.departamento;
    let agg = map.get(key);
    if (!agg) {
      agg = {
        departamento: r.departamento,
        sigla: r.sigla,
        horas: 0,
        aprovadas: 0,
        pendentes: 0,
      };
      map.set(key, agg);
    }
    agg.horas += r.horasReservadas;
    agg.aprovadas += r.reservasAprovadas;
    agg.pendentes += r.reservasPendentes;
  }
  return [...map.values()].sort((a, b) => b.horas - a.horas);
}

export function exportCostReportCsv(rows: CostReportRow[]): void {
  const header = [
    'Departamento',
    'Sigla',
    'Centro de custo (dept)',
    'Centro de custo (recurso)',
    'Recurso',
    'Reservas aprovadas',
    'Reservas pendentes',
    'Horas reservadas',
  ];
  const lines = [
    header.join(';'),
    ...rows.map((r) =>
      [
        r.departamento,
        r.sigla,
        r.centroCustoDept,
        r.centroCustoRecurso,
        r.recurso,
        String(r.reservasAprovadas),
        String(r.reservasPendentes),
        r.horasReservadas.toFixed(2),
      ]
        .map((c) => `"${String(c).replace(/"/g, '""')}"`)
        .join(';'),
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `relatorio-centros-custo-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
