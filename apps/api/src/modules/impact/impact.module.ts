import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { EmailModule } from '../email/email.module.js';
import {
  CustomerImpactController,
  ImpactController,
  ImpactSharingController,
  PnlLinesController,
  ValidationController,
} from './impact.controller.js';
import { ImpactService } from './impact.service.js';
import { SharingService } from './sharing.service.js';
import { ValidationService } from './validation.service.js';

/** GuV-Wirkung (PNL-01 ff.). */
@Module({
  imports: [EmailModule, CustomersModule],
  controllers: [
    ImpactController,
    ImpactSharingController,
    CustomerImpactController,
    PnlLinesController,
    ValidationController,
  ],
  providers: [ImpactService, ValidationService, SharingService],
  exports: [ImpactService, ValidationService],
})
export class ImpactModule {}
