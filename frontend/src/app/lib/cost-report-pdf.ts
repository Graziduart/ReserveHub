import Chart from 'chart.js/auto';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { CostReportRow } from './cost-report';
import { aggregateCostReportByDepartment, CHART_EXPORT } from './cost-report';
import { getStoredAuthUser } from './apiBase';
import type { CostReportEmailOptions } from './cost-report-email';

type Rgb = [number, number, number];

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

const BRAND = {
  indigo: [99, 102, 241] as Rgb,
  slate: [17, 24, 39] as Rgb,
  muted: [100, 116, 139] as Rgb,
  tableHead: [15, 23, 42] as Rgb,
  green: [5, 150, 105] as Rgb,
  amber: [217, 119, 6] as Rgb,
  border: [226, 232, 240] as Rgb,
  surface: [248, 250, 252] as Rgb,
  pageBg: [238, 241, 245] as Rgb,
  white: [255, 255, 255] as Rgb,
};

const KPI_PALETTE: Rgb[] = [
  [102, 126, 234],
  [17, 153, 142],
  [236, 72, 153],
  [250, 112, 154],
];

const MARGIN = 14;
const FOOTER_H = 10;

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

export type CostReportPdfOptions = CostReportEmailOptions;

export function getCostReportChartImages(rows: CostReportRow[]): {
  hours: string;
  status: string;
} {
  const byDept = aggregateCostReportByDepartment(rows);
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

function pct(part: number, total: number): string {
  if (total <= 0) return '0% do total';
  return `${Math.round((part / total) * 100)}% do total`;
}

function pageSize(pdf: jsPDF) {
  return {
    w: pdf.internal.pageSize.getWidth(),
    h: pdf.internal.pageSize.getHeight(),
  };
}

function contentWidth(pdf: jsPDF): number {
  return pageSize(pdf).w - MARGIN * 2;
}

function pageBottom(pdf: jsPDF): number {
  return pageSize(pdf).h - MARGIN - FOOTER_H;
}

function fillPageBackground(pdf: jsPDF): void {
  const { w, h } = pageSize(pdf);
  pdf.setFillColor(...BRAND.pageBg);
  pdf.rect(0, 0, w, h, 'F');
}

function drawPageFooter(pdf: jsPDF): void {
  const { w, h } = pageSize(pdf);
  const pageNum = pdf.getNumberOfPages();
  pdf.setDrawColor(...BRAND.border);
  pdf.setLineWidth(0.2);
  pdf.line(MARGIN, h - MARGIN - 4, w - MARGIN, h - MARGIN - 4);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...BRAND.muted);
  pdf.text('ReserveHub · Alocação de custos', MARGIN, h - MARGIN);
  pdf.text(`Página ${pageNum}`, w - MARGIN, h - MARGIN, { align: 'right' });
}

function ensureSpace(pdf: jsPDF, y: number, needed: number): number {
  if (y + needed > pageBottom(pdf)) {
    pdf.addPage();
    fillPageBackground(pdf);
    return MARGIN;
  }
  return y;
}

function drawReportHeader(
  pdf: jsPDF,
  y: number,
  source: 'api' | 'local',
): number {
  const { w } = pageSize(pdf);
  const cx = w / 2;

  pdf.setTextColor(...BRAND.indigo);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.text('RESERVEHUB', cx, y, { align: 'center' });

  y += 8;
  pdf.setTextColor(...BRAND.slate);
  pdf.setFontSize(18);
  pdf.text('Relatório de alocação de custos', cx, y, { align: 'center' });

  y += 7;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9);
  pdf.setTextColor(...BRAND.muted);
  const dateStr = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  pdf.text(`Gerado em: ${dateStr}`, cx, y, { align: 'center' });

  y += 5;
  const user = getStoredAuthUser();
  const greeting = user?.name?.split(' ')[0];
  const sourceLabel = source === 'api' ? 'API service-core' : 'Cálculo local';
  pdf.setFontSize(8);
  pdf.setTextColor(...BRAND.muted);
  pdf.text(
    greeting ? `Para ${greeting} · ${sourceLabel}` : sourceLabel,
    cx,
    y,
    { align: 'center' },
  );

  y += 6;
  pdf.setDrawColor(...BRAND.border);
  pdf.setLineWidth(0.3);
  pdf.line(MARGIN + 4, y, w - MARGIN - 4, y);
  return y + 8;
}

function drawKpiCard(
  pdf: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  rgb: Rgb,
  label: string,
  value: string,
  subtext: string,
): void {
  pdf.setFillColor(...rgb);
  pdf.roundedRect(x, y, w, h, 3, 3, 'F');

  pdf.setTextColor(...BRAND.white);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(6.5);
  pdf.text(label.toUpperCase(), x + 4, y + 7);

  pdf.setFontSize(16);
  pdf.text(value, x + 4, y + 16);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(7);
  const lines = pdf.splitTextToSize(subtext, w - 8);
  pdf.text(lines, x + 4, y + 22);
}

