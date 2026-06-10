import { Injectable } from '@nestjs/common';
import { CostReportService } from './CostReportService';

/** Exportação simplificada para integração ERP (SAP/Protheus). */
@Injectable()
export class ErpExportService {
  constructor(private readonly costReport: CostReportService) {}

  async buildCsv(from?: string, to?: string): Promise<string> {
    const rows = await this.costReport.buildReport(from, to);
    const header =
      'departamento;sigla;centro_custo_dept;centro_custo_recurso;recurso;reservas_aprovadas;horas_reservadas';
    const lines = rows.map(
      (r) =>
        [
          r.departamento,
          r.sigla,
          r.centroCustoDept,
          r.centroCustoRecurso,
          r.recurso,
          r.reservasAprovadas,
          r.horasReservadas.toFixed(2),
        ].join(';'),
    );
    return [header, ...lines].join('\n');
  }
}
