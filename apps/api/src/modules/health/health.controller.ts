import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@reziproq/shared';
import { Public } from '../auth/public.decorator.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
