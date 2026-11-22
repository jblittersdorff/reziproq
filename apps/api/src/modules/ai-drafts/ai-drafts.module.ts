import { Module } from '@nestjs/common';
import { AiGatewayModule } from '../ai-gateway/ai-gateway.module.js';
import { ModelGateway } from '../ai-gateway/model-gateway.js';
import { DRAFT_MODEL, GatewayDraftModel } from './draft-model.js';

@Module({
  imports: [AiGatewayModule],
  providers: [
    {
      provide: DRAFT_MODEL,
      inject: [ModelGateway],
      useFactory: (gateway: ModelGateway) => new GatewayDraftModel(gateway),
    },
  ],
  exports: [DRAFT_MODEL],
})
export class AiDraftsModule {}
