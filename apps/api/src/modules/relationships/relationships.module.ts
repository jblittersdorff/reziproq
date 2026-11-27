import { Module } from '@nestjs/common';
import { HintsModule } from '../hints/hints.module.js';
import { PortfolioModule } from '../portfolio/portfolio.module.js';
import { RelationshipsController } from './relationships.controller.js';
import { RelationshipsService } from './relationships.service.js';

/** BZ-01 (K2-b): Seite Lieferanten mit den Linsen Liste und Segmente */
@Module({
  imports: [PortfolioModule, HintsModule],
  controllers: [RelationshipsController],
  providers: [RelationshipsService],
})
export class RelationshipsModule {}
