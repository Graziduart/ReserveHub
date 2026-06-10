import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CostReportRow, DeptCostAggregate } from './cost-report';
import { aggregateCostReportByDepartment, CHART_EXPORT } from './cost-report';

/** Paleta alinhada ao template de email (recruitment-style). */
const BRAND = {
  indigo: [99, 102, 241] as [number, number, number],
  slate: [17, 24, 39] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  tableHead: [15, 23, 42] as [number, number, number],
  green: [5, 150, 105] as [number, number, number],
  amber: [217, 119, 6] as [number, number, number],
  border: [226, 232, 240] as [number, number, number],
  surface: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

const KPI_COLORS = {
  purple: [102, 126, 234] as [number, number, number],
  green: [17, 153, 142] as [number, number, number],
  pink: [236, 72, 153] as [number, number, number],
  coral: [250, 112, 154] as [number, number, number],
};

type DeptAggregate = DeptCostAggregate;

function aggregateByDepartment(rows: CostReportRow[]): DeptAggregate[] {
  return aggregateCostReportByDepartment(rows);
}

function chartToDataUrl(
  type: 'doughnut' | 'bar',
  labels: string[],
  datasets: { label: string; data: number[]; backgroundColor: string | string[] }[],
  width = CHART_EXPORT.width,
  height = CHART_EXPORT.barHeight,
): string {
  const isBar = type === 'bar';
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const chart = new Chart(ctx, {
    type,
    data: { labels, datasets },
    options: {
      animation: false,
      responsive: false,
      maintainAspectRatio: false,
      devicePixelRatio: CHART_EXPORT.pixelRatio,
      layout: {
        padding: isBar
          ? { top: 16, right: 20, bottom: 72, left: 28 }
          : { top: 16, right: 20, bottom: 48, left: 16 },
      },
      plugins: {
        legend: {
          position: 'bottom',
          align: 'center',
          labels: {
            boxWidth: 14,
            boxHeight: 14,
            padding: 18,
            font: { size: 13, family: 'system-ui, sans-serif' },
            color: '#475569',
          },
        },
      },
      elements: {
        arc: { borderWidth: 2, borderColor: '#ffffff' },
        bar: { borderRadius: 4 },
      },
      ...(type === 'doughnut' ? { cutout: '58%' } : {}),
      scales: isBar
        ? {
            x: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                padding: 10,
                font: { size: 12, family: 'system-ui, sans-serif' },
                color: '#64748b',
              },
            },
            y: {
              beginAtZero: true,
              border: { display: false },
              grid: { color: '#f1f5f9', lineWidth: 1 },
              ticks: {
                stepSize: 1,
                padding: 8,
                font: { size: 12, family: 'system-ui, sans-serif' },
                color: '#94a3b8',
              },
            },
          }
        : undefined,
    },
  });

  const url = canvas.toDataURL('image/png');
  chart.destroy();
  return url;
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0% do total';
  return `${Math.round((part / total) * 100)}% do total`;
}

function drawReportHeader(doc: jsPDF, source: 'api' | 'local'): number {
  const w = doc.internal.pageSize.getWidth();
  let y = 18;

  doc.setTextColor(...BRAND.indigo);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('RESERVEHUB', w / 2, y, { align: 'center' });

  y += 9;
  doc.setTextColor(...BRAND.slate);
  doc.setFontSize(17);
  doc.text('Relatório de alocação de custos', w / 2, y, { align: 'center' });

  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...BRAND.muted);
  const dateStr = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  doc.text(`Gerado em: ${dateStr}`, w / 2, y, { align: 'center' });

  y += 5;
  doc.setFontSize(8);
  doc.text(
    source === 'api' ? 'Fonte: API service-core' : 'Fonte: Cálculo local',
    w / 2,
    y,
    { align: 'center' },
  );

  y += 7;
  doc.setDrawColor(...BRAND.border);
  doc.setLineWidth(0.3);
  doc.line(14, y, w - 14, y);
  return y + 8;
}