function drawKpiGrid(
  pdf: jsPDF,
  y: number,
  rows: CostReportRow[],
  totais: { aprovadas: number; pendentes: number; horas: number },
  deptCount: number,
): number {
  const gap = 4;
  const cardW = (contentWidth(pdf) - gap) / 2;
  const cardH = 24;
  const totalReservas = totais.aprovadas + totais.pendentes;

  const cards = [
    {
      label: 'Total de registos',
      value: String(rows.length),
      sub: 'Linhas consolidadas no relatório',
    },
    {
      label: 'Reservas aprovadas',
      value: String(totais.aprovadas),
      sub: pct(totais.aprovadas, totalReservas),
    },
    {
      label: 'Reservas pendentes',
      value: String(totais.pendentes),
      sub: pct(totais.pendentes, totalReservas),
    },
    {
      label: 'Horas reservadas',
      value: `${totais.horas.toFixed(1)}h`,
      sub: `${deptCount} departamento${deptCount === 1 ? '' : 's'} envolvidos`,
    },
  ];

  cards.forEach((card, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    drawKpiCard(
      pdf,
      MARGIN + 4 + col * (cardW + gap),
      y + row * (cardH + gap),
      cardW,
      cardH,
      KPI_PALETTE[i],
      card.label,
      card.value,
      card.sub,
    );
  });

  return y + 2 * cardH + gap + 10;
}

function drawSectionTitle(pdf: jsPDF, y: number, title: string): number {
  pdf.setTextColor(...BRAND.slate);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.text(title, MARGIN + 4, y);
  return y + 6;
}

function drawChartBlock(
  pdf: jsPDF,
  y: number,
  caption: string,
  imageData: string,
  logicalHeight: number,
): number {
  if (!imageData.startsWith('data:image/')) {
    return y;
  }

  const w = contentWidth(pdf) - 8;
  const h = w * (logicalHeight / CHART_EXPORT.width);

  y = ensureSpace(pdf, y, h + 14);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(...BRAND.muted);
  pdf.text(caption, MARGIN + 4, y);
  y += 4;

  pdf.setDrawColor(...BRAND.border);
  pdf.setLineWidth(0.2);
  pdf.roundedRect(MARGIN + 4, y, w, h, 2, 2, 'S');
  pdf.addImage(imageData, 'PNG', MARGIN + 4, y, w, h, undefined, 'SLOW');

  return y + h + 8;
}

function buildProfessionalPdf({
  rows,
  source,
  totais,
  chartImages,
}: CostReportPdfOptions & {
  chartImages: { hours: string; status: string };
}): jsPDF {
  const deptCount = new Set(rows.map((r) => r.departamento)).size;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  fillPageBackground(pdf);

  let y = MARGIN + 4;
  y = drawReportHeader(pdf, y, source);
  y = drawKpiGrid(pdf, y, rows, totais, deptCount);

  if (chartImages.hours) {
    y = drawSectionTitle(pdf, y, 'Resumo visual');
    y = drawChartBlock(
      pdf,
      y,
      'Distribuição de horas',
      chartImages.hours,
      CHART_EXPORT.doughnutHeight,
    );
  }

  if (chartImages.status) {
    if (!chartImages.hours) {
      y = drawSectionTitle(pdf, y, 'Resumo visual');
    }
    y = drawChartBlock(
      pdf,
      y,
      'Aprovadas vs pendentes',
      chartImages.status,
      CHART_EXPORT.barHeight,
    );
  }

  // Tabela sempre numa página nova — evita o autoTable repintar os gráficos.
  pdf.addPage();
  fillPageBackground(pdf);
  y = MARGIN + 4;
  y = drawSectionTitle(pdf, y, 'Alocação por departamento e recurso');
  const tableStartPage = pdf.getNumberOfPages();

  autoTable(pdf, {
    startY: y + 2,
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
    margin: { left: MARGIN + 4, right: MARGIN + 4, top: MARGIN, bottom: MARGIN + FOOTER_H },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.8,
      textColor: BRAND.slate,
      lineColor: BRAND.border,
      lineWidth: 0.15,
      overflow: 'linebreak',
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
      0: { cellWidth: 28 },
      1: { cellWidth: 12 },
      2: { cellWidth: 18, font: 'courier' },
      3: { cellWidth: 18, font: 'courier' },
      4: { cellWidth: 28 },
      5: { halign: 'right', textColor: BRAND.green, cellWidth: 14 },
      6: { halign: 'right', textColor: BRAND.amber, cellWidth: 14 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 14 },
    },
    showHead: 'everyPage',
    theme: 'grid',
    willDrawPage: (data) => {
      if (data.pageNumber >= tableStartPage) {
        fillPageBackground(pdf);
      }
    },
    didDrawPage: () => {
      drawPageFooter(pdf);
    },
  });

  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p += 1) {
    pdf.setPage(p);
    drawPageFooter(pdf);
  }

  return pdf;
}

export async function exportCostReportPdf({
  rows,
  source,
  totais,
  chartImages: chartImagesIn,
}: CostReportPdfOptions & {
  chartImages?: { hours?: string; status?: string };
  html?: string;
}): Promise<void> {
  if (rows.length === 0) return;

  const chartImages = chartImagesIn ?? getCostReportChartImages(rows);
  const pdf = buildProfessionalPdf({
    rows,
    source,
    totais,
    chartImages: {
      hours: chartImages.hours ?? '',
      status: chartImages.status ?? '',
    },
  });

  const fileDate = new Date().toISOString().slice(0, 10);
  pdf.save(`reservehub-relatorio-custos-${fileDate}.pdf`);
}
