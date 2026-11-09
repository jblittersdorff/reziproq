import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { PlanApprovalsService } from './plan-approvals.service.js';
import { PlanContributionsService } from './plan-contributions.service.js';
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
  imports: [EmailModule],
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
  ],
  exports: [PlanContributionsService, PlanApprovalsService],
})
export class SupplierPlansModule {}
