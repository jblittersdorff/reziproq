import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import {
  BuyerTouchpointsController,
  SupplierTouchpointsController,
} from './touchpoints.controller.js';
import { TouchpointsService } from './touchpoints.service.js';

/** Kontaktpunkte (PLB-06). Den Zyklus-Schritt trägt overview.module ein. */
@Module({
  imports: [CustomersModule],
  controllers: [BuyerTouchpointsController, SupplierTouchpointsController],
  providers: [TouchpointsService],
})
export class TouchpointsModule {}
