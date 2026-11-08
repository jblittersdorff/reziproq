import { Module } from '@nestjs/common';
import { ActionsModule } from '../actions/actions.module.js';
import { CustomersModule } from '../customers/customers.module.js';
import { OverviewModule } from '../overview/overview.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { SupplierPlansModule } from '../supplier-plans/supplier-plans.module.js';
import { StartController } from './start.controller.js';
import { StartService } from './start.service.js';

@Module({
  imports: [RatingsModule, OverviewModule, SupplierPlansModule, CustomersModule, ActionsModule],
  controllers: [StartController],
  providers: [StartService],
})
export class StartModule {}
