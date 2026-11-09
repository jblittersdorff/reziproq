import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { EmailModule } from '../email/email.module.js';
import {
  BuyerJbpApprovalController,
  BuyerJbpCommitmentsController,
  BuyerJbpController,
  BuyerJbpInitiativesController,
  BuyerJbpTopicsController,
  SupplierJbpApprovalController,
  SupplierJbpCommitmentsController,
  SupplierJbpController,
  SupplierJbpInitiativesController,
  SupplierJbpTopicsController,
} from './jbp.controller.js';
import { JbpService } from './jbp.service.js';
import { JbpApprovalService } from './jbp-approval.service.js';
import { JbpCommitmentsService } from './jbp-commitments.service.js';
import { JbpInitiativesService } from './jbp-initiatives.service.js';
import { JbpTopicsService } from './jbp-topics.service.js';

/** Gemeinsamer Plan (JBP-01 ff.). */
@Module({
  imports: [CustomersModule, ActionsModule, EmailModule],
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
  ],
  providers: [
    JbpService,
    JbpTopicsService,
    JbpInitiativesService,
    JbpCommitmentsService,
    JbpApprovalService,
  ],
  exports: [JbpService, JbpCommitmentsService, JbpApprovalService],
})
export class JbpModule {}
