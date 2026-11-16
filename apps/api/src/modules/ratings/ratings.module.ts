import { Module } from '@nestjs/common';
import { AiDraftsModule } from '../ai-drafts/ai-drafts.module.js';
import { ConsolidationService } from './consolidation.service.js';
import { DeviationExplanationsService } from './deviation-explanations.service.js';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';

@Module({
  imports: [AiDraftsModule],
  controllers: [RatingsController],
  providers: [RatingsService, ConsolidationService, DeviationExplanationsService],
  exports: [RatingsService],
})
export class RatingsModule {}
