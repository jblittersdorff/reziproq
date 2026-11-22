import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { JbpModule } from '../jbp/jbp.module.js';
import {
  OpportunitiesController,
  OpportunityOverviewController,
} from './opportunities.controller.js';
import { OpportunitiesService } from './opportunities.service.js';
import { OpportunitiesWorker } from './opportunities.worker.js';
import { OpportunityOverviewService } from './overview.service.js';

@Module({
  imports: [AiGatewayModule, JbpModule, ActionsModule],
  controllers: [OpportunitiesController, OpportunityOverviewController],
  providers: [OpportunitiesService, OpportunityOverviewService, OpportunitiesWorker],
})
export class OpportunitiesModule {}
