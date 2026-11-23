import { Module } from '@nestjs/common';
import { AiDraftsModule } from '../ai-drafts/ai-drafts.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { RoundsModule } from '../rounds/rounds.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { AnalysisController } from './analysis.controller.js';
import { AnalysisService } from './analysis.service.js';
import { AssessmentController } from './assessment.controller.js';
import { AssessmentService } from './assessment.service.js';
import { MarketController } from './market.controller.js';
import { MarketService } from './market.service.js';
import { MaterialGroupsController } from './material-groups.controller.js';
import { MaterialGroupsService } from './material-groups.service.js';
import { ScorecardController } from './scorecard.controller.js';
import { ScorecardService } from './scorecard.service.js';
import { ScorecardWorker } from './scorecard.worker.js';
import { CategorySegmentationController } from './segmentation.controller.js';
import { CategorySegmentationService } from './segmentation.service.js';
import { StrategyController } from './strategy.controller.js';
import { StrategyService } from './strategy.service.js';

/** Warengruppenmanagement (Release 1.1): WG-01, WG-04, WG-06, WG-07, WG-09, WG-10, WG-12, WG-18 */
@Module({
  imports: [AiDraftsModule, RatingsModule, RoundsModule, SuppliersModule],
  // Strategie zuerst: feste Pfade wie /warengruppen/strategien vor /warengruppen/:id
  controllers: [
    StrategyController,
    AnalysisController,
    MarketController,
    AssessmentController,
    ScorecardController,
    CategorySegmentationController,
    MaterialGroupsController,
  ],
  providers: [
    MaterialGroupsService,
    StrategyService,
    AnalysisService,
    MarketService,
    AssessmentService,
    CategorySegmentationService,
    ScorecardService,
    ScorecardWorker,
  ],
  exports: [StrategyService],
})
export class MaterialGroupsModule {}
