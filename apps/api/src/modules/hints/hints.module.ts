import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { PortfolioModule } from '../portfolio/portfolio.module.js';
import { HintsController } from './hints.controller.js';
import { HintsService } from './hints.service.js';
import { HintsWorker } from './hints.worker.js';

/** Hinweise auf typische Fehler im Lieferantenmanagement (FS-01). */
@Module({
  imports: [PortfolioModule, AiGatewayModule],
  controllers: [HintsController],
  providers: [HintsService, HintsWorker],
  exports: [HintsService, HintsWorker],
})
export class HintsModule {}
