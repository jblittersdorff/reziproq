import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import {
  BuyerJbpCommitmentsController,
  BuyerJbpController,
  BuyerJbpInitiativesController,
  BuyerJbpTopicsController,
  SupplierJbpCommitmentsController,
  SupplierJbpController,
  SupplierJbpInitiativesController,
  SupplierJbpTopicsController,
} from './jbp.controller.js';
import { JbpService } from './jbp.service.js';
import { JbpCommitmentsService } from './jbp-commitments.service.js';
import { JbpInitiativesService } from './jbp-initiatives.service.js';
import { JbpTopicsService } from './jbp-topics.service.js';

/** Gemeinsamer Plan (JBP-01 ff.). */
@Module({
  imports: [CustomersModule, ActionsModule],
  controllers: [
    BuyerJbpController,
    SupplierJbpController,
    BuyerJbpTopicsController,
    SupplierJbpTopicsController,
    BuyerJbpInitiativesController,
    SupplierJbpInitiativesController,
    BuyerJbpCommitmentsController,
    SupplierJbpCommitmentsController,
  ],
  providers: [JbpService, JbpTopicsService, JbpInitiativesService, JbpCommitmentsService],
  exports: [JbpService, JbpCommitmentsService],
})
export class JbpModule {}
