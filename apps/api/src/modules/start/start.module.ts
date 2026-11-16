import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { CommentsModule } from '../comments/comments.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { FeedbackModule } from '../feedback/feedback.module.js';
import { ImpactModule } from '../impact/impact.module.js';
import { JbpModule } from '../jbp/jbp.module.js';
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
    PortfolioModule,
    JbpModule,
    ImpactModule,
    CommentsModule,
    FeedbackModule,
  ],
  controllers: [StartController],
  providers: [StartService],
})
export class StartModule {}
