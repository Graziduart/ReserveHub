import { Body, Controller, Get, Post } from '@nestjs/common';
import { DashboardService } from '../service/dashboard.service';

@Controller('cards')
export class CardsController {
  constructor(private readonly dashboardService: DashboardService) {}

  /** Agregados mantidos a partir dos eventos `core.#` (MongoDB). */
  @Get('dashboard')
  getDashboard() {
    return this.dashboardService.getDashboard();
  }

  /** Recalcula o dashboard a partir de contagens (admin / script de reconciliação). */
  @Post('reconcile')
  reconcile(
    @Body()
    body: {
      departmentsActive: number;
      resourcesActive: number;
      reservationsByStatus: Record<string, number>;
    },
  ) {
    return this.dashboardService.reconcile(body);
  }
}
