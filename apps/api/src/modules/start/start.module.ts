import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { CommentsModule } from '../comments/comments.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { ImpactModule } from '../impact/impact.module.js';
import { IntegrationsModule } from '../integrations/integrations.module.js';
import { OrganizationsModule } from '../organizations/organizations.module.js';
import { JbpModule } from '../jbp/jbp.module.js';
import { MaterialGroupsModule } from '../material-groups/material-groups.module.js';
import { OverviewModule } from '../overview/overview.module.js';
import { PortfolioModule } from '../portfolio/portfolio.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { SupplierPlansModule } from '../supplier-plans/supplier-plans.module.js';
import { StartController } from './start.controller.js';
import { StartService } from './start.service.js';

@Module({
  imports: [
    RatingsModule,
    OverviewModule,
    SupplierPlansModule,
    CustomersModule,
    ActionsModule,
    AiGatewayModule,
    PortfolioModule,
    JbpModule,
    ImpactModule,
    CommentsModule,
    FeedbackModule,
    MaterialGroupsModule,
    IntegrationsModule,
    OrganizationsModule,
  ],
  controllers: [StartController],
  providers: [StartService],
  exports: [StartService],
})
export class StartModule {}
