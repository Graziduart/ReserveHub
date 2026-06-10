import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditJwtModule } from './auth/jwt.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { AuditController } from './audit/controller/audit.controller';
import { AuditEvent, AuditEventSchema } from './audit/schemas/audit-event.schema';
import { AuditIngestService } from './audit/service/audit-ingest.service';
import { RabbitConsumerService } from './audit/service/rabbit-consumer.service';
import { HealthController } from './shared/health/health.controller';

@Module({
  imports: [
    AuditJwtModule,
    MongooseModule.forRoot(
      process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/reservehub_audit',
    ),
    MongooseModule.forFeature([
      { name: AuditEvent.name, schema: AuditEventSchema },
    ]),
  ],
  controllers: [HealthController, AuditController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    AuditIngestService,
    RabbitConsumerService,
  ],
})
export class AppModule {}
