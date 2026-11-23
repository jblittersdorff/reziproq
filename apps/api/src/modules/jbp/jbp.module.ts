import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { EmailModule } from '../email/email.module.js';
import {
  BuyerJbpApprovalController,
  BuyerJbpCommitmentsController,
  BuyerJbpController,
  BuyerJbpInitiativesController,
  BuyerJbpScorecardController,
  BuyerJbpTopicsController,
  SupplierJbpApprovalController,
  SupplierJbpCommitmentsController,
  SupplierJbpController,
  SupplierJbpInitiativesController,
  SupplierJbpScorecardController,
  SupplierJbpTopicsController,
} from './jbp.controller.js';
import { JbpService } from './jbp.service.js';
import { JbpApprovalService } from './jbp-approval.service.js';
import { JbpCommitmentsService } from './jbp-commitments.service.js';
import { JbpInitiativesService } from './jbp-initiatives.service.js';
import { JbpScorecardService } from './jbp-scorecard.service.js';
import { JbpTopicsService } from './jbp-topics.service.js';
import { ScorecardSettingsController } from './scorecard-settings.controller.js';

/** Gemeinsamer Plan (JBP-01 ff.). */
@Module({
  imports: [AiGatewayModule, CustomersModule, ActionsModule, EmailModule],
  controllers: [
    BuyerJbpController,
    SupplierJbpController,
    BuyerJbpTopicsController,
    SupplierJbpTopicsController,
    BuyerJbpInitiativesController,
    SupplierJbpInitiativesController,
    BuyerJbpCommitmentsController,
    SupplierJbpCommitmentsController,
    BuyerJbpApprovalController,
    SupplierJbpApprovalController,
    BuyerJbpScorecardController,
    SupplierJbpScorecardController,
    ScorecardSettingsController,
  ],
  providers: [
    JbpService,
    JbpTopicsService,
    JbpInitiativesService,
    JbpCommitmentsService,
    JbpApprovalService,
    JbpScorecardService,
  ],
  exports: [
    JbpService,
    JbpTopicsService,
    JbpInitiativesService,
    JbpCommitmentsService,
    JbpApprovalService,
    JbpScorecardService,
  ],
})
export class JbpModule {}
