import { Controller, Get, Header, Query } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Roles } from '../../auth/roles.decorator';
import { CostReportService } from '../service/CostReportService';
import { ErpExportService } from '../service/ErpExportService';
import { UtilizationReportService } from '../service/UtilizationReportService';
import { ReservationsByDepartmentService } from '../service/ReservationsByDepartmentService';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly costReport: CostReportService,
    private readonly utilization: UtilizationReportService,
    private readonly erpExport: ErpExportService,
    private readonly reservationsByDepartment: ReservationsByDepartmentService,
  ) {}

  /** Reservas agrupadas por nome do departamento (Postgres). */
  @Get('reservations-by-department')
  getReservationsByDepartment() {
    return this.reservationsByDepartment.buildReport();
  }

  /** Agregação por departamento / centro de custo (governança). */
  @Get('cost-allocation')
  @Roles(Role.ADMIN, Role.MANAGER)
  getCostAllocation(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ) {
    return this.costReport.buildReport(from, to);
  }

  @Get('utilization')
  @Roles(Role.ADMIN, Role.MANAGER)
  getUtilization(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ) {
    return this.utilization.buildReport(from, to);
  }

  @Get('erp-export')
  @Roles(Role.ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async getErpExport(
    @Query('from') from: string | undefined,
    @Query('to') to: string | undefined,
  ) {
    return this.erpExport.buildCsv(from, to);
  }
}
