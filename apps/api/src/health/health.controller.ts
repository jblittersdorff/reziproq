import { Controller, Get } from '@nestjs/common';
import { type Database, sql } from '@reziproq/db';
import type { HealthResponse } from '@reziproq/shared';
import { InjectDatabase } from '../common/database.module.js';

@Controller('health')
export class HealthController {
  constructor(@InjectDatabase() private readonly db: Database) {}

  @Get()
  async check(): Promise<HealthResponse> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'degraded', database: 'down' };
    }
  }
}
