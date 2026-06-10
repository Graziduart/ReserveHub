import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './shared/database/prisma.module';
import { DepartmentController } from './department/controller/DepartmentController';
import { DepartmentService } from './department/service/DepartmentService';
import { ResourceService } from './resources/service/ResourceService';
import { ResourceController } from './resources/controller/ResourceController';
import { ReservationController } from './reservations/controller/ReservationController';
import { ReservationService } from './reservations/service/ReservationService';
import { ReportsController } from './reports/controller/ReportsController';
import { CostReportService } from './reports/service/CostReportService';
import { UtilizationReportService } from './reports/service/UtilizationReportService';
import { ErpExportService } from './reports/service/ErpExportService';
import { ReservationsByDepartmentService } from './reports/service/ReservationsByDepartmentService';
import { HealthController } from './shared/health/health.controller';
import { RabbitPublisherService } from './shared/events/rabbit.publisher';
import { CoreJwtModule } from './auth/jwt.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [PrismaModule, CoreJwtModule],
  controllers: [
    HealthController,
    DepartmentController,
    ResourceController,
    ReservationController,
    ReportsController,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    RabbitPublisherService,
    DepartmentService,
    ResourceService,
    ReservationService,
    CostReportService,
    UtilizationReportService,
    ErpExportService,
    ReservationsByDepartmentService,
  ],
})
export class AppModule {}
