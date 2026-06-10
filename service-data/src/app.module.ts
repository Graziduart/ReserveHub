import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { DataJwtModule } from './auth/jwt.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { CardsController } from './cards/controller/cards.controller';
import {
  DashboardSummary,
  DashboardSummarySchema,
} from './cards/schemas/dashboard.schema';
import { DashboardService } from './cards/service/dashboard.service';
import { RabbitConsumerService } from './cards/service/rabbit-consumer.service';
import { HealthController } from './shared/health/health.controller';

@Module({
  imports: [
    DataJwtModule,
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/reservehub_data',
    ),
    MongooseModule.forFeature([
      { name: DashboardSummary.name, schema: DashboardSummarySchema },
    ]),
  ],
  controllers: [HealthController, CardsController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    DashboardService,
    RabbitConsumerService,
  ],
})
export class AppModule {}
