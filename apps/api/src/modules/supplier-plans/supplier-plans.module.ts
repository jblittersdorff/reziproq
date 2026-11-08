import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module.js';
import { PlanContributionsService } from './plan-contributions.service.js';
import {
  ObjectiveCategoriesController,
  PlanContributionsController,
  StrategicTopicsController,
  SupplierPlansController,
} from './supplier-plans.controller.js';
import { StrategicTopicsService } from './strategic-topics.service.js';
import { SupplierPlansService } from './supplier-plans.service.js';

@Module({
  imports: [EmailModule],
  controllers: [
    SupplierPlansController,
    PlanContributionsController,
    StrategicTopicsController,
    ObjectiveCategoriesController,
  ],
  providers: [SupplierPlansService, PlanContributionsService, StrategicTopicsService],
  exports: [PlanContributionsService],
})
export class SupplierPlansModule {}
