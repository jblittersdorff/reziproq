import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { OverviewModule } from '../overview/overview.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { SupplierPlansModule } from '../supplier-plans/supplier-plans.module.js';
import { StartController } from './start.controller.js';
import { StartService } from './start.service.js';

@Module({
  imports: [RatingsModule, OverviewModule, SupplierPlansModule, CustomersModule],
  controllers: [StartController],
  providers: [StartService],
})
export class StartModule {}
