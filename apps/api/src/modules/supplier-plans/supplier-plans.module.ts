import { Module } from '@nestjs/common';
import { AiDraftsModule } from '../ai-drafts/ai-drafts.module.js';
import { EmailModule } from '../email/email.module.js';
import { PlanApprovalsService } from './plan-approvals.service.js';
import { PlanContributionsService } from './plan-contributions.service.js';
import { PlanSummaryDraftService } from './plan-summary-draft.service.js';
import { StrategicTopicsService } from './strategic-topics.service.js';
import {
  ObjectiveCategoriesController,
  PlanApprovalsController,
  PlanContributionsController,
  StrategicTopicsController,
  SupplierPlansController,
} from './supplier-plans.controller.js';
import { SupplierPlansService } from './supplier-plans.service.js';

@Module({
  imports: [AiDraftsModule, EmailModule],
  controllers: [
    SupplierPlansController,
    PlanApprovalsController,
    PlanContributionsController,
    StrategicTopicsController,
    ObjectiveCategoriesController,
  ],
  providers: [
    SupplierPlansService,
    PlanContributionsService,
    StrategicTopicsService,
    PlanApprovalsService,
    PlanSummaryDraftService,
  ],
  exports: [SupplierPlansService, PlanContributionsService, PlanApprovalsService],
})
export class SupplierPlansModule {}