function drawKpiCard(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: [number, number, number],
  label: string,
  value: string,
  subtext: string,
) {
  doc.setFillColor(...rgb);
  doc.roundedRect(x, y, w, h, 3.5, 3.5, 'F');

  doc.setTextColor(...BRAND.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.text(label.toUpperCase(), x + 5, y + 7);

  doc.setFontSize(17);
  doc.text(value, x + 5, y + 17);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const lines = doc.splitTextToSize(subtext, w - 10);
  doc.text(lines, x + 5, y + 23);
}

function drawKpiGrid(
  doc: jsPDF,
  y: number,
  rowCount: number,
  totais: { aprovadas: number; pendentes: number; horas: number },
  deptCount: number,
): number {
  const pageW = doc.internal.pageSize.getWidth();
  const gap = 4;
  const cardW = (pageW - 28 - gap) / 2;
  const cardH = 24;
  const totalReservas = totais.aprovadas + totais.pendentes;

  const cards = [
    {
      color: KPI_COLORS.purple,
      label: 'Total de registos',
      value: String(rowCount),
      sub: 'Linhas consolidadas no relatório',
    },
    {
      color: KPI_COLORS.green,
      label: 'Reservas aprovadas',
      value: String(totais.aprovadas),
      sub: pct(totais.aprovadas, totalReservas),
    },
    {
      color: KPI_COLORS.pink,
      label: 'Reservas pendentes',
      value: String(totais.pendentes),
      sub: pct(totais.pendentes, totalReservas),
    },
    {
      color: KPI_COLORS.coral,
      label: 'Horas reservadas',
      value: `${totais.horas.toFixed(1)}h`,
      sub: `${deptCount} departamento${deptCount === 1 ? '' : 's'} envolvidos`,
    },
  ];

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawKpiCard(
      doc,
      14 + col * (cardW + gap),
      y + row * (cardH + gap),
      cardW,
      cardH,
      card.color,
      card.label,
      card.value,
      card.sub,
    );
  });

  return y + 2 * cardH + gap + 10;
}

function drawSectionTitle(doc: jsPDF, y: number, title: string): number {
  doc.setTextColor(...BRAND.slate);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(title, 14, y);
  return y + 7;
}

function drawPageMiniHeader(doc: jsPDF, pageNumber: number) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...BRAND.surface);
  doc.rect(0, 0, w, 14, 'F');
  doc.setDrawColor(...BRAND.border);
  doc.line(0, 14, w, 14);
  doc.setTextColor(...BRAND.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('ReserveHub · Alocação de custos', 14, 9);
  doc.text(`Página ${pageNumber}`, w - 14, 9, { align: 'right' });
}

const PDF_MARGIN_BOTTOM = 16;

function pageBottomY(doc: jsPDF): number {
  return doc.internal.pageSize.getHeight() - PDF_MARGIN_BOTTOM;
}

/** Nova página se não houver altura suficiente para o bloco seguinte. */
function ensurePageSpace(doc: jsPDF, y: number, neededMm: number): number {
  if (y + neededMm > pageBottomY(doc)) {
    doc.addPage();
    return 22;
  }
  return y;
}

function chartDisplayHeight(chartW: number, logicalHeight: number): number {
  return chartW * (logicalHeight / CHART_EXPORT.width);
}

export type CostReportPdfOptions = {
  rows: CostReportRow[];
  source: 'api' | 'local';
  totais: { aprovadas: number; pendentes: number; horas: number };
};

const EMAIL_CHART_COLORS = [
  '#1e40af',
  '#047857',
  '#b45309',
  '#6d28d9',
  '#0e7490',
  '#be185d',
  '#4d7c0f',
  '#c2410c',
];

