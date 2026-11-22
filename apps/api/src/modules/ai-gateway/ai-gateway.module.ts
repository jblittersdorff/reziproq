import { Module } from '@nestjs/common';
import { AiSettingsController, AiUsageController } from './ai-settings.controller.js';
import { ModelGateway } from './model-gateway.js';

@Module({
  controllers: [AiSettingsController, AiUsageController],
  providers: [ModelGateway],
  exports: [ModelGateway],
})
export class AiGatewayModule {}
