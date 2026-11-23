import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

/** KI-15 Import und Zuordnung (erweitert den Import aus PLT-07, Entscheidung F14). */
@Module({
  imports: [AiGatewayModule, SuppliersModule],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
