import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { ImportApiController } from './import-api.controller.js';
import { ImportApiQueue } from './import-api.queue.js';
import { ImportApiService } from './import-api.service.js';
import { ImportApiWorker } from './import-api.worker.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

/** KI-15 Import und Zuordnung (erweitert den Import aus PLT-07, Entscheidung F14); IN-07 Import-API. */
@Module({
  imports: [AiGatewayModule, SuppliersModule, IntegrationsModule],
  controllers: [ImportsController, ImportApiController],
  providers: [ImportsService, ImportApiService, ImportApiQueue, ImportApiWorker],
  exports: [ImportsService],
})
export class ImportsModule {}
