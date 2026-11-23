import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
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
import { OverviewInsightController, SupplierRingsController } from './insights.controller.js';
import { InsightsService } from './insights.service.js';
import { PortfolioService } from './portfolio.service.js';
import { SharingService } from './sharing.service.js';
import { ValidationService } from './validation.service.js';

/** GuV-Wirkung (PNL-01 ff.) und der Beleg der Auswertungen (AW-01). */
@Module({
  imports: [EmailModule, CustomersModule, AiGatewayModule],
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
    OverviewInsightController,
    SupplierRingsController,
  ],
  providers: [
    ImpactService,
    ValidationService,
    SharingService,
    PortfolioService,
    ExportService,
    InsightsService,
  ],
  exports: [ImpactService, ValidationService],
})
export class ImpactModule {}
