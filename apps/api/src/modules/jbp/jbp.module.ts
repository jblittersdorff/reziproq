import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import {
  BuyerJbpController,
  BuyerJbpTopicsController,
  SupplierJbpController,
  SupplierJbpTopicsController,
} from './jbp.controller.js';
import { JbpService } from './jbp.service.js';
import { JbpTopicsService } from './jbp-topics.service.js';

/** Gemeinsamer Plan (JBP-01 ff.). */
@Module({
  imports: [CustomersModule],
  controllers: [
    BuyerJbpController,
    SupplierJbpController,
    BuyerJbpTopicsController,
    SupplierJbpTopicsController,
  ],
  providers: [JbpService, JbpTopicsService],
  exports: [JbpService],
})
export class JbpModule {}
