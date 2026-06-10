import { Controller, Get } from '@nestjs/common';
import { Public } from '../../auth/public.decorator';

@Controller('health')
@Public()
export class HealthController {
  @Get()
  live() {
    return { ok: true, service: 'service-audit' };
  }
}
