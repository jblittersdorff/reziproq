import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module.js';
import { EmailModule } from '../email/email.module.js';
import { ExportService } from './export.service.js';
import {
  BridgeController,
  CustomerBridgeController,
  CustomerImpactController,
  ImpactController,
  ImpactExportController,
  ImpactSharingController,
  PnlLinesController,
  PortfolioImpactController,
  ValidationController,
} from './impact.controller.js';
import { ImpactService } from './impact.service.js';
import { PortfolioService } from './portfolio.service.js';
import { SharingService } from './sharing.service.js';
import { ValidationService } from './validation.service.js';

/** GuV-Wirkung (PNL-01 ff.). */
@Module({
  imports: [EmailModule, CustomersModule],
  controllers: [
    ImpactController,
    ImpactSharingController,
    CustomerImpactController,
    BridgeController,
    CustomerBridgeController,
    PortfolioImpactController,
    ImpactExportController,
    PnlLinesController,
    ValidationController,
  ],
  providers: [ImpactService, ValidationService, SharingService, PortfolioService, ExportService],
  exports: [ImpactService, ValidationService],
})
export class ImpactModule {}
