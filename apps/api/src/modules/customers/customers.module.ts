import { Module } from '@nestjs/common';
import { AccountPlanController } from './account-plan.controller.js';
import { AccountPlanService } from './account-plan.service.js';
import { CustomersController } from './customers.controller.js';
import { CustomersService } from './customers.service.js';

@Module({
  controllers: [CustomersController, AccountPlanController],
  providers: [CustomersService, AccountPlanService],
  exports: [CustomersService],
})
export class CustomersModule {}
