import type { CostReportRow } from './cost-report';
import { CHART_EXPORT } from './cost-report';
import { getStoredAuthUser } from './apiBase';

export type CostReportEmailOptions = {
  rows: CostReportRow[];
  source: 'api' | 'local';
  totais: { aprovadas: number; pendentes: number; horas: number };
  chartImages?: { hours?: string; status?: string };
};

const C = {
  bg: '#eef1f5',
  card: '#ffffff',
  text: '#111827',
  muted: '#64748b',
  faint: '#94a3b8',
  line: '#e2e8f0',
  tableHead: '#0f172a',
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pct(part: number, total: number): string {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}% do total`;
}

/** Card KPI estilo dashboard (gradiente + valor + legenda). */
function gradientCard(
  label: string,
  value: string,
  subtext: string,
  gradient: string,
): string {
  return `
    <td width="50%" style="padding:8px;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-radius:14px;overflow:hidden;background:${gradient};">
        <tr>
          <td style="padding:22px 20px;color:#ffffff;">
            <div style="font-size:10px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;opacity:0.92;">${label}</div>
            <div style="font-size:34px;font-weight:700;line-height:1.1;margin-top:10px;">${value}</div>
            <div style="font-size:12px;margin-top:8px;opacity:0.88;line-height:1.4;">${subtext}</div>
          </td>
        </tr>
      </table>
    </td>`;
}

function th(label: string, align: 'left' | 'right' = 'left'): string {
  return `<th align="${align}" style="padding:14px 12px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;background:${C.tableHead};border:none;">${label}</th>`;
}

function td(
  content: string,
  opts: { align?: 'left' | 'right'; strong?: boolean; color?: string; mono?: boolean } = {},
): string {
  const align = opts.align ?? 'left';
  const weight = opts.strong ? '700' : '400';
  const color = opts.color ?? C.text;
  const font = opts.mono
    ? "font-family:ui-monospace,'SF Mono',Consolas,monospace;font-size:12px;"
    : 'font-size:13px;';
  return `<td align="${align}" style="padding:14px 12px;border-bottom:1px solid ${C.line};color:${color};font-weight:${weight};${font}">${content}</td>`;
}

function buildTableRows(rows: CostReportRow[]): string {
  return rows
    .map(
      (r) => `
    <tr>
      ${td(escapeHtml(r.departamento), { strong: true })}
      ${td(escapeHtml(r.sigla), { color: C.muted })}
      ${td(escapeHtml(r.centroCustoDept), { mono: true, color: C.muted })}
      ${td(escapeHtml(r.centroCustoRecurso), { mono: true, color: C.muted })}
      ${td(escapeHtml(r.recurso))}
      ${td(String(r.reservasAprovadas), { align: 'right', strong: true, color: '#059669' })}
      ${td(String(r.reservasPendentes), { align: 'right', strong: true, color: r.reservasPendentes > 0 ? '#d97706' : C.muted })}
      ${td(`${r.horasReservadas.toFixed(1)}h`, { align: 'right', strong: true })}
    </tr>`,
    )
    .join('');
}

function buildChartsBlock(chartImages?: { hours?: string; status?: string }): string {
  if (!chartImages?.hours && !chartImages?.status) return '';

  const imgs: string[] = [];
  if (chartImages.hours) {
    imgs.push(`
      <tr><td style="padding:0 24px 12px;">
        <div style="font-size:12px;color:${C.muted};margin-bottom:8px;">Distribuição de horas</div>
        <img src="${chartImages.hours}" alt="Horas por departamento" width="${CHART_EXPORT.width}" height="${CHART_EXPORT.doughnutHeight}" style="display:block;width:100%;max-width:${CHART_EXPORT.width}px;height:auto;border-radius:10px;border:1px solid ${C.line};" />
      </td></tr>`);
  }
  if (chartImages.status) {
    imgs.push(`
      <tr><td style="padding:0 24px 20px;">
        <div style="font-size:12px;color:${C.muted};margin-bottom:8px;">Aprovadas vs pendentes</div>
        <img src="${chartImages.status}" alt="Estado das reservas" width="${CHART_EXPORT.width}" height="${CHART_EXPORT.barHeight}" style="display:block;width:100%;max-width:${CHART_EXPORT.width}px;height:auto;border-radius:10px;border:1px solid ${C.line};" />
      </td></tr>`);
  }

  return `
    <tr>
      <td style="padding:8px 24px 12px;">
        <div style="font-size:16px;font-weight:700;color:${C.text};">Resumo visual</div>
      </td>
    </tr>
    ${imgs.join('')}`;
}

export function buildCostReportEmailHtml({
  rows,
  source,
  totais,
  chartImages,
}: CostReportEmailOptions): string {
  const user = getStoredAuthUser();
  const generatedShort = new Date().toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const greeting = user?.name?.split(' ')[0];
  const sourceLabel = source === 'api' ? 'API service-core' : 'Cálculo local';
  const deptCount = new Set(rows.map((r) => r.departamento)).size;
  const totalReservas = totais.aprovadas + totais.pendentes;

  const totalsRow =
    rows.length > 0
      ? `
    <tr style="background:#f8fafc;">
      ${td('Total', { strong: true })}
      ${td('—', { color: C.muted })}
      ${td('—', { color: C.muted })}
      ${td('—', { color: C.muted })}
      ${td('—', { color: C.muted })}
      ${td(String(totais.aprovadas), { align: 'right', strong: true, color: '#059669' })}
      ${td(String(totais.pendentes), { align: 'right', strong: true, color: '#d97706' })}
      ${td(`${totais.horas.toFixed(1)}h`, { align: 'right', strong: true })}
    </tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ReserveHub — Relatório de alocação de custos</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:32px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;background:${C.card};border-radius:12px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">

          <!-- Cabeçalho centrado -->
          <tr>
            <td align="center" style="padding:36px 24px 0;">
              <div style="font-size:11px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6366f1;margin-bottom:12px;">ReserveHub</div>
              <div style="font-size:26px;font-weight:700;color:${C.text};letter-spacing:-0.02em;line-height:1.25;">
                Relatório de alocação de custos
              </div>
              <div style="font-size:13px;color:${C.muted};margin-top:10px;">
                Gerado em: ${escapeHtml(generatedShort)}
              </div>
              ${
                greeting
                  ? `<div style="font-size:13px;color:${C.faint};margin-top:6px;">Para ${escapeHtml(greeting)} · ${sourceLabel}</div>`
                  : `<div style="font-size:13px;color:${C.faint};margin-top:6px;">${sourceLabel}</div>`
              }
            </td>
          </tr>

          <tr>
            <td style="padding:24px 32px 8px;">
              <div style="height:1px;background:${C.line};"></div>
            </td>
          </tr>

          <!-- KPIs 2×2 -->
          <tr>
            <td style="padding:8px 16px 20px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  ${gradientCard(
                    'Total de registos',
                    String(rows.length),
                    'Linhas consolidadas no relatório',
                    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  )}
                  ${gradientCard(
                    'Reservas aprovadas',
                    String(totais.aprovadas),
                    pct(totais.aprovadas, totalReservas),
                    'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                  )}
                </tr>
                <tr>
                  ${gradientCard(
                    'Reservas pendentes',
                    String(totais.pendentes),
                    pct(totais.pendentes, totalReservas),
                    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                  )}
                  ${gradientCard(
                    'Horas reservadas',
                    `${totais.horas.toFixed(1)}h`,
                    `${deptCount} departamento${deptCount === 1 ? '' : 's'} envolvidos`,
                    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                  )}
                </tr>
              </table>
            </td>
          </tr>

          ${buildChartsBlock(chartImages)}

          <!-- Tabela -->
          <tr>
            <td style="padding:12px 24px 8px;">
              <div style="font-size:16px;font-weight:700;color:${C.text};">Alocação por departamento e recurso</div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 28px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid ${C.line};border-radius:10px;overflow:hidden;">
                <thead>
                  <tr>
                    ${th('Departamento')}
                    ${th('Sigla')}
                    ${th('CC dept.')}
                    ${th('CC recurso')}
                    ${th('Recurso')}
                    ${th('Aprov.', 'right')}
                    ${th('Pend.', 'right')}
                    ${th('Horas', 'right')}
                  </tr>
                </thead>
                <tbody>
                  ${
                    rows.length === 0
                      ? `<tr><td colspan="8" align="center" style="padding:28px 12px;font-size:13px;color:${C.muted};">Sem reservas activas para consolidar.</td></tr>`
                      : `${buildTableRows(rows)}${totalsRow}`
                  }
                </tbody>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function exportCostReportEmailHtml(options: CostReportEmailOptions): void {
  const html = buildCostReportEmailHtml(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reservehub-relatorio-email-${new Date().toISOString().slice(0, 10)}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export function previewCostReportEmail(options: CostReportEmailOptions): void {
  const html = buildCostReportEmailHtml(options);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank', 'noopener,noreferrer');
  if (!w) {
    URL.revokeObjectURL(url);
    throw new Error('popup_blocked');
  }
  w.addEventListener('load', () => URL.revokeObjectURL(url), { once: true });
}