export function getCostReportChartImages(rows: CostReportRow[]): {
  hours: string;
  status: string;
} {
  const byDept = aggregateByDepartment(rows);
  const labels = byDept.map((d) => d.sigla || d.departamento.slice(0, 12));
  return {
    hours: chartToDataUrl(
      'doughnut',
      labels,
      [
        {
          label: 'Horas',
          data: byDept.map((d) => Number(d.horas.toFixed(2))),
          backgroundColor: EMAIL_CHART_COLORS.slice(0, labels.length),
        },
      ],
      CHART_EXPORT.width,
      CHART_EXPORT.doughnutHeight,
    ),
    status: chartToDataUrl(
      'bar',
      labels,
      [
        {
          label: 'Aprovadas',
          data: byDept.map((d) => d.aprovadas),
          backgroundColor: '#047857',
        },
        {
          label: 'Pendentes',
          data: byDept.map((d) => d.pendentes),
          backgroundColor: '#d97706',
        },
      ],
      CHART_EXPORT.width,
      CHART_EXPORT.barHeight,
    ),
  };
}

export async function exportCostReportPdf({
  rows,
  source,
  totais,
}: CostReportPdfOptions): Promise<void> {
  if (rows.length === 0) return;

  const deptCount = new Set(rows.map((r) => r.departamento)).size;
  const { hours: hoursChart, status: statusChart } = getCostReportChartImages(rows);

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  let y = drawReportHeader(doc, source);
  y = drawKpiGrid(doc, y, rows.length, totais, deptCount);

  const chartW = pageW - 28;

  if (hoursChart || statusChart) {
    const hoursH = hoursChart
      ? chartDisplayHeight(chartW, CHART_EXPORT.doughnutHeight) + 6
      : 0;
    const statusH = statusChart
      ? chartDisplayHeight(chartW, CHART_EXPORT.barHeight) + 8
      : 0;
    const chartsBlockH = 10 + hoursH + statusH;

    if (y + chartsBlockH > pageBottomY(doc)) {
      doc.addPage();
      y = 22;
    }

    y = drawSectionTitle(doc, y, 'Resumo visual');

    if (hoursChart) {
      const chartH = chartDisplayHeight(chartW, CHART_EXPORT.doughnutHeight);
      y = ensurePageSpace(doc, y, chartH + 6);
      doc.addImage(hoursChart, 'PNG', 14, y, chartW, chartH, undefined, 'FAST');
      y += chartH + 6;
    }
    if (statusChart) {
      const chartH = chartDisplayHeight(chartW, CHART_EXPORT.barHeight);
      y = ensurePageSpace(doc, y, chartH + 8);
      doc.addImage(statusChart, 'PNG', 14, y, chartW, chartH, undefined, 'FAST');
      y += chartH + 8;
    }
  }

  y = ensurePageSpace(doc, y, 24);
  y = drawSectionTitle(doc, y, 'Alocação por departamento e recurso');

  autoTable(doc, {
    startY: y,
    head: [
      [
        'Departamento',
        'Sigla',
        'CC dept.',
        'CC recurso',
        'Recurso',
        'Aprov.',
        'Pend.',
        'Horas',
      ],
    ],
    body: [
      ...rows.map((r) => [
        r.departamento,
        r.sigla,
        r.centroCustoDept,
        r.centroCustoRecurso,
        r.recurso,
        String(r.reservasAprovadas),
        String(r.reservasPendentes),
        `${r.horasReservadas.toFixed(1)}h`,
      ]),
      [
        'Total',
        '—',
        '—',
        '—',
        '—',
        String(totais.aprovadas),
        String(totais.pendentes),
        `${totais.horas.toFixed(1)}h`,
      ],
    ],
    margin: { left: 14, right: 14, top: 18 },
    styles: {
      fontSize: 7.5,
      cellPadding: 3,
      textColor: BRAND.slate,
      lineColor: BRAND.border,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: BRAND.tableHead,
      textColor: BRAND.white,
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 7,
    },
    alternateRowStyles: { fillColor: BRAND.surface },
    columnStyles: {
      5: { halign: 'right', textColor: BRAND.green },
      6: { halign: 'right', textColor: BRAND.amber },
      7: { halign: 'right', fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawPageMiniHeader(doc, data.pageNumber);
      }
    },
  });

  const fileDate = new Date().toISOString().slice(0, 10);
  doc.save(`reservehub-relatorio-custos-${fileDate}.pdf`);
}
