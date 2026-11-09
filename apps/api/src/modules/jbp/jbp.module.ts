import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import {
  BuyerJbpController,
  BuyerJbpInitiativesController,
  BuyerJbpTopicsController,
  SupplierJbpController,
  SupplierJbpInitiativesController,
  SupplierJbpTopicsController,
} from './jbp.controller.js';
import { JbpService } from './jbp.service.js';
import { JbpInitiativesService } from './jbp-initiatives.service.js';
import { JbpTopicsService } from './jbp-topics.service.js';

/** Gemeinsamer Plan (JBP-01 ff.). */
@Module({
  imports: [CustomersModule],
  controllers: [
    BuyerJbpController,
    SupplierJbpController,
    BuyerJbpTopicsController,
    SupplierJbpTopicsController,
    BuyerJbpInitiativesController,
    SupplierJbpInitiativesController,
  ],
  providers: [JbpService, JbpTopicsService, JbpInitiativesService],
  exports: [JbpService],
})
export class JbpModule {}
