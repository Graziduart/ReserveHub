import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Cloud,
  Download,
  FileText,
  HardDrive,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CostReportCharts } from '../components/reports/CostReportCharts';
import { CostReportSummary } from '../components/reports/CostReportSummary';
import { CostReportTable } from '../components/reports/CostReportTable';
import {
  aggregateCostReportByDepartment,
  buildCostReport,
  exportCostReportCsv,
} from '../lib/cost-report';
import { buildCostReportEmailHtml } from '../lib/cost-report-email';
import { exportCostReportPdf, getCostReportChartImages } from '../lib/cost-report-pdf';
import { getCostAllocationReport } from '../lib/api';
import { RequireRole } from '../components/auth/RequireRole';
import { CostReportPreviewDialog } from '../components/reports/CostReportPreviewDialog';

function formatGeneratedAt(): string {
  return new Date().toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function RelatoriosPage() {
  const { reservas, recursos, departamentos } = useApp();
  const [rows, setRows] = useState<ReturnType<typeof buildCostReport>>([]);
  const [source, setSource] = useState<'api' | 'local'>('local');
  const [loading, setLoading] = useState(true);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [generatedAt, setGeneratedAt] = useState(formatGeneratedAt);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [emailPreviewOpen, setEmailPreviewOpen] = useState(false);

  const localRows = useMemo(
    () => buildCostReport(reservas, recursos, departamentos),
    [reservas, recursos, departamentos],
  );

  const loadReport = () => {
    setLoading(true);
    getCostAllocationReport()
      .then((apiRows) => {
        setRows(apiRows);
        setSource('api');
        setGeneratedAt(formatGeneratedAt());
      })
      .catch(() => {
        setRows(localRows);
        setSource('local');
        setGeneratedAt(formatGeneratedAt());
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh when local data changes
  }, [localRows]);

  const totais = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        aprovadas: acc.aprovadas + r.reservasAprovadas,
        pendentes: acc.pendentes + r.reservasPendentes,
        horas: acc.horas + r.horasReservadas,
      }),
      { aprovadas: 0, pendentes: 0, horas: 0 },
    );
  }, [rows]);

  const byDept = useMemo(() => aggregateCostReportByDepartment(rows), [rows]);
  const deptCount = useMemo(
    () => new Set(rows.map((r) => r.departamento)).size,
    [rows],
  );

  const handleExportPdf = async () => {
    if (exportingPdf) return;
    setExportingPdf(true);
    try {
      const chartImages = getCostReportChartImages(rows);
      await exportCostReportPdf({ rows, source, totais, chartImages });
      toast.success('PDF exportado com sucesso');
    } catch (err) {
      console.error('exportCostReportPdf', err);
      const detail = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Não foi possível gerar o PDF (${detail})`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handlePreviewEmail = () => {
    try {
      const chartImages = getCostReportChartImages(rows);
      const html = buildCostReportEmailHtml({ rows, source, totais, chartImages });
      setEmailPreviewHtml(html);
      setEmailPreviewOpen(true);
    } catch {
      toast.error('Não foi possível abrir a pré-visualização');
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={
                  source === 'api'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }
              >
                {source === 'api' ? (
                  <>
                    <Cloud className="w-3 h-3 mr-1" />
                    API core
                  </>
                ) : (
                  <>
                    <HardDrive className="w-3 h-3 mr-1" />
                    Cálculo local
                  </>
                )}
              </Badge>
              <span className="text-xs text-gray-500">Gerado em {generatedAt}</span>
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
                Alocação de custos
              </h1>
              <p className="text-gray-600 mt-1 max-w-2xl">
                Consolidação de reservas por departamento, centro de custo e recurso para
                análise financeira e exportação.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={loadReport}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => exportCostReportCsv(rows)}
              disabled={rows.length === 0 || loading}
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePreviewEmail}
              disabled={rows.length === 0 || loading}
            >
              <Mail className="w-4 h-4 mr-2" />
              Pré-visualizar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => void handleExportPdf()}
              disabled={rows.length === 0 || loading || exportingPdf}
            >
              <FileText className="w-4 h-4 mr-2" />
              {exportingPdf ? 'A gerar…' : 'PDF'}
            </Button>
          </div>
        </div>
      </div>

      {!loading && (
        <CostReportSummary
          aprovadas={totais.aprovadas}
          pendentes={totais.pendentes}
          horas={totais.horas}
          departamentos={deptCount}
          linhas={rows.length}
        />
      )}

      {!loading && rows.length > 0 && (
        <Card className="border-gray-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              Análise gráfica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CostReportCharts byDept={byDept} />
          </CardContent>
        </Card>
      )}

      <Card className="border-gray-200/80 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Detalhe consolidado</CardTitle>
          <p className="text-sm text-gray-500 mt-1">
            Linhas agregadas por departamento, recurso e centro de custo.
          </p>
        </CardHeader>
        <CardContent>
          <CostReportTable rows={rows} loading={loading} />
        </CardContent>
      </Card>

      <CostReportPreviewDialog
        open={emailPreviewOpen}
        onOpenChange={setEmailPreviewOpen}
        html={emailPreviewHtml}
      />
    </div>
  );
}

export function Relatorios() {
  return (
    <RequireRole roles={['ADMIN', 'MANAGER']}>
      <RelatoriosPage />
    </RequireRole>
  );
}
