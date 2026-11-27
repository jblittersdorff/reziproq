import { Module } from '@nestjs/common';
import { HintsModule } from '../hints/hints.module.js';
import { JbpModule } from '../jbp/jbp.module.js';
import { PortfolioModule } from '../portfolio/portfolio.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { AkteService } from './akte.service.js';
import { RelationshipsController } from './relationships.controller.js';
import { RelationshipsService } from './relationships.service.js';

/** BZ-01 (K2-b): Seite Lieferanten mit den Linsen Liste und Segmente; AK-01 (K2-c): Akte */
@Module({
  imports: [PortfolioModule, HintsModule, JbpModule, SuppliersModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService, AkteService],
})
export class RelationshipsModule {}
