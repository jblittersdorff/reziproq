import { ActionsModule } from '../actions/actions.module.js';
import { QbrPrepWorker } from './qbr-prep.worker.js';
import { Module } from '@nestjs/common';
import { ActivitiesModule } from '../activities/activities.module.js';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { MeetingsModule } from '../meetings/meetings.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { AgentRunner } from './agent-runner.js';
import { AgentTools } from './agent-tools.js';
import { AgentsController } from './agents.controller.js';
import { AgentsService } from './agents.service.js';
import { AgentsWorker } from './agents.worker.js';

@Module({
  imports: [
    ActionsModule,
    AiGatewayModule,
    MeetingsModule,
    ActivitiesModule,
    FeedbackModule,
    RatingsModule,
    SuppliersModule,
  ],
  controllers: [AgentsController],
  providers: [AgentRunner, AgentTools, AgentsService, AgentsWorker, QbrPrepWorker],
})
export class AgentsModule {}
