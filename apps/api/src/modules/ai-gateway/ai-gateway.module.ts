import { Module } from '@nestjs/common';
import {
  AiSettingsController,
  AiUsageController,
  InsightReportController,
} from './ai-settings.controller.js';
import { InsightSummaryService } from './insight-summary.service.js';
import { ModelGateway } from './model-gateway.js';

@Module({
  controllers: [AiSettingsController, AiUsageController, InsightReportController],
  providers: [ModelGateway, InsightSummaryService],
  exports: [ModelGateway, InsightSummaryService],
})
export class AiGatewayModule {}
