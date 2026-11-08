import { Module } from '@nestjs/common';
import { ConsolidationService } from './consolidation.service.js';
import { RatingsController } from './ratings.controller.js';
import { RatingsService } from './ratings.service.js';

@Module({
  controllers: [RatingsController],
  providers: [RatingsService, ConsolidationService],
  exports: [RatingsService],
})
export class RatingsModule {}
