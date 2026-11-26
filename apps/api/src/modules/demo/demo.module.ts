import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module.js';
import { HintsModule } from '../hints/hints.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { OpportunitiesModule } from '../opportunities/opportunities.module.js';
import { TodayModule } from '../today/today.module.js';
import { DemoController } from './demo.controller.js';
import { DemoRegieController } from './demo-regie.controller.js';
import { DemoRegieService } from './demo-regie.service.js';

/**
 * DM-01: Demo-Mandant und Demo-Regie (K1-b, K1-g); Demo-Tokens kommen aus dem Auth-Modul. Die Regie
 * führt beim Vorrücken der Uhr die Läufe der anderen Module aus.
 */
@Module({
  imports: [AgentsModule, HintsModule, IntegrationsModule, OpportunitiesModule, TodayModule],
  controllers: [DemoController, DemoRegieController],
  providers: [DemoRegieService],
})
export class DemoModule {}
