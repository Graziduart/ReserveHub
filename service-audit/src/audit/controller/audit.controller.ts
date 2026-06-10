import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../auth/roles.decorator';
import { AuditIngestService } from '../service/audit-ingest.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditIngestService) {}

  @Get('events')
  @Roles('ADMIN', 'MANAGER')
  recent(
    @Query('limit') limit?: string,
    @Query('routingKey') routingKey?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('cursor') cursor?: string,
  ) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.audit.findRecent({
      limit: Number.isFinite(n) ? n : 50,
      routingKey: routingKey || undefined,
      from: from || undefined,
      to: to || undefined,
      cursor: cursor || undefined,
    });
  }
}
