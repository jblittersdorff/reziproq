import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
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
import { MeetingBriefWorker } from './meeting-brief.worker.js';
import { MyAgentController } from './my-agent.controller.js';
import { MyAgentService } from './my-agent.service.js';

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
  controllers: [AgentsController, MyAgentController],
  providers: [
    AgentRunner,
    AgentTools,
    AgentsService,
    AgentsWorker,
    MeetingBriefWorker,
    MyAgentService,
  ],
})
export class AgentsModule {}
