import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import {
  BuyerActionsController,
  MyActionsController,
  SupplierActionsController,
} from './actions.controller.js';
import { ActionsService } from './actions.service.js';

/** Maßnahmen (QBR-03). Kennzahl und Live-Abschnitt tragen overview.module und meetings.module ein. */
@Module({
  imports: [CustomersModule],
  controllers: [BuyerActionsController, SupplierActionsController, MyActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
