import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { BuyerJbpController, SupplierJbpController } from './jbp.controller.js';
import { JbpService } from './jbp.service.js';

/** Gemeinsamer Plan (JBP-01 ff.). */
@Module({
  imports: [CustomersModule],
  controllers: [BuyerJbpController, SupplierJbpController],
  providers: [JbpService],
  exports: [JbpService],
})
export class JbpModule {}
